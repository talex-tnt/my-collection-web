import {
  collection,
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  type QueryDocumentSnapshot,
  type DocumentData,
  type QueryConstraint,
  getCountFromServer,
  startAfter as fsStartAfter,
  limit as fsLimit,
  collectionGroup,
} from 'firebase/firestore';

import type {
  FirestoreBuilder,
  FirestoreTagTypes,
} from '../../types/firestoreBuilder';
import { createFirestoreApiError } from '../../errorLogger';
import { db } from '../../../../lib/firebase';
import {
  getUserCollectionPath,
  resolveDataCollectionPath,
} from '../../runtimeConfig';
import type { ImageFolder, ImagePreview } from '../../types/shared';
import { sanitizeFirestorePayload } from '../../utils';
export interface Item {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt?: string;
  description?: string;
  tags?: string[];
  metadata?: {
    imageFolder?: ImageFolder;
    previewImage?: ImagePreview;
  };
}

type ItemInput = Omit<Item, 'id' | 'createdAt' | 'updatedAt'> & {
  isPublicItem: boolean;
  collectionId?: string;
};
type ItemUpdate = Partial<Omit<Item, 'id' | 'createdAt'>>;

interface FirestoreItemDoc {
  name: string;
  nameLowercase: string;
  nameTokens: string[];
  userId: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  description?: string;
  tags?: string[];
  metadata?: {
    imageFolder?: ImageFolder;
    previewImage?: ImagePreview;
  };
}

export interface PaginationCursor {
  id: string;
  createdAt?: string;
  nameLowercase?: string;
}

const tokenizeName = (name: string): string[] =>
  Array.from(new Set(name.trim().toLowerCase().split(/\s+/).filter(Boolean)));

const mapItemDoc = (snapshot: QueryDocumentSnapshot<DocumentData>): Item => {
  const data = snapshot.data() as FirestoreItemDoc;

  return {
    id: snapshot.id,
    name: data.name,
    userId: data.userId,
    description: data.description,
    tags: data.tags || [],
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? '',
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.(),
    metadata: data.metadata,
  };
};

const getUserItemsEndpoints = (builder: FirestoreBuilder) => ({
  getAllUserItems: builder.query<
    {
      items: Item[];
      pageInfo: {
        endCursor: PaginationCursor | null;
        hasNextPage: boolean;
      };
    },
    {
      userId: string;
      isPublicItem: boolean;
      tags?: string[];
      startWithNameFilter?: string;
      nameContainsTokens?: string;
      limit?: number;
      startAfter?: PaginationCursor | null;
    }
  >({
    async queryFn({
      userId,
      isPublicItem,
      tags,
      startWithNameFilter,
      nameContainsTokens,
      limit,
      startAfter,
    }) {
      const resolvedVisibility = isPublicItem
        ? ('public' as const)
        : ('private' as const);

      const basePath = await resolveDataCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'users',
      });

      const baseConstraints: QueryConstraint[] = [];

      baseConstraints.push(where('userId', '==', userId));

      if (tags?.length) {
        baseConstraints.push(where('tags', 'array-contains-any', tags));
      }

      const prefix = startWithNameFilter?.trim().toLowerCase();

      if (prefix || nameContainsTokens) {
        if (nameContainsTokens) {
          const tokens = tokenizeName(nameContainsTokens);
          if (tokens.length) {
            baseConstraints.push(
              where('nameTokens', 'array-contains', tokens[0])
            );
          }
        }

        if (prefix) {
          baseConstraints.push(
            where('nameLowercase', '>=', prefix),
            where('nameLowercase', '<=', `${prefix}\uf8ff`),
            orderBy('nameLowercase')
          );
        } else {
          baseConstraints.push(orderBy('createdAt', 'desc'));
        }
      } else {
        baseConstraints.push(orderBy('createdAt', 'desc'));
      }

      baseConstraints.push(orderBy('__name__', 'asc'));

      if (startAfter) {
        baseConstraints.push(
          prefix
            ? fsStartAfter(startAfter.nameLowercase, startAfter.id)
            : fsStartAfter(
                Timestamp.fromDate(new Date(startAfter.createdAt!)),
                startAfter.id
              )
        );
      }

      const groupQuery = Number.isInteger(limit)
        ? query(
            collectionGroup(db, 'items'),
            ...baseConstraints,
            fsLimit((limit ?? 0) + 1)
          )
        : query(collectionGroup(db, 'items'), ...baseConstraints);

      try {
        const snapshot = await getDocs(groupQuery);

        const rawItems = snapshot.docs
          .filter((docSnapshot) => docSnapshot.ref.path.startsWith(basePath))
          .map(mapItemDoc);

        const hasNextPage = rawItems.length > (limit ?? rawItems.length);
        const pagedItems = hasNextPage ? rawItems.slice(0, limit) : rawItems;
        const last = pagedItems[pagedItems.length - 1];

        return {
          data: {
            items: pagedItems,
            pageInfo: {
              endCursor: last
                ? {
                    id: last.id,
                    createdAt: last.createdAt,
                    nameLowercase: last.name.toLowerCase(),
                  }
                : null,
              hasNextPage,
            },
          },
        };
      } catch (error) {
        return {
          error: createFirestoreApiError(
            {
              apiEndpoint: 'getAllItemsFromGroup',
              operation: 'QUERY',
              firebaseFunc: 'getDocs',
              path: `collectionGroup://items?root=${basePath}`,
            },
            error
          ),
        };
      }
    },

    providesTags: (result, _error, request) => {
      const tagType: FirestoreTagTypes = request.isPublicItem
        ? 'PublicUserItems'
        : 'PrivateUserItems';
      const listId = `${request.userId}_LIST`;

      return result && result.items
        ? [
            ...result.items.map(({ id }) => ({
              type: tagType,
              id,
            })),
            {
              type: tagType,
              id: listId,
            },
          ]
        : [
            {
              type: tagType,
              id: listId,
            },
          ];
    },
  }),
  getUserItems: builder.query<
    {
      items: Item[];
      pageInfo: {
        endCursor: PaginationCursor | null;
        hasNextPage: boolean;
      };
    },
    {
      userId: string;
      isPublicItem: boolean;
      tags?: string[];
      startWithNameFilter?: string;
      nameContainsTokens?: string;
      limit?: number;
      startAfter?: PaginationCursor | null;
      collectionId?: string;
    }
  >({
    async queryFn({
      userId,
      isPublicItem,
      tags,
      startWithNameFilter,
      nameContainsTokens,
      limit,
      startAfter,
      collectionId,
    }) {
      const resolvedVisibility = isPublicItem
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'items',
        userId,
        collectionId,
      });

      const baseConstraints: QueryConstraint[] = [];

      if (tags?.length) {
        baseConstraints.push(where('tags', 'array-contains-any', tags));
      }

      const prefix = startWithNameFilter?.trim().toLowerCase();

      // -------------------------
      // SEARCH MODE
      // -------------------------
      if (prefix || nameContainsTokens) {
        if (nameContainsTokens) {
          const tokens = tokenizeName(nameContainsTokens);

          if (tokens.length) {
            baseConstraints.push(
              where('nameTokens', 'array-contains', tokens[0])
            );
          }
        }

        if (prefix) {
          baseConstraints.push(
            where('nameLowercase', '>=', prefix),
            where('nameLowercase', '<=', `${prefix}\uf8ff`),
            orderBy('nameLowercase')
          );
        } else {
          baseConstraints.push(orderBy('createdAt', 'desc'));
        }
      } else {
        baseConstraints.push(orderBy('createdAt', 'desc'));
      }

      baseConstraints.push(orderBy('__name__', 'asc'));

      if (startAfter) {
        baseConstraints.push(
          prefix
            ? fsStartAfter(startAfter.nameLowercase, startAfter.id)
            : fsStartAfter(
                Timestamp.fromDate(new Date(startAfter.createdAt!)),
                startAfter.id
              )
        );
      }

      const pagedQuery = Number.isInteger(limit)
        ? query(
            collection(db, path),
            ...baseConstraints,
            fsLimit((limit ?? 0) + 1)
          )
        : query(collection(db, path), ...baseConstraints);

      try {
        const snapshot = await getDocs(pagedQuery);
        const rawItems = snapshot.docs.map(mapItemDoc);

        const hasNextPage = rawItems.length > (limit ?? rawItems.length);

        const pagedItems = hasNextPage ? rawItems.slice(0, limit) : rawItems;

        const last = pagedItems[pagedItems.length - 1];

        return {
          data: {
            items: pagedItems,
            pageInfo: {
              endCursor: last
                ? {
                    id: last.id,
                    createdAt: last.createdAt,
                    nameLowercase: last.name.toLowerCase(),
                  }
                : null,
              hasNextPage,
            },
          },
        };
      } catch (error) {
        return {
          error: createFirestoreApiError(
            {
              apiEndpoint: 'getUserItems',
              operation: 'QUERY',
              firebaseFunc: 'getDocs',
              path,
            },
            error
          ),
        };
      }
    },

    providesTags: (result, _error, request) => {
      const tagType: FirestoreTagTypes = request.isPublicItem
        ? 'PublicUserItems'
        : 'PrivateUserItems';
      const listId = `${request.userId}_LIST`;

      return result && result.items
        ? [
            ...result.items.map(({ id }) => ({
              type: tagType,
              id,
            })),
            {
              type: tagType,
              id: listId,
            },
          ]
        : [
            {
              type: tagType,
              id: listId,
            },
          ];
    },
  }),

  getUserItemsCount: builder.query<
    number,
    {
      userId: string;
      isPublicItem: boolean;
      tags?: string[];
      startWithNameFilter?: string;
      nameContainsTokens?: string;
      collectionId?: string;
    }
  >({
    async queryFn({
      userId,
      isPublicItem,
      tags,
      startWithNameFilter,
      nameContainsTokens,
      collectionId,
    }) {
      const resolvedVisibility = isPublicItem
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'items',
        userId,
        collectionId,
      });

      const baseConstraints: QueryConstraint[] = [];

      if (tags?.length) {
        baseConstraints.push(where('tags', 'array-contains-any', tags));
      }

      const prefix = startWithNameFilter?.trim().toLowerCase();

      if (prefix || nameContainsTokens) {
        if (nameContainsTokens) {
          const tokens = tokenizeName(nameContainsTokens);

          if (tokens.length) {
            baseConstraints.push(
              where('nameTokens', 'array-contains', tokens[0])
            );
          }
        }

        if (prefix) {
          baseConstraints.push(
            where('nameLowercase', '>=', prefix),
            where('nameLowercase', '<=', `${prefix}\uf8ff`)
          );
        }
      }

      const countQuery = query(collection(db, path), ...baseConstraints);

      const context = {
        apiEndpoint: 'getUserItemsCount',
        operation: 'QUERY' as const,
        firebaseFunc: 'getCountFromServer',
        path,
        requestPayload: {
          userId,
          tags,
          startWithNameFilter,
          nameContainsTokens,
        },
      };

      try {
        const snapshot = await getCountFromServer(countQuery);

        return {
          data: snapshot.data().count,
        };
      } catch (error) {
        return {
          error: createFirestoreApiError(context, error),
        };
      }
    },

    providesTags: (result, _error, request) => {
      const tagType: FirestoreTagTypes = request.isPublicItem
        ? 'PublicUserItems'
        : 'PrivateUserItems';
      return result !== undefined
        ? [
            {
              type: tagType,
              id: `${request.userId}_LIST`,
            },
          ]
        : [];
    },
  }),

  createUserItem: builder.mutation<Item, ItemInput>({
    async queryFn({ isPublicItem, collectionId, ...itemData }) {
      const resolvedVisibility = isPublicItem
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'items',
        userId: itemData.userId,
        collectionId,
      });

      const cleanData = sanitizeFirestorePayload(itemData);
      const requestPayload = {
        ...cleanData,
        nameLowercase: itemData.name.trim().toLowerCase(),
        nameTokens: tokenizeName(itemData.name),
        tags: itemData.tags || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const context = {
        apiEndpoint: 'createUserItem',
        operation: 'CREATE' as const,
        firebaseFunc: 'addDoc',
        path,
        requestPayload,
      };

      try {
        const docRef = await addDoc(collection(db, path), requestPayload);

        return {
          data: {
            id: docRef.id,
            ...itemData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };
      } catch (error) {
        return {
          error: createFirestoreApiError(context, error),
        };
      }
    },

    invalidatesTags: (_r, _e, { userId, isPublicItem }) => {
      const tagType: FirestoreTagTypes = isPublicItem
        ? 'PublicUserItems'
        : 'PrivateUserItems';
      return [
        {
          type: tagType,
          id: `${userId}_LIST`,
        },
      ];
    },
  }),

  updateUserItem: builder.mutation<
    void,
    {
      id: string;
      userId: string;
      isPublicItem: boolean;
      collectionId?: string;
      updates: ItemUpdate;
    }
  >({
    async queryFn({ id, userId, isPublicItem, collectionId, updates }) {
      const resolvedVisibility = isPublicItem
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'items',
        userId,
        collectionId,
      });

      const requestPayload = {
        ...updates,
        ...(updates.name
          ? {
              nameLowercase: updates.name.trim().toLowerCase(),
              nameTokens: tokenizeName(updates.name),
            }
          : {}),
        updatedAt: serverTimestamp(),
      };

      const context = {
        apiEndpoint: 'updateUserItem',
        operation: 'UPDATE' as const,
        firebaseFunc: 'setDoc',
        path,
        segmentPaths: [id],
        requestPayload,
      };
      try {
        await setDoc(doc(db, path, id), requestPayload, {
          merge: true,
        });

        return { data: undefined };
      } catch (error) {
        return {
          error: createFirestoreApiError(context, error),
        };
      }
    },

    invalidatesTags: (_r, _e, { id, userId, isPublicItem }) => {
      const tagType: FirestoreTagTypes = isPublicItem
        ? 'PublicUserItems'
        : 'PrivateUserItems';
      return [
        {
          type: tagType,
          id,
        },
        {
          type: tagType,
          id: `${userId}_LIST`,
        },
      ];
    },
  }),

  deleteUserItem: builder.mutation<
    void,
    { id: string; userId: string; isPublicItem: boolean; collectionId?: string }
  >({
    async queryFn({ id, userId, isPublicItem, collectionId }) {
      const resolvedVisibility = isPublicItem
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'items',
        userId,
        collectionId,
      });

      const context = {
        apiEndpoint: 'deleteUserItem',
        operation: 'DELETE' as const,
        firebaseFunc: 'deleteDoc',
        path,
        segmentPaths: [id],
      };
      try {
        await deleteDoc(doc(db, path, id));
        return { data: undefined };
      } catch (error) {
        return {
          error: createFirestoreApiError(context, error),
        };
      }
    },
    invalidatesTags: (_r, _e, { id, userId, isPublicItem }) => {
      const tagType: FirestoreTagTypes = isPublicItem
        ? 'PublicUserItems'
        : 'PrivateUserItems';
      return [
        {
          type: tagType,
          id,
        },
        {
          type: tagType,
          id: `${userId}_LIST`,
        },
      ];
    },
  }),
});

export default getUserItemsEndpoints;

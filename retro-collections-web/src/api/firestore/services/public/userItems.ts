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
} from 'firebase/firestore';

import type { FirestoreBuilder } from '../../types/firestoreBuilder';
import { createFirestoreApiError } from '../../errorLogger';
import { db } from '../../../../lib/firebase';
import { getUserCollectionPath } from '../../runtimeConfig';
import type { ImageFolder, ImagePreview } from '../../types/shared';

const visibility = 'public' as const;

export interface Item {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt?: string;
  description?: string;
  visibility?: {
    public: boolean;
  };
  tags?: string[];
  metadata?: {
    imageFolder?: ImageFolder;
    previewImage?: ImagePreview;
  };
}

type ItemInput = Omit<Item, 'id' | 'createdAt' | 'updatedAt'>;
type ItemUpdate = Partial<Omit<Item, 'id' | 'createdAt'>>;

interface FirestoreItemDoc {
  name: string;
  nameLowercase: string;
  nameTokens: string[];
  userId: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  description?: string;
  visibility?: {
    public: boolean;
  };
  tags?: string[];
  metadata?: {
    imageFolder?: ImageFolder;
    previewImage?: ImagePreview;
  };
}

interface PaginationCursor {
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
    visibility: data.visibility,
    tags: data.tags || [],
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? '',
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.(),
    metadata: data.metadata,
  };
};

const getPublicUserItemsEndpoints = (builder: FirestoreBuilder) => ({
  getPublicUserItems: builder.query<
    {
      items: Item[];
      pageInfo: {
        endCursor: PaginationCursor | null;
        hasNextPage: boolean;
      };
    },
    {
      userId: string;
      tags?: string[];
      startWithNameFilter?: string;
      nameContainsTokens?: string;
      isPublic?: boolean;
      limit?: number;
      startAfter?: PaginationCursor | null;
    }
  >({
    async queryFn({
      userId,
      tags,
      startWithNameFilter,
      nameContainsTokens,
      isPublic,
      limit,
      startAfter,
    }) {
      const path = await getUserCollectionPath({
        visibility,
        resourceType: 'items',
        userId,
      });

      const baseConstraints: QueryConstraint[] = [];

      if (tags?.length) {
        baseConstraints.push(where('tags', 'array-contains-any', tags));
      }

      if (isPublic !== undefined) {
        baseConstraints.push(where('visibility.public', '==', isPublic));
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
              apiEndpoint: 'getPublicUserItems',
              operation: 'QUERY',
              firebaseFunc: 'getDocs',
              path,
            },
            error
          ),
        };
      }
    },

    providesTags: (result, _error, request) =>
      result && result.items
        ? [
            ...result.items.map(({ id }) => ({
              type: 'PublicUserItems' as const,
              id,
            })),
            {
              type: 'PublicUserItems' as const,
              id: `${request.userId}_LIST`,
            },
          ]
        : [
            {
              type: 'PublicUserItems' as const,
              id: `${request.userId}_LIST`,
            },
          ],
  }),

  getPublicUserItemsCount: builder.query<
    number,
    {
      userId: string;
      tags?: string[];
      startWithNameFilter?: string;
      nameContainsTokens?: string;
      isPublic?: boolean;
    }
  >({
    async queryFn({
      userId,
      tags,
      startWithNameFilter,
      nameContainsTokens,
      isPublic,
    }) {
      const path = await getUserCollectionPath({
        visibility,
        resourceType: 'items',
        userId,
      });

      const baseConstraints: QueryConstraint[] = [];

      if (tags?.length) {
        baseConstraints.push(where('tags', 'array-contains-any', tags));
      }

      if (isPublic !== undefined) {
        baseConstraints.push(where('visibility.public', '==', isPublic));
      }

      const prefix = startWithNameFilter?.trim().toLowerCase();

      // Apply the same token / prefix filtering constraints
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
        apiEndpoint: 'getPublicUserItemsCount',
        operation: 'QUERY' as const,
        firebaseFunc: 'getCountFromServer',
        path,
        requestPayload: {
          userId,
          tags,
          startWithNameFilter,
          nameContainsTokens,
          isPublic,
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

    providesTags: (result, _error, request) =>
      result !== undefined
        ? [
            {
              type: 'PublicUserItems' as const,
              id: `${request.userId}_LIST`,
            },
          ]
        : [],
  }),

  createPublicUserItem: builder.mutation<Item, ItemInput>({
    async queryFn(itemData) {
      const path = await getUserCollectionPath({
        visibility,
        resourceType: 'items',
        userId: itemData.userId,
      });

      const requestPayload = {
        ...itemData,
        nameLowercase: itemData.name.trim().toLowerCase(),
        nameTokens: tokenizeName(itemData.name),
        tags: itemData.tags || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const context = {
        apiEndpoint: 'createPublicUserItem',
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

    invalidatesTags: (_r, _e, { userId }) => [
      {
        type: 'PublicUserItems' as const,
        id: `${userId}_LIST`,
      },
    ],
  }),

  updatePublicUserItem: builder.mutation<
    void,
    { id: string; userId: string; updates: ItemUpdate }
  >({
    async queryFn({ id, userId, updates }) {
      const path = await getUserCollectionPath({
        visibility,
        resourceType: 'items',
        userId,
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
        apiEndpoint: 'updatePublicUserItem',
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

    invalidatesTags: (_r, _e, { id, userId }) => [
      {
        type: 'PublicUserItems' as const,
        id,
      },
      {
        type: 'PublicUserItems' as const,
        id: `${userId}_LIST`,
      },
    ],
  }),

  deletePublicUserItem: builder.mutation<void, { id: string; userId: string }>({
    async queryFn({ id, userId }) {
      const path = await getUserCollectionPath({
        visibility,
        resourceType: 'items',
        userId,
      });

      const context = {
        apiEndpoint: 'deletePublicUserItem',
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
    invalidatesTags: (_r, _e, { id, userId }) => [
      {
        type: 'PublicUserItems' as const,
        id,
      },
      {
        type: 'PublicUserItems' as const,
        id: `${userId}_LIST`,
      },
    ],
  }),
});

export default getPublicUserItemsEndpoints;

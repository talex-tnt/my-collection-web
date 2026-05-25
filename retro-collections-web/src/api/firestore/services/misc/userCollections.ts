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

import type {
  FirestoreBuilder,
  FirestoreTagTypes,
} from '../../types/firestoreBuilder';
import { createFirestoreApiError } from '../../errorLogger';
import { db } from '../../../../lib/firebase';
import { getUserCollectionPath } from '../../runtimeConfig';
import type { ImageFolder, ImagePreview } from '../../types/shared';
import { sanitizeFirestorePayload } from '../../utils';

export interface Collection {
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

type CollectionInput = Omit<Collection, 'id' | 'createdAt' | 'updatedAt'> & {
  isPublicCollection: boolean;
};
type CollectionUpdate = Partial<Omit<Collection, 'id' | 'createdAt'>>;

interface FirestoreCollectionDoc {
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

interface PaginationCursor {
  id: string;
  createdAt?: string;
  nameLowercase?: string;
}

const tokenizeName = (name: string): string[] =>
  Array.from(new Set(name.trim().toLowerCase().split(/\s+/).filter(Boolean)));

const mapCollectionDoc = (
  snapshot: QueryDocumentSnapshot<DocumentData>
): Collection => {
  const data = snapshot.data() as FirestoreCollectionDoc;

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

const getUserCollectionsEndpoints = (builder: FirestoreBuilder) => ({
  getUserCollections: builder.query<
    {
      collections: Collection[];
      pageInfo: {
        endCursor: PaginationCursor | null;
        hasNextPage: boolean;
      };
    },
    {
      userId: string;
      isPublicCollection: boolean;
      tags?: string[];
      startWithNameFilter?: string;
      nameContainsTokens?: string;
      limit?: number;
      startAfter?: PaginationCursor | null;
    }
  >({
    async queryFn({
      userId,
      isPublicCollection,
      tags,
      startWithNameFilter,
      nameContainsTokens,
      limit,
      startAfter,
    }) {
      const resolvedVisibility = isPublicCollection
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'collections',
        userId,
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
        const rawCollections = snapshot.docs.map(mapCollectionDoc);

        const hasNextPage =
          rawCollections.length > (limit ?? rawCollections.length);

        const pagedCollections = hasNextPage
          ? rawCollections.slice(0, limit)
          : rawCollections;

        const last = pagedCollections[pagedCollections.length - 1];

        return {
          data: {
            collections: pagedCollections,
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
              apiEndpoint: 'getUserCollections',
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
      const tagType: FirestoreTagTypes = request.isPublicCollection
        ? 'PublicUserCollections'
        : 'PrivateUserCollections';
      const listId = `${request.userId}_LIST`;

      return result && result.collections
        ? [
            ...result.collections.map(({ id }) => ({
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

  getUserCollectionsCount: builder.query<
    number,
    {
      userId: string;
      isPublicCollection: boolean;
      tags?: string[];
      startWithNameFilter?: string;
      nameContainsTokens?: string;
    }
  >({
    async queryFn({
      userId,
      isPublicCollection,
      tags,
      startWithNameFilter,
      nameContainsTokens,
    }) {
      const resolvedVisibility = isPublicCollection
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'collections',
        userId,
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
        apiEndpoint: 'getUserCollectionsCount',
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
      const tagType: FirestoreTagTypes = request.isPublicCollection
        ? 'PublicUserCollections'
        : 'PrivateUserCollections';
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

  createUserCollection: builder.mutation<Collection, CollectionInput>({
    async queryFn({ isPublicCollection, ...collectionData }) {
      const resolvedVisibility = isPublicCollection
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'collections',
        userId: collectionData.userId,
      });

      const cleanData = sanitizeFirestorePayload(collectionData);
      const requestPayload = {
        ...cleanData,
        nameLowercase: collectionData.name.trim().toLowerCase(),
        nameTokens: tokenizeName(collectionData.name),
        tags: collectionData.tags || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const context = {
        apiEndpoint: 'createUserCollection',
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
            ...collectionData,
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

    invalidatesTags: (_r, _e, { userId, isPublicCollection }) => {
      const tagType: FirestoreTagTypes = isPublicCollection
        ? 'PublicUserCollections'
        : 'PrivateUserCollections';
      return [
        {
          type: tagType,
          id: `${userId}_LIST`,
        },
      ];
    },
  }),

  updateUserCollection: builder.mutation<
    void,
    {
      id: string;
      userId: string;
      isPublicCollection: boolean;
      updates: CollectionUpdate;
    }
  >({
    async queryFn({ id, userId, isPublicCollection, updates }) {
      const resolvedVisibility = isPublicCollection
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'collections',
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
        apiEndpoint: 'updateUserCollection',
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

    invalidatesTags: (_r, _e, { id, userId, isPublicCollection }) => {
      const tagType: FirestoreTagTypes = isPublicCollection
        ? 'PublicUserCollections'
        : 'PrivateUserCollections';
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

  deleteUserCollection: builder.mutation<
    void,
    { id: string; userId: string; isPublicCollection: boolean }
  >({
    async queryFn({ id, userId, isPublicCollection }) {
      const resolvedVisibility = isPublicCollection
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'collections',
        userId,
      });

      const context = {
        apiEndpoint: 'deleteUserCollection',
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
    invalidatesTags: (_r, _e, { id, userId, isPublicCollection }) => {
      const tagType: FirestoreTagTypes = isPublicCollection
        ? 'PublicUserCollections'
        : 'PrivateUserCollections';
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

export default getUserCollectionsEndpoints;

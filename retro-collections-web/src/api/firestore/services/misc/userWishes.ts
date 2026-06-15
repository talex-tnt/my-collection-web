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
  writeBatch,
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

export interface Wish {
  id: string;
  name: string;
  userId: string;
  wishlistId?: string;
  createdAt: string;
  updatedAt?: string;
  description?: string;
  tags?: string[];
  metadata?: {
    imageFolder?: ImageFolder;
    previewImage?: ImagePreview;
  };
  isPublic: boolean;
}

type WishInput = Omit<Wish, 'id' | 'createdAt' | 'updatedAt'> & {
  isPublicWish: boolean;
  wishlistId?: string;
};
type WishUpdate = Partial<Omit<Wish, 'id' | 'createdAt'>>;

interface FirestoreWishDoc {
  name: string;
  nameLowercase: string;
  nameTokens: string[];
  userId: string;
  wishlistId?: string;
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
  updatedAt?: string;
  nameLowercase?: string;
}

const tokenizeName = (name: string): string[] =>
  Array.from(new Set(name.trim().toLowerCase().split(/\s+/).filter(Boolean)));

const mapWishDoc = (snapshot: QueryDocumentSnapshot<DocumentData>): Wish => {
  const data = snapshot.data() as FirestoreWishDoc;

  return {
    id: snapshot.id,
    name: data.name,
    userId: data.userId,
    wishlistId: data?.wishlistId,
    description: data.description,
    tags: data.tags || [],
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? '',
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.(),
    metadata: data.metadata,
    isPublic: snapshot.ref.path.includes('/public/'),
  };
};

const getUserWishesEndpoints = (builder: FirestoreBuilder) => ({
  getAllUserWishes: builder.query<
    {
      wishes: Wish[];
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
      limit?: number;
      startAfter?: PaginationCursor | null;
      sortBy?: 'createdAt' | 'updatedAt' | 'name'; // Added dynamic sortBy parameter
    }
  >({
    async queryFn({
      userId,
      tags,
      startWithNameFilter,
      nameContainsTokens,
      limit,
      startAfter,
      sortBy = 'updatedAt', // Defaults to 'updatedAt' as requested
    }) {
      const baseConstraints: QueryConstraint[] = [];

      // 1. Enforce global scoping boundaries by binding the query to a specific user
      baseConstraints.push(where('userId', '==', userId));

      // 2. Apply array filters for tags if present
      if (tags?.length) {
        baseConstraints.push(where('tags', 'array-contains-any', tags));
      }

      const prefix = startWithNameFilter?.trim().toLowerCase();

      // 3. Handle partial string token matching
      if (nameContainsTokens) {
        const tokens = tokenizeName(nameContainsTokens);
        if (tokens.length) {
          baseConstraints.push(
            where('nameTokens', 'array-contains', tokens[0])
          );
        }
      }

      // 4. Handle Sorting & Range Constraints (The critical Firestore rule)
      if (prefix) {
        // FIRESTORE RULE: If you use a range filter (>=, <=), your primary orderBy
        // MUST be on that exact same field. We cannot sort by date here.
        baseConstraints.push(
          where('nameLowercase', '>=', prefix),
          where('nameLowercase', '<=', `${prefix}\uf8ff`),
          orderBy('nameLowercase', 'asc')
        );
      } else {
        // If there is no prefix range filter, apply the requested dynamic sorting strategy
        if (sortBy === 'name') {
          baseConstraints.push(orderBy('nameLowercase', 'asc'));
        } else if (sortBy === 'createdAt') {
          baseConstraints.push(orderBy('createdAt', 'desc'));
        } else {
          // Fallback default: 'updatedAt'
          baseConstraints.push(orderBy('updatedAt', 'desc'));
        }
      }

      // 5. Tie-breaker sorting field required for deterministic pagination cursors
      baseConstraints.push(orderBy('__name__', 'asc'));

      // 6. Map and apply the cursor variables for pagination matching the active index structure
      if (startAfter) {
        if (prefix || sortBy === 'name') {
          baseConstraints.push(
            fsStartAfter(startAfter.nameLowercase, startAfter.id)
          );
        } else if (sortBy === 'createdAt') {
          baseConstraints.push(
            fsStartAfter(
              Timestamp.fromDate(new Date(startAfter.createdAt!)),
              startAfter.id
            )
          );
        } else {
          // Dynamic matching pagination cursor for 'updatedAt'
          baseConstraints.push(
            fsStartAfter(
              Timestamp.fromDate(new Date(startAfter.updatedAt!)),
              startAfter.id
            )
          );
        }
      }

      // 7. Compile the query constraints into a Collection Group execution reference
      const groupQuery = Number.isInteger(limit)
        ? query(
            collectionGroup(db, 'whishes'),
            ...baseConstraints,
            fsLimit((limit ?? 0) + 1)
          )
        : query(collectionGroup(db, 'whishes'), ...baseConstraints);

      try {
        const snapshot = await getDocs(groupQuery);

        const rawItems = snapshot.docs.map(mapWishDoc);

        const hasNextPage = rawItems.length > (limit ?? rawItems.length);
        const pagedItems = hasNextPage ? rawItems.slice(0, limit) : rawItems;
        const last = pagedItems[pagedItems.length - 1];

        return {
          data: {
            wishes: pagedItems,
            pageInfo: {
              endCursor: last
                ? {
                    id: last.id,
                    createdAt: last.createdAt,
                    updatedAt: last.updatedAt, // Pass down to preserve cursor values
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
              apiEndpoint: 'getAllWishesFromGroup',
              operation: 'QUERY',
              firebaseFunc: 'getDocs',
              path: `collectionGroup://whishes`,
            },
            error
          ),
        };
      }
    },
    providesTags: (result, _error, request) => {
      const tagType: FirestoreTagTypes = 'UserWishes';
      const listId = `${request.userId}_LIST`;
      return result && result.wishes
        ? [
            ...result.wishes.map(({ id }) => ({
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

  getAllUserWishesCount: builder.query<
    number,
    {
      userId: string;
      tags?: string[];
      startWithNameFilter?: string;
      nameContainsTokens?: string;
    }
  >({
    async queryFn({ userId, tags, startWithNameFilter, nameContainsTokens }) {
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
            where('nameLowercase', '<=', `${prefix}\uf8ff`)
          );
        }
      }

      const countQuery = query(
        collectionGroup(db, 'whishes'),
        ...baseConstraints
      );

      const context = {
        apiEndpoint: 'getAllUserWishesCount',
        operation: 'QUERY' as const,
        firebaseFunc: 'getCountFromServer',
        path: `collectionGroup://whishes`,
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
      const tagType: FirestoreTagTypes = 'UserWishes';
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

  getUserWishes: builder.query<
    {
      wishes: Wish[];
      pageInfo: {
        endCursor: PaginationCursor | null;
        hasNextPage: boolean;
      };
    },
    {
      userId: string;
      isPublicWish: boolean;
      tags?: string[];
      startWithNameFilter?: string;
      nameContainsTokens?: string;
      limit?: number;
      startAfter?: PaginationCursor | null;
      wishlistId?: string;
      sortBy?: 'createdAt' | 'updatedAt' | 'name';
    }
  >({
    async queryFn({
      userId,
      isPublicWish,
      tags,
      startWithNameFilter,
      nameContainsTokens,
      limit,
      startAfter,
      wishlistId,
      sortBy = 'updatedAt',
    }) {
      const resolvedVisibility = isPublicWish
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'whishes',
        userId,
        wishlistId,
      });

      const baseConstraints: QueryConstraint[] = [];

      // FIX 1: Removed baseConstraints.push(where('userId', '==', userId));
      // Shallow collection queries implicitly validate ownership through the subcollection path.

      // 2. Apply array filters for tags if present
      if (tags?.length) {
        baseConstraints.push(where('tags', 'array-contains-any', tags));
      }

      const prefix = startWithNameFilter?.trim().toLowerCase();

      // 3. Handle partial string token matching
      if (nameContainsTokens) {
        const tokens = tokenizeName(nameContainsTokens);
        if (tokens.length) {
          baseConstraints.push(
            where('nameTokens', 'array-contains', tokens[0])
          );
        }
      }

      // 4. Handle Sorting & Range Constraints (The critical Firestore rule)
      if (prefix) {
        baseConstraints.push(
          where('nameLowercase', '>=', prefix),
          where('nameLowercase', '<=', `${prefix}\uf8ff`),
          orderBy('nameLowercase', 'asc')
        );
      } else {
        if (sortBy === 'name') {
          baseConstraints.push(orderBy('nameLowercase', 'asc'));
        } else if (sortBy === 'createdAt') {
          baseConstraints.push(orderBy('createdAt', 'desc'));
        } else {
          baseConstraints.push(orderBy('updatedAt', 'desc'));
        }
      }

      // 5. Tie-breaker sorting field required for deterministic pagination cursors
      baseConstraints.push(orderBy('__name__', 'asc'));

      // FIX 2: Correctly match cursor parameters to the active sorting key sequence
      if (startAfter) {
        if (prefix || sortBy === 'name') {
          baseConstraints.push(
            fsStartAfter(startAfter.nameLowercase, startAfter.id)
          );
        } else if (sortBy === 'createdAt') {
          baseConstraints.push(
            fsStartAfter(
              Timestamp.fromDate(new Date(startAfter.createdAt!)),
              startAfter.id
            )
          );
        } else {
          baseConstraints.push(
            fsStartAfter(
              Timestamp.fromDate(new Date(startAfter.updatedAt!)),
              startAfter.id
            )
          );
        }
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
        const rawItems = snapshot.docs.map(mapWishDoc);

        const hasNextPage = rawItems.length > (limit ?? rawItems.length);
        const pagedItems = hasNextPage ? rawItems.slice(0, limit) : rawItems;
        const last = pagedItems[pagedItems.length - 1];

        return {
          data: {
            wishes: pagedItems,
            pageInfo: {
              endCursor: last
                ? {
                    id: last.id,
                    createdAt: last.createdAt,
                    updatedAt: last.updatedAt, // Pass down to preserve cursor values
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
              apiEndpoint: 'getUserWishes',
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
      const tagType: FirestoreTagTypes = request.isPublicWish
        ? 'PublicUserWishes'
        : 'PrivateUserWishes';
      const listId = `${request.userId}_LIST`;

      return result && result.wishes
        ? [
            ...result.wishes.map(({ id }) => ({
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

  getUserWishesCount: builder.query<
    number,
    {
      userId: string;
      isPublicWish: boolean;
      tags?: string[];
      startWithNameFilter?: string;
      nameContainsTokens?: string;
      wishlistId?: string;
    }
  >({
    async queryFn({
      userId,
      isPublicWish,
      tags,
      startWithNameFilter,
      nameContainsTokens,
      wishlistId,
    }) {
      const resolvedVisibility = isPublicWish
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'whishes',
        userId,
        wishlistId,
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
        apiEndpoint: 'getUserWishesCount',
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
      const tagType: FirestoreTagTypes = request.isPublicWish
        ? 'PublicUserWishes'
        : 'PrivateUserWishes';
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

  createUserWish: builder.mutation<Wish, WishInput>({
    async queryFn({ isPublicWish, wishlistId, ...itemData }) {
      const resolvedVisibility = isPublicWish
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'whishes',
        userId: itemData.userId,
        wishlistId,
      });

      const cleanData = sanitizeFirestorePayload(itemData);
      const requestPayload = {
        ...cleanData,
        nameLowercase: itemData.name.trim().toLowerCase(),
        nameTokens: tokenizeName(itemData.name),
        tags: itemData.tags || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(wishlistId ? { wishlistId } : {}),
      };

      const context = {
        apiEndpoint: 'createUserWish',
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
            wishlistId,
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

    invalidatesTags: (_r, _e, { userId, isPublicWish }) => {
      const tagType: FirestoreTagTypes = isPublicWish
        ? 'PublicUserWishes'
        : 'PrivateUserWishes';
      return [
        {
          type: 'UserWishes',
          id: `${userId}_LIST`,
        },
        {
          type: tagType,
          id: `${userId}_LIST`,
        },
      ];
    },
  }),

  updateUserWish: builder.mutation<
    void,
    {
      id: string;
      userId: string;
      isPublicWish: boolean;
      wishlistId?: string;
      updates: WishUpdate;
    }
  >({
    async queryFn({ id, userId, isPublicWish, wishlistId, updates }) {
      const resolvedVisibility = isPublicWish
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'whishes',
        userId,
        wishlistId,
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
        apiEndpoint: 'updateUserWish',
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

    invalidatesTags: (_r, _e, { id, userId, isPublicWish }) => {
      const tagType: FirestoreTagTypes = isPublicWish
        ? 'PublicUserWishes'
        : 'PrivateUserWishes';
      return [
        {
          type: 'UserWishes',
          id,
        },
        {
          type: 'UserWishes',
          id: `${userId}_LIST`,
        },
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

  deleteUserWish: builder.mutation<
    void,
    { id: string; userId: string; isPublicWish: boolean; wishlistId?: string }
  >({
    async queryFn({ id, userId, isPublicWish, wishlistId }) {
      const resolvedVisibility = isPublicWish
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'whishes',
        userId,
        wishlistId,
      });

      const context = {
        apiEndpoint: 'deleteUserWish',
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
    invalidatesTags: (_r, _e, { id, userId, isPublicWish }) => {
      const tagType: FirestoreTagTypes = isPublicWish
        ? 'PublicUserWishes'
        : 'PrivateUserWishes';
      return [
        {
          type: 'UserWishes',
          id,
        },
        {
          type: 'UserWishes',
          id: `${userId}_LIST`,
        },
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

  batchDeleteUserWishes: builder.mutation<
    { deletedCount: number; batchesCommitted: number },
    {
      itemIds: string[];
      userId: string;
      isPublicWish: boolean;
      wishlistId?: string;
    }
  >({
    async queryFn({ itemIds, userId, isPublicWish, wishlistId }) {
      if (!itemIds || itemIds.length === 0) {
        return { data: { deletedCount: 0, batchesCommitted: 0 } };
      }

      const resolvedVisibility = isPublicWish
        ? ('public' as const)
        : ('private' as const);

      // 1. Resolve the correct path to the wishes subcollection
      const subcollectionPath = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'whishes',
        userId,
        wishlistId,
      });

      const context = {
        apiEndpoint: 'batchDeleteUserWishes',
        operation: 'DELETE' as const,
        firebaseFunc: 'writeBatch',
        path: subcollectionPath,
        requestPayload: { itemIds },
      };

      try {
        const CHUNK_SIZE = 400;
        let deletedCount = 0;
        let batchesCommitted = 0;

        for (let i = 0; i < itemIds.length; i += CHUNK_SIZE) {
          const chunk = itemIds.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);

          chunk.forEach((id) => {
            const docRef = doc(db, subcollectionPath, id);
            batch.delete(docRef);
            deletedCount++;
          });

          await batch.commit();
          batchesCommitted++;
        }

        return { data: { deletedCount, batchesCommitted } };
      } catch (error) {
        return {
          error: createFirestoreApiError(context, error),
        };
      }
    },
    invalidatesTags: (_result, _error, request) => {
      const tagType: FirestoreTagTypes = request.isPublicWish
        ? 'PublicUserWishes'
        : 'PrivateUserWishes';

      const itemTags = request.itemIds.map((id) => ({
        type: 'UserWishes' as FirestoreTagTypes,
        id,
      }));

      const auxiliaryTags = request.itemIds.map((id) => ({
        type: tagType,
        id,
      }));

      return [
        ...itemTags,
        ...auxiliaryTags,
        {
          type: 'UserWishes',
          id: `${request.userId}_LIST`,
        },
        {
          type: tagType,
          id: `${request.userId}_LIST`,
        },
      ];
    },
  }),

  injectWishlistIdIntoWishes: builder.mutation<
    { updatedCount: number; batchesCommitted: number },
    { userId: string; isPublicWish: boolean; wishlistId: string }
  >({
    async queryFn({ userId, isPublicWish, wishlistId }) {
      const resolvedVisibility = isPublicWish
        ? ('public' as const)
        : ('private' as const);

      // 1. Resolve the correct path to the wishes subcollection
      const subcollectionPath = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'whishes',
        userId,
        wishlistId,
      });

      const itemsRef = collection(db, subcollectionPath);

      const context = {
        apiEndpoint: 'injectWishlistIdIntoWishes',
        operation: 'UPDATE' as const,
        firebaseFunc: 'writeBatch',
        path: subcollectionPath,
      };

      try {
        // 2. Fetch all documents currently inside this subcollection
        const snapshot = await getDocs(itemsRef);

        if (snapshot.empty) {
          return { data: { updatedCount: 0, batchesCommitted: 0 } };
        }

        const docs = snapshot.docs;
        const totalDocs = docs.length;

        // Define a safe chunk size (Firestore max limit is 500)
        const CHUNK_SIZE = 400;
        let updatedCount = 0;
        let batchesCommitted = 0;

        // 3. Loop through documents in chunks of 400
        for (let i = 0; i < totalDocs; i += CHUNK_SIZE) {
          const chunk = docs.slice(i, i + CHUNK_SIZE);
          const batch = writeBatch(db);

          chunk.forEach((docSnapshot) => {
            const docRef = doc(db, subcollectionPath, docSnapshot.id);

            // Queue a merge update adding the wishlistId and updating timestamp
            batch.set(
              docRef,
              {
                wishlistId,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );

            updatedCount++;
          });

          // 4. Commit each chunked batch sequentially
          await batch.commit();
          batchesCommitted++;
        }

        return { data: { updatedCount, batchesCommitted } };
      } catch (error) {
        return {
          error: createFirestoreApiError(context, error),
        };
      }
    },
    invalidatesTags: (_result, _error, request) => {
      const tagType: FirestoreTagTypes = request.isPublicWish
        ? 'PublicUserWishes'
        : 'PrivateUserWishes';
      return [
        {
          type: tagType,
          id: `${request.userId}_LIST`,
        },
        {
          type: 'UserWishes',
          id: `${request.userId}_LIST`,
        },
      ];
    },
  }),
});

export default getUserWishesEndpoints;

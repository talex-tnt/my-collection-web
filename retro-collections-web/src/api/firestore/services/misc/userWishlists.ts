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
  getDoc,
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

export interface Wishlist {
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

type WishlistInput = Omit<Wishlist, 'id' | 'createdAt' | 'updatedAt'> & {
  isPublicWishlist: boolean;
};
type WishlistUpdate = Partial<Omit<Wishlist, 'id' | 'createdAt'>>;

interface FirestoreWishlistDoc {
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

const mapWishlistDoc = (
  snapshot: QueryDocumentSnapshot<DocumentData>
): Wishlist => {
  const data = snapshot.data() as FirestoreWishlistDoc;

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

const getUserWishlistsEndpoints = (builder: FirestoreBuilder) => ({
  getUserWishlist: builder.query<
    Wishlist,
    { id: string; userId: string; isPublicWishlist: boolean }
  >({
    async queryFn({ id, userId, isPublicWishlist }) {
      const resolvedVisibility = isPublicWishlist
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'wishlists',
        userId,
      });

      const context = {
        apiEndpoint: 'getWishlist',
        operation: 'QUERY' as const,
        firebaseFunc: 'getDoc',
        path,
        segmentPaths: [id],
      };

      try {
        const docRef = doc(db, path, id);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) {
          throw new Error(`Wishlist with id ${id} does not exist.`);
        }

        const wishlistData = mapWishlistDoc(snapshot);

        return { data: wishlistData };
      } catch (error) {
        return {
          error: createFirestoreApiError(context, error),
        };
      }
    },

    providesTags: (_result, _error, request) => {
      const tagType: FirestoreTagTypes = request.isPublicWishlist
        ? 'PublicUserWishlists'
        : 'PrivateUserWishlists';
      return [
        {
          type: tagType,
          id: request.id,
        },
      ];
    },
  }),
  getUserWishlists: builder.query<
    {
      wishlists: Wishlist[];
      pageInfo: {
        endCursor: PaginationCursor | null;
        hasNextPage: boolean;
      };
    },
    {
      userId: string;
      isPublicWishlist: boolean;
      tags?: string[];
      startWithNameFilter?: string;
      nameContainsTokens?: string;
      limit?: number;
      startAfter?: PaginationCursor | null;
    }
  >({
    async queryFn({
      userId,
      isPublicWishlist,
      tags,
      startWithNameFilter,
      nameContainsTokens,
      limit,
      startAfter,
    }) {
      const resolvedVisibility = isPublicWishlist
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'wishlists',
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
        const rawCollections = snapshot.docs.map(mapWishlistDoc);

        const hasNextPage =
          rawCollections.length > (limit ?? rawCollections.length);

        const pagedCollections = hasNextPage
          ? rawCollections.slice(0, limit)
          : rawCollections;

        const last = pagedCollections[pagedCollections.length - 1];

        return {
          data: {
            wishlists: pagedCollections,
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
              apiEndpoint: 'getUserWishlists',
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
      const tagType: FirestoreTagTypes = request.isPublicWishlist
        ? 'PublicUserWishlists'
        : 'PrivateUserWishlists';
      const listId = `${request.userId}_LIST`;

      return result && result.wishlists
        ? [
            ...result.wishlists.map(({ id }) => ({
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

  getUserWishlistsCount: builder.query<
    number,
    {
      userId: string;
      isPublicWishlist: boolean;
      tags?: string[];
      startWithNameFilter?: string;
      nameContainsTokens?: string;
    }
  >({
    async queryFn({
      userId,
      isPublicWishlist,
      tags,
      startWithNameFilter,
      nameContainsTokens,
    }) {
      const resolvedVisibility = isPublicWishlist
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'wishlists',
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
        apiEndpoint: 'getUserWishlistsCount',
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
      const tagType: FirestoreTagTypes = request.isPublicWishlist
        ? 'PublicUserWishlists'
        : 'PrivateUserWishlists';
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

  createUserWishlist: builder.mutation<Wishlist, WishlistInput>({
    async queryFn({ isPublicWishlist, ...wishlistData }) {
      const resolvedVisibility = isPublicWishlist
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'wishlists',
        userId: wishlistData.userId,
      });

      const cleanData = sanitizeFirestorePayload(wishlistData);
      const requestPayload = {
        ...cleanData,
        nameLowercase: wishlistData.name.trim().toLowerCase(),
        nameTokens: tokenizeName(wishlistData.name),
        tags: wishlistData.tags || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const context = {
        apiEndpoint: 'createUserWishlist',
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
            ...wishlistData,
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

    invalidatesTags: (_r, _e, { userId, isPublicWishlist }) => {
      const tagType: FirestoreTagTypes = isPublicWishlist
        ? 'PublicUserWishlists'
        : 'PrivateUserWishlists';
      return [
        {
          type: tagType,
          id: `${userId}_LIST`,
        },
      ];
    },
  }),

  updateUserWishlist: builder.mutation<
    void,
    {
      id: string;
      userId: string;
      isPublicWishlist: boolean;
      updates: WishlistUpdate;
    }
  >({
    async queryFn({ id, userId, isPublicWishlist, updates }) {
      const resolvedVisibility = isPublicWishlist
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'wishlists',
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
        apiEndpoint: 'updateUserWishlist',
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

    invalidatesTags: (_r, _e, { id, userId, isPublicWishlist }) => {
      const tagType: FirestoreTagTypes = isPublicWishlist
        ? 'PublicUserWishlists'
        : 'PrivateUserWishlists';
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

  deleteUserWishlist: builder.mutation<
    void,
    { id: string; userId: string; isPublicWishlist: boolean }
  >({
    async queryFn({ id, userId, isPublicWishlist }) {
      const resolvedVisibility = isPublicWishlist
        ? ('public' as const)
        : ('private' as const);

      const path = await getUserCollectionPath({
        visibility: resolvedVisibility,
        resourceType: 'wishlists',
        userId,
      });

      const context = {
        apiEndpoint: 'deleteUserWishlist',
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
    invalidatesTags: (_r, _e, { id, userId, isPublicWishlist }) => {
      const tagType: FirestoreTagTypes = isPublicWishlist
        ? 'PublicUserWishlists'
        : 'PrivateUserWishlists';
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

export default getUserWishlistsEndpoints;

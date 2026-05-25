import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import type { FirestoreApiError } from './errorLogger';

import getRuntimeConfigEndpoints from './services/runtime-config';
import getUserItemsEndpoints from './services/misc/userItems';
import getUserCollectionsEndpoints from './services/misc/userCollections';
import getUsersEndpoints from './services/public/users';
import getAuthorizedUsersEndpoints from './services/private/authorized-users';
import getPrivateUsersEndpoints from './services/private/users';
import getPublicUserTagsEndpoints from './services/public/userTags';
import getWikipediaSettingsEndpoints from './services/private/wikipediaSettings';
import getRawgSettingsEndpoints from './services/private/rawgSettings';
import { FIRESTORE_TAG_TYPES } from './types/firestoreBuilder';
export const firestoreApi = createApi({
  reducerPath: 'firestoreApi',

  baseQuery: fakeBaseQuery<FirestoreApiError>(),

  tagTypes: FIRESTORE_TAG_TYPES,

  endpoints: (builder) => ({
    ...getRuntimeConfigEndpoints(builder),
    ...getUserItemsEndpoints(builder),
    ...getUserCollectionsEndpoints(builder),
    ...getPublicUserTagsEndpoints(builder),
    ...getUsersEndpoints(builder),
    ...getPrivateUsersEndpoints(builder),
    ...getAuthorizedUsersEndpoints(builder),
    ...getWikipediaSettingsEndpoints(builder),
    ...getRawgSettingsEndpoints(builder),
  }),
});

export const {
  useGetRuntimeConfigQuery,

  useGetUserItemsQuery,
  useGetUserItemsCountQuery,
  useCreateUserItemMutation,
  useUpdateUserItemMutation,
  useDeleteUserItemMutation,

  useGetUserCollectionsQuery,
  useGetUserCollectionQuery,
  useCreateUserCollectionMutation,
  useUpdateUserCollectionMutation,
  useDeleteUserCollectionMutation,

  useGetUsersQuery,
  useGetPublicUsersQuery,
  useGetPrivateUsersQuery,
  useGetUserByIdQuery,
  useGetPrivateUserByIdQuery,
  useLazyIsUserAuthorizedQuery,
  useCreateOrUpdateUserMutation,
  useCreateOrUpdatePrivateUserMutation,
  useSetUserVisibilityMutation,

  useIsUserAuthorizedQuery,
  useGetAuthorizedUsersQuery,
  useAddAuthorizedUserMutation,
  useRemoveAuthorizedUserMutation,
  useGetPublicUserTagsQuery,
  useCreatePublicUserTagMutation,
  useDeletePublicUserTagMutation,
  useUpdatePublicUserTagMutation,

  // Settings
  useGetWikipediaSettingsQuery,
  useUpdateWikipediaSettingsMutation,
  useGetRawgSettingsQuery,
  useUpdateRawgSettingsMutation,
} = firestoreApi;

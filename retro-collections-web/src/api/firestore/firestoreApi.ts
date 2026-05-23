import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import type { FirestoreApiError } from './errorLogger';

import getRuntimeConfigEndpoints from './services/runtime-config';
import getPublicUserItemsEndpoints from './services/public/userItems';
import getUsersEndpoints from './services/public/users';
import getAuthorizedUsersEndpoints from './services/private/authorized-users';
import getPrivateUsersEndpoints from './services/private/users';
import getPublicUserTagsEndpoints from './services/public/userTags';
import getWikipediaSettingsEndpoints from './services/private/wikipediaSettings';

export const firestoreApi = createApi({
  reducerPath: 'firestoreApi',

  baseQuery: fakeBaseQuery<FirestoreApiError>(),

  tagTypes: [
    'PublicUserItems',
    'PublicUsers',
    'PrivateUsers',
    'PrivateAuthorizedUsers',
  ],

  endpoints: (builder) => ({
    ...getRuntimeConfigEndpoints(builder),
    ...getPublicUserItemsEndpoints(builder),
    ...getPublicUserTagsEndpoints(builder),
    ...getUsersEndpoints(builder),
    ...getPrivateUsersEndpoints(builder),
    ...getAuthorizedUsersEndpoints(builder),
    ...getWikipediaSettingsEndpoints(builder),
  }),
});

export const {
  useGetRuntimeConfigQuery,

  useGetPublicUserItemsQuery,
  useGetPublicUserItemsCountQuery,
  useCreatePublicUserItemMutation,
  useUpdatePublicUserItemMutation,
  useDeletePublicUserItemMutation,

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
} = firestoreApi;

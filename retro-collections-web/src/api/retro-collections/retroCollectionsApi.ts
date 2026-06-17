import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getAuth } from 'firebase/auth';

// --- Existing Types ---
export type ManageUserArgs = {
  uidToManage?: string;
  emailToManage?: string;
  enable: boolean;
};

export type CustomClaims = {
  admin?: boolean;
  [key: string]: boolean | undefined;
};

export type ManageUserResponse = {
  success: boolean;
  message: string;
  uid: string;
  claims?: CustomClaims;
};

export type DriveProxyArgs = {
  fileId: string;
};

export type DriveProxyResponse = {
  success: boolean;
  imageUrl?: string;
};

// --- Access Request Types ---
export type RequestUserAccessArgs = {
  message?: string;
};

export type RequestUserAccessResponse = {
  message: string;
};

// 1. Core API base path resolved directly from build-time environment variables
const baseUrl = import.meta.env.VITE_RETRO_COLLECTIONS_BASEURL;

export const retroCollectionsApi = createApi({
  reducerPath: 'retroCollectionsApi',
  baseQuery: async (args, api, extraOptions) => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      console.error('No authenticated user found');
      throw new Error('User not authenticated');
    }

    const token = await currentUser.getIdToken();
    const baseQueryPayload = (tk: string) => ({
      baseUrl,
      prepareHeaders: (headers: Headers) => {
        // 2. Clear authorization handling without downstream environment flags
        headers.set('Authorization', `Bearer ${tk}`);
        return headers;
      },
    });
    const base = fetchBaseQuery(baseQueryPayload(token));

    const result = await base(args, api, extraOptions);

    if (result.error?.status === 401) {
      const newToken = await currentUser.getIdToken(true); // Force token refresh
      const base = fetchBaseQuery(baseQueryPayload(newToken));
      return await base(args, api, extraOptions);
    }
    return result;
  },
  endpoints: (builder) => ({
    manageUserClaims: builder.mutation<ManageUserResponse, ManageUserArgs>({
      query: ({ uidToManage, emailToManage, enable }) => ({
        url: '/manage-user',
        method: enable ? 'POST' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          uidToManage,
          emailToManage,
        },
      }),
      transformResponse: (response: ManageUserResponse): ManageUserResponse => {
        console.log('Manage User API response:', response);
        return response;
      },
    }),

    getDriveImage: builder.query<DriveProxyResponse, DriveProxyArgs>({
      query: ({ fileId }) => ({
        url: '/drive-proxy',
        method: 'GET',
        params: {
          id: fileId, // Aligned to map to the 'id' parameter expected by your backend query extractor
        },
      }),
      transformResponse: (response: DriveProxyResponse): DriveProxyResponse => {
        console.log('Drive Proxy API response:', response);
        return response;
      },
    }),

    requestUserAccess: builder.mutation<
      RequestUserAccessResponse,
      RequestUserAccessArgs
    >({
      query: ({ message }) => ({
        url: '/request-user-access',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          message,
        },
      }),
      transformResponse: (
        response: RequestUserAccessResponse
      ): RequestUserAccessResponse => {
        console.log('Request User Access API response:', response);
        return response;
      },
    }),
  }),
});

export const {
  useManageUserClaimsMutation,
  useGetDriveImageQuery,
  useRequestUserAccessMutation,
} = retroCollectionsApi;

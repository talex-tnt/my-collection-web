import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getAuth } from 'firebase/auth';
import type { ImageFolder, ImagePreview } from '../firestore/types/shared';

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

export type ApproveUserAccessArgs = {
  uidToManage?: string;
  emailToManage?: string;
};

export type ApproveUserAccessResponse = {
  message: string;
  uid: string;
  email: string;
  pendingRequestRemoved: boolean;
};

export type PublicItemsCursor = {
  id: string;
  docPath?: string;
  createdAt?: string;
  updatedAt?: string;
  nameLowercase?: string;
};

export type PublicItem = {
  id: string;
  name: string;
  userId: string;
  collectionId?: string;
  createdAt: string;
  updatedAt?: string;
  description?: string;
  tags?: string[];
  metadata?: {
    imageFolder?: ImageFolder;
    previewImage?: ImagePreview;
  };
  isPublic: boolean;
};

export type GetPublicItemsArgs = {
  userId: string;
  tags?: string[];
  startWithNameFilter?: string;
  nameContainsTokens?: string;
  limit?: number;
  startAfter?: PublicItemsCursor | null;
  sortBy?: 'createdAt' | 'updatedAt' | 'name';
};

export type GetPublicItemsResponse = {
  items: PublicItem[];
  totalCount: number;
  pageInfo: {
    endCursor: PublicItemsCursor | null;
    hasNextPage: boolean;
  };
};

// --- AI Image Analyzer Types ---
export type AnalyzeArgs = {
  parentFolderId: string;
  images: File[];
  optionalTags?: string[];
  driveToken: string;
};

export type AnalyzeResponse = {
  suggestedTitle: string;
  descriptionEn: string;
  productTags: string[];
};

// --- New Create and Upload Target Directory Types ---
export type CreateAndUploadArgs = {
  parentFolderId: string;
  newFolderName: string;
  images: File[];
  driveToken: string;
};

export type CreateAndUploadResponse = {
  folderId: string;
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
        url: 'manage-user',
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
        url: 'drive-proxy',
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
        url: 'request-user-access',
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

    approveUserAccess: builder.mutation<
      ApproveUserAccessResponse,
      ApproveUserAccessArgs
    >({
      query: ({ uidToManage, emailToManage }) => ({
        url: 'approve-user-access',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          uidToManage,
          emailToManage,
        },
      }),
      transformResponse: (
        response: ApproveUserAccessResponse
      ): ApproveUserAccessResponse => {
        console.log('Approve User Access API response:', response);
        return response;
      },
    }),

    getPublicItems: builder.query<GetPublicItemsResponse, GetPublicItemsArgs>({
      query: ({
        userId,
        tags,
        startWithNameFilter,
        nameContainsTokens,
        limit,
        startAfter,
        sortBy,
      }) => ({
        url: 'get-public-items',
        method: 'GET',
        params: {
          userId,
          tags: tags?.join(','),
          startWithNameFilter,
          nameContainsTokens,
          limit,
          sortBy,
          startAfter: startAfter ? JSON.stringify(startAfter) : undefined,
        },
      }),
    }),

    analyzeProductImages: builder.mutation<AnalyzeResponse, AnalyzeArgs>({
      query: ({ parentFolderId, images, optionalTags, driveToken }) => {
        const formData = new FormData();
        formData.append('parentFolderId', parentFolderId);
        images.forEach((img) => formData.append('images', img));

        if (optionalTags && optionalTags.length > 0) {
          formData.append('optionalTags', optionalTags.join(','));
        }

        return {
          url: 'analyze-item-github-ai', // Routes relative to your Vercel VITE_RETRO_COLLECTIONS_BASEURL context
          method: 'POST',
          headers: {
            'X-Drive-Token': driveToken, // Injects your Google token into headers alongside the Firebase standard Bearer token
          },
          body: formData, // Automatically processes content-type headers for FormData payloads
        };
      },
    }),

    createAndUploadFolder: builder.mutation<
      CreateAndUploadResponse,
      CreateAndUploadArgs
    >({
      query: ({ parentFolderId, newFolderName, images, driveToken }) => {
        const formData = new FormData();
        formData.append('parentFolderId', parentFolderId);
        formData.append('newFolderName', newFolderName);
        images.forEach((img) => formData.append('images', img));

        return {
          url: 'create-and-upload', // Pointing directly to your new native backend endpoint routing context
          method: 'POST',
          headers: {
            'X-Drive-Token': driveToken,
          },
          body: formData,
        };
      },
    }),
  }),
});

export const {
  useManageUserClaimsMutation,
  useGetDriveImageQuery,
  useRequestUserAccessMutation,
  useApproveUserAccessMutation,
  useGetPublicItemsQuery,
  useAnalyzeProductImagesMutation,
  useCreateAndUploadFolderMutation,
} = retroCollectionsApi;

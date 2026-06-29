import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import {
  clearDriveToken,
  getDriveToken,
  requestDriveToken,
} from './googleDriveAuth';

type ListFilesArgs = {
  folderId?: string;
  query?: string;
};
type ListFilesResponse = {
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    thumbnailLink?: string;
    parents?: string[];
  }>;
};
type GetFileResponse = {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  parents?: string[];
};
type GetFileDownloadResponse = Blob;

export const driveApi = createApi({
  reducerPath: 'driveApi',
  keepUnusedDataFor: 60 * 60, // 1h cache

  refetchOnFocus: false,
  refetchOnReconnect: false,

  baseQuery: async (args, api, extraOptions) => {
    let token = getDriveToken();
    if (!token) {
      token = await requestDriveToken();
    }

    const base = fetchBaseQuery({
      baseUrl: 'https://www.googleapis.com/drive/v3',
      prepareHeaders: (headers) => {
        headers.set('Authorization', `Bearer ${token}`);
        return headers;
      },
    });

    const result = await base(args, api, extraOptions);

    if (result.error?.status === 401) {
      clearDriveToken();
      const newToken = await requestDriveToken();
      return fetchBaseQuery({
        baseUrl: 'https://www.googleapis.com/drive/v3',
        prepareHeaders: (headers) => {
          headers.set('Authorization', `Bearer ${newToken}`);
          return headers;
        },
      })(args, api, extraOptions);
    }
    return result;
  },
  endpoints: (builder) => ({
    listFiles: builder.query<ListFilesResponse, ListFilesArgs>({
      query: ({ folderId, query }) => ({
        url: '/files',
        params: {
          q:
            query ??
            (folderId
              ? `'${folderId}' in parents and trashed = false`
              : "'root' in parents and trashed = false"),
          fields:
            'files(id,name,mimeType,modifiedTime,thumbnailLink,webContentLink,parents)',
        },
      }),
    }),

    getFile: builder.query<GetFileResponse, string>({
      query: (fileId) => ({
        url: `/files/${fileId}`,
        params: {
          fields: 'id,name,mimeType,thumbnailLink,parents',
        },
      }),
    }),

    getFileDownload: builder.query<GetFileDownloadResponse, string>({
      query: (fileId) => ({
        url: `/files/${fileId}`,
        params: {
          alt: 'media',
        },
        responseHandler: async (response: Response) => response.blob(),
      }),
    }),
    getFileText: builder.query<string, string>({
      query: (fileId) => ({
        url: `/files/${fileId}`,
        params: {
          alt: 'media',
        },
        responseHandler: async (response: Response) => response.text(),
      }),
    }),
  }),
});

export const {
  useListFilesQuery,
  useGetFileQuery,
  useGetFileDownloadQuery,
  useLazyListFilesQuery,
  useLazyGetFileDownloadQuery,
  useLazyGetFileTextQuery,
} = driveApi;

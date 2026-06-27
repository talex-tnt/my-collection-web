import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import {
  clearDriveWriteToken,
  getDriveWriteToken,
  requestDriveWriteToken,
} from './googleDriveAuthWrite';

export type CreateAndUploadArgs = {
  parentFolderId: string;
  newFolderName: string;
  images: File[];
};

export type CreateAndUploadResponse = {
  folderId: string;
  files: { id: string; name: string }[];
};

export type CreateDriveFolderArgs = {
  parentFolderId: string;
  folderName: string;
};

export type CreateDriveFolderResponse = {
  id: string;
  name: string;
};

export type UploadFileToFolderArgs = {
  folderId: string;
  file: File;
  fileName?: string;
};

export type UploadFileToFolderResponse = {
  id: string;
  name: string;
};

export type RenameDriveNodeArgs = {
  id: string;
  name: string;
};

export type RenameDriveNodeResponse = {
  id: string;
  name: string;
};

export type DeleteDriveNodeArgs = {
  id: string;
};

export type DeleteDriveNodeResponse = {
  success: boolean;
};

export const driveWriteApi = createApi({
  reducerPath: 'driveWriteApi',
  keepUnusedDataFor: 60 * 60, // 1h cache
  refetchOnFocus: false,
  refetchOnReconnect: false,
  tagTypes: ['DriveFolders'],

  baseQuery: async (args, api, extraOptions) => {
    let token = getDriveWriteToken();
    if (!token) {
      token = await requestDriveWriteToken();
    }

    const base = fetchBaseQuery({
      baseUrl: 'https://www.googleapis.com',
      prepareHeaders: (headers) => {
        headers.set('Authorization', `Bearer ${token}`);
        return headers;
      },
    });

    const result = await base(args, api, extraOptions);

    if (result.error?.status === 401) {
      clearDriveWriteToken();
      const newToken = await requestDriveWriteToken();
      return fetchBaseQuery({
        baseUrl: 'https://www.googleapis.com',
        prepareHeaders: (headers) => {
          headers.set('Authorization', `Bearer ${newToken}`);
          return headers;
        },
      })(args, api, extraOptions);
    }
    return result;
  },

  endpoints: (builder) => ({
    createDriveFolder: builder.mutation<
      CreateDriveFolderResponse,
      CreateDriveFolderArgs
    >({
      query: ({ parentFolderId, folderName }) => ({
        url: '/drive/v3/files',
        method: 'POST',
        body: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId],
        },
        params: {
          fields: 'id,name',
        },
      }),
      invalidatesTags: ['DriveFolders'],
    }),

    uploadFileToFolder: builder.mutation<
      UploadFileToFolderResponse,
      UploadFileToFolderArgs
    >({
      queryFn: async (
        { folderId, file, fileName },
        _api,
        _extra,
        baseQuery
      ) => {
        const finalFileName = fileName || file.name;
        const metadata = {
          name: finalFileName,
          parents: [folderId],
        };

        const formData = new FormData();
        formData.append(
          'metadata',
          new Blob([JSON.stringify(metadata)], { type: 'application/json' })
        );
        formData.append('file', file);

        const uploadResult = await baseQuery({
          url: '/upload/drive/v3/files?uploadType=multipart&fields=id,name',
          method: 'POST',
          body: formData,
        });

        if (uploadResult.error) {
          return { error: uploadResult.error };
        }

        const data = uploadResult.data as UploadFileToFolderResponse;
        return { data };
      },
      invalidatesTags: ['DriveFolders'],
    }),

    renameDriveNode: builder.mutation<
      RenameDriveNodeResponse,
      RenameDriveNodeArgs
    >({
      query: ({ id, name }) => ({
        url: `/drive/v3/files/${id}`,
        method: 'PATCH',
        body: { name },
        params: {
          fields: 'id,name',
        },
      }),
      invalidatesTags: ['DriveFolders'],
    }),

    deleteDriveNode: builder.mutation<
      DeleteDriveNodeResponse,
      DeleteDriveNodeArgs
    >({
      queryFn: async ({ id }, _api, _extra, baseQuery) => {
        const result = await baseQuery({
          url: `/drive/v3/files/${id}`,
          method: 'DELETE',
        });

        if (result.error) {
          return { error: result.error };
        }

        return { data: { success: true } };
      },
      invalidatesTags: ['DriveFolders'],
    }),

    createAndUploadFolder: builder.mutation<
      CreateAndUploadResponse,
      CreateAndUploadArgs
    >({
      queryFn: async (
        { parentFolderId, newFolderName, images },
        _api,
        _extraOptions,
        baseQuery
      ) => {
        try {
          // 1. Create the new target folder in Google Drive
          const folderMetadata = {
            name: newFolderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId],
          };

          const folderResult = await baseQuery({
            url: '/drive/v3/files',
            method: 'POST',
            body: folderMetadata,
          });

          if (folderResult.error) {
            return { error: folderResult.error };
          }

          const folderData = folderResult.data as { id: string };
          const createdFolderId = folderData.id;

          // 2. Upload images using standard browser FormData
          const uploadedFiles = await Promise.all(
            images.map(async (file, index) => {
              const extension = file.name.split('.').pop() || 'jpeg';

              // 1. Enforce sequential naming logic sequentially
              let finalFileName: string;

              if (index === 0) {
                // First image is always the Preview file
                finalFileName = `Preview.${extension}`;
              } else {
                // Subsequent images become IMG_001, IMG_002, etc. (index is padded to 3 digits)
                const fileNumber = String(index).padStart(3, '0');
                finalFileName = `IMG_${fileNumber}.${extension}`;
              }

              // Build the native metadata configuration block
              const fileMetadata = {
                name: finalFileName,
                parents: [createdFolderId],
              };

              // Map properties using multi-part Form payloads natively handled by the browser
              const formData = new FormData();
              formData.append(
                'metadata',
                new Blob([JSON.stringify(fileMetadata)], {
                  type: 'application/json',
                })
              );
              formData.append('file', file);

              const uploadResult = await baseQuery({
                url: '/upload/drive/v3/files?uploadType=multipart&fields=id,name',
                method: 'POST',
                body: formData,
              });

              if (uploadResult.error) {
                throw uploadResult.error;
              }

              const fileData = uploadResult.data as {
                id: string;
                name: string;
              };
              return {
                id: fileData.id,
                name: fileData.name,
              };
            })
          );

          return {
            data: {
              folderId: createdFolderId,
              files: uploadedFiles,
            },
          };
        } catch (error: { message?: string } | unknown) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error:
                (error as { message?: string })?.message ||
                'Client-side multi-part image upload task execution failed.',
              data: error,
            },
          };
        }
      },
      invalidatesTags: ['DriveFolders'],
    }),
  }),
});

export const {
  useCreateAndUploadFolderMutation,
  useCreateDriveFolderMutation,
  useUploadFileToFolderMutation,
  useRenameDriveNodeMutation,
  useDeleteDriveNodeMutation,
} = driveWriteApi;

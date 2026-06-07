import { useState } from 'react';
import {
  useLazyListFilesQuery,
  useLazyGetFileTextQuery,
} from '../api/google-drive/googleDriveApi'; // Adjusted to your file placement
import { findPreviewImage } from '../utils/findPreviewImage';
import type { FolderType, FileType } from '../api/firestore/types/shared';

export interface JSONItem {
  title: string;
  platform: string;
  serial_code: string;
  folderName: string;
}

export interface PreparedImportItem {
  name: string;
  description: string;
  metadata: {
    imageFolder: FolderType | Record<string, never>;
    previewImage: FileType | Record<string, never>;
  };
}

export const useDriveImport = () => {
  const [triggerListFiles] = useLazyListFilesQuery();
  const [triggerDownloadFile] = useLazyGetFileTextQuery();

  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [preparedItems, setPreparedItems] = useState<PreparedImportItem[]>([]);

  const analyzeFolder = async (_rootFolderId: string, allFiles: FileType[]) => {
    setIsLoadingAnalysis(true);
    setError(null);
    setPreparedItems([]);

    try {
      // 1. Locate the JSON file matching new-items-*.json
      const jsonFile = allFiles.find(
        (f) => f?.name?.startsWith('new-items-') && f?.name?.endsWith('.json')
      );

      if (!jsonFile) {
        throw new Error(
          "No 'new-items-*.json' file found in the selected folder."
        );
      }

      if (!jsonFile.id) {
        throw new Error('The identified JSON file does not have a valid ID.');
      }
      // 2. Fetch the JSON payload using your authenticated RTK query handler
      const fileText = await triggerDownloadFile(jsonFile.id).unwrap();
      const jsonParsed: JSONItem[] = JSON.parse(fileText);

      // 3. Collect asset subdirectories present in this folder level
      const subFolders = allFiles.filter(
        (f) => f.mimeType === 'application/vnd.google-apps.folder'
      );

      const itemsToImport: PreparedImportItem[] = [];

      // 4. Resolve sub-assets sequentially using your custom findPreviewImage logic
      for (const entry of jsonParsed) {
        const matchedFolder = subFolders.find(
          (f) => f?.name?.toLowerCase() === entry?.folderName?.toLowerCase()
        );

        let previewImageObj: FileType | Record<string, never> = {};
        let folderMeta: FolderType | Record<string, never> = {};

        if (matchedFolder) {
          folderMeta = { id: matchedFolder.id, name: matchedFolder.name };

          const folderContent = await triggerListFiles({
            folderId: matchedFolder.id,
          }).unwrap();
          if (folderContent?.files) {
            // Mapping RTK query signature properties directly into your local FileType parameters safely
            const convertedFiles: FileType[] = folderContent.files.map(
              (file) => ({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                thumbnailLink: file.thumbnailLink,
              })
            );

            const previewImage = findPreviewImage(convertedFiles);
            if (previewImage?.thumbnailLink) {
              previewImageObj = previewImage;
            }
          }
        }
        const descriptionParts = [];
        if (entry.platform)
          descriptionParts.push(`Platform: ${entry.platform}`);
        if (entry.serial_code)
          descriptionParts.push(`Serial: ${entry.serial_code}`);
        const description = descriptionParts.join('\n');
        itemsToImport.push({
          name: entry.title,
          description,

          metadata: {
            imageFolder: folderMeta,
            previewImage: previewImageObj,
          },
        });
      }

      setPreparedItems(itemsToImport);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'An error occurred during folder analysis.';
      setError(errorMessage);
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  return {
    analyzeFolder,
    preparedItems,
    isLoadingAnalysis,
    error,
    setPreparedItems,
  };
};

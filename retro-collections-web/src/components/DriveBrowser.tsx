import { useEffect, useState } from 'react';
import {
  useGetFileQuery,
  useListFilesQuery,
} from '../api/google-drive/googleDriveApi';
import DriveImage from './DriveImage';
import type { FileType, FolderType } from '../api/firestore/types/shared';
import { useDisableScroll } from '../utils/hooks';
import {
  FiArrowUp as ArrowUp,
  FiArrowUpCircle as ArrowUpCicle,
  FiFolder as FolderIcon,
} from 'react-icons/fi';

type DriveBrowserProps = {
  onSelectFolder: (data: { folder: FolderType; files: FileType[] }) => void;
  selectedFolder?: FolderType;
  disableScroll?: boolean;
};

const DriveBrowser = ({
  onSelectFolder,
  selectedFolder,
  disableScroll = false,
}: DriveBrowserProps) => {
  useDisableScroll(disableScroll);

  const [currentFolder, setCurrentFolder] = useState<FolderType>(
    selectedFolder || { id: 'root', name: 'Root' }
  );

  const { data: currentData } = useGetFileQuery(currentFolder?.id ?? '', {
    skip: currentFolder?.id === undefined || currentFolder?.id === 'root',
  });
  const currentFolderName = currentData?.name;
  const currentFolderParentId = currentData?.parents?.[0] || null;

  useEffect(() => {
    if (selectedFolder) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentFolder(selectedFolder);
    }
  }, [selectedFolder]);

  const { data, isLoading } = useListFilesQuery(
    {
      folderId: currentFolder?.id,
    },
    { skip: !currentFolder?.id }
  );

  const files = data?.files || [];

  const folders = files
    .filter(
      (f: { mimeType: string }) =>
        f.mimeType === 'application/vnd.google-apps.folder'
    )
    .sort((a: FolderType, b: FolderType) =>
      (a.name || '').localeCompare(b.name || '', undefined, {
        sensitivity: 'base',
      })
    );

  const images = files.filter((f: { mimeType: string }) =>
    f.mimeType.startsWith('image/')
  );

  return (
    <div className="card bg-transparent w-full max-w-md mx-auto flex flex-col h-full">
      <div className="card-body p-2 sm:p-6 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <h3 className="card-title text-base-content text-lg font-semibold">
            Google Drive Folder Browser
          </h3>

          {/* Optional: Root shortcut */}
          {currentFolder.id !== 'root' && (
            <button
              className="btn btn-xs ml-2"
              onClick={() => setCurrentFolder({ id: 'root', name: 'Root' })}
            >
              <FolderIcon className="w-6 h-6" />
              <ArrowUpCicle className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="mb-2">
          <span className="text-xs opacity-70">Current folder:</span>
          <span className="ml-2 font-mono text-sm">{currentFolder.name}</span>
        </div>

        {/* Actions */}
        <div className="flex justify-between mb-2">
          {currentFolderParentId && currentFolderName && (
            <button
              className="btn btn-xs ml-1"
              onClick={() =>
                setCurrentFolder({
                  id: currentFolderParentId,
                  name: currentFolderName,
                })
              }
            >
              {/* <span className="text-xl">📁</span> */}
              <FolderIcon className="w-4 h-4" />
              <ArrowUp className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Folders */}
        {isLoading && (
          <div className="flex items-center gap-2 my-4">
            <span className="loading loading-spinner loading-xs" />
            <span className="text-xs opacity-70">Loading folders...</span>
          </div>
        )}

        <div className="mb-4 rounded-lg border border-base-200 bg-base-100/60 p-2 max-h-[60vh] sm:max-h-[40vh] overflow-y-auto">
          {folders.length > 0 ? (
            <ul className="space-y-2">
              {folders.map((folder: FolderType) => (
                <li key={folder.id} className="flex items-center gap-2">
                  <button
                    className="btn btn-ghost btn-sm flex items-center gap-1"
                    onClick={() => setCurrentFolder(folder)}
                    title={`Open ${folder.name}`}
                  >
                    <FolderIcon className="w-4 h-4 min-w-[16px] min-h-[16px] mr-2" />
                    <span className="text-left">{folder.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !isLoading && (
              <div className="text-xs opacity-60 mt-0">
                No folders found in this directory.
              </div>
            )
          )}
        </div>

        {/* Images */}
        <div className="mt-0 flex-grow min-h-0 flex flex-col">
          <h4 className="font-semibold text-sm mb-2">Images</h4>

          <div className="rounded-lg border border-base-200 bg-base-100/60 p-2 max-h-[60vh] sm:max-h-[40vh] overflow-y-auto">
            {images.length === 0 && !isLoading && (
              <div className="text-xs opacity-60">
                No images in this folder.
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pr-1">
              {images.map((img: { id: string; name: string }) => (
                <div key={img.id} className="flex flex-col items-center">
                  <div className="w-full h-[100px] bg-base-200 rounded overflow-hidden flex items-center justify-center">
                    <DriveImage fileId={img.id} name={img.name} />
                  </div>

                  <span
                    className="text-xs mt-1 truncate max-w-[100px]"
                    title={img.name}
                  >
                    {img.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between mb-2">
          <button
            className="btn btn-xs btn-outline"
            onClick={() =>
              onSelectFolder({
                folder: { id: '', name: '' },
                files: [],
              })
            }
          >
            Unset
          </button>

          <button
            className="btn btn-outline btn-xs btn-primary"
            onClick={() =>
              onSelectFolder({
                folder: currentFolder,
                files,
              })
            }
          >
            {/* Select {currentFolder.name} */}
            Select Current
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriveBrowser;

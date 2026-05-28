import { useEffect, useState } from 'react';
import { useListFilesQuery } from '../api/google-drive/googleDriveApi';
import DriveImage from './DriveImage';
import type { FileType, FolderType } from '../api/firestore/types/shared';
import { useDisableScroll } from '../utils/hooks';

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

  // ✅ STACK instead of single folder
  const [folderStack, setFolderStack] = useState<FolderType[]>([
    selectedFolder || { id: 'root', name: 'Root' },
  ]);

  const currentFolder = folderStack[folderStack.length - 1];

  useEffect(() => {
    if (selectedFolder) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFolderStack([selectedFolder]);
    }
  }, [selectedFolder]);

  const { data, isLoading } = useListFilesQuery({
    folderId: currentFolder.id,
  });

  const files = data?.files || [];

  const folders = files.filter(
    (f: { mimeType: string }) =>
      f.mimeType === 'application/vnd.google-apps.folder'
  );

  const images = files.filter((f: { mimeType: string }) =>
    f.mimeType.startsWith('image/')
  );

  return (
    <div className="card bg-transparent w-full max-w-md mx-auto">
      <div className="card-body p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="card-title text-base-content text-lg font-semibold">
            Google Drive Folder Browser
          </h3>

          {/* ✅ Back button */}
          {folderStack.length > 1 && (
            <button
              className="btn btn-xs btn-outline ml-4"
              onClick={() => setFolderStack((prev) => prev.slice(0, -1))}
            >
              ⬅ Back
            </button>
          )}

          {/* Optional: Root shortcut */}
          {currentFolder.id !== 'root' && (
            <button
              className="btn btn-xs btn-outline ml-2"
              onClick={() => setFolderStack([{ id: 'root', name: 'Root' }])}
            >
              ⬅ Root
            </button>
          )}
        </div>

        <div className="mb-2">
          <span className="text-xs opacity-70">Current folder:</span>
          <span className="ml-2 font-mono text-sm">{currentFolder.name}</span>
        </div>

        {/* Folders */}
        {isLoading && (
          <div className="flex items-center gap-2 my-4">
            <span className="loading loading-spinner loading-xs" />
            <span className="text-xs opacity-70">Loading folders...</span>
          </div>
        )}

        <ul className="space-y-2 mb-4">
          {folders.map((folder: FolderType) => (
            <li key={folder.id} className="flex items-center gap-2">
              <button
                className="btn btn-ghost btn-sm flex items-center gap-1"
                onClick={() => setFolderStack((prev) => [...prev, folder])}
                title={`Open ${folder.name}`}
              >
                <span className="text-xl">📁</span>
                <span className="truncate max-w-[120px] text-left">
                  {folder.name}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {folders.length === 0 && !isLoading && (
          <div className="text-xs opacity-60 mt-4">
            No folders found in this directory.
          </div>
        )}

        {/* Images */}
        <div className="mt-2">
          <h4 className="font-semibold text-sm mb-2">Images</h4>

          {images.length === 0 && !isLoading && (
            <div className="text-xs opacity-60">No images in this folder.</div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

        {/* Actions */}
        <button
          className="btn btn-outline btn-xs mt-4"
          onClick={() =>
            onSelectFolder({
              folder: currentFolder,
              files,
            })
          }
        >
          Select {currentFolder.name}
        </button>

        <button
          className="btn btn-xs btn-outline mt-2"
          onClick={() =>
            onSelectFolder({
              folder: { id: '', name: '' },
              files: [],
            })
          }
        >
          Unset
        </button>
      </div>
    </div>
  );
};

export default DriveBrowser;

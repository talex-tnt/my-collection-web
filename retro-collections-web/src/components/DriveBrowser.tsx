import { useEffect, useState } from 'react';
import {
  useGetFileQuery,
  useListFilesQuery,
} from '../api/google-drive/googleDriveApi';
import DriveImage from './DriveImage';
import type { FileType, FolderType } from '../api/firestore/types/shared';
import { usePrefixGroupedList } from '../hooks/usePrefixGroupedList';
import { useDisableScroll } from '../utils/hooks';
import {
  FiArrowUp as ArrowUp,
  FiArrowUpCircle as ArrowUpCicle,
  FiChevronDown,
  FiChevronRight,
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
  const {
    filterText: folderFilter,
    setFilterText: setFolderFilter,
    isGroupingEnabled: groupByPrefix,
    setIsGroupingEnabled: setGroupByPrefix,
    expandedGroups,
    filteredItems: filteredFolders,
    groupedEntries,
    standaloneItems: standaloneFolders,
    toggleGroup,
  } = usePrefixGroupedList({
    items: folders,
    getLabel: (folder) => folder.name || '',
    getKey: (folder) => folder.id || folder.name || '',
  });

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
        <div className="flex items-center gap-2 mb-2">
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
              <FolderIcon className="w-4 h-4" />
              <ArrowUp className="w-6 h-6" />
            </button>
          )}

          <input
            type="text"
            className="input input-xs input-bordered flex-1"
            placeholder="Search folders..."
            value={folderFilter}
            onChange={(e) => setFolderFilter(e.target.value)}
          />

          <label className="label cursor-pointer gap-1 p-0">
            <span className="text-[10px] opacity-70 whitespace-nowrap">
              Group
            </span>
            <input
              type="checkbox"
              className="toggle toggle-xs"
              checked={groupByPrefix}
              onChange={(e) => setGroupByPrefix(e.target.checked)}
            />
          </label>
        </div>

        {/* Folders */}
        {isLoading && (
          <div className="flex items-center gap-2 my-4">
            <span className="loading loading-spinner loading-xs" />
            <span className="text-xs opacity-70">Loading folders...</span>
          </div>
        )}

        <div className="mb-4 rounded-lg border border-base-200 bg-base-100/60 p-2 max-h-[60vh] sm:max-h-[40vh] overflow-y-auto">
          {filteredFolders.length > 0 ? (
            groupByPrefix ? (
              <div className="space-y-2">
                {groupedEntries.map((group) => {
                  const isExpanded = expandedGroups[group.groupLabel] || false;

                  return (
                    <div key={group.groupLabel} className="space-y-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs normal-case justify-start w-full px-1"
                        onClick={() => toggleGroup(group.groupLabel)}
                      >
                        {isExpanded ? (
                          <FiChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <FiChevronRight className="w-3.5 h-3.5" />
                        )}
                        <span className="font-medium">{group.groupLabel}</span>
                      </button>

                      {isExpanded && (
                        <ul className="space-y-1 pl-5">
                          {group.entries.map((entry) => (
                            <li
                              key={
                                entry.item.id ||
                                `${group.groupLabel}-${entry.childLabel}`
                              }
                              className="flex items-center gap-2"
                            >
                              <button
                                className="btn btn-ghost btn-sm flex items-center gap-1"
                                onClick={() => setCurrentFolder(entry.item)}
                                title={`Open ${entry.item.name}`}
                              >
                                <FolderIcon className="w-4 h-4 min-w-[16px] min-h-[16px] mr-2" />
                                <span className="text-left">
                                  {entry.childLabel}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}

                {standaloneFolders.length > 0 && (
                  <ul className="space-y-2">
                    {standaloneFolders.map((folder: FolderType) => (
                      <li
                        key={folder.id || folder.name}
                        className="flex items-center gap-2"
                      >
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
                )}
              </div>
            ) : (
              <ul className="space-y-2">
                {filteredFolders.map((folder: FolderType) => (
                  <li
                    key={folder.id || folder.name}
                    className="flex items-center gap-2"
                  >
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
            )
          ) : (
            !isLoading && (
              <div className="text-xs opacity-60 mt-0">
                {folders.length === 0
                  ? 'No folders found in this directory.'
                  : 'No folders match your filter.'}
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

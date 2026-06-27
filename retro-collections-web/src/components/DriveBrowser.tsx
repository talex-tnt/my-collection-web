import { useEffect, useRef, useState } from 'react';
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
  FiChevronDown,
  FiChevronRight,
  FiFolder as FolderIcon,
  FiHome as HomeIcon,
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
  const folderNameMeasureRef = useRef<HTMLSpanElement | null>(null);
  const [isFolderNameOverflowing, setIsFolderNameOverflowing] = useState(false);

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

  useEffect(() => {
    const measureOverflow = () => {
      const element = folderNameMeasureRef.current;

      if (!element) return;

      setIsFolderNameOverflowing(element.scrollWidth > element.clientWidth + 1);
    };

    measureOverflow();

    const element = folderNameMeasureRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureOverflow);
      return () => window.removeEventListener('resize', measureOverflow);
    }

    const observer = new ResizeObserver(measureOverflow);
    observer.observe(element);

    return () => observer.disconnect();
  }, [currentFolder.name]);

  return (
    <div className="card bg-transparent w-full max-w-md mx-auto flex flex-col h-full">
      <style>{`
        @keyframes drive-browser-text-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
      <div className="card-body p-2 sm:p-6 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <h3 className="card-title text-base-content text-lg font-semibold">
            Google Drive Folder Browser
          </h3>

          {/* Optional: Root shortcut */}
          {currentFolder.id !== 'root' && (
            <button
              className="btn btn-xs btn-ghost tooltip"
              title="Go to root folder"
              onClick={() => setCurrentFolder({ id: 'root', name: 'Root' })}
            >
              <span className="relative inline-flex items-center justify-center w-6 h-6">
                <FolderIcon className="w-6 h-6" strokeWidth={1} />
                <HomeIcon className="absolute w-3 h-3" />
              </span>
            </button>
          )}
        </div>

        <div className="mb-2">
          <span className="text-xs opacity-70">Current folder:</span>
          <span className="ml-2 font-mono text-sm text-primary">
            {currentFolder.name}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mb-2">
          {currentFolderParentId && currentFolderName && (
            <button
              className="btn btn-xs ml-1 btn-ghost tooltip"
              title={`Go to parent folder`}
              onClick={() =>
                setCurrentFolder({
                  id: currentFolderParentId,
                  name: currentFolderName,
                })
              }
            >
              <FolderIcon className="w-6 h-6" strokeWidth={1.5} />
              <ArrowUp className="absolute w-3 h-3" />
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
                                <FolderIcon
                                  className="w-4 h-4 min-w-[16px] min-h-[16px] mr-2"
                                  strokeWidth={1.5}
                                />
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
                          <FolderIcon
                            className="w-4 h-4 min-w-[16px] min-h-[16px] mr-2"
                            strokeWidth={1.5}
                          />
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
                      <FolderIcon
                        className="w-4 h-4 min-w-[16px] min-h-[16px] mr-2"
                        strokeWidth={1.5}
                      />
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
        <div className="flex items-center justify-between gap-2 mb-2">
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

          <div className="flex items-center gap-2 flex-nowrap ml-auto shrink-0 min-w-0">
            <span className="whitespace-nowrap shrink-0">Set current:</span>
            <button
              className="btn btn-outline btn-xs btn-primary relative w-auto max-w-[100px] justify-start overflow-hidden shrink-0"
              onClick={() =>
                onSelectFolder({
                  folder: currentFolder,
                  files,
                })
              }
            >
              <span
                ref={folderNameMeasureRef}
                aria-hidden="true"
                className="absolute inset-0 invisible overflow-hidden whitespace-nowrap text-left"
              >
                {currentFolder?.name ?? 'Current'}
              </span>

              {isFolderNameOverflowing ? (
                <span className="block min-w-0 overflow-hidden whitespace-nowrap text-left">
                  <span
                    className="inline-flex w-max will-change-transform"
                    style={{
                      animation:
                        'drive-browser-text-marquee 5s linear infinite',
                    }}
                  >
                    <span className="pr-6">
                      {currentFolder?.name ?? 'Current'}
                    </span>
                    <span className="pr-6">
                      {currentFolder?.name ?? 'Current'}
                    </span>
                  </span>
                </span>
              ) : (
                <span className="block min-w-0 truncate text-left">
                  {currentFolder?.name ?? 'Current'}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriveBrowser;

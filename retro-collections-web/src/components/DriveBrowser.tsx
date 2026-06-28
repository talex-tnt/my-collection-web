import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import {
  useGetFileQuery,
  useLazyGetFileDownloadQuery,
  useListFilesQuery,
} from '../api/google-drive/googleDriveApi';
import {
  useCreateDriveFolderMutation,
  useDeleteDriveNodeMutation,
  useRenameDriveNodeMutation,
  useUploadFileToFolderMutation,
} from '../api/google-drive/googleDriveWriteApi';
import DriveImage from './DriveImage';
import type { FileType, FolderType } from '../api/firestore/types/shared';
import { usePrefixGroupedList } from '../hooks/usePrefixGroupedList';
import { useDisableScroll } from '../utils/hooks';
import { stripImageMetadata } from './AIImageAnalyzer/imageEditing';
import { PhotoEditorModal } from './AIImageAnalyzer/PhotoEditorModal';
import {
  FiArrowUp as ArrowUp,
  FiChevronDown,
  FiChevronRight,
  FiEdit2,
  FiFolder as FolderIcon,
  FiHome as HomeIcon,
  FiImage,
  FiStar,
  FiTrash2,
  FiUpload,
  FiX,
  FiFolderPlus,
} from 'react-icons/fi';

type DriveNode = {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  modifiedTime?: string;
  parents?: string[];
};

type FolderSortMode = 'name-asc' | 'name-desc' | 'updated-asc' | 'updated-desc';

const isPreviewFileName = (name: string | null | undefined) =>
  Boolean(name && /^Preview(\.|$)/i.test(name));

const splitFileName = (name: string) => {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === name.length - 1) {
    return { stem: name, extension: '' };
  }

  return {
    stem: name.slice(0, dotIndex),
    extension: name.slice(dotIndex + 1),
  };
};

const buildUniqueName = (requestedName: string, usedNames: Set<string>) => {
  const normalizedRequestedName = requestedName.trim() || 'IMG';
  const requestedKey = normalizedRequestedName.toLowerCase();

  if (!usedNames.has(requestedKey)) {
    usedNames.add(requestedKey);
    return normalizedRequestedName;
  }

  const { stem, extension } = splitFileName(normalizedRequestedName);
  let counter = 1;

  while (counter < 10000) {
    const candidateStem = `${stem}_${String(counter).padStart(3, '0')}`;
    const candidateName = extension
      ? `${candidateStem}.${extension}`
      : candidateStem;
    const candidateKey = candidateName.toLowerCase();

    if (!usedNames.has(candidateKey)) {
      usedNames.add(candidateKey);
      return candidateName;
    }

    counter += 1;
  }

  const fallback = `${stem}_${Date.now()}`;
  const fallbackName = extension ? `${fallback}.${extension}` : fallback;
  usedNames.add(fallbackName.toLowerCase());
  return fallbackName;
};

const getPreviewFileName = (name: string) => {
  const { extension } = splitFileName(name);
  return extension ? `Preview.${extension}` : 'Preview';
};

const formatFolderModifiedAt = (modifiedTime?: string) => {
  if (!modifiedTime) return 'No update data';

  const parsedDate = new Date(modifiedTime);
  if (Number.isNaN(parsedDate.getTime())) return 'No update data';

  return new Intl.DateTimeFormat(undefined, {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsedDate);
};

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
  const uploadInputId = useId();
  const [isFolderNameOverflowing, setIsFolderNameOverflowing] = useState(false);
  const [folderSortMode, setFolderSortMode] =
    useState<FolderSortMode>('name-asc');
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationNotice, setOperationNotice] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<{
    id: string;
    name: string;
    mimeType: string;
    src: string;
  } | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [uploadFileToFolder, { isLoading: isUploading }] =
    useUploadFileToFolderMutation();
  const [createDriveFolder, { isLoading: isCreatingFolder }] =
    useCreateDriveFolderMutation();
  const [renameDriveNode, { isLoading: isRenaming }] =
    useRenameDriveNodeMutation();
  const [deleteDriveNode, { isLoading: isDeleting }] =
    useDeleteDriveNodeMutation();
  const [downloadFile] = useLazyGetFileDownloadQuery();

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

  const { data, isLoading, isFetching, refetch } = useListFilesQuery(
    {
      folderId: currentFolder?.id,
    },
    { skip: !currentFolder?.id }
  );

  const files = (data?.files || []) as DriveNode[];

  const folders = files
    .filter(
      (f: DriveNode) => f.mimeType === 'application/vnd.google-apps.folder'
    )
    .sort((a: DriveNode, b: DriveNode) => {
      if (folderSortMode === 'name-asc') {
        return (a.name || '').localeCompare(b.name || '', undefined, {
          sensitivity: 'base',
        });
      }

      if (folderSortMode === 'name-desc') {
        return (b.name || '').localeCompare(a.name || '', undefined, {
          sensitivity: 'base',
        });
      }

      const aUpdatedAt = a.modifiedTime ? Date.parse(a.modifiedTime) : 0;
      const bUpdatedAt = b.modifiedTime ? Date.parse(b.modifiedTime) : 0;

      if (folderSortMode === 'updated-asc') {
        return aUpdatedAt - bUpdatedAt;
      }

      return bUpdatedAt - aUpdatedAt;
    });
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

  const useGroupedView = groupByPrefix && folderSortMode === 'name-asc';

  const images = files.filter((f: DriveNode) =>
    f.mimeType.startsWith('image/')
  );

  const isMutating =
    isUploading || isCreatingFolder || isRenaming || isDeleting || isFetching;

  const clearStatus = () => {
    setOperationError(null);
    setOperationNotice(null);
  };

  const folderNameExists = (name: string, excludingId?: string) => {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return false;

    return folders.some(
      (folder) =>
        folder.id !== excludingId &&
        (folder.name || '').trim().toLowerCase() === normalized
    );
  };

  const imageNameExists = (name: string, excludingId?: string) => {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return false;

    return images.some(
      (image) =>
        image.id !== excludingId &&
        (image.name || '').trim().toLowerCase() === normalized
    );
  };

  const handleRenameFolder = async (folder: DriveNode) => {
    const nextNameRaw = window.prompt('Rename folder', folder.name || '');
    if (nextNameRaw === null) return;

    const nextName = nextNameRaw.trim();
    if (!nextName) {
      setOperationError('Folder name cannot be empty.');
      return;
    }

    if (folderNameExists(nextName, folder.id)) {
      setOperationError(
        'A folder with this name already exists in the current folder.'
      );
      return;
    }

    try {
      clearStatus();
      await renameDriveNode({ id: folder.id, name: nextName }).unwrap();
      setOperationNotice('Folder renamed.');
      await refetch();
    } catch (error) {
      console.error('Unable to rename folder:', error);
      setOperationError('Unable to rename folder. Please try again.');
    }
  };

  const handleCreateFolder = async () => {
    if (!currentFolder?.id) return;

    const nextNameRaw = window.prompt('Create new folder', 'New Folder');
    if (nextNameRaw === null) return;

    const nextName = nextNameRaw.trim();
    if (!nextName) {
      setOperationError('Folder name cannot be empty.');
      return;
    }

    if (folderNameExists(nextName)) {
      setOperationError(
        'A folder with this name already exists in the current folder.'
      );
      return;
    }

    try {
      clearStatus();
      await createDriveFolder({
        parentFolderId: currentFolder.id,
        folderName: nextName,
      }).unwrap();
      setOperationNotice('Folder created.');
      await refetch();
    } catch (error) {
      console.error('Unable to create folder:', error);
      setOperationError('Unable to create folder. Please try again.');
    }
  };

  const handleDeleteFolder = async (folder: DriveNode) => {
    const confirmed = window.confirm(
      `Delete folder "${folder.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      clearStatus();
      await deleteDriveNode({ id: folder.id }).unwrap();
      setOperationNotice('Folder deleted.');
      await refetch();
    } catch (error) {
      console.error('Unable to delete folder:', error);
      setOperationError('Unable to delete folder. It may not be empty.');
    }
  };

  const handleRenameImage = async (image: DriveNode) => {
    const nextNameRaw = window.prompt('Rename image', image.name || '');
    if (nextNameRaw === null) return;

    const nextName = nextNameRaw.trim();
    if (!nextName) {
      setOperationError('Image name cannot be empty.');
      return;
    }

    if (imageNameExists(nextName, image.id)) {
      setOperationError('An image with this name already exists.');
      return;
    }

    if (isPreviewFileName(nextName)) {
      await handleSetAsPreview(image, nextName);
      return;
    }

    try {
      clearStatus();
      await renameDriveNode({ id: image.id, name: nextName }).unwrap();
      setOperationNotice('Image renamed.');
      await refetch();
    } catch (error) {
      console.error('Unable to rename image:', error);
      setOperationError('Unable to rename image. Please try again.');
    }
  };

  const handleDeleteImage = async (image: DriveNode) => {
    const confirmed = window.confirm(
      `Delete image "${image.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      clearStatus();
      await deleteDriveNode({ id: image.id }).unwrap();
      setOperationNotice('Image deleted.');
      await refetch();
    } catch (error) {
      console.error('Unable to delete image:', error);
      setOperationError('Unable to delete image. Please try again.');
    }
  };

  const handleSetAsPreview = async (
    image: DriveNode,
    requestedName?: string
  ) => {
    const previewName =
      requestedName || getPreviewFileName(image.name || 'Preview');
    const existingPreview = images.find(
      (entry) => entry.id !== image.id && isPreviewFileName(entry.name)
    );

    try {
      clearStatus();

      if (existingPreview) {
        const { extension } = splitFileName(existingPreview.name || '');
        const usedNames = new Set(
          images
            .filter((entry) => entry.id !== existingPreview.id)
            .map((entry) => (entry.name || '').trim().toLowerCase())
            .filter(Boolean)
        );

        const fallbackRequested = extension ? `IMG.${extension}` : 'IMG';
        const fallbackName = buildUniqueName(fallbackRequested, usedNames);

        await renameDriveNode({
          id: existingPreview.id,
          name: fallbackName,
        }).unwrap();
      }

      await renameDriveNode({
        id: image.id,
        name: previewName,
      }).unwrap();

      setOperationNotice('Preview image updated.');
      await refetch();
    } catch (error) {
      console.error('Unable to set preview image:', error);
      setOperationError('Unable to set preview image. Please try again.');
    }
  };

  const handleUploadImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
      ? Array.from(event.target.files)
      : [];

    if (selectedFiles.length === 0 || !currentFolder?.id) {
      return;
    }

    try {
      clearStatus();
      const sanitizedFiles = await Promise.all(
        selectedFiles.map((file) => stripImageMetadata(file))
      );

      const usedNames = new Set(
        images
          .map((image) => (image.name || '').trim().toLowerCase())
          .filter(Boolean)
      );
      const hasPreview = images.some((image) => isPreviewFileName(image.name));

      for (let index = 0; index < sanitizedFiles.length; index += 1) {
        const file = sanitizedFiles[index];
        const requestedName =
          !hasPreview && index === 0
            ? getPreviewFileName(file.name)
            : file.name || 'IMG';
        const uniqueName = buildUniqueName(requestedName, usedNames);

        await uploadFileToFolder({
          folderId: currentFolder.id,
          file,
          fileName: uniqueName,
        }).unwrap();
      }

      setOperationNotice('Images uploaded.');
      await refetch();
    } catch (error) {
      console.error('Unable to upload images:', error);
      setOperationError('Unable to upload images. Please try again.');
    } finally {
      event.target.value = '';
    }
  };

  const handleEditImage = async (image: DriveNode) => {
    try {
      clearStatus();
      const blob = await downloadFile(image.id).unwrap();
      const src = URL.createObjectURL(blob);

      setEditingImage({
        id: image.id,
        name: image.name,
        mimeType: blob.type || image.mimeType || 'image/jpeg',
        src,
      });
    } catch (error) {
      console.error('Unable to open image editor:', error);
      setOperationError('Unable to open image editor. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    if (editingImage?.src) {
      URL.revokeObjectURL(editingImage.src);
    }
    setEditingImage(null);
  };

  const handleSaveEditedImage = async (file: File) => {
    if (!editingImage || !currentFolder?.id) return;

    try {
      clearStatus();

      const usedNames = new Set(
        images
          .filter((image) => image.id !== editingImage.id)
          .map((image) => (image.name || '').trim().toLowerCase())
          .filter(Boolean)
      );
      const uniqueName = buildUniqueName(
        editingImage.name || file.name,
        usedNames
      );

      await uploadFileToFolder({
        folderId: currentFolder.id,
        file,
        fileName: uniqueName,
      }).unwrap();

      await deleteDriveNode({ id: editingImage.id }).unwrap();
      setOperationNotice('Image edited and saved.');
      handleCancelEdit();
      await refetch();
    } catch (error) {
      console.error('Unable to save edited image:', error);
      setOperationError('Unable to save edited image. Please try again.');
    }
  };
  const normalizedSearch = folderFilter.trim().toLowerCase();
  const filteredImages =
    normalizedSearch.length === 0
      ? images
      : images.filter((image) =>
          (image.name || '').toLowerCase().includes(normalizedSearch)
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

  useEffect(() => {
    return () => {
      if (editingImage?.src) {
        URL.revokeObjectURL(editingImage.src);
      }
    };
  }, [editingImage]);

  useEffect(() => {
    if (!fullscreenImage) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFullscreenImage(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [fullscreenImage]);

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
                <HomeIcon className="absolute bottom-[4.5px] w-3 h-3" />
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

        {/* Search and Controls */}
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
              <ArrowUp className="absolute bottom-[3.5px] w-3 h-3" />
            </button>
          )}

          <div className="relative flex-1">
            <input
              type="text"
              className="input input-xs input-bordered w-full pr-7"
              placeholder="Search..."
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
            />

            {folderFilter && (
              <button
                type="button"
                className="btn btn-ghost btn-xs absolute right-1 top-1/2 -translate-y-1/2 px-1 min-h-0 h-5"
                title="Clear search"
                onClick={() => setFolderFilter('')}
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <label className="label cursor-pointer gap-1 p-0">
            <span className="text-[10px] opacity-70 whitespace-nowrap">
              Group
            </span>
            <input
              type="checkbox"
              className="toggle toggle-xs"
              checked={groupByPrefix}
              onChange={(e) => setGroupByPrefix(e.target.checked)}
              disabled={folderSortMode !== 'name-asc'}
            />
          </label>

          <select
            className="select select-bordered select-xs h-6 min-h-0 w-24 px-1 text-[10px] shrink-0"
            value={folderSortMode}
            onChange={(e) =>
              setFolderSortMode(e.target.value as FolderSortMode)
            }
          >
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="updated-asc">Updated oldest</option>
            <option value="updated-desc">Updated newest</option>
          </select>
        </div>

        {operationError && (
          <div className="alert alert-error text-xs py-2 px-3 mb-2">
            {operationError}
          </div>
        )}
        {operationNotice && (
          <div className="alert alert-success text-xs py-2 px-3 mb-2">
            {operationNotice}
          </div>
        )}

        {/* Folders */}
        {isLoading && (
          <div className="flex items-center gap-2 my-4">
            <span className="loading loading-spinner loading-xs" />
            <span className="text-xs opacity-70">Loading folders...</span>
          </div>
        )}

        <div className="mb-4 rounded-lg border border-base-200 bg-base-100/60 p-2 max-h-[60vh] sm:max-h-[40vh] overflow-y-auto">
          {filteredFolders.length > 0 ? (
            useGroupedView ? (
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
                              className="flex items-center gap-2 justify-between"
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
                                <span className="text-left leading-tight">
                                  <span className="block">
                                    {entry.childLabel}
                                  </span>
                                  <span className="block text-[9px] opacity-50">
                                    {formatFolderModifiedAt(
                                      (entry.item as DriveNode).modifiedTime
                                    )}
                                  </span>
                                </span>
                              </button>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  title="Rename folder"
                                  disabled={isMutating}
                                  onClick={() =>
                                    handleRenameFolder(entry.item as DriveNode)
                                  }
                                >
                                  <FiEdit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs text-error"
                                  title="Delete folder"
                                  disabled={isMutating}
                                  onClick={() =>
                                    handleDeleteFolder(entry.item as DriveNode)
                                  }
                                >
                                  <FiTrash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
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
                        className="flex items-center gap-2 justify-between"
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
                          <span className="text-left leading-tight">
                            <span className="block">{folder.name}</span>
                            <span className="block text-[9px] opacity-50">
                              {formatFolderModifiedAt(
                                (folder as DriveNode).modifiedTime
                              )}
                            </span>
                          </span>
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            title="Rename folder"
                            disabled={isMutating}
                            onClick={() =>
                              handleRenameFolder(folder as DriveNode)
                            }
                          >
                            <FiEdit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-error"
                            title="Delete folder"
                            disabled={isMutating}
                            onClick={() =>
                              handleDeleteFolder(folder as DriveNode)
                            }
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
                    className="flex items-center gap-2 justify-between"
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
                      <span className="text-left leading-tight">
                        <span className="block">{folder.name}</span>
                        <span className="block text-[9px] opacity-50">
                          {formatFolderModifiedAt(
                            (folder as DriveNode).modifiedTime
                          )}
                        </span>
                      </span>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        title="Rename folder"
                        disabled={isMutating}
                        onClick={() => handleRenameFolder(folder as DriveNode)}
                      >
                        <FiEdit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        title="Delete folder"
                        disabled={isMutating}
                        onClick={() => handleDeleteFolder(folder as DriveNode)}
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
            {filteredImages.length === 0 && !isLoading && (
              <div className="text-xs opacity-60">
                {images.length === 0
                  ? 'No images in this folder.'
                  : 'No images match your search.'}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pr-1">
              {filteredImages.map((img: DriveNode) => (
                <div key={img.id} className="flex flex-col items-center">
                  <button
                    type="button"
                    className="w-full h-[100px] bg-base-200 rounded overflow-hidden flex items-center justify-center"
                    onClick={() =>
                      setFullscreenImage({ id: img.id, name: img.name })
                    }
                    title={`Open ${img.name} fullscreen`}
                  >
                    <DriveImage fileId={img.id} name={img.name} />
                  </button>

                  <span
                    className="text-xs mt-1 truncate max-w-[100px]"
                    title={img.name}
                  >
                    {img.name}
                  </span>
                  <div className="mt-1 flex items-center gap-1">
                    <button
                      type="button"
                      className={`btn btn-ghost btn-xs ${
                        isPreviewFileName(img.name) ? 'text-success' : ''
                      }`}
                      title="Set as Preview"
                      onClick={() => handleSetAsPreview(img)}
                      disabled={isMutating || isPreviewFileName(img.name)}
                    >
                      <FiStar className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      title="Rename image"
                      onClick={() => handleRenameImage(img)}
                      disabled={isMutating}
                    >
                      <FiEdit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      title="Edit image"
                      onClick={() => handleEditImage(img)}
                      disabled={isMutating}
                    >
                      <FiImage className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      title="Delete image"
                      onClick={() => handleDeleteImage(img)}
                      disabled={isMutating}
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-xs btn-outline"
              onClick={handleCreateFolder}
              disabled={!currentFolder?.id || isMutating}
            >
              <FiFolderPlus className="w-3.5 h-3.5" />
            </button>

            <label
              htmlFor={uploadInputId}
              className={`btn btn-xs btn-outline gap-1 ${
                !currentFolder?.id || isMutating
                  ? 'pointer-events-none opacity-50'
                  : ''
              }`}
            >
              <FiUpload className="w-3.5 h-3.5" />
              <FiImage className="w-3.5 h-3.5" />
            </label>
            <input
              id={uploadInputId}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={handleUploadImages}
              disabled={!currentFolder?.id || isMutating}
            />

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
          </div>

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

        {editingImage && (
          <PhotoEditorModal
            imageSrc={editingImage.src}
            fileName={editingImage.name}
            mimeType={editingImage.mimeType}
            onCancel={handleCancelEdit}
            onSave={handleSaveEditedImage}
          />
        )}

        {fullscreenImage && (
          <div
            className="fixed inset-0 z-[110050] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setFullscreenImage(null)}
          >
            <button
              type="button"
              className="btn btn-circle btn-sm btn-ghost fixed right-3 top-3 z-[110060]"
              onClick={() => setFullscreenImage(null)}
              aria-label="Close fullscreen image"
              title="Close"
            >
              ✕
            </button>
            <div
              className="max-h-[95vh] max-w-[95vw]"
              onClick={(event) => event.stopPropagation()}
            >
              <DriveImage
                fileId={fullscreenImage.id}
                name={fullscreenImage.name}
                style={{
                  width: 'auto',
                  height: 'auto',
                  maxWidth: '95vw',
                  maxHeight: '95vh',
                  objectFit: 'contain',
                  borderRadius: 12,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriveBrowser;

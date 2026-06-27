import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAnalyzeProductImagesMutation } from '../../api/retro-collections/retroCollectionsApi';
import {
  useCreateDriveFolderMutation,
  useDeleteDriveNodeMutation,
  useRenameDriveNodeMutation,
  useUploadFileToFolderMutation,
} from '../../api/google-drive/googleDriveWriteApi';
import { useGetPublicUserTagsQuery } from '../../api/firestore/firestoreApi';
import type { FolderType, FileType } from '../../api/firestore/types/shared';
import {
  getDriveToken,
  requestDriveToken,
} from '../../api/google-drive/googleDriveAuth';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { SerializedError } from '@reduxjs/toolkit';
import { useCurrentUser } from '../../utils/hooks';
import { AnalyzerModal } from './AnalyzerModal';
import DriveFolderModal from '../DriveFolderModal';
import { PhotoEditorModal } from './PhotoEditorModal';
import { stripImageMetadata } from './imageEditing';
import type { AnalyzerEngine, SuggestedResult, TagStyle } from './types';

interface AIImageAnalyzerProps {
  currentTags?: string[];
  onAnalysisSuccess: (data: {
    title: string;
    description: string;
    tags: string[];
    uploadedFolderId?: { id: string; name: string };
    fallbackPreview?: { id: string; name: string };
  }) => void;
}

export function AIImageAnalyzer({
  currentTags = [],
  onAnalysisSuccess: _onAnalysisSuccess,
}: AIImageAnalyzerProps) {
  // Main Assistant Modal toggle state
  const [isOpen, setIsOpen] = useState(false);
  const user = useCurrentUser();

  // Core workflow states
  const [images, setImages] = useState<Array<File | null>>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [selectedAIIndexes, setSelectedAIIndexes] = useState<number[]>([]);
  const [driveFileIds, setDriveFileIds] = useState<Array<string | null>>([]);
  const [imageSyncStates, setImageSyncStates] = useState<
    Array<'local' | 'synced' | 'pending-upload' | 'pending-delete' | 'error'>
  >([]);
  const [selectedFolder, setSelectedFolder] = useState<FolderType | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isImportingImages, setIsImportingImages] = useState(false);
  const [driveSyncEnabled, setDriveSyncEnabled] = useState(false);
  const [managedDriveFolder, setManagedDriveFolder] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [hasConfirmedDriveSync, setHasConfirmedDriveSync] = useState(false);
  const driveSyncRunningRef = useRef(false);
  const driveSyncQueuedRef = useRef(false);
  const managedDriveFolderRef = useRef<{
    id: string;
    name: string;
  } | null>(null);
  const uploadedDriveImageKeysRef = useRef<Set<string>>(new Set());
  const uploadingDriveImageKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    managedDriveFolderRef.current = managedDriveFolder;
  }, [managedDriveFolder]);

  const getDriveImageKey = (image: File | null, index: number) => {
    if (!image) return '';
    return `${index}:${image.name}:${image.size}:${image.lastModified}`;
  };

  const [engine, setEngine] = useState<AnalyzerEngine>('github');

  // Secondary nested popup toggle state for the Drive Browser
  const [isDriveOpen, setIsDriveOpen] = useState(false);

  // Error messaging state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // API mutations & queries
  const userId = user?.uid ?? '';
  const { data: userTags = [] } = useGetPublicUserTagsQuery(
    { userId },
    { skip: !userId }
  );
  const [analyzeImages, { isLoading: isAnalyzing }] =
    useAnalyzeProductImagesMutation();
  const [createDriveFolder] = useCreateDriveFolderMutation();
  const [uploadFileToFolder] = useUploadFileToFolderMutation();
  const [renameDriveNode] = useRenameDriveNodeMutation();
  const [deleteDriveNode] = useDeleteDriveNodeMutation();

  const [suggestedResult, setSuggestedResult] =
    useState<SuggestedResult | null>(null);

  const styleMap = userTags.reduce<Record<string, TagStyle>>((acc, t) => {
    acc[t.id] = {
      backgroundColor: t.style?.backgroundColor || null,
      foregroundColor: t.style?.foregroundColor || null,
      imageUrl: (t.style as { imageUrl?: string | null })?.imageUrl || null,
    };
    return acc;
  }, {});

  const fallbackTagStyle: TagStyle = {
    backgroundColor: null,
    foregroundColor: null,
    imageUrl: null,
  };

  function parseAndSetError(error: unknown) {
    let extractMessage = 'An unexpected error occurred.';
    const fetchError = error as FetchBaseQueryError;
    const serializedError = error as SerializedError;

    if (fetchError && fetchError.data && typeof fetchError.data === 'object') {
      const apiData = fetchError.data as { error?: string; message?: string };
      extractMessage = apiData.error || apiData.message || extractMessage;
    } else if (serializedError && typeof serializedError.message === 'string') {
      extractMessage = serializedError.message;
    }

    setErrorMessage(extractMessage);
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setErrorMessage(null);
    setSuggestedResult(null);

    const filesArray = Array.from(e.target.files) as File[];
    setIsImportingImages(true);

    try {
      const previousImageCount = images.length;
      const sanitizedFiles = await Promise.all(
        filesArray.map((file) => stripImageMetadata(file))
      );
      const filePreviews = sanitizedFiles.map((file) =>
        URL.createObjectURL(file)
      );

      setImages((prev) => [...prev, ...sanitizedFiles]);
      setPreviews((prev) => [...prev, ...filePreviews]);
      setDriveFileIds((prev) => [...prev, ...sanitizedFiles.map(() => null)]);
      setImageSyncStates((prev) => [
        ...prev,
        ...sanitizedFiles.map(() => 'pending-upload' as const),
      ]);
      setSelectedAIIndexes((prev) => {
        // Default selection: only the very first image should be selected for AI.
        if (
          prev.length === 0 &&
          previousImageCount === 0 &&
          sanitizedFiles.length > 0
        ) {
          return [0];
        }
        return prev;
      });
    } catch (error) {
      console.error('Failed to strip image metadata:', error);
      setErrorMessage('Unable to load photos safely. Please try again.');
    } finally {
      setIsImportingImages(false);
    }

    // Allow selecting the same file again in the next interaction.
    e.target.value = '';
  };

  const handleRemovePreview = (indexToRemove: number) => {
    setErrorMessage(null);
    setSuggestedResult(null);

    const targetDriveFileId = driveFileIds[indexToRemove];

    if (targetDriveFileId) {
      const shouldDeleteInDrive = window.confirm(
        'This photo was synced to Drive. Removing it locally will also remove it from Drive on next sync. Continue?'
      );

      if (!shouldDeleteInDrive) {
        return;
      }
    }

    setPreviews((prev) => {
      const urlToRemove = prev[indexToRemove];
      if (urlToRemove && !targetDriveFileId) {
        URL.revokeObjectURL(urlToRemove);
      }
      if (targetDriveFileId) {
        return prev;
      }
      return prev.filter((_, index) => index !== indexToRemove);
    });

    setImages((prev) => {
      if (targetDriveFileId) {
        const next = [...prev];
        next[indexToRemove] = null;
        return next;
      }
      return prev.filter((_, index) => index !== indexToRemove);
    });

    setDriveFileIds((prev) => {
      if (targetDriveFileId) return prev;
      return prev.filter((_, index) => index !== indexToRemove);
    });

    setImageSyncStates((prev) => {
      if (targetDriveFileId) {
        const next = [...prev];
        next[indexToRemove] = 'pending-delete';
        return next;
      }
      return prev.filter((_, index) => index !== indexToRemove);
    });

    setSelectedAIIndexes((prev) => {
      const reindexed = prev
        .filter((index) => index !== indexToRemove)
        .map((index) => (index > indexToRemove ? index - 1 : index));

      // Keep one default AI selection when images still exist.
      const remainingImageCount = targetDriveFileId
        ? images.filter((img, i) => i !== indexToRemove && Boolean(img)).length
        : images.length - 1;

      if (reindexed.length === 0 && remainingImageCount > 0) {
        return [0];
      }

      return reindexed;
    });
  };

  const handleToggleImageForAI = (indexToToggle: number) => {
    setErrorMessage(null);
    setSuggestedResult(null);

    setSelectedAIIndexes((prev) => {
      if (prev.includes(indexToToggle)) {
        return prev.filter((index) => index !== indexToToggle);
      }

      return [...prev, indexToToggle].sort((a, b) => a - b);
    });
  };

  const handleOpenPhotoEditor = (indexToEdit: number) => {
    if (indexToEdit < 0 || indexToEdit >= previews.length) return;
    setEditingIndex(indexToEdit);
  };

  const handleClosePhotoEditor = () => {
    setEditingIndex(null);
  };

  const handleSaveEditedPhoto = (editedFile: File) => {
    if (editingIndex === null || editingIndex < 0) return;

    setErrorMessage(null);
    setSuggestedResult(null);

    const nextPreviewUrl = URL.createObjectURL(editedFile);
    const indexToReplace = editingIndex;

    setImages((prev) => {
      if (indexToReplace >= prev.length) return prev;
      const next = [...prev];
      next[indexToReplace] = editedFile;
      return next;
    });

    setImageSyncStates((prev) => {
      if (indexToReplace >= prev.length) return prev;
      const next = [...prev];
      next[indexToReplace] = driveFileIds[indexToReplace]
        ? 'pending-upload'
        : 'pending-upload';
      return next;
    });

    setPreviews((prev) => {
      if (indexToReplace >= prev.length) return prev;
      const next = [...prev];
      URL.revokeObjectURL(next[indexToReplace]);
      next[indexToReplace] = nextPreviewUrl;
      return next;
    });

    setEditingIndex(null);
  };

  const handleFolderSelect = (data: {
    folder: FolderType;
    files: FileType[];
  }) => {
    if (data.folder?.id) {
      setErrorMessage(null);
      setSelectedFolder(data.folder);
      setIsDriveOpen(false);
    }
  };

  const handleAnalyze = async () => {
    if (images.length === 0 || !selectedFolder?.id) return;

    const aiSelectedImages = selectedAIIndexes
      .map((index) => images[index])
      .filter((image): image is File => Boolean(image));

    if (aiSelectedImages.length === 0) return;

    setErrorMessage(null);

    try {
      let token = getDriveToken();
      if (!token) {
        token = await requestDriveToken();
      }
      const result = await analyzeImages({
        parentFolderId: selectedFolder.id,
        images: aiSelectedImages,
        optionalTags: currentTags,
        driveToken: token,
        engine,
      }).unwrap();

      const suggestedName = result.suggestedTitle?.trim() || '';
      const currentTypedName = newFolderName.trim();

      if (suggestedName) {
        if (!currentTypedName) {
          setNewFolderName(suggestedName);
        } else if (currentTypedName !== suggestedName) {
          const shouldOverrideName = window.confirm(
            `AI suggested a different folder name:\n\n"${suggestedName}"\n\nReplace your current folder name?`
          );

          if (shouldOverrideName) {
            setNewFolderName(suggestedName);
          }
        }
      }

      setSuggestedResult(result);
    } catch (error: unknown) {
      console.error('Error during image analysis operations:', error);
      parseAndSetError(error);
    }
  };

  const handleDriveSyncToggle = (enabled: boolean) => {
    if (enabled && !hasConfirmedDriveSync) {
      const confirmed = window.confirm(
        'Enable Drive Sync?\n\nWhen enabled, this tool will create and rename a managed folder in Drive and sync photo uploads/removals for files it created.'
      );

      if (!confirmed) return;

      setHasConfirmedDriveSync(true);
    }

    setDriveSyncEnabled(enabled);
  };

  useEffect(() => {
    const selectedFolderId = selectedFolder?.id;
    const trimmedFolderName = newFolderName.trim();
    const managedFolder = managedDriveFolderRef.current;
    const managedFolderName = managedFolder?.name ?? '';

    const hasPendingUpload = images.some(
      (image, index) => Boolean(image) && !driveFileIds[index]
    );
    const hasPendingDelete = imageSyncStates.some(
      (state, index) =>
        state === 'pending-delete' &&
        !images[index] &&
        Boolean(driveFileIds[index])
    );
    const needsFolderCreate =
      driveSyncEnabled &&
      Boolean(selectedFolderId) &&
      Boolean(trimmedFolderName) &&
      !managedFolder;
    const needsFolderRename =
      driveSyncEnabled &&
      Boolean(selectedFolderId) &&
      Boolean(trimmedFolderName) &&
      Boolean(managedFolder?.id) &&
      managedFolderName !== trimmedFolderName;
    const hasNoPendingFileWork = !needsFolderCreate && !needsFolderRename;
    const hasNoPendingImageWork = !hasPendingUpload && !hasPendingDelete;

    if (
      !driveSyncEnabled ||
      !selectedFolderId ||
      !trimmedFolderName ||
      (hasNoPendingFileWork && hasNoPendingImageWork)
    ) {
      return;
    }

    const runDriveSync = async () => {
      if (driveSyncRunningRef.current) {
        driveSyncQueuedRef.current = true;
        return;
      }

      driveSyncRunningRef.current = true;
      setIsSyncingDrive(true);

      try {
        do {
          driveSyncQueuedRef.current = false;

          if (!selectedFolderId || !trimmedFolderName || !driveSyncEnabled) {
            break;
          }

          let folderId = managedDriveFolderRef.current?.id;
          let folderName = managedDriveFolderRef.current?.name || '';

          if (!folderId) {
            const createdFolder = await createDriveFolder({
              parentFolderId: selectedFolderId,
              folderName: trimmedFolderName,
            }).unwrap();

            folderId = createdFolder.id;
            folderName = createdFolder.name;
            managedDriveFolderRef.current = {
              id: createdFolder.id,
              name: createdFolder.name,
            };
            setManagedDriveFolder({
              id: createdFolder.id,
              name: createdFolder.name,
            });
          }

          if (folderId && folderName !== trimmedFolderName) {
            const renamedFolder = await renameDriveNode({
              id: folderId,
              name: trimmedFolderName,
            }).unwrap();

            folderName = renamedFolder.name;
            managedDriveFolderRef.current = {
              id: folderId,
              name: renamedFolder.name,
            };
            setManagedDriveFolder({ id: folderId, name: renamedFolder.name });
          }

          if (!folderId) return;

          const imageSnapshot = images;
          const driveIdSnapshot = driveFileIds;
          const syncStateSnapshot = imageSyncStates;

          for (let index = 0; index < imageSnapshot.length; index += 1) {
            const image = imageSnapshot[index];
            const imageKey = getDriveImageKey(image, index);

            if (!image || driveIdSnapshot[index]) continue;
            if (
              uploadedDriveImageKeysRef.current.has(imageKey) ||
              uploadingDriveImageKeysRef.current.has(imageKey)
            ) {
              continue;
            }

            uploadingDriveImageKeysRef.current.add(imageKey);

            try {
              const uploadResult = await uploadFileToFolder({
                folderId,
                file: image as File,
              }).unwrap();

              uploadedDriveImageKeysRef.current.add(imageKey);

              setDriveFileIds((prev) => {
                const next = [...prev];
                next[index] = uploadResult.id;
                return next;
              });

              setImageSyncStates((prev) => {
                const next = [...prev];
                next[index] = 'synced';
                return next;
              });
            } finally {
              uploadingDriveImageKeysRef.current.delete(imageKey);
            }
          }

          for (let index = imageSnapshot.length - 1; index >= 0; index -= 1) {
            const driveFileId = driveIdSnapshot[index];
            if (imageSnapshot[index] || !driveFileId) continue;

            const shouldDeleteInDrive =
              syncStateSnapshot[index] === 'pending-delete';

            if (!shouldDeleteInDrive) continue;

            await deleteDriveNode({ id: driveFileId }).unwrap();

            setPreviews((prev) => {
              const urlToRemove = prev[index];
              if (urlToRemove) {
                URL.revokeObjectURL(urlToRemove);
              }
              return prev.filter((_, i) => i !== index);
            });
            setImages((prev) => prev.filter((_, i) => i !== index));
            setDriveFileIds((prev) => prev.filter((_, i) => i !== index));
            setImageSyncStates((prev) => prev.filter((_, i) => i !== index));
            setSelectedAIIndexes((prev) =>
              prev
                .filter((i) => i !== index)
                .map((i) => (i > index ? i - 1 : i))
            );
          }

          const syncedFolderName = newFolderName.trim() || folderName;
          const firstSyncedIndex = driveIdSnapshot.findIndex(
            (id, index) => Boolean(id) && Boolean(imageSnapshot[index])
          );
          const fallbackPreview =
            firstSyncedIndex >= 0 && driveIdSnapshot[firstSyncedIndex]
              ? {
                  id: driveIdSnapshot[firstSyncedIndex] as string,
                  name:
                    imageSnapshot[firstSyncedIndex]?.name ||
                    `IMG_${String(firstSyncedIndex).padStart(3, '0')}`,
                }
              : undefined;

          _onAnalysisSuccess({
            title: syncedFolderName,
            description: suggestedResult?.descriptionEn || '',
            tags: suggestedResult?.productTags || currentTags,
            uploadedFolderId: {
              id: folderId,
              name: syncedFolderName,
            },
            fallbackPreview,
          });
        } while (driveSyncQueuedRef.current);
      } catch (error) {
        parseAndSetError(error);
      } finally {
        driveSyncRunningRef.current = false;
        setIsSyncingDrive(false);
      }
    };

    void runDriveSync();

    return undefined;
  }, [
    _onAnalysisSuccess,
    createDriveFolder,
    currentTags,
    deleteDriveNode,
    driveFileIds,
    driveSyncEnabled,
    imageSyncStates,
    images,
    managedDriveFolder?.id,
    managedDriveFolder?.name,
    newFolderName,
    previews,
    renameDriveNode,
    selectedFolder?.id,
    suggestedResult?.descriptionEn,
    suggestedResult?.productTags,
    uploadFileToFolder,
  ]);

  const handleRemoveTag = (removedTag: string) => {
    setSuggestedResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        productTags: prev.productTags.filter((tag) => tag !== removedTag),
      };
    });
  };

  const handleCloseModal = () => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setSuggestedResult(null);
    setImages([]);
    setPreviews([]);
    setSelectedAIIndexes([]);
    setDriveFileIds([]);
    setImageSyncStates([]);
    setSelectedFolder(null);
    setNewFolderName('');
    setDriveSyncEnabled(false);
    setManagedDriveFolder(null);
    setIsSyncingDrive(false);
    setHasConfirmedDriveSync(false);
    uploadedDriveImageKeysRef.current.clear();
    uploadingDriveImageKeysRef.current.clear();
    setEditingIndex(null);
    setErrorMessage(null);
    setEngine('github');
    setIsOpen(false);
  };

  const globalLoading = isAnalyzing || isImportingImages || isSyncingDrive;

  return (
    <div className="ml-auto">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn btn-xs btn-tertiary gap-2 rounded-xl shadow-sm font-medium normal-case"
      >
        AI ✨
      </button>

      {isOpen &&
        createPortal(
          <AnalyzerModal
            selectedFolder={selectedFolder}
            images={images}
            previews={previews}
            driveFileIds={driveFileIds}
            imageSyncStates={imageSyncStates}
            newFolderName={newFolderName}
            engine={engine}
            suggestedResult={suggestedResult}
            errorMessage={errorMessage}
            isAnalyzing={isAnalyzing}
            isUploading={isSyncingDrive}
            globalLoading={globalLoading}
            driveSyncEnabled={driveSyncEnabled}
            isSyncingDrive={isSyncingDrive}
            folderSyncStatus={
              !driveSyncEnabled
                ? 'off'
                : managedDriveFolder &&
                    managedDriveFolder.name === newFolderName.trim()
                  ? 'synced'
                  : 'pending'
            }
            styleMap={styleMap}
            fallbackTagStyle={fallbackTagStyle}
            onClose={handleCloseModal}
            onOpenDrive={() => setIsDriveOpen(true)}
            onFileChange={handleFileChange}
            onEditPreview={handleOpenPhotoEditor}
            onRemovePreview={handleRemovePreview}
            selectedAIIndexes={selectedAIIndexes}
            onToggleImageForAI={handleToggleImageForAI}
            onFolderNameChange={setNewFolderName}
            onDriveSyncToggle={handleDriveSyncToggle}
            onEngineChange={setEngine}
            onAnalyze={handleAnalyze}
            onDiscardSuggested={() => setSuggestedResult(null)}
            onRemoveTag={handleRemoveTag}
          />,
          document.body
        )}

      {editingIndex !== null &&
        previews[editingIndex] &&
        images[editingIndex] &&
        createPortal(
          <PhotoEditorModal
            imageSrc={previews[editingIndex]}
            fileName={images[editingIndex].name}
            mimeType={images[editingIndex].type}
            onCancel={handleClosePhotoEditor}
            onSave={handleSaveEditedPhoto}
          />,
          document.body
        )}

      <DriveFolderModal
        isOpen={isDriveOpen}
        selectedFolder={selectedFolder || undefined}
        onClose={() => setIsDriveOpen(false)}
        onSelectFolder={(data) => {
          handleFolderSelect({
            folder: data.folder,
            files: data.files,
          });
        }}
      />
    </div>
  );
}

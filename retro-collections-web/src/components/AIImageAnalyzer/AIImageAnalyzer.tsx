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

const DRIVE_FOLDER_NAME_CONFLICT_ERROR =
  'A folder with this name already exists in the selected Drive folder. Choose a unique folder name before syncing.';

const isPreviewFileName = (name: string | null | undefined) =>
  Boolean(name && /^Preview(\.|$)/i.test(name));

const getPreviewFileName = (file: File) => {
  const parts = file.name.split('.');
  const extension = parts.length > 1 ? parts[parts.length - 1] : '';
  return extension ? `Preview.${extension}` : 'Preview';
};

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

const computeDesiredDriveFileNames = (
  imageSnapshot: Array<File | null>,
  driveIdSnapshot: Array<string | null>,
  driveNameSnapshot: Array<string | null>,
  previewIndex: number
) => {
  const desiredNames = new Map<number, string>();
  const usedNames = new Set<string>();

  for (let index = 0; index < imageSnapshot.length; index += 1) {
    const image = imageSnapshot[index];
    if (!image) continue;

    const driveFileId = driveIdSnapshot[index];
    const currentDriveName = driveNameSnapshot[index] || '';

    let requestedName: string;
    if (index === previewIndex) {
      requestedName = getPreviewFileName(image);
    } else if (currentDriveName && !isPreviewFileName(currentDriveName)) {
      requestedName = currentDriveName;
    } else {
      requestedName =
        image.name ||
        (driveFileId ? `IMG_${String(index + 1).padStart(3, '0')}` : 'IMG');
    }

    const uniqueName = buildUniqueName(requestedName, usedNames);
    desiredNames.set(index, uniqueName);
  }

  return desiredNames;
};

interface AIImageAnalyzerProps {
  currentTags?: string[];
  onAnalysisSuccess: (data: {
    title?: string;
    description?: string;
    tags?: string[];
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
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<
    number | null
  >(null);
  const [driveFileIds, setDriveFileIds] = useState<Array<string | null>>([]);
  const [driveFileNames, setDriveFileNames] = useState<Array<string | null>>(
    []
  );
  const [imageSyncStates, setImageSyncStates] = useState<
    Array<'local' | 'synced' | 'pending-upload' | 'pending-delete' | 'error'>
  >([]);
  const [selectedFolder, setSelectedFolder] = useState<FolderType | null>(null);
  const [selectedFolderChildFolderNames, setSelectedFolderChildFolderNames] =
    useState<string[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [debouncedFolderName, setDebouncedFolderName] = useState('');
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
  const driveRenameRunningRef = useRef(false);
  const folderNameDirtyRef = useRef(false);
  const latestFolderNameRef = useRef('');
  const managedDriveFolderRef = useRef<{
    id: string;
    name: string;
  } | null>(null);
  const uploadedDriveImageKeysRef = useRef<Set<string>>(new Set());
  const uploadingDriveImageKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    managedDriveFolderRef.current = managedDriveFolder;
  }, [managedDriveFolder]);

  useEffect(() => {
    latestFolderNameRef.current = newFolderName.trim();
    if (driveSyncEnabled) {
      folderNameDirtyRef.current = true;
    }
  }, [driveSyncEnabled, newFolderName]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedFolderName(newFolderName);
    }, 600);

    return () => window.clearTimeout(timeoutId);
  }, [newFolderName]);

  const getDriveImageKey = (image: File | null, index: number) => {
    if (!image) return '';
    return `${index}:${image.name}:${image.size}:${image.lastModified}`;
  };

  const effectivePreviewIndex =
    selectedPreviewIndex !== null && images[selectedPreviewIndex]
      ? selectedPreviewIndex
      : images.findIndex((image) => Boolean(image));

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
  const [applyTitleEnabled, setApplyTitleEnabled] = useState(true);
  const [applyDescriptionEnabled, setApplyDescriptionEnabled] = useState(true);
  const [applyTagsEnabled, setApplyTagsEnabled] = useState(true);
  const [applyFolderEnabled, setApplyFolderEnabled] = useState(true);

  const normalizedRequestedFolderName = newFolderName.trim().toLowerCase();
  const normalizedManagedFolderName =
    managedDriveFolder?.name?.trim().toLowerCase() || '';
  const hasFolderNameConflict =
    Boolean(selectedFolder?.id) &&
    Boolean(normalizedRequestedFolderName) &&
    selectedFolderChildFolderNames.some(
      (name) =>
        name === normalizedRequestedFolderName &&
        name !== normalizedManagedFolderName
    );

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
      const hasExistingLocalImage = images.some((image) => Boolean(image));
      const sanitizedFiles = await Promise.all(
        filesArray.map((file) => stripImageMetadata(file))
      );
      const filePreviews = sanitizedFiles.map((file) =>
        URL.createObjectURL(file)
      );

      setImages((prev) => [...prev, ...sanitizedFiles]);
      setPreviews((prev) => [...prev, ...filePreviews]);
      setDriveFileIds((prev) => [...prev, ...sanitizedFiles.map(() => null)]);
      setDriveFileNames((prev) => [...prev, ...sanitizedFiles.map(() => null)]);
      setImageSyncStates((prev) => [
        ...prev,
        ...sanitizedFiles.map(() => 'pending-upload' as const),
      ]);
      setSelectedPreviewIndex((prev) => {
        if (!hasExistingLocalImage && sanitizedFiles.length > 0) {
          return previousImageCount;
        }
        return prev;
      });
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

    setDriveFileNames((prev) => {
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

    if (selectedPreviewIndex === indexToRemove) {
      setSelectedPreviewIndex(null);
    }
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
      const siblingFolderNames = Array.from(
        new Set(
          data.files
            .filter(
              (file) =>
                (file as { mimeType?: string }).mimeType ===
                'application/vnd.google-apps.folder'
            )
            .map((file) => (file.name || '').trim().toLowerCase())
            .filter(Boolean)
        )
      );

      setErrorMessage(null);
      setSelectedFolder(data.folder);
      setSelectedFolderChildFolderNames(siblingFolderNames);
      setIsDriveOpen(false);
    }
  };

  const handleFolderNameChange = (name: string) => {
    setNewFolderName(name);

    const normalizedNextFolderName = name.trim().toLowerCase();
    const hasConflict =
      Boolean(selectedFolder?.id) &&
      Boolean(normalizedNextFolderName) &&
      selectedFolderChildFolderNames.some(
        (folderName) =>
          folderName === normalizedNextFolderName &&
          folderName !== normalizedManagedFolderName
      );

    if (!hasConflict) {
      setErrorMessage((prev) =>
        prev === DRIVE_FOLDER_NAME_CONFLICT_ERROR ? null : prev
      );
    }
  };

  const handleAnalyze = async () => {
    if (images.length === 0) return;

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

      const aiParentFolderId = selectedFolder?.id || 'root';

      const result = await analyzeImages({
        parentFolderId: aiParentFolderId,
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
    const trimmedFolderName = debouncedFolderName.trim();
    const managedFolder = managedDriveFolderRef.current;
    const desiredDriveNames = computeDesiredDriveFileNames(
      images,
      driveFileIds,
      driveFileNames,
      effectivePreviewIndex
    );

    const hasPendingDelete = imageSyncStates.some(
      (state, index) =>
        state === 'pending-delete' &&
        !images[index] &&
        Boolean(driveFileIds[index])
    );
    const hasPendingNameNormalization = images.some((image, index) => {
      if (!image) return false;

      const desiredName = desiredDriveNames.get(index);
      if (!desiredName) return false;

      if (!driveFileIds[index]) {
        return true;
      }

      const currentName = driveFileNames[index] || '';
      return currentName !== desiredName;
    });
    const needsFolderCreate =
      driveSyncEnabled &&
      Boolean(selectedFolderId) &&
      Boolean(trimmedFolderName) &&
      !managedFolder;
    const hasNoPendingFileWork = !needsFolderCreate;
    const hasNoPendingImageWork =
      !hasPendingDelete && !hasPendingNameNormalization;
    const normalizedCurrentManagedFolderName =
      managedFolder?.name?.trim().toLowerCase() || '';
    const hasFolderNameConflictForSync =
      Boolean(trimmedFolderName) &&
      selectedFolderChildFolderNames.some(
        (name) =>
          name === trimmedFolderName.toLowerCase() &&
          name !== normalizedCurrentManagedFolderName
      );

    if (
      !driveSyncEnabled ||
      !selectedFolderId ||
      !trimmedFolderName ||
      (hasNoPendingFileWork && hasNoPendingImageWork)
    ) {
      return;
    }

    if (hasFolderNameConflictForSync) {
      setErrorMessage(DRIVE_FOLDER_NAME_CONFLICT_ERROR);
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
            setSelectedFolderChildFolderNames((prev) =>
              prev.includes(createdFolder.name.trim().toLowerCase())
                ? prev
                : [...prev, createdFolder.name.trim().toLowerCase()]
            );
            folderNameDirtyRef.current =
              latestFolderNameRef.current.trim() !== createdFolder.name;
          }

          if (!folderId) return;

          const imageSnapshot = images;
          const driveIdSnapshot = driveFileIds;
          const driveNameSnapshot = driveFileNames;
          const syncStateSnapshot = imageSyncStates;
          const desiredNames = computeDesiredDriveFileNames(
            imageSnapshot,
            driveIdSnapshot,
            driveNameSnapshot,
            effectivePreviewIndex
          );

          for (let index = 0; index < imageSnapshot.length; index += 1) {
            const image = imageSnapshot[index];
            const imageKey = getDriveImageKey(image, index);
            const desiredName = desiredNames.get(index);

            if (!image || driveIdSnapshot[index]) continue;
            if (
              uploadedDriveImageKeysRef.current.has(imageKey) ||
              uploadingDriveImageKeysRef.current.has(imageKey)
            ) {
              continue;
            }
            if (!desiredName) continue;

            uploadingDriveImageKeysRef.current.add(imageKey);

            try {
              const uploadResult = await uploadFileToFolder({
                folderId,
                file: image as File,
                fileName: desiredName,
              }).unwrap();

              uploadedDriveImageKeysRef.current.add(imageKey);

              setDriveFileIds((prev) => {
                const next = [...prev];
                next[index] = uploadResult.id;
                return next;
              });

              setDriveFileNames((prev) => {
                const next = [...prev];
                next[index] = uploadResult.name;
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
            setDriveFileNames((prev) => prev.filter((_, i) => i !== index));
            setImageSyncStates((prev) => prev.filter((_, i) => i !== index));
            setSelectedAIIndexes((prev) =>
              prev
                .filter((i) => i !== index)
                .map((i) => (i > index ? i - 1 : i))
            );
          }

          for (let index = 0; index < imageSnapshot.length; index += 1) {
            const image = imageSnapshot[index];
            const driveFileId = driveIdSnapshot[index];
            const desiredName = desiredNames.get(index);
            if (!image || !driveFileId || !desiredName) continue;

            const currentName = driveNameSnapshot[index] || '';
            if (currentName === desiredName) continue;

            const renamedFile = await renameDriveNode({
              id: driveFileId,
              name: desiredName,
            }).unwrap();

            setDriveFileNames((prev) => {
              const next = [...prev];
              next[index] = renamedFile.name;
              return next;
            });
          }

          folderName = debouncedFolderName.trim() || folderName;
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
    createDriveFolder,
    deleteDriveNode,
    driveFileIds,
    driveFileNames,
    driveSyncEnabled,
    debouncedFolderName,
    imageSyncStates,
    images,
    managedDriveFolder?.id,
    managedDriveFolder?.name,
    previews,
    renameDriveNode,
    effectivePreviewIndex,
    selectedFolder?.id,
    selectedFolderChildFolderNames,
    uploadFileToFolder,
  ]);

  useEffect(() => {
    if (!driveSyncEnabled || !selectedFolder?.id || !managedDriveFolder?.id) {
      return;
    }

    const runRenameQueue = async () => {
      if (driveRenameRunningRef.current) {
        return;
      }

      driveRenameRunningRef.current = true;

      try {
        while (folderNameDirtyRef.current) {
          const currentFolder = managedDriveFolderRef.current;
          const nextFolderName = latestFolderNameRef.current.trim();

          if (
            !driveSyncEnabled ||
            !selectedFolder?.id ||
            !currentFolder?.id ||
            !nextFolderName
          ) {
            folderNameDirtyRef.current = false;
            break;
          }

          const normalizedNextFolderName = nextFolderName.toLowerCase();
          const normalizedCurrentFolderName = currentFolder.name
            .trim()
            .toLowerCase();
          const hasRenameConflict = selectedFolderChildFolderNames.some(
            (name) =>
              name === normalizedNextFolderName &&
              name !== normalizedCurrentFolderName
          );

          if (hasRenameConflict) {
            folderNameDirtyRef.current = false;
            setErrorMessage(DRIVE_FOLDER_NAME_CONFLICT_ERROR);
            break;
          }

          if (currentFolder.name === nextFolderName) {
            folderNameDirtyRef.current = false;
            break;
          }

          folderNameDirtyRef.current = false;

          const renamedFolder = await renameDriveNode({
            id: currentFolder.id,
            name: nextFolderName,
          }).unwrap();

          managedDriveFolderRef.current = {
            id: currentFolder.id,
            name: renamedFolder.name,
          };
          setManagedDriveFolder({
            id: currentFolder.id,
            name: renamedFolder.name,
          });
          setSelectedFolderChildFolderNames((prev) => {
            const withoutOldName = prev.filter(
              (name) => name !== currentFolder.name.trim().toLowerCase()
            );
            const normalizedRenamedName = renamedFolder.name
              .trim()
              .toLowerCase();
            return withoutOldName.includes(normalizedRenamedName)
              ? withoutOldName
              : [...withoutOldName, normalizedRenamedName];
          });

          if (latestFolderNameRef.current.trim() !== renamedFolder.name) {
            folderNameDirtyRef.current = true;
          }
        }
      } catch (error) {
        parseAndSetError(error);
      } finally {
        driveRenameRunningRef.current = false;

        if (folderNameDirtyRef.current) {
          void runRenameQueue();
        }
      }
    };

    void runRenameQueue();

    return undefined;
  }, [
    driveSyncEnabled,
    managedDriveFolder?.id,
    newFolderName,
    renameDriveNode,
    selectedFolder?.id,
    selectedFolderChildFolderNames,
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

  const handleApplySuggested = () => {
    const suggestedTitle = suggestedResult?.suggestedTitle?.trim() || '';
    const suggestedDescription = suggestedResult?.descriptionEn?.trim() || '';
    const suggestedTags = (suggestedResult?.productTags || []).filter(Boolean);
    const resolvedTitle = newFolderName.trim() || suggestedTitle;

    const shouldApplyTitle = applyTitleEnabled && Boolean(resolvedTitle);
    const shouldApplyDescription =
      applyDescriptionEnabled && Boolean(suggestedDescription);
    const shouldApplyTags = applyTagsEnabled && suggestedTags.length > 0;
    const shouldApplyFolder = applyFolderEnabled && Boolean(managedDriveFolder);

    if (
      !shouldApplyTitle &&
      !shouldApplyDescription &&
      !shouldApplyTags &&
      !shouldApplyFolder
    ) {
      setErrorMessage('Enable at least one Apply toggle before applying.');
      return;
    }

    const firstSyncedIndex = driveFileIds.findIndex(
      (id, index) => Boolean(id) && Boolean(images[index])
    );
    const preferredPreviewIndex =
      effectivePreviewIndex >= 0 &&
      driveFileIds[effectivePreviewIndex] &&
      images[effectivePreviewIndex]
        ? effectivePreviewIndex
        : firstSyncedIndex;
    const fallbackPreview =
      preferredPreviewIndex >= 0 && driveFileIds[preferredPreviewIndex]
        ? {
            id: driveFileIds[preferredPreviewIndex] as string,
            name:
              images[preferredPreviewIndex]?.name ||
              `IMG_${String(preferredPreviewIndex).padStart(3, '0')}`,
          }
        : undefined;

    _onAnalysisSuccess({
      title: shouldApplyTitle ? resolvedTitle : undefined,
      description: shouldApplyDescription ? suggestedDescription : undefined,
      tags: shouldApplyTags ? suggestedTags : undefined,
      uploadedFolderId: shouldApplyFolder
        ? {
            id: managedDriveFolder?.id || '',
            name: managedDriveFolder?.name || '',
          }
        : undefined,
      fallbackPreview: shouldApplyFolder ? fallbackPreview : undefined,
    });

    handleCloseModal();
  };

  const handleCloseModal = () => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setSuggestedResult(null);
    setImages([]);
    setPreviews([]);
    setSelectedAIIndexes([]);
    setSelectedPreviewIndex(null);
    setDriveFileIds([]);
    setDriveFileNames([]);
    setImageSyncStates([]);
    setSelectedFolder(null);
    setSelectedFolderChildFolderNames([]);
    setNewFolderName('');
    setDriveSyncEnabled(false);
    setManagedDriveFolder(null);
    setIsSyncingDrive(false);
    setHasConfirmedDriveSync(false);
    setApplyTitleEnabled(true);
    setApplyDescriptionEnabled(true);
    setApplyTagsEnabled(true);
    setApplyFolderEnabled(true);
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
            managedFolderName={managedDriveFolder?.name ?? null}
            hasFolderNameConflict={hasFolderNameConflict}
            selectedPreviewIndex={
              effectivePreviewIndex >= 0 ? effectivePreviewIndex : null
            }
            applyTitleEnabled={applyTitleEnabled}
            applyDescriptionEnabled={applyDescriptionEnabled}
            applyTagsEnabled={applyTagsEnabled}
            applyFolderEnabled={applyFolderEnabled}
            engine={engine}
            suggestedResult={suggestedResult}
            errorMessage={errorMessage}
            isAnalyzing={isAnalyzing}
            globalLoading={globalLoading}
            driveSyncEnabled={driveSyncEnabled}
            isSyncingDrive={isSyncingDrive}
            styleMap={styleMap}
            fallbackTagStyle={fallbackTagStyle}
            onClose={handleCloseModal}
            onOpenDrive={() => setIsDriveOpen(true)}
            onFileChange={handleFileChange}
            onEditPreview={handleOpenPhotoEditor}
            onRemovePreview={handleRemovePreview}
            selectedAIIndexes={selectedAIIndexes}
            onToggleImageForAI={handleToggleImageForAI}
            onSetPreviewImage={setSelectedPreviewIndex}
            onFolderNameChange={handleFolderNameChange}
            onDriveSyncToggle={handleDriveSyncToggle}
            onApplyTitleToggle={setApplyTitleEnabled}
            onApplyDescriptionToggle={setApplyDescriptionEnabled}
            onApplyTagsToggle={setApplyTagsEnabled}
            onApplyFolderToggle={setApplyFolderEnabled}
            onEngineChange={setEngine}
            onAnalyze={handleAnalyze}
            onApplySuggested={handleApplySuggested}
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

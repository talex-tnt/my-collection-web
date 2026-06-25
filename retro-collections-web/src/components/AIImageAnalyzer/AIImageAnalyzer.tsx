import { useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAnalyzeProductImagesMutation } from '../../api/retro-collections/retroCollectionsApi';
import { useCreateAndUploadFolderMutation } from '../../api/google-drive/googleDriveWriteApi';
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
import { DriveFolderModal } from './DriveFolderModal';
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
  onAnalysisSuccess,
}: AIImageAnalyzerProps) {
  // Main Assistant Modal toggle state
  const [isOpen, setIsOpen] = useState(false);
  const user = useCurrentUser();

  // Core workflow states
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FolderType | null>(null);

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
  const [createAndUpload, { isLoading: isUploading }] =
    useCreateAndUploadFolderMutation();

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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setErrorMessage(null);
    setSuggestedResult(null);

    const filesArray = Array.from(e.target.files) as File[];
    const filePreviews = filesArray.map((file) => URL.createObjectURL(file));

    setImages((prev) => [...prev, ...filesArray]);
    setPreviews((prev) => [...prev, ...filePreviews]);

    // Allow selecting the same file again in the next interaction.
    e.target.value = '';
  };

  const handleRemovePreview = (indexToRemove: number) => {
    setErrorMessage(null);
    setSuggestedResult(null);

    setPreviews((prev) => {
      const urlToRemove = prev[indexToRemove];
      if (urlToRemove) {
        URL.revokeObjectURL(urlToRemove);
      }
      return prev.filter((_, index) => index !== indexToRemove);
    });

    setImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleMovePreviewToFirst = (indexToMove: number) => {
    if (indexToMove <= 0) return;

    setErrorMessage(null);
    setSuggestedResult(null);

    setPreviews((prev) => {
      if (indexToMove >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(indexToMove, 1);
      next.unshift(moved);
      return next;
    });

    setImages((prev) => {
      if (indexToMove >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(indexToMove, 1);
      next.unshift(moved);
      return next;
    });
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
    setErrorMessage(null);

    try {
      let token = getDriveToken();
      if (!token) {
        token = await requestDriveToken();
      }
      const result = await analyzeImages({
        parentFolderId: selectedFolder.id,
        images: images.length > 0 ? [images[0]] : [],
        optionalTags: currentTags,
        driveToken: token,
        engine,
      }).unwrap();

      setSuggestedResult(result);
    } catch (error: unknown) {
      console.error('Error during image analysis operations:', error);
      parseAndSetError(error);
    }
  };

  const handleConfirmAndUpload = async () => {
    if (!suggestedResult || !selectedFolder?.id || images.length === 0) return;
    setErrorMessage(null);

    try {
      const uploadResult = await createAndUpload({
        parentFolderId: selectedFolder.id,
        newFolderName: suggestedResult.suggestedTitle,
        images: images,
      }).unwrap();

      const primaryUploadedFile = uploadResult.files?.[0];

      onAnalysisSuccess({
        title: suggestedResult.suggestedTitle,
        description: suggestedResult.descriptionEn,
        tags: suggestedResult.productTags,
        uploadedFolderId: uploadResult.folderId
          ? { id: uploadResult.folderId, name: suggestedResult.suggestedTitle }
          : undefined,
        fallbackPreview: primaryUploadedFile
          ? { id: primaryUploadedFile.id, name: primaryUploadedFile.name }
          : undefined,
      });

      handleCloseModal();
    } catch (error: unknown) {
      console.error(
        'Error during frontend folder creation and image upload pipeline:',
        error
      );
      parseAndSetError(error);
    }
  };

  const parseAndSetError = (error: unknown) => {
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
  };

  const handleRemoveTag = (removedTag: string) => {
    setSuggestedResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        productTags: prev.productTags.filter((tag) => tag !== removedTag),
      };
    });
  };

  const handleSuggestedTitleChange = (title: string) => {
    setSuggestedResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        suggestedTitle: title,
      };
    });
  };

  const handleCloseModal = () => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setSuggestedResult(null);
    setImages([]);
    setPreviews([]);
    setSelectedFolder(null);
    setErrorMessage(null);
    setEngine('github');
    setIsOpen(false);
  };

  const globalLoading = isAnalyzing || isUploading;

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
            engine={engine}
            suggestedResult={suggestedResult}
            errorMessage={errorMessage}
            isAnalyzing={isAnalyzing}
            isUploading={isUploading}
            globalLoading={globalLoading}
            styleMap={styleMap}
            fallbackTagStyle={fallbackTagStyle}
            onClose={handleCloseModal}
            onOpenDrive={() => setIsDriveOpen(true)}
            onFileChange={handleFileChange}
            onRemovePreview={handleRemovePreview}
            onMovePreviewToFirst={handleMovePreviewToFirst}
            onEngineChange={setEngine}
            onAnalyze={handleAnalyze}
            onConfirmAndUpload={handleConfirmAndUpload}
            onDiscardSuggested={() => setSuggestedResult(null)}
            onSuggestedTitleChange={handleSuggestedTitleChange}
            onRemoveTag={handleRemoveTag}
          />,
          document.body
        )}

      {isDriveOpen &&
        createPortal(
          <DriveFolderModal
            onClose={() => setIsDriveOpen(false)}
            onSelectFolder={handleFolderSelect}
          />,
          document.body
        )}
    </div>
  );
}

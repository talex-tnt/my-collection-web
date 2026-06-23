import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  useAnalyzeProductImagesMutation,
  useCreateAndUploadFolderMutation,
} from '../api/retro-collections/retroCollectionsApi';
import DriveBrowser from './DriveBrowser';
import type { FolderType, FileType } from '../api/firestore/types/shared';
import {
  getDriveToken,
  requestDriveToken,
} from '../api/google-drive/googleDriveAuth';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { SerializedError } from '@reduxjs/toolkit';
import {
  getDriveWriteToken,
  requestDriveWriteToken,
} from '../api/google-drive/googleDriveAuthWrite';

interface AIImageAnalyzerProps {
  currentTags?: string[];
  onAnalysisSuccess: (data: {
    title: string;
    description: string;
    tags: string[];
    uploadedFolderId?: string; // Enhanced payload to return the created drive id if needed
  }) => void;
}

export function AIImageAnalyzer({
  currentTags = [],
  onAnalysisSuccess,
}: AIImageAnalyzerProps) {
  // Main Assistant Modal toggle state
  const [isOpen, setIsOpen] = useState(false);

  // Core workflow states
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FolderType | null>(null);

  // Secondary nested popup toggle state for the Drive Browser
  const [isDriveOpen, setIsDriveOpen] = useState(false);

  // Error messaging state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // API mutations
  const [analyzeImages, { isLoading: isAnalyzing }] =
    useAnalyzeProductImagesMutation();
  const [createAndUpload, { isLoading: isUploading }] =
    useCreateAndUploadFolderMutation();

  const [suggestedResult, setSuggestedResult] = useState<{
    suggestedTitle: string;
    descriptionEn: string;
    productTags: string[];
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setErrorMessage(null); // Clear errors on new upload
    const filesArray = Array.from(e.target.files);
    setImages(filesArray);

    const filePreviews = filesArray.map((file) => URL.createObjectURL(file));
    setPreviews(filePreviews);
  };

  const handleFolderSelect = (data: {
    folder: FolderType;
    files: FileType[];
  }) => {
    if (data.folder?.id) {
      setErrorMessage(null); // Clear errors on new target selection
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
        images,
        optionalTags: currentTags,
        driveToken: token,
      }).unwrap();

      setSuggestedResult(result);
    } catch (error: unknown) {
      console.error('Error during image analysis operations:', error);
      parseAndSetError(error);
    }
  };

  // NEW STEP: Confirms execution, summons the folder creation/upload API, and pipes the result forward
  const handleConfirmAndUpload = async () => {
    if (!suggestedResult || !selectedFolder?.id || images.length === 0) return;
    setErrorMessage(null);

    try {
      let token = getDriveWriteToken();
      if (!token) {
        token = await requestDriveWriteToken();
      }

      // Trigger the folder creation + image binary file transmission pipeline
      const uploadResult = await createAndUpload({
        parentFolderId: selectedFolder.id,
        newFolderName: suggestedResult.suggestedTitle,
        images: images,
        driveToken: token,
      }).unwrap();

      // Fire completion event returning metadata as well as the newly created folder reference ID
      onAnalysisSuccess({
        title: suggestedResult.suggestedTitle,
        description: suggestedResult.descriptionEn,
        tags: suggestedResult.productTags,
        uploadedFolderId: uploadResult.folderId,
      });

      handleCloseModal();
    } catch (error: unknown) {
      console.error(
        'Error during folder creation and image upload pipeline:',
        error
      );
      parseAndSetError(error);
    }
  };

  // Isolated type-safe error parsing utility wrapper
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

  const handleCloseModal = () => {
    setSuggestedResult(null);
    setImages([]);
    setPreviews([]);
    setSelectedFolder(null);
    setErrorMessage(null);
    setIsOpen(false);
  };

  const globalLoading = isAnalyzing || isUploading;

  return (
    <>
      {/* COMPONENT ENTRY POINT: THE TRIGGER BUTTON */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn btn-sm btn-outline btn-primary gap-2 w-full rounded-xl shadow-sm font-medium normal-case"
      >
        ✨ Use AI Assistant
      </button>

      {/* RENDER MODALS OUTSIDE COMPONENT LAYOUT USING PORTALS */}
      {isOpen &&
        createPortal(
          <div className="modal modal-open z-[9999] backdrop-blur-sm fixed inset-0 flex items-center justify-center bg-black/50">
            <div className="modal-box bg-base-200 max-w-md w-full p-6 border border-base-300 rounded-2xl shadow-xl space-y-4 relative">
              <button
                type="button"
                onClick={handleCloseModal}
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                disabled={globalLoading}
              >
                ✕
              </button>

              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                  ✨ AI Product Creation Assistant
                </h3>
                <p className="text-[11px] opacity-60">
                  Automate names, descriptions, and folder structure uploads
                </p>
              </div>

              {/* STEP 1: POPUP TARGET SELECTION TRIGGER */}
              <div className="form-control w-full space-y-2">
                <span className="label-text font-semibold text-xs opacity-80">
                  1. Select Target Google Drive Folder
                </span>

                <button
                  type="button"
                  className={`btn btn-sm btn-block ${selectedFolder ? 'btn-neutral' : 'btn-primary btn-outline'}`}
                  onClick={() => setIsDriveOpen(true)}
                  disabled={globalLoading}
                >
                  {selectedFolder
                    ? 'Change Folder Target'
                    : 'Browse Google Drive...'}
                </button>

                {selectedFolder && (
                  <div className="text-[11px] text-success font-medium bg-base-100 px-3 py-1.5 rounded-lg border border-base-300 mt-1 truncate">
                    📁 Location:{' '}
                    <span className="underline font-bold">
                      {selectedFolder.name}
                    </span>
                  </div>
                )}
              </div>

              {/* STEP 2: BINARY PAYLOAD UPLOAD */}
              <div className="form-control w-full space-y-1">
                <span className="label-text font-semibold text-xs opacity-80">
                  2. Capture or Upload Photos
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handleFileChange}
                  className="file-input file-input-bordered file-input-sm file-input-primary w-full"
                  disabled={globalLoading}
                />
              </div>

              {/* Preview Deck */}
              {previews.length > 0 && (
                <div className="flex gap-2 overflow-x-auto py-1 bg-base-100 p-2 rounded-lg border border-base-300">
                  {previews.map((src, index) => (
                    <img
                      key={index}
                      src={src}
                      alt={`Preview ${index}`}
                      className="w-14 h-14 object-cover rounded-md border border-base-300 flex-shrink-0"
                    />
                  ))}
                </div>
              )}

              {/* DYNAMIC VISUAL ERROR BANNER */}
              {errorMessage && (
                <div className="alert alert-error text-xs p-3 rounded-xl border border-error/20 bg-error/10 text-error flex items-start gap-2 animate-fadeIn">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="stroke-current shrink-0 h-4 w-4 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="flex-1">
                    <span className="font-bold block">
                      Something went wrong
                    </span>
                    <p className="opacity-90 mt-0.5 font-mono break-all">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              )}

              {/* PIPELINE DISPATCH CONTROL ACTION */}
              {images.length > 0 && selectedFolder && !suggestedResult && (
                <button
                  type="button"
                  onClick={handleAnalyze}
                  className="btn btn-sm btn-primary w-full shadow-md"
                  disabled={globalLoading}
                >
                  {isAnalyzing ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    `Analyze Photos Inside Target Directory`
                  )}
                </button>
              )}

              {/* SUGGESTED METADATA COMPILATION & DRIVE UPLOAD CONFIRMATION CONTROLS */}
              {suggestedResult && (
                <div className="bg-base-100 p-4 rounded-xl border border-success/30 space-y-3 text-xs shadow-inner">
                  <div className="badge badge-success text-white font-medium">
                    AI Analysis Completed
                  </div>

                  <div>
                    <span className="font-bold block opacity-70">
                      Suggested Title:
                    </span>
                    <input
                      type="text"
                      className="input input-sm input-bordered w-full font-medium mt-1 text-sm text-base-content"
                      value={suggestedResult.suggestedTitle}
                      disabled={isUploading}
                      onChange={(e) =>
                        setSuggestedResult({
                          ...suggestedResult,
                          suggestedTitle: e.target.value,
                        })
                      }
                    />
                    <label className="text-[10px] opacity-50 mt-0.5 block">
                      This will be the name of your new Google Drive folder.
                    </label>
                  </div>

                  {suggestedResult.descriptionEn && (
                    <div>
                      <span className="font-bold block opacity-70">
                        Description (EN):
                      </span>
                      <p className="italic mt-0.5 max-h-24 overflow-y-auto bg-base-200/50 p-2 rounded">
                        {suggestedResult.descriptionEn}
                      </p>
                    </div>
                  )}

                  {suggestedResult.productTags?.length > 0 && (
                    <div>
                      <span className="font-bold block opacity-70 mb-1">
                        Detected Tags:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {suggestedResult.productTags.map((t, i) => (
                          <span
                            key={i}
                            className="badge badge-sm badge-outline"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-2 border-t border-base-200">
                    <span className="text-[11px] font-bold text-center block text-warning animate-pulse">
                      ❓ Ready to create this folder and upload your photos?
                    </span>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-success flex-1 text-white shadow"
                        onClick={handleConfirmAndUpload}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          'Confirm & Upload to Drive'
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        onClick={() => setSuggestedResult(null)}
                        disabled={isUploading}
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* NESTED SUB-POPUP: DRIVE BROWSER MODAL (HIGHER Z-INDEX PORTAL) */}
      {isDriveOpen &&
        createPortal(
          <div className="modal modal-open z-[10000] backdrop-blur-sm fixed inset-0 flex items-center justify-center bg-black/60">
            <div className="modal-box bg-base-100 max-w-lg w-11/12 p-6 rounded-2xl shadow-2xl relative border border-base-200">
              <button
                type="button"
                onClick={() => setIsDriveOpen(false)}
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              >
                ✕
              </button>

              <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-3">
                Select Google Drive Target Folder
              </h3>

              <div className="border border-base-200 rounded-xl p-3 bg-base-50 max-h-72 overflow-y-auto">
                <DriveBrowser
                  onSelectFolder={handleFolderSelect}
                  disableScroll={true}
                />
              </div>

              <div className="modal-action mt-4">
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setIsDriveOpen(false)}
                >
                  Cancel Selection
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

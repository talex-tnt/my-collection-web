import { useState } from 'react';
import { useAnalyzeProductImagesMutation } from '../api/retro-collections/retroCollectionsApi';
import DriveBrowser from './DriveBrowser';
import type { FolderType, FileType } from '../api/firestore/types/shared';
import {
  getDriveToken,
  requestDriveToken,
} from '../api/google-drive/googleDriveAuth';

interface AIImageAnalyzerProps {
  currentTags?: string[];
  onAnalysisSuccess: (data: {
    title: string;
    description: string;
    tags: string[];
  }) => void;
}

export function AIImageAnalyzer({
  currentTags = [],
  onAnalysisSuccess,
}: AIImageAnalyzerProps) {
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<FolderType | null>(null);

  const [analyzeImages, { isLoading }] = useAnalyzeProductImagesMutation();
  const [suggestedResult, setSuggestedResult] = useState<{
    suggestedTitle: string;
    descriptionEn: string;
    productTags: string[];
  } | null>(null);

  // Handle local image selection or phone camera snap
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    setImages(filesArray);

    const filePreviews = filesArray.map((file) => URL.createObjectURL(file));
    setPreviews(filePreviews);
  };

  // Captures the target destination directory from DriveBrowser
  const handleFolderSelect = (data: {
    folder: FolderType;
    files: FileType[];
  }) => {
    if (data.folder?.id) {
      setSelectedFolder(data.folder);
    }
  };

  const handleAnalyze = async () => {
    if (images.length === 0 || !selectedFolder?.id) return;

    try {
      let token = getDriveToken();
      if (!token) {
        token = await requestDriveToken();
      }
      const result = await analyzeImages({
        parentFolderId: selectedFolder.id, // Dynamically selected Google Drive target folder
        images,
        optionalTags: currentTags,
        driveToken: token,
      }).unwrap();

      setSuggestedResult(result);
    } catch (error) {
      console.error('Error during image analysis operations:', error);
    }
  };

  const handleAcceptSuggestion = () => {
    if (!suggestedResult) return;

    onAnalysisSuccess({
      title: suggestedResult.suggestedTitle,
      description: suggestedResult.descriptionEn,
      tags: suggestedResult.productTags,
    });

    // Reset workflow local states
    setSuggestedResult(null);
    setImages([]);
    setPreviews([]);
    setSelectedFolder(null);
  };

  return (
    <div className="card bg-base-200 p-4 border border-dashed border-primary/40 rounded-xl space-y-4">
      <div className="text-sm font-semibold text-primary flex items-center gap-2">
        ✨ AI Product Creation Assistant
      </div>

      {/* STEP 1: SELECT GOOGLE DRIVE TARGET DIRECTORY */}
      <div className="form-control w-full space-y-1">
        <span className="label-text font-semibold text-xs opacity-80">
          1. Select Target Google Drive Folder
        </span>
        <div className="border border-base-300 rounded-lg p-2 bg-base-50 max-h-48 overflow-y-auto">
          <DriveBrowser
            onSelectFolder={handleFolderSelect}
            disableScroll={true}
          />
        </div>
        {selectedFolder && (
          <div className="text-[11px] text-success font-medium mt-1 truncate">
            📁 Target Folder:{' '}
            <span className="underline">{selectedFolder.name}</span>
          </div>
        )}
      </div>

      {/* STEP 2: CAPTURE / UPLOAD PRODUCT PHOTOS */}
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
          disabled={isLoading}
        />
      </div>

      {/* Images local thumb preview deck */}
      {previews.length > 0 && (
        <div className="flex gap-2 overflow-x-auto py-1">
          {previews.map((src, index) => (
            <img
              key={index}
              src={src}
              alt={`Preview ${index}`}
              className="w-14 h-14 object-cover rounded-md border border-base-300"
            />
          ))}
        </div>
      )}

      {/* ANALYSIS SUBMIT BUTTON ACTION */}
      {images.length > 0 && selectedFolder && !suggestedResult && (
        <button
          type="button"
          onClick={handleAnalyze}
          className="btn btn-sm btn-primary w-full"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            `Analyze Photos inside "${selectedFolder.name}"`
          )}
        </button>
      )}

      {/* SUGGESTED METADATA CONFIRMATION CONTROL BOX */}
      {suggestedResult && (
        <div className="bg-base-100 p-3 rounded-lg border border-success/30 space-y-3 text-xs">
          <div className="badge badge-success text-white font-medium">
            AI Analysis Completed
          </div>

          <div>
            <span className="font-bold block opacity-70">Suggested Title:</span>
            <p className="text-sm font-medium">
              {suggestedResult.suggestedTitle}
            </p>
          </div>

          {suggestedResult.descriptionEn && (
            <div>
              <span className="font-bold block opacity-70">
                Description (EN):
              </span>
              <p className="italic">{suggestedResult.descriptionEn}</p>
            </div>
          )}

          {suggestedResult.productTags?.length > 0 && (
            <div>
              <span className="font-bold block opacity-70 mb-1">
                Detected Tags:
              </span>
              <div className="flex flex-wrap gap-1">
                {suggestedResult.productTags.map((t, i) => (
                  <span key={i} className="badge badge-sm badge-outline">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className="btn btn-xs btn-success flex-1 text-white"
              onClick={handleAcceptSuggestion}
            >
              Apply to Form
            </button>
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => setSuggestedResult(null)}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

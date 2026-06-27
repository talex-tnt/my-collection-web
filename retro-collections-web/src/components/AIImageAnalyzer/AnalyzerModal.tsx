import { useId, type ChangeEvent } from 'react';
import TagBadge from '../TagBadge';
import type { FolderType } from '../../api/firestore/types/shared';
import type { AnalyzerEngine, SuggestedResult, TagStyle } from './types';

interface AnalyzerModalProps {
  selectedFolder: FolderType | null;
  images: File[];
  previews: string[];
  engine: AnalyzerEngine;
  suggestedResult: SuggestedResult | null;
  errorMessage: string | null;
  isAnalyzing: boolean;
  isUploading: boolean;
  globalLoading: boolean;
  styleMap: Record<string, TagStyle>;
  fallbackTagStyle: TagStyle;
  onClose: () => void;
  onOpenDrive: () => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onEditPreview: (index: number) => void;
  onRemovePreview: (index: number) => void;
  onMovePreviewToFirst: (index: number) => void;
  onEngineChange: (engine: AnalyzerEngine) => void;
  onAnalyze: () => void;
  onConfirmAndUpload: () => void;
  onDiscardSuggested: () => void;
  onSuggestedTitleChange: (title: string) => void;
  onRemoveTag: (tag: string) => void;
}

export function AnalyzerModal({
  selectedFolder,
  images,
  previews,
  engine,
  suggestedResult,
  errorMessage,
  isAnalyzing,
  isUploading,
  globalLoading,
  styleMap,
  fallbackTagStyle,
  onClose,
  onOpenDrive,
  onFileChange,
  onEditPreview,
  onRemovePreview,
  onMovePreviewToFirst,
  onEngineChange,
  onAnalyze,
  onConfirmAndUpload,
  onDiscardSuggested,
  onSuggestedTitleChange,
  onRemoveTag,
}: AnalyzerModalProps) {
  const fileInputId = useId();

  return (
    <div className="modal modal-open z-[9999] backdrop-blur-sm fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="modal-box bg-base-200 max-w-md w-full p-6 border border-base-300 rounded-2xl shadow-xl space-y-4 relative">
        <button
          type="button"
          onClick={onClose}
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

        <div className="form-control w-full space-y-2">
          <span className="label-text font-semibold text-xs opacity-80">
            1. Select where the new image folder will be created
          </span>

          <button
            type="button"
            className={`btn btn-sm btn-block ${selectedFolder ? 'btn-neutral' : 'btn-primary btn-outline'}`}
            onClick={onOpenDrive}
            disabled={globalLoading}
          >
            {selectedFolder ? 'Change Folder Target' : 'Browse Google Drive...'}
          </button>

          {selectedFolder && (
            <div className="text-[11px] text-success font-medium bg-base-100 px-3 py-1.5 rounded-lg border border-base-300 mt-1 truncate">
              📁 Location:{' '}
              <span className="underline font-bold">{selectedFolder.name}</span>
            </div>
          )}
        </div>

        <div className="form-control w-full space-y-1">
          <span className="label-text font-semibold text-xs opacity-80">
            2. Capture or Upload Photos
          </span>
          <input
            id={fileInputId}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={onFileChange}
            className="sr-only"
            disabled={globalLoading}
          />
          <label
            htmlFor={fileInputId}
            className={`btn btn-sm btn-outline w-full min-h-0 h-auto py-2  normal-case ${globalLoading ? 'pointer-events-none opacity-50' : ''}`}
          >
            Take photo or choose files
          </label>
          <p className="text-[11px] opacity-60 leading-snug">
            Open the camera on mobile or pick one or more images from your
            gallery.
          </p>
          {images.length > 0 && (
            <div className="text-[11px] text-success font-medium bg-base-100 px-3 py-1.5 rounded-lg border border-base-300 mt-1 truncate">
              {images.length === 1
                ? `Selected photo: ${images[0].name}`
                : `${images.length} photos selected. First: ${images[0].name}`}
            </div>
          )}
        </div>

        {previews.length > 0 && (
          <div className="flex gap-2 overflow-x-auto py-1 bg-base-100 p-2 rounded-lg border border-base-300">
            {previews.map((src, index) => (
              <div key={index} className="relative w-14 h-14 flex-shrink-0">
                <img
                  src={src}
                  alt={`Preview ${index}`}
                  className="w-14 h-14 object-cover rounded-md border border-base-300"
                />
                <button
                  type="button"
                  onClick={() => onEditPreview(index)}
                  disabled={globalLoading}
                  className="btn btn-circle btn-xs btn-neutral absolute -top-1 -left-1 min-h-0 h-5 w-5"
                  aria-label={`Edit photo ${index + 1}`}
                  title="Edit photo"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => onRemovePreview(index)}
                  disabled={globalLoading}
                  className="btn btn-circle btn-xs btn-error text-white absolute -top-1 -right-1 min-h-0 h-5 w-5"
                  aria-label={`Remove photo ${index + 1}`}
                  title="Remove photo"
                >
                  ✕
                </button>
                {index === 0 && (
                  <span className="badge badge-primary badge-xs absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 w-10">
                    AI ✨
                  </span>
                )}
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => onMovePreviewToFirst(index)}
                    disabled={globalLoading}
                    className="btn btn-circle btn-xs btn-primary absolute -bottom-1 left-1/2 -translate-x-1/2 min-h-0 h-4 w-4 p-0 text-[10px] leading-none"
                    aria-label={`Move photo ${index + 1} to first position`}
                    title="Move to first"
                  >
                    {'←'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {images.length > 0 && selectedFolder && (
          <div className="form-control w-full space-y-1 animate-fadeIn">
            <span className="label-text font-semibold text-xs opacity-80">
              3. Choose AI Core Engine
            </span>
            <div className="flex gap-2">
              <select
                className="select select-bordered select-sm flex-1 font-medium"
                value={engine}
                onChange={(e) =>
                  onEngineChange(e.target.value as AnalyzerEngine)
                }
                disabled={globalLoading}
              >
                <option value="github">GitHub AI Pipeline (Default)</option>
                <option value="gemini">Gemini Pro Vision Engine</option>
              </select>

              {suggestedResult && (
                <button
                  type="button"
                  onClick={onAnalyze}
                  className="btn btn-sm btn-outline btn-primary px-3 shadow-sm"
                  disabled={globalLoading}
                >
                  {isAnalyzing ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    'Rerun 🔄'
                  )}
                </button>
              )}
            </div>
          </div>
        )}

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
              <span className="font-bold block">Something went wrong</span>
              <p className="opacity-90 mt-0.5 font-mono break-all">
                {errorMessage}
              </p>
            </div>
          </div>
        )}

        {images.length > 0 && selectedFolder && !suggestedResult && (
          <button
            type="button"
            onClick={onAnalyze}
            className="btn btn-sm btn-primary w-full shadow-md"
            disabled={globalLoading}
          >
            {isAnalyzing ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              `Analyze Photos Using ${engine === 'github' ? 'GitHub AI' : 'Gemini AI'}`
            )}
          </button>
        )}

        {suggestedResult && (
          <div className="bg-base-100 p-4 rounded-xl border border-success/30 space-y-3 text-xs shadow-inner">
            <div className="badge badge-success text-white font-medium">
              AI Analysis Completed ({engine === 'github' ? 'GitHub' : 'Gemini'}
              )
            </div>

            <div>
              <span className="font-bold block opacity-70">
                Suggested Title:
              </span>
              <input
                type="text"
                className="input input-sm input-bordered w-full font-medium mt-1 text-sm text-base-content"
                value={suggestedResult.suggestedTitle}
                disabled={isUploading || isAnalyzing}
                onChange={(e) => onSuggestedTitleChange(e.target.value)}
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
                <span className="font-bold block opacity-70 mb-1.5">
                  Detected Tags:
                </span>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {suggestedResult.productTags.map((tag, index) => (
                    <TagBadge
                      key={`${tag}-${index}`}
                      tag={tag}
                      style={styleMap[tag] || fallbackTagStyle}
                      readOnly={false}
                      onRemove={onRemoveTag}
                    />
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
                  onClick={onConfirmAndUpload}
                  disabled={isUploading || isAnalyzing}
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
                  onClick={onDiscardSuggested}
                  disabled={isUploading || isAnalyzing}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

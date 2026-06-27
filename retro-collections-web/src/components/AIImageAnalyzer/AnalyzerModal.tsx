import { useId, type ChangeEvent } from 'react';
import TagBadge from '../TagBadge';
import type { FolderType } from '../../api/firestore/types/shared';
import type { AnalyzerEngine, SuggestedResult, TagStyle } from './types';

interface AnalyzerModalProps {
  selectedFolder: FolderType | null;
  images: Array<File | null>;
  previews: string[];
  driveFileIds: Array<string | null>;
  imageSyncStates: Array<
    'local' | 'synced' | 'pending-upload' | 'pending-delete' | 'error'
  >;
  newFolderName: string;
  selectedAIIndexes: number[];
  engine: AnalyzerEngine;
  suggestedResult: SuggestedResult | null;
  errorMessage: string | null;
  isAnalyzing: boolean;
  isUploading: boolean;
  globalLoading: boolean;
  driveSyncEnabled: boolean;
  isSyncingDrive: boolean;
  folderSyncStatus: 'off' | 'pending' | 'synced';
  styleMap: Record<string, TagStyle>;
  fallbackTagStyle: TagStyle;
  onClose: () => void;
  onOpenDrive: () => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onEditPreview: (index: number) => void;
  onRemovePreview: (index: number) => void;
  onToggleImageForAI: (index: number) => void;
  onFolderNameChange: (name: string) => void;
  onDriveSyncToggle: (enabled: boolean) => void;
  onEngineChange: (engine: AnalyzerEngine) => void;
  onAnalyze: () => void;
  onDiscardSuggested: () => void;
  onRemoveTag: (tag: string) => void;
}

export function AnalyzerModal({
  selectedFolder,
  images,
  previews,
  driveFileIds,
  imageSyncStates,
  newFolderName,
  selectedAIIndexes,
  engine,
  suggestedResult,
  errorMessage,
  isAnalyzing,
  isUploading,
  globalLoading,
  driveSyncEnabled,
  isSyncingDrive,
  folderSyncStatus,
  styleMap,
  fallbackTagStyle,
  onClose,
  onOpenDrive,
  onFileChange,
  onEditPreview,
  onRemovePreview,
  onToggleImageForAI,
  onFolderNameChange,
  onDriveSyncToggle,
  onEngineChange,
  onAnalyze,
  onDiscardSuggested,
  onRemoveTag,
}: AnalyzerModalProps) {
  const fileInputId = useId();
  const hasAISelection = selectedAIIndexes.length > 0;
  const activeImagesCount = images.filter(Boolean).length;

  const renderSyncIcon = (status: 'synced' | 'pending' | 'updating') => {
    if (status === 'synced') {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          className="h-3 w-3 shrink-0"
          aria-hidden="true"
        >
          <path
            d="M20 6 9 17l-5-5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        className={`h-3 w-3 shrink-0 ${status === 'updating' ? 'animate-spin' : 'animate-pulse'}`}
        aria-hidden="true"
      >
        <path
          d="M4 12a8 8 0 0 1 13.66-5.66L20 8V3m0 5h-5m16 4a8 8 0 0 1-13.66 5.66L4 16v5m0-5h5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="modal modal-open z-[9999] backdrop-blur-sm fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="modal-box bg-base-200 max-w-md h-full sm:h-auto w-full p-6 border border-base-300 rounded-2xl shadow-xl space-y-4 relative">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
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
          {activeImagesCount > 0 && (
            <div className="text-[11px] text-success font-medium bg-base-100 px-3 py-1.5 rounded-lg border border-base-300 mt-1 truncate">
              {activeImagesCount === 1
                ? `Selected photo: ${images.find(Boolean)?.name || ''}`
                : `${activeImagesCount} photos selected.`}
            </div>
          )}
        </div>

        {previews.length > 0 && (
          <div className="flex gap-2 overflow-x-auto py-1 bg-base-100 p-2 rounded-lg border border-base-300">
            {previews.map((src, index) => {
              const isLocalMissing = !images[index];
              const syncState = imageSyncStates[index];
              const isSynced = syncState === 'synced';
              const isUnsynced = !isSynced;
              const hasDriveFile = Boolean(driveFileIds[index]);
              let syncLabel: string;
              if (isLocalMissing && hasDriveFile) {
                syncLabel = 'Pending delete';
              } else if (isSynced) {
                syncLabel = 'Synced';
              } else if (hasDriveFile) {
                syncLabel = 'Updating';
              } else {
                syncLabel = 'Pending upload';
              }
              const syncTone = isSynced ? 'badge-success' : 'badge-warning';
              const syncIconState = isSynced
                ? 'synced'
                : hasDriveFile
                  ? 'updating'
                  : 'pending';

              return (
                <div key={index} className="relative w-30 h-30 flex-shrink-0">
                  <img
                    src={src}
                    alt={`Preview ${index}`}
                    className={`w-30 h-30 object-cover rounded-md border border-base-300 ${isUnsynced ? 'opacity-60' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => onEditPreview(index)}
                    disabled={globalLoading || isLocalMissing}
                    className="btn btn-circle btn-xs btn-neutral absolute top-1 left-1 min-h-0 h-7 w-7"
                    aria-label={`Edit photo ${index + 1}`}
                    title="Edit photo"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemovePreview(index)}
                    disabled={globalLoading}
                    className="btn btn-circle btn-xs btn-error text-white absolute top-1 right-1 min-h-0 h-7 w-7"
                    aria-label={`Remove photo ${index + 1}`}
                    title="Remove photo"
                  >
                    ✕
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleImageForAI(index)}
                    disabled={globalLoading || isLocalMissing}
                    className={`btn btn-circle btn-xs absolute bottom-1 left-1/2 -translate-x-1/2 min-h-0 h-7 w-7 p-0 text-[10px] leading-none ${
                      selectedAIIndexes.includes(index)
                        ? 'btn-primary'
                        : 'btn-outline btn-base-content/40'
                    }`}
                    aria-label={`${selectedAIIndexes.includes(index) ? 'Remove' : 'Add'} photo ${index + 1} ${selectedAIIndexes.includes(index) ? 'from' : 'to'} AI selection`}
                    title={
                      selectedAIIndexes.includes(index)
                        ? 'Selected for AI'
                        : 'Select for AI'
                    }
                  >
                    AI
                  </button>

                  <span
                    className={`badge badge-xs absolute bottom-1 right-1 gap-1 ${syncTone}`}
                  >
                    {renderSyncIcon(syncIconState)}
                    <span>{syncLabel}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {activeImagesCount > 0 && (
          <div className="text-[11px] opacity-70">
            AI selection: {selectedAIIndexes.length} / {activeImagesCount}{' '}
            photos
          </div>
        )}

        {activeImagesCount > 0 && selectedFolder && (
          <div className="form-control w-full space-y-1 animate-fadeIn">
            <span className="label-text font-semibold text-xs opacity-80">
              3. New Folder Name
            </span>
            <input
              type="text"
              className="input input-sm input-bordered w-full"
              placeholder="Type a folder name or run AI to suggest one"
              value={newFolderName}
              onChange={(e) => onFolderNameChange(e.target.value)}
              disabled={globalLoading}
            />
            <p className="text-[11px] opacity-60">
              Drive Sync requires this field.
            </p>

            <div className="flex items-center justify-between">
              <label className="label cursor-pointer gap-2 p-0">
                <span className="text-xs font-medium">Drive Sync</span>
                <input
                  type="checkbox"
                  className="toggle toggle-sm"
                  checked={driveSyncEnabled}
                  onChange={(e) => onDriveSyncToggle(e.target.checked)}
                  disabled={globalLoading}
                />
              </label>
              <span
                className={`text-[11px] ${
                  folderSyncStatus === 'synced'
                    ? 'text-success'
                    : folderSyncStatus === 'pending'
                      ? 'text-warning'
                      : 'opacity-60'
                }`}
              >
                {folderSyncStatus === 'synced'
                  ? 'Folder synced'
                  : folderSyncStatus === 'pending'
                    ? 'Folder pending sync'
                    : 'Sync off'}
              </span>
            </div>
            {driveSyncEnabled && (
              <p className="text-[11px] opacity-60">
                Only files and folders created by this tool are modified.
              </p>
            )}
            <div className="text-[11px] opacity-60 bg-base-100/70 border border-base-300 rounded-md px-2 py-1.5 leading-snug">
              Sync legend: Synced = in Drive, Pending upload = local only,
              Pending delete = removed locally and waiting Drive deletion,
              Updating = queued Drive update.
            </div>
            {isSyncingDrive && (
              <p className="text-[11px] text-info">Syncing with Drive...</p>
            )}
          </div>
        )}

        {activeImagesCount > 0 && selectedFolder && (
          <div className="form-control w-full space-y-1 animate-fadeIn">
            <span className="label-text font-semibold text-xs opacity-80">
              4. Choose AI Core Engine
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

        {activeImagesCount > 0 && selectedFolder && (
          <button
            type="button"
            onClick={onAnalyze}
            className="btn btn-sm btn-primary w-full shadow-md"
            disabled={globalLoading || !hasAISelection}
          >
            {isAnalyzing ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              `Analyze Selected Photos Using ${engine === 'github' ? 'GitHub AI' : 'Gemini AI'}`
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
                AI Suggested Folder Name:
              </span>
              <p className="mt-0.5 font-medium bg-base-200/50 p-2 rounded">
                {suggestedResult.suggestedTitle}
              </p>
              <label className="text-[10px] opacity-50 mt-0.5 block">
                The input above is the final folder name used for upload.
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
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={onDiscardSuggested}
                disabled={isUploading || isAnalyzing}
              >
                Discard AI Result
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

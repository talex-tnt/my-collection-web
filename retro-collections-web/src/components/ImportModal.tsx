import { createPortal } from 'react-dom';
import { useState } from 'react';
import DriveBrowser from './DriveBrowser';
import {
  useDriveImport,
  type PreparedImportItem,
} from '../utils/useDriveImport';
import type { FolderType, FileType } from '../api/firestore/types/shared';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (items: PreparedImportItem[]) => Promise<void>;
}

export default function ImportModal({
  isOpen,
  onClose,
  onConfirmImport,
}: ImportModalProps) {
  const {
    analyzeFolder,
    preparedItems,
    isLoadingAnalysis,
    error,
    setPreparedItems,
  } = useDriveImport();
  const [isImporting, setIsImporting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleFolderSelect = (data: {
    folder: FolderType;
    files: FileType[];
  }) => {
    if (data.folder?.id) {
      analyzeFolder(data.folder.id, data.files);
    }
  };

  const handleConfirm = async () => {
    setIsImporting(true);
    await onConfirmImport(preparedItems);
    setIsImporting(false);
    setPreparedItems([]);
    onClose();
  };

  // Define the Modal JSX Tree
  const modalContent = (
    <div
      className="modal modal-open items-center justify-center fixed inset-0 z-50"
      role="dialog"
    >
      <div className="modal-box max-w-2xl bg-base-100 border border-base-200 shadow-2xl p-6 flex flex-col max-h-[90vh] z-10">
        <h3 className="font-bold text-lg mb-2">
          Import Collectibles from Google Drive
        </h3>

        {preparedItems.length === 0 ? (
          <>
            <p className="text-xs text-base-content/60 mb-4">
              Select the root folder containing your{' '}
              <code className="badge badge-sm font-mono">new-items-*.json</code>{' '}
              file and asset subfolders.
            </p>
            <div className="border border-base-300 rounded-lg p-2 bg-base-50 overflow-y-auto flex-grow">
              <DriveBrowser
                onSelectFolder={handleFolderSelect}
                disableScroll={true}
              />
            </div>
            {isLoadingAnalysis && (
              <div className="flex items-center justify-center gap-2 my-4">
                <span className="loading loading-spinner loading-md text-primary" />
                <span className="text-sm font-medium">
                  Analyzing folder structures and resolving images...
                </span>
              </div>
            )}
            {error && (
              <div className="alert alert-error text-xs mt-3">{error}</div>
            )}
          </>
        ) : (
          <div className="flex flex-col flex-grow overflow-hidden">
            <p className="text-sm mb-3 text-success font-medium">
              Analysis complete! Found {preparedItems.length} items ready to
              import:
            </p>

            <div className="overflow-y-auto flex-grow space-y-2 pr-1 border border-base-200 rounded p-2 bg-base-200/40">
              {preparedItems.map((item, idx) => {
                const previewImageId =
                  'id' in item.metadata.previewImage
                    ? item.metadata.previewImage.id
                    : undefined;
                const previewImageName =
                  'name' in item.metadata.previewImage
                    ? item.metadata.previewImage.name
                    : '';
                const imageFolderName =
                  'name' in item.metadata.imageFolder
                    ? item.metadata.imageFolder.name
                    : '';

                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 bg-base-100 p-2 rounded border border-base-300 text-xs shadow-xs"
                  >
                    {previewImageId ? (
                      <img
                        src={`https://drive.google.com/thumbnail?id=${previewImageId}&sz=w100`}
                        className="w-12 h-12 object-contain rounded bg-base-200 shrink-0"
                        alt={previewImageName}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-base-300 flex items-center justify-center shrink-0">
                        🖼️
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-base-content truncate">
                        {item.name}
                      </div>
                      <div className="opacity-60 font-mono text-[10px] whitespace-pre-line">
                        {item.description}
                      </div>
                      {imageFolderName && (
                        <div className="text-[10px] text-primary mt-0.5 truncate">
                          📁 Linked Folder: {imageFolderName}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="modal-action flex gap-2 mt-4">
              <button
                type="button"
                className="btn btn-sm btn-ghost border border-base-300"
                onClick={() => setPreparedItems([])}
                disabled={isImporting}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary flex-1"
                onClick={handleConfirm}
                disabled={isImporting}
              >
                {isImporting ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  'Confirm and Bulk Upload'
                )}
              </button>
            </div>
          </div>
        )}

        {preparedItems.length === 0 && (
          <div className="modal-action mt-4">
            <button
              type="button"
              className="btn btn-sm btn-ghost border border-base-300 w-full"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      <div
        className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-xs z-0"
        onClick={onClose}
      ></div>
    </div>
  );

  // Escapes parent DOM clipping contexts safely by attaching directly to the body node
  return createPortal(modalContent, document.body);
}

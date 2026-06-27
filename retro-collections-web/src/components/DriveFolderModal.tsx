import { createPortal } from 'react-dom';

import type { FileType, FolderType } from '../api/firestore/types/shared';
import { findPreviewImage } from '../utils/findPreviewImage';
import DriveBrowser from './DriveBrowser';

type DriveFolderModalProps = {
  isOpen: boolean;
  selectedFolder?: FolderType;
  onClose: () => void;
  onSelectFolder: (data: {
    folder: FolderType;
    files: FileType[];
    previewImage: { id: string; name: string } | null;
  }) => void;
};

function DriveFolderModal({
  isOpen,
  selectedFolder,
  onClose,
  onSelectFolder,
}: DriveFolderModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm">
      <div className="bg-base-100 rounded-lg shadow-lg p-6 relative min-w-[320px] max-w-full sm:max-w-[90vw] max-h-full sm:max-h-[80vh] overflow-auto border border-base-200">
        <button
          type="button"
          className="absolute top-2 right-2 btn btn-xs btn-circle"
          onClick={onClose}
        >
          ✕
        </button>
        <DriveBrowser
          disableScroll
          onSelectFolder={(data) => {
            if (data.folder) {
              const resolvedPreview = findPreviewImage(data.files || []);
              onSelectFolder({
                folder: data.folder,
                files: data.files || [],
                previewImage: resolvedPreview?.id
                  ? {
                      id: resolvedPreview.id,
                      name: resolvedPreview.name ?? '',
                    }
                  : null,
              });
            }
            onClose();
          }}
          selectedFolder={selectedFolder}
        />
      </div>
    </div>,
    document.body
  );
}

export default DriveFolderModal;
import DriveBrowser from '../DriveBrowser';
import type { FileType, FolderType } from '../../api/firestore/types/shared';

interface DriveFolderModalProps {
  onClose: () => void;
  onSelectFolder: (data: { folder: FolderType; files: FileType[] }) => void;
}

export function DriveFolderModal({
  onClose,
  onSelectFolder,
}: DriveFolderModalProps) {
  return (
    <div className="modal modal-open z-[10000] backdrop-blur-sm fixed inset-0 flex items-center justify-center bg-black/60">
      <div className="modal-box bg-base-100 max-w-lg w-11/12 p-6 rounded-2xl shadow-2xl relative border border-base-200">
        <button
          type="button"
          onClick={onClose}
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
        >
          ✕
        </button>

        <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-3">
          Select Google Drive Target Folder
        </h3>

        <div className="border border-base-200 rounded-xl p-3 bg-base-50 max-h-72 overflow-y-auto">
          <DriveBrowser onSelectFolder={onSelectFolder} disableScroll={true} />
        </div>

        <div className="modal-action mt-4">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>
            Cancel Selection
          </button>
        </div>
      </div>
    </div>
  );
}

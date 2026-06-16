import { useState } from 'react';
import { FiEdit2, FiTrash2, FiFolderPlus, FiFolder } from 'react-icons/fi';
import DriveBrowser from './DriveBrowser';

import type { FileType, ImageFolder } from '../api/firestore/types/shared';
import type { Wish } from '../api/firestore/services/misc/userWishes';

interface WishActionsProps {
  wishData: Wish;
  onEdit: () => void;
  onDelete: (wishId: string) => void;
  onImageFolderSelect: ({
    folder,
    files,
  }: {
    folder: ImageFolder;
    files: FileType[];
  }) => void;
  imageFolder?: ImageFolder;
  readonly: boolean;
}

function WishActions({
  wishData,
  onEdit,
  onDelete,
  onImageFolderSelect,
  imageFolder,
  readonly,
}: WishActionsProps) {
  const [showDrivePopup, setShowDrivePopup] = useState(false);

  return (
    <div className="flex gap-2 items-center">
      {showDrivePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-base-100 rounded-lg shadow-lg p-6 relative min-w-[320px] max-w-[90vw] max-h-[80vh] overflow-auto">
            <button
              type="button"
              className="absolute top-2 right-2 btn btn-xs btn-circle"
              onClick={() => setShowDrivePopup(false)}
            >
              x
            </button>
            <DriveBrowser
              disableScroll
              onSelectFolder={(data) => {
                onImageFolderSelect(data);
                setShowDrivePopup(false);
              }}
              selectedFolder={imageFolder}
            />
          </div>
        </div>
      )}

      <div className="flex gap-0">
        {imageFolder && (
          <div className="flex items-center gap-1 bg-base-200 rounded py-1 px-1.5 mr-1 max-w-[100px] truncate">
            <span className="text-[10px] opacity-80 truncate">
              {imageFolder.name}
            </span>
          </div>
        )}
        <button
          type="button"
          data-tip="Select Drive folder"
          className="btn btn-sm btn-ghost tooltip"
          onClick={() => setShowDrivePopup(true)}
          disabled={readonly}
        >
          {imageFolder ? (
            <FiFolder
              size={18}
              className={`text-primary ${readonly ? '' : 'fill-current'}`}
            />
          ) : (
            <FiFolderPlus size={18} />
          )}
        </button>
      </div>

      <button
        type="button"
        className="btn btn-sm btn-ghost tooltip"
        data-tip="Edit name"
        onClick={onEdit}
        disabled={readonly}
      >
        <FiEdit2 size={18} />
      </button>

      <button
        type="button"
        className="btn btn-sm btn-ghost btn-error hover:bg-error/10 tooltip"
        data-tip="Delete wish"
        onClick={() => onDelete(wishData.id)}
        disabled={readonly}
      >
        <FiTrash2 size={18} />
      </button>
    </div>
  );
}

export default WishActions;

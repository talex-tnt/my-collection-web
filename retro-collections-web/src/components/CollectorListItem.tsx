import { motion } from 'framer-motion';
import type { Item } from '../api/firestore/services/misc/userItems';
import Tags from './Tags';
import { FiMaximize2 as Minimize } from 'react-icons/fi';
import { PreviewImage } from './PreviewImage';
interface CollectorListItemProps {
  item: Item;
  showTags?: boolean;
  onExpand?: () => void;
  showPreview?: boolean;
}

function CollectorListItem({
  item,
  showTags = true,
  showPreview = true,
  onExpand,
}: CollectorListItemProps) {
  const imagePreview = item?.metadata?.previewImage as
    | {
        id: string;
        name: string;
        mimeType?: string;
        thumbnailLink?: string;
      }
    | undefined;

  return (
    <motion.div
      layoutId={`expandable-${item.id}`}
      className="flex flex-col gap-2 sm:rounded-lg sm:border sm:border-base-300 bg-base-200 p-4 cursor-pointer"
      onClick={onExpand}
    >
      {/* Tags at the top, toggleable */}
      {showTags && (
        <Tags
          readOnly
          userId={item.userId}
          itemId={item.id}
          tags={item.tags || []}
          isPublicItem={true} // Ensure tags are treated as public for display
        />
      )}
      <div className="flex items-center gap-2">
        <p className="font-bold text-lg">{item.name}</p>
        <button
          type="button"
          className="ml-auto btn btn-xs btn-ghost"
          onClick={onExpand}
        >
          <Minimize className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-row gap-4 justify-between items-start w-full">
        {showPreview && (
          <div className="flex flex-col gap-2" title="Open expanded item">
            {imagePreview?.id && (
              <PreviewImage
                driveId={imagePreview?.id}
                // size="w200"
                alt={imagePreview.name || 'Item preview'}
                className="w-full rounded-md cursor-ne-resize transition-opacity hover:opacity-90" // custom styling still flows through
              />
            )}
          </div>
        )}
        <div className="flex flex-col gap-1 w-full self-stretch">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-base-content/80 whitespace-pre-wrap">
              {item.description}
            </p>
          </div>
          <div className="flex flex-col gap-1 w-full text-xs text-base-content/40 whitespace-pre-wrap mt-auto">
            {/* End Description */}
            {item.createdAt && (
              <span>Created: {new Date(item.createdAt).toLocaleString()}</span>
            )}
            {item.updatedAt && (
              <span>Edited: {new Date(item.updatedAt).toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default CollectorListItem;

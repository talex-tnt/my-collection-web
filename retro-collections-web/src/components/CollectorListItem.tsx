import { motion } from 'framer-motion';
import type { Item } from '../api/firestore/services/misc/userItems';
import Tags from './Tags';
import { FiMaximize2 as Minimize } from 'react-icons/fi';
interface CollectorListItemProps {
  item: Item;
  showTags?: boolean;
  onExpand?: () => void;
}

function CollectorListItem({
  item,
  showTags = true,
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
      className="flex flex-col gap-2 rounded-lg border border-base-300 bg-base-200 p-4 cursor-pointer"
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

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start w-full">
        <div className="flex flex-col gap-2">
          {imagePreview?.id && (
            <img
              loading="lazy"
              // src={imagePreview.thumbnailLink}
              src={`https://drive.google.com/thumbnail?id=${item?.metadata?.previewImage?.id}&sz=w200`}
              // src={'https://drive.google.com/thumbnail?authuser=0&sz=w320&id=YOUR_FILE_ID'.replace(
              //   'YOUR_FILE_ID',
              //   imagePreview.id
              // )}
              referrerPolicy={'no-referrer'}
              alt={imagePreview.name}
              className="w-full h-auto rounded"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-base-content/80 whitespace-pre-wrap">
            {item.description}
          </p>
        </div>
        {/* End Description */}
      </div>
    </motion.div>
  );
}

export default CollectorListItem;

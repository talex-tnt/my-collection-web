import type { Item } from '../api/firestore/services/misc/userItems';
import Tags from './Tags';
import ItemImages from './ItemImages';
import { useDisableScroll, useUISettings } from '../utils/hooks';
import { FiMinimize2 as Minimize } from 'react-icons/fi';
import { PreviewImage } from './PreviewImage';

interface CollectorExpandedItemProps {
  item: Item;
  showTags?: boolean;
  onExpand?: () => void;
  onClose?: () => void;
}

function CollectorExpandedItem({
  item,
  showTags = true,
  onClose,
}: CollectorExpandedItemProps) {
  useDisableScroll();
  const [uiSettings] = useUISettings();
  const collapseItemImages = uiSettings?.collapseImages ?? false;
  const imagePreview = item?.metadata?.previewImage as
    | {
        id: string;
        name: string;
        mimeType?: string;
        thumbnailLink?: string;
      }
    | undefined;
  const imageFolder =
    item?.metadata?.imageFolder &&
    (item.metadata.imageFolder.id ? item.metadata.imageFolder : undefined);

  return (
    <div className="flex flex-col gap-2 bg-base-200 p-4">
      {/* Tags at the top, toggleable */}
      <div className="flex items-center gap-2">
        {showTags && (
          <Tags
            userId={item.userId}
            itemId={item.id}
            tags={item.tags || []}
            isPublicItem={true}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        <p className="font-bold text-lg cursor-pointer hover:underline ">
          {item.name}
        </p>
        <button
          type="button"
          className="ml-auto btn btn-sm btn-ghost"
          onClick={onClose}
        >
          <Minimize className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start w-full">
        {/* Description (left) */}
        <div className="flex flex-col gap-2">
          {imagePreview?.id && (
            <PreviewImage
              driveId={imagePreview?.id}
              size="w200"
              alt={imagePreview.name || 'Item preview'}
              className="w-full rounded-md" // custom styling still flows through
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-base-content/80 whitespace-pre-wrap cursor-pointer hover:underline">
            {item.description}
          </p>
        </div>
        {/* End Description */}
      </div>

      {!collapseItemImages && imageFolder && (
        <ItemImages folder={imageFolder} />
      )}
      {collapseItemImages && imageFolder && (
        <details className="collapse collapse-arrow bg-base-100 rounded">
          <summary className="collapse-title text-sm font-medium cursor-pointer">
            See more images...
          </summary>

          <div className="collapse-content">
            <ItemImages folder={imageFolder} />
          </div>
        </details>
      )}
    </div>
  );
}

export default CollectorExpandedItem;

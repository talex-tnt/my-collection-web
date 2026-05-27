import type { Item } from '../api/firestore/services/misc/userItems';
import Tags from './Tags';
import ItemImages from './ItemImages';

interface CollectorExpandedItemProps {
  item: Item;
  showTags?: boolean;
  onExpand?: () => void;
}

function CollectorExpandedItem({
  item,
  showTags = true,
}: CollectorExpandedItemProps) {
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
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start w-full">
        {/* Description (left) */}
        <div className="flex flex-col gap-2">
          {imagePreview?.id && (
            <img
              loading="lazy"
              // src={imagePreview.thumbnailLink} --- IGNORE ---
              src={`https://drive.google.com/thumbnail?id=${imagePreview?.id}&sz=w200`}
              referrerPolicy={'no-referrer'}
              alt={imagePreview.name}
              className="w-full h-auto rounded"
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

      {imageFolder && <ItemImages folder={imageFolder} />}
      {/* {imageFolder && (
        <details className="collapse collapse-arrow bg-base-100 rounded">
          <summary className="collapse-title text-sm font-medium cursor-pointer">
            See more images...
          </summary>

          <div className="collapse-content">
            <ItemImages folder={imageFolder} />
          </div>
        </details>
      )} */}
    </div>
  );
}

export default CollectorExpandedItem;

import { useState } from 'react';
import {
  useGetPublicUserTagsQuery,
  useUpdateUserWishMutation,
} from '../api/firestore/firestoreApi';
import type { UserTag } from '../api/firestore/services/public/userTags';
import AddUserWishTag from './AddUserWishTag';

interface WishTagsProps {
  userId: string;
  wishId: string;
  wishlistId?: string;
  isPublicWish: boolean;
  tags: string[];
  onTagsChange?: (tags: string[]) => void;
  readOnly?: boolean;
}

export default function WishTags({
  userId,
  wishId,
  wishlistId,
  isPublicWish,
  tags = [],
  onTagsChange,
  readOnly = false,
}: WishTagsProps) {
  const { data: userTags = [] } = useGetPublicUserTagsQuery(
    { userId },
    { skip: !userId }
  );

  const [updateWish] = useUpdateUserWishMutation();
  const [addTagError, setAddTagError] = useState<string | null>(null);

  const styleMap = userTags.reduce<
    Record<string, NonNullable<UserTag['style']> & { imageUrl?: string | null }>
  >((acc, tag) => {
    acc[tag.id] = {
      backgroundColor: tag.style?.backgroundColor || null,
      foregroundColor: tag.style?.foregroundColor || null,
      imageUrl: (tag.style as { imageUrl?: string | null })?.imageUrl || null,
    };
    return acc;
  }, {});

  const handleRemoveTag = async (tagToRemove: string) => {
    setAddTagError(null);
    const updatedTags = tags.filter((tag) => tag !== tagToRemove);

    try {
      await updateWish({
        id: wishId,
        userId,
        updates: { tags: updatedTags },
        isPublicWish,
        wishlistId,
      }).unwrap();
      onTagsChange?.(updatedTags);
    } catch (err: unknown) {
      setAddTagError(
        (err as { message?: string })?.message || 'Failed to remove tag'
      );
    }
  };

  const sortedTags = [...tags].sort((a, b) => {
    const orderA = userTags.find((tag) => tag.id === a)?.order ?? 0;
    const orderB = userTags.find((tag) => tag.id === b)?.order ?? 0;
    return orderA - orderB;
  });

  return (
    <div className="w-full">
      <div className="flex flex-row flex-wrap gap-2 items-center justify-start">
        {sortedTags.length > 0 ? (
          sortedTags.map((tag) => {
            const style = styleMap[tag] || {
              backgroundColor: null,
              foregroundColor: null,
              imageUrl: null,
            };

            return (
              <span
                key={tag}
                className={
                  'badge badge-outline flex items-center' +
                  (style.imageUrl ? ' p-0 px-2' : ' gap-2 py-3 px-2.5')
                }
                style={{
                  backgroundColor: style.backgroundColor || undefined,
                  color: style.foregroundColor || undefined,
                }}
              >
                {style.imageUrl && (
                  <img
                    src={style.imageUrl}
                    alt=""
                    className="max-w-[100px] max-h-[22px] object-contain shrink-0"
                    loading="lazy"
                  />
                )}

                {!style.imageUrl && (
                  <span className="truncate max-w-[120px]">{tag}</span>
                )}

                {!readOnly && (
                  <button
                    type="button"
                    className="ml-1 text-xs text-error hover:text-error-content font-bold transition-colors"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() => handleRemoveTag(tag)}
                    tabIndex={0}
                  >
                    x
                  </button>
                )}
              </span>
            );
          })
        ) : (
          <span className="text-xs text-base-content/50 italic">No tags</span>
        )}

        {!readOnly && (
          <AddUserWishTag
            userId={userId}
            wishId={wishId}
            wishlistId={wishlistId}
            isPublicWish={isPublicWish}
            assignedTags={tags}
            userTags={userTags}
            onTagsChange={onTagsChange}
            onError={setAddTagError}
          />
        )}
      </div>

      {addTagError && (
        <div className="text-xs text-error mt-1 w-full">{addTagError}</div>
      )}
    </div>
  );
}

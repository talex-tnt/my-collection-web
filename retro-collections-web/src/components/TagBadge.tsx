import type { UserTag } from '../api/firestore/services/public/userTags';

interface TagBadgeProps {
  tag: string;
  style: NonNullable<UserTag['style']> & { imageUrl?: string | null };
  readOnly: boolean;
  onRemove: (tag: string) => void;
}

export default function TagBadge({
  tag,
  style,
  readOnly,
  onRemove,
}: TagBadgeProps) {
  return (
    <span
      className={
        'badge badge-outline flex items-center' +
        (style.imageUrl ? ' p-0 px-0' : ' gap-2 py-3 px-2.5')
      }
      style={{
        backgroundColor: style.backgroundColor || undefined,
        color: style.foregroundColor || undefined,
      }}
    >
      {/* RENDER THE IMAGE IF PRESENT IN THE TAG DESIGN */}
      {style.imageUrl ? (
        <img
          src={style.imageUrl}
          alt=""
          className={`max-w-[100px] max-h-[22px] object-contain shrink-0 ${
            style.backgroundColor === 'transparent' ? 'px-0' : 'px-2'
          }`}
          loading="lazy"
        />
      ) : (
        <span className="truncate max-w-[120px]">{tag}</span>
      )}

      {!readOnly && (
        <button
          type="button"
          className="ml-1 text-xs text-error hover:text-error-content font-bold transition-colors"
          aria-label={`Remove tag ${tag}`}
          onClick={() => onRemove(tag)}
          tabIndex={0}
        >
          ×
        </button>
      )}
    </span>
  );
}

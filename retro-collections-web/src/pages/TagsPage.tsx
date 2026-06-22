import { useState } from 'react';
import { TagColorPicker } from '../components/TagColorPicker';
import {
  useGetPublicUserTagsQuery,
  useCreatePublicUserTagMutation,
  useDeletePublicUserTagMutation,
  useUpdatePublicUserTagMutation,
} from '../api/firestore/firestoreApi';

import { AVAILABLE_TAG_IMAGES, TAG_COLOR_PAIRS } from '../assets/tags';

interface TagsPageProps {
  user?: { uid: string } | null;
}

export default function TagsPage({ user }: TagsPageProps) {
  const userId = user?.uid ?? '';
  const {
    data: tags = [],
    isLoading,
    error,
  } = useGetPublicUserTagsQuery({ userId }, { skip: !userId });

  const [createTag] = useCreatePublicUserTagMutation();
  const [deleteTag] = useDeletePublicUserTagMutation();
  const [updateTagStyle] = useUpdatePublicUserTagMutation();

  const [newTag, setNewTag] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Modal selector state tracking which tag is being edited for images
  const [activeImagePickerTagId, setActiveImagePickerTagId] = useState<
    string | null
  >(null);

  const findPairIndex = (bg: string | null, fg: string | null) => {
    return TAG_COLOR_PAIRS.findIndex(
      (pair) => pair.backgroundColor === bg && pair.foregroundColor === fg
    );
  };

  const handleStylePairChange = (
    tagId: string,
    pairIndex: number,
    currentImageUrl?: string | null
  ) => {
    const pair = TAG_COLOR_PAIRS[pairIndex];
    const style = {
      backgroundColor: pair.backgroundColor,
      foregroundColor: pair.foregroundColor,
      imageUrl: currentImageUrl || null,
    };
    updateTagStyle({ userId, tag: tagId, style }).unwrap();
  };

  const handleImageChange = (
    tagId: string,
    imagePath: string | null,
    currentStyle: {
      backgroundColor?: string | null;
      foregroundColor?: string | null;
      imageUrl?: string | null;
    }
  ) => {
    const style = {
      backgroundColor: currentStyle.backgroundColor || null,
      foregroundColor: currentStyle.foregroundColor || null,
      imageUrl: imagePath,
    };
    updateTagStyle({ userId, tag: tagId, style }).unwrap();
  };

  const handleOrderChange = (tagId: string, newOrder: number) => {
    const order = newOrder;
    updateTagStyle({ userId, tag: tagId, order }).unwrap();
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    const tag = newTag.trim();
    if (!tag) return;
    if (tags.some((t) => t.id.toLowerCase() === tag.toLowerCase())) {
      setAddError('Tag already exists');
      return;
    }
    try {
      await createTag({ userId, tag }).unwrap();
      setNewTag('');
    } catch (err: unknown) {
      setAddError(
        (err as { message?: string })?.message || 'Failed to add tag'
      );
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    setDeleteError(null);
    try {
      await deleteTag({ userId, tag: tagId }).unwrap();
    } catch (err: unknown) {
      setDeleteError(
        (err as { message?: string })?.message || 'Failed to delete tag'
      );
    }
  };

  // Helper properties to find the currently focused tag inside the modal markup
  const selectedTagObject = tags.find((t) => t.id === activeImagePickerTagId);
  const selectedTagStyle = (selectedTagObject?.style || {
    backgroundColor: null,
    foregroundColor: null,
  }) as {
    backgroundColor: string | null;
    foregroundColor: string | null;
    imageUrl?: string | null;
  };
  const selectedTagImageUrl = selectedTagStyle?.imageUrl || null;

  // Sorting tags array by order ascending (defaulting to 0 if undefined)
  const sortedTags = [...tags].sort((a, b) => {
    const orderA = a.order ?? 0;
    const orderB = b.order ?? 0;
    return orderA - orderB;
  });

  return (
    <div className="max-w-5xl mx-auto mt-8 p-6 bg-base-200 rounded-lg shadow relative">
      <h1 className="text-2xl font-bold mb-4">Manage Tags</h1>
      <form className="flex gap-2 mb-6" onSubmit={handleAddTag}>
        <input
          type="text"
          className="input input-bordered input-sm flex-1"
          placeholder="New tag name"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
        />
        <button type="submit" className="btn btn-sm btn-primary">
          Add Tag
        </button>
      </form>
      {addError && <div className="text-error text-xs mb-2">{addError}</div>}

      {isLoading ? (
        <div className="text-base-content/60">Loading tags...</div>
      ) : error ? (
        <div className="text-error">Failed to load tags</div>
      ) : sortedTags.length === 0 ? (
        <div className="text-base-content/60 italic">No tags found.</div>
      ) : (
        <ul className="space-y-2">
          {sortedTags.map((tag) => {
            const style = (tag.style || {
              backgroundColor: null,
              foregroundColor: null,
            }) as {
              backgroundColor: string | null;
              foregroundColor: string | null;
            };
            const currentImageUrl =
              (tag.style as { imageUrl?: string | null })?.imageUrl || null;
            const currentOrder = tag.order;

            return (
              <li
                key={tag.id}
                className="flex items-center justify-between gap-2 bg-base-100 rounded px-3 py-2 border border-base-300 shadow-sm"
              >
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="number"
                    className="input input-bordered input-xs w-18 p-0 pl-2 font-mono font-semibold"
                    value={currentOrder ?? ''}
                    onChange={(e) => {
                      if (e.target.value === '') {
                        // handleOrderChange(tag.id, 0);
                        // nothing to do
                      }
                      try {
                        const val = parseInt(e.target.value, 10);
                        handleOrderChange(tag.id, isNaN(val) ? 0 : val);
                      } catch (_err) {
                        console.error(
                          'Invalid order input:',
                          e.target.value,
                          _err
                        );
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '') {
                        // handleOrderChange(tag.id, 0);
                        // nothing to do
                        return;
                      }
                      try {
                        const val = parseInt(e.target.value, 10);
                        handleOrderChange(tag.id, isNaN(val) ? 0 : val);
                      } catch (_err) {
                        console.error(
                          'Invalid order input on blur:',
                          e.target.value,
                          _err
                        );
                      }
                    }}
                    title="Order Number"
                  />

                  <TagColorPicker
                    text={tag.id}
                    valueIndex={findPairIndex(
                      style.backgroundColor,
                      style.foregroundColor
                    )}
                    onChange={(idx) =>
                      handleStylePairChange(tag.id, idx, currentImageUrl)
                    }
                    colorPairs={TAG_COLOR_PAIRS}
                  />

                  {/* BUTTON TRIGGER FOR THE POPUP IMAGE PICKER */}
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost p-1 h-7 min-h-0 flex items-center justify-center bg-base-200/50 hover:bg-base-300 rounded transition-all"
                    onClick={() => setActiveImagePickerTagId(tag.id)}
                    title="Select Icon"
                  >
                    {currentImageUrl ? (
                      <img
                        src={currentImageUrl}
                        alt=""
                        className={`w-16 h-8 mix-blend-normal object-contain`}
                        style={{
                          backgroundColor: `${style.backgroundColor || 'transparent'}`,
                        }}
                      />
                    ) : (
                      <span className="text-xs opacity-70 px-1">🖼️</span>
                    )}
                  </button>
                  {tag.id}
                </div>

                <button
                  className="btn btn-xs btn-error btn-outline"
                  onClick={() => handleDeleteTag(tag.id)}
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {deleteError && (
        <div className="text-error text-xs mt-2">{deleteError}</div>
      )}

      {/* POPUP IMAGE PICKER DIALOG (DaisyUI Modal State Pattern) */}
      {activeImagePickerTagId && (
        <div
          className="modal modal-open items-center justify-center"
          role="dialog"
        >
          <div className="modal-box max-w-md bg-base-100 border border-base-300 shadow-2xl p-6">
            <h3 className="font-bold text-lg mb-1">
              Select Icon for{' '}
              <span className="badge badge-neutral font-mono">
                {activeImagePickerTagId}
              </span>
            </h3>
            <p className="text-xs text-base-content/60 mb-4">
              Choose an icon from your application static directory assets.
            </p>

            {/* GRID DISPLAY LAYOUT CONTAINER WITH FIXED AUTO-ROWS */}
            <div className="grid grid-cols-4 gap-3 max-h-80 overflow-y-auto p-1 mb-6">
              {/* RESET BUTTON */}
              <button
                type="button"
                className={`btn btn-sm h-12 text-xs font-normal shrink-0 ${
                  !selectedTagImageUrl ? 'btn-neutral' : 'btn-outline btn-ghost'
                }`}
                onClick={() => {
                  handleImageChange(
                    activeImagePickerTagId,
                    null,
                    selectedTagStyle
                  );
                }}
              >
                None
              </button>

              {/* LOGO BUTTONS ITERATION */}
              {AVAILABLE_TAG_IMAGES.map((img) => {
                const isSelected = selectedTagImageUrl === img.path;
                const absoluteImagePath = `${import.meta.env.BASE_URL.replace(/\/$/, '')}${img.path}`;
                return (
                  <button
                    key={img.id}
                    type="button"
                    className={`btn btn-sm h-12 p-1.5 flex flex-col items-center justify-center gap-0.5 relative overflow-hidden group shrink-0 ${
                      isSelected
                        ? 'btn-primary border-primary'
                        : 'btn-outline btn-ghost bg-base-200/30 border-base-300 hover:bg-base-300'
                    }`}
                    title={img.label} // Keeps the name accessible on mouse hover
                    onClick={() => {
                      handleImageChange(
                        activeImagePickerTagId,
                        absoluteImagePath,
                        selectedTagStyle
                      );
                    }}
                  >
                    {/* IMAGE CONTAINER WITH HARD LIMITS */}
                    <div
                      className={`w-full flex items-center justify-center bg-transparent`}
                    >
                      <img
                        src={absoluteImagePath}
                        alt={img.label}
                        className={`max-w-full max-h-full object-contain mix-blend-lighten pointer-events-none  ${
                          img?.bgColor ? img?.bgColor : 'bg-transparent'
                        }`}
                        onError={(e) => {
                          // Fallback wrapper if image fails to load or path is broken
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>

                    {/* COMPACT MINI TEXT INSIDE BUTTON */}
                    {/* <span className="text-[9px] leading-none tracking-tight truncate w-full text-center opacity-70 group-hover:opacity-100">
                      {img.label}
                    </span> */}
                  </button>
                );
              })}
            </div>

            <div className="modal-action mt-0">
              <button
                type="button"
                className="btn btn-sm btn-ghost border border-base-300 w-full font-semibold"
                onClick={() => setActiveImagePickerTagId(null)}
              >
                Close
              </button>
            </div>
          </div>
          {/* Backdrop blur click target to safely close the modal */}
          <div
            className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setActiveImagePickerTagId(null)}
          ></div>
        </div>
      )}
    </div>
  );
}

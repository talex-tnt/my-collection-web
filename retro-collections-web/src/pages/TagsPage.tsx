import { useState } from 'react';
import {
  TagColorPicker,
  type TagColorPair,
} from '../components/TagColorPicker';
import {
  useGetPublicUserTagsQuery,
  useCreatePublicUserTagMutation,
  useDeletePublicUserTagMutation,
  useUpdatePublicUserTagMutation,
} from '../api/firestore/firestoreApi';

// Cleaned up with unique IDs and standard asset paths
// Completely updated to match your public/tag-icons directory assets
const AVAILABLE_TAG_IMAGES = [
  // SEGA
  {
    id: 'sega-retro',
    path: '/tag-icons/sega-logo.png',
    label: 'Sega (1975)',
  },
  {
    id: 'sega-genesis',
    path: '/tag-icons/sega-genesis.png',
    label: 'Sega Genesis',
  },
  {
    id: 'master-system',
    path: '/tag-icons/master-system.png',
    label: 'Master System',
  },
  {
    id: 'mega-drive-jp',
    path: '/tag-icons/mega-drive-jp.svg',
    label: 'Mega Drive JP',
  },
  {
    id: 'mega-drive-eu',
    path: '/tag-icons/sega-mega-drive-logo-png-transparent.png',
    label: 'Mega Drive JP',
  },
  {
    id: 'mega-drive-eu-bw',
    path: '/tag-icons/sega-mega-drive-logo-black-and-white.png',
    label: 'Mega Drive JP',
  },
  {
    id: 'saturn-jp',
    path: '/tag-icons/saturn-jap.png',
    label: 'Saturn JP',
    bgColor: 'bg-white',
  },
  {
    id: 'saturn-eu',
    path: '/tag-icons/saturn-usa.png',
    label: 'Saturn USA',
  },
  {
    id: 'dreamcast',
    path: '/tag-icons/sega-dreamcast.png',
    label: 'Dreamcast',
    bgColor: 'bg-white',
  },

  // NINTENDO
  {
    id: 'nintendo-logo',
    path: '/tag-icons/nintendo-logo.png',
    label: 'Nintendo',
  },
  {
    id: 'super-nintendo',
    path: '/tag-icons/super-nintendo-logo.png',
    label: 'Super Nintendo',
  },
  { id: 'nes', path: '/tag-icons/nes.png', label: 'NES' },
  { id: 'game-boy', path: '/tag-icons/game-boy.png', label: 'Game Boy' },
  {
    id: 'nintendo-64',
    path: '/tag-icons/nintendo-64.png',
    label: 'Nintendo 64',
  },
  {
    id: 'nintendo-ds',
    path: '/tag-icons/nintendo-ds.svg',
    label: 'Nintendo DS',
    bgColor: 'bg-white',
  },
  { id: 'nintendo-wii', path: '/tag-icons/nintendo-wii.png', label: 'Wii' },
  { id: 'wii-u', path: '/tag-icons/wii-u.png', label: 'Wii U' },
  {
    id: 'nintendo-switch',
    path: '/tag-icons/nintendo-switch.png',
    label: 'Nintendo Switch',
  },

  // PLAYSTATION
  {
    id: 'sony',
    path: '/tag-icons/sony.png',
    label: 'SONY',
    bgColor: 'bg-white',
  },
  {
    id: 'playstation-retro',
    path: '/tag-icons/ps1.png',
    label: 'PlayStation (Classic)',
  },
  {
    id: 'ps2',
    path: '/tag-icons/ps2.png',
    label: 'PlayStation 2',
    bgColor: 'bg-white',
  },
  {
    id: 'ps3',
    path: '/tag-icons/ps3.png',
    label: 'PlayStation 3',
    bgColor: 'bg-white',
  },
  {
    id: 'ps4',
    path: '/tag-icons/ps4.png',
    label: 'PlayStation 4',
    bgColor: 'bg-white',
  },
  {
    id: 'ps5',
    path: '/tag-icons/ps5.png',
    label: 'PlayStation 5',
    bgColor: 'bg-white',
  },

  // XBOX
  {
    id: 'microsoft',
    path: '/tag-icons/microsoft.png',
    label: 'Miscrosoft',
    bgColor: 'bg-white',
  },
  {
    id: 'xbox-classic',
    path: '/tag-icons/xbox-logo-2001-2005.png',
    label: 'Xbox (Classic)',
  },
  { id: 'xbox-360', path: '/tag-icons/xbox-360-logo.png', label: 'Xbox 360' },
  {
    id: 'xbox-2010',
    path: '/tag-icons/xbox-logo-2010-2013.png',
    label: 'Xbox (2010)',
  },
];

const TAG_COLOR_PAIRS = [
  { name: 'Default', backgroundColor: null, foregroundColor: null },
  {
    name: 'Logo',
    backgroundColor: 'transparent',
    foregroundColor: 'transparent',
  },
  // Base colors
  { name: 'Red', backgroundColor: '#f87171', foregroundColor: '#fff' },
  { name: 'Amber', backgroundColor: '#fbbf24', foregroundColor: '#222' },
  { name: 'Green', backgroundColor: '#34d399', foregroundColor: '#222' },
  { name: 'Blue', backgroundColor: '#60a5fa', foregroundColor: '#fff' },
  { name: 'Purple', backgroundColor: '#a78bfa', foregroundColor: '#fff' },
  { name: 'Pink', backgroundColor: '#f472b6', foregroundColor: '#222' },
  { name: 'Yellow', backgroundColor: '#facc15', foregroundColor: '#222' },
  { name: 'Gray', backgroundColor: '#d1d5db', foregroundColor: '#222' },
  { name: 'Black', backgroundColor: '#000000', foregroundColor: '#fff' },
  { name: 'White', backgroundColor: '#ffffff', foregroundColor: '#222' },
  { name: 'Dark Blue', backgroundColor: '#1e293b', foregroundColor: '#fff' },

  // 🎮 Console / gaming brand colors
  { name: 'Nintendo', backgroundColor: '#e60012', foregroundColor: '#ffffff' },
  {
    name: 'PlayStation',
    backgroundColor: '#003791',
    foregroundColor: '#ffffff',
  },
  { name: 'Xbox', backgroundColor: '#107C10', foregroundColor: '#ffffff' },
  { name: 'Sega', backgroundColor: '#006db6', foregroundColor: '#ffffff' },
  { name: 'Steam', backgroundColor: '#1b2838', foregroundColor: '#c7d5e0' },
  {
    name: 'Epic Games',
    backgroundColor: '#111111',
    foregroundColor: '#ffffff',
  },
  { name: 'Atari', backgroundColor: '#000000', foregroundColor: '#ff4f00' },
] as TagColorPair[];

interface TagsPageProps {
  user: { uid: string };
}

export default function TagsPage({ user }: TagsPageProps) {
  const userId = user.uid;
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
    currentStyle: (typeof TAG_COLOR_PAIRS)[0] & { imageUrl?: string | null }
  ) => {
    const style = {
      backgroundColor: currentStyle.backgroundColor || null,
      foregroundColor: currentStyle.foregroundColor || null,
      imageUrl: imagePath,
    };
    updateTagStyle({ userId, tag: tagId, style }).unwrap();
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
  const selectedTagStyle = selectedTagObject?.style || {
    backgroundColor: null,
    foregroundColor: null,
  };
  const selectedTagImageUrl =
    (selectedTagObject?.style as { imageUrl?: string | null })?.imageUrl ||
    null;

  return (
    <div className="max-w-xl mx-auto mt-8 p-6 bg-base-200 rounded-lg shadow relative">
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
      ) : tags.length === 0 ? (
        <div className="text-base-content/60 italic">No tags found.</div>
      ) : (
        <ul className="space-y-2">
          {tags.map((tag) => {
            const style = tag.style || {
              backgroundColor: null,
              foregroundColor: null,
            };
            const currentImageUrl =
              (tag.style as { imageUrl?: string | null })?.imageUrl || null;

            return (
              <li
                key={tag.id}
                className="flex items-center justify-between gap-2 bg-base-100 rounded px-3 py-2 border border-base-300 shadow-sm"
              >
                <div className="flex items-center gap-2 flex-1">
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
                        className="w-16 h-8 bg-transparent mix-blend-normal object-contain"
                        style={{
                          backgroundColor: 'transparent !important',
                          background: 'none !important',
                        }}
                      />
                    ) : (
                      <span className="text-xs opacity-70 px-1">🖼️</span>
                    )}
                  </button>
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

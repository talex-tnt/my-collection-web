import { motion } from 'framer-motion';
import type { Item } from '../api/firestore/services/items/userItems';
import ItemActions from './ItemActions';
import { useState } from 'react';
import {
  useUpdateUserItemMutation,
  useDeleteUserItemMutation,
} from '../api/firestore/firestoreApi';
import Tags from './Tags';
import { findPreviewImage } from '../utils/findPreviewImage';
import type { FolderType, FileType } from '../api/firestore/types/shared';
import { FiMaximize2 as Maximaze } from 'react-icons/fi';
interface MyListItemProps {
  item: Item;
  userId: string;
  showTags?: boolean;
  isPublicItem: boolean;
  onExpand?: () => void;
}

function MyListItem({
  item,
  userId,
  showTags = true,
  onExpand,
  isPublicItem,
}: MyListItemProps) {
  const [editingField, setEditingField] = useState<
    'name' | 'description' | null
  >(null);
  const [editValue, setEditValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [updateItem] = useUpdateUserItemMutation();
  const [deleteItem] = useDeleteUserItemMutation();

  const internalDeleteItem = async (itemId: string) => {
    if (!userId) return;
    try {
      await deleteItem({
        id: itemId,
        userId,
        isPublicItem,
      }).unwrap();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const startEditing = (
    field: 'name' | 'description',
    currentValue: string
  ) => {
    setEditingField(field);
    setEditValue(currentValue);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!editingField) return;
    const updates =
      editingField === 'name'
        ? { name: editValue.trim() }
        : { description: editValue };
    try {
      await updateItem({
        id: item.id,
        userId,
        updates,
        isPublicItem,
      }).unwrap();
    } catch (error) {
      console.error('Error updating item:', error);
    }
    setEditing(false);
    setEditingField(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditingField(null);
    setEditValue('');
  };
  const imageFolder =
    item?.metadata?.imageFolder &&
    (item.metadata.imageFolder.id ? item.metadata.imageFolder : undefined);
  const imagePreview = item?.metadata?.previewImage as
    | {
        id: string;
        name: string;
        mimeType?: string;
        thumbnailLink?: string;
      }
    | undefined;

  const setImageFolder = async ({
    folder,
    files,
  }: {
    folder: FolderType;
    files: FileType[];
  }) => {
    console.log('Set image folder:', folder);
    if (!userId) return;
    const previewImage = findPreviewImage(files);
    const metadata = {
      ...item.metadata,
      imageFolder: folder?.id ? folder : {},
      previewImage: previewImage?.id
        ? { id: previewImage.id, name: previewImage.name }
        : {},
    };
    try {
      await updateItem({
        id: item.id,
        userId,
        updates: {
          metadata,
        },
        isPublicItem,
      }).unwrap();
    } catch (error) {
      console.error('Error updating image folder:', error);
    }
  };
  return (
    <motion.div
      layoutId={`expandable-${item.id}`}
      className="flex flex-col gap-2 rounded-lg border border-base-300 bg-base-200 p-4"
      // onClick={(e) => {
      //   const target = e.target as HTMLElement;

      //   // prevent interfering with inputs/buttons
      //   if (target.closest('input, textarea, button, select')) return;

      //   // prevent double-click breaking expand
      //   if (e.detail > 1) return;

      //   onExpand?.();
      // }}
    >
      {/* Tags at the top, toggleable */}
      <div className="flex items-center gap-2">
        {showTags && (
          <Tags
            userId={item.userId}
            itemId={item.id}
            tags={item.tags || []}
            isPublicItem={isPublicItem}
          />
        )}
        <button className="btn btn-ghost btn-xs" onClick={onExpand}>
          <Maximaze />
        </button>
      </div>
      <div className="flex items-center gap-2">
        {editing && editingField === 'name' ? (
          <input
            className="input input-sm input-bordered font-medium w-full max-w-xs"
            value={editValue}
            autoFocus
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
          />
        ) : (
          <p
            className="font-bold text-lg cursor-pointer hover:underline "
            onDoubleClick={() => startEditing('name', item.name)}
            title="Double-click to edit name"
          >
            {item.name}
          </p>
        )}
      </div>

      <div className="flex flex-row gap-4 justify-between items-start w-full">
        {/* Description (left) */}
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
          {editing && editingField === 'description' ? (
            <textarea
              className="textarea textarea-bordered textarea-sm w-full"
              value={editValue}
              autoFocus
              rows={2}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  saveEdit();
                }
                if (e.key === 'Escape') cancelEdit();
              }}
            />
          ) : item.description ? (
            <p
              className="text-sm text-base-content/80 whitespace-pre-wrap cursor-pointer hover:underline"
              onDoubleClick={() =>
                startEditing('description', item.description || '')
              }
              title="Double-click to edit description"
            >
              {item.description}
            </p>
          ) : (
            <p
              className="text-sm text-base-content/80 italic cursor-pointer hover:underline"
              onDoubleClick={() => startEditing('description', '')}
              title="Double-click to add description"
            >
              Add description...
            </p>
          )}
        </div>
        {/* End Description */}
      </div>

      {/* Visibility, dates, and actions row */}
      <div className="flex flex-row gap-4 items-center text-xs text-base-content/60 justify-between w-full mt-1">
        <div className="flex flex-row gap-4 items-center">
          <span>
            Visibility:{' '}
            <span
              className={isPublicItem ? 'text-green-600' : 'text-yellow-600'}
            >
              {isPublicItem ? 'Public' : 'Private'}
            </span>
          </span>
          {item.createdAt && (
            <span>Created: {new Date(item.createdAt).toLocaleString()}</span>
          )}
          {item.updatedAt && (
            <span>Edited: {new Date(item.updatedAt).toLocaleString()}</span>
          )}
        </div>
        <div className="flex flex-row items-center">
          <ItemActions
            itemData={item}
            isPublicItem={isPublicItem}
            onEdit={() => startEditing('name', item.name)}
            onDelete={internalDeleteItem}
            onImageFolderSelect={setImageFolder}
            imageFolder={imageFolder}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default MyListItem;

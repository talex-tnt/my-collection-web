import { useState, useMemo } from 'react';
import {
  useGetUserCollectionsQuery,
  useCreateUserCollectionMutation,
  useUpdateUserCollectionMutation,
  useDeleteUserCollectionMutation,
} from '../api/firestore/firestoreApi';
import CollapsePanel from './CollapsePanel'; // Make sure the path matches your project structure

interface Collection {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt?: string;
  description?: string;
  tags?: string[];
}

interface MyCollectionsListProps {
  userId: string;
  isPublicCollection: boolean;
  readOnly?: boolean;
  onCollectionClick?: (collection: Collection) => void;
}

function CollectionsList({
  userId,
  isPublicCollection,
  readOnly = false,
  onCollectionClick,
}: MyCollectionsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const {
    data: collectionsData,
    isLoading,
    error,
  } = useGetUserCollectionsQuery(
    {
      userId: userId || '',
      isPublicCollection,
    },
    { skip: !userId }
  );

  const [createCollection] = useCreateUserCollectionMutation();
  const [updateCollection] = useUpdateUserCollectionMutation();
  const [deleteCollection] = useDeleteUserCollectionMutation();

  const filteredCollections = useMemo(() => {
    return (collectionsData?.collections || []).filter((col) =>
      col.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [collectionsData?.collections, searchTerm]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || readOnly || !userId) return;

    try {
      await createCollection({
        userId: userId,
        isPublicCollection,
        name: newName.trim(),
        description: newDesc.trim(),
      }).unwrap();

      setNewName('');
      setNewDesc('');

      // Programmatically blurs focus to help reset native UI states if needed
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-2">
      {/* REUSABLE COLLAPSIBLE PANEL */}
      {!readOnly && (
        <CollapsePanel title="Create New Collection">
          <form
            onSubmit={handleCreate}
            className="flex flex-col md:flex-row gap-2"
          >
            <input
              type="text"
              placeholder="Collection Name"
              maxLength={100}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input input-sm input-bordered"
              required
            />
            <input
              type="text"
              placeholder="Description (Optional)"
              maxLength={1000}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="input input-sm input-bordered"
            />
            <button type="submit" className="btn btn-sm btn-primary">
              Add
            </button>
          </form>
        </CollapsePanel>
      )}

      {/* LIST */}
      <CollapsePanel
        title={`My Collections (${collectionsData?.collections.length || 0})`}
        className="collapse-open bg-base-100"
      >
        <div className="flex flex-col md:flex-row md:justify-between items-center gap-2">
          <input
            type="text"
            placeholder="Search collection by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input input-sm input-bordered w-full max-w-sm"
          />
        </div>
        {error ? (
          <div className="alert alert-error">Error loading collections</div>
        ) : isLoading ? (
          <div className="alert alert-info">Loading...</div>
        ) : filteredCollections.length === 0 ? (
          <div className="alert alert-info">No collections found</div>
        ) : (
          filteredCollections.map((collection) => (
            <MyCollectionItem
              key={collection.id}
              collection={collection}
              userId={userId || ''}
              isPublicCollection={isPublicCollection}
              readOnly={readOnly}
              onUpdate={updateCollection}
              onDelete={deleteCollection}
              onSelect={onCollectionClick}
            />
          ))
        )}
      </CollapsePanel>
    </div>
  );
}

export default CollectionsList;

/* ============================================================================
   SUB-COMPONENT: MyCollectionItem
   ============================================================================ */
interface MyCollectionItemProps {
  collection: Collection;
  userId: string;
  isPublicCollection: boolean;
  readOnly: boolean;
  onUpdate: ReturnType<typeof useUpdateUserCollectionMutation>[0];
  onDelete: ReturnType<typeof useDeleteUserCollectionMutation>[0];
  onSelect?: (collection: Collection) => void;
}

function MyCollectionItem({
  collection,
  userId,
  isPublicCollection,
  readOnly,
  onUpdate,
  onDelete,
  onSelect,
}: MyCollectionItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(collection.name);
  const [editDesc, setEditDesc] = useState(collection.description || '');

  const handleSave = async () => {
    if (readOnly) return;
    if (
      editName.trim() === collection.name &&
      editDesc.trim() === (collection.description || '')
    ) {
      setIsEditing(false);
      return;
    }
    if (!editName.trim()) return;

    try {
      await onUpdate({
        id: collection.id,
        userId,
        isPublicCollection,
        updates: {
          name: editName.trim(),
          description: editDesc.trim(),
        },
      }).unwrap();
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditName(collection.name);
      setEditDesc(collection.description || '');
      setIsEditing(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    if (window.confirm(`Delete collection "${collection.name}"?`)) {
      try {
        await onDelete({
          id: collection.id,
          userId,
          isPublicCollection,
        }).unwrap();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  return (
    <div
      onClick={() => !isEditing && onSelect?.(collection)}
      className={`flex items-center justify-between p-3 bg-base-200 rounded-lg hover:bg-base-300 transition-colors group ${
        isEditing ? 'cursor-default' : 'cursor-pointer'
      }`}
    >
      <div className="flex-1 min-w-0 pr-4 select-none">
        {isEditing ? (
          <div
            className="flex flex-col gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              value={editName}
              maxLength={100}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input input-xs input-bordered w-full max-w-xs focus:input-primary"
              autoFocus
            />
            <input
              type="text"
              value={editDesc}
              maxLength={1000}
              onChange={(e) => setEditDesc(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input input-xs input-bordered w-full max-w-md"
              placeholder="Description..."
            />
            <div className="flex gap-2">
              <button onClick={handleSave} className="btn btn-xs btn-success">
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="btn btn-xs btn-ghost"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="font-bold truncate text-sm">{collection.name}</div>
            <div className="text-xs opacity-60 truncate">
              {collection.description || (
                <span className="italic opacity-40">No description</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!readOnly && !isEditing && (
          <>
            <button
              onClick={handleEditClick}
              className="btn btn-xs btn-outline btn-secondary group-hover:opacity-100"
            >
              Edit
            </button>

            <button
              onClick={handleDelete}
              className="btn btn-xs btn-error btn-ghost group-hover:opacity-100"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

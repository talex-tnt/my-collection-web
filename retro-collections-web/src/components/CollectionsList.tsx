import { useState, useMemo } from 'react';

import {
  useGetUserCollectionsQuery,
  useCreateUserCollectionMutation,
  useUpdateUserCollectionMutation,
  useDeleteUserCollectionMutation,
} from '../api/firestore/firestoreApi';
import CollapsePanel from './CollapsePanel';
import { type CollectionType } from './Collection';
import Collection from './Collection';
interface CollectionsListProps {
  userId: string;
  isPublicCollection: boolean;
  readOnly?: boolean;
  onCollectionClick?: (collection: CollectionType) => void;
}

function CollectionsList({
  userId,
  isPublicCollection,
  readOnly = false,
  onCollectionClick,
}: CollectionsListProps) {
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

  // Client-side search filtering by collection name
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

      // Safely remove active focus to reset inputs
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-2">
      {/* REUSABLE COLLAPSIBLE PANEL FOR CREATION */}
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
              className="input input-sm input-bordered w-full"
            />
            <button type="submit" className="btn btn-sm btn-primary">
              Add
            </button>
          </form>
        </CollapsePanel>
      )}

      {/* COLLECTIONS MANAGEMENT LIST */}
      <CollapsePanel
        title={`My Collections (${collectionsData?.collections.length || 0})`}
        className="collapse-open bg-base-100"
      >
        <div className="flex flex-col md:flex-row md:justify-between items-center gap-2 mb-4">
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
          <div className="flex flex-col gap-2">
            {filteredCollections.map((collection) => (
              <Collection
                key={collection.id}
                collection={collection}
                userId={userId || ''}
                isPublicCollection={isPublicCollection}
                readOnly={readOnly}
                onUpdate={updateCollection}
                onDelete={deleteCollection}
                onSelect={onCollectionClick}
              />
            ))}
          </div>
        )}
      </CollapsePanel>
    </div>
  );
}

export default CollectionsList;

import { useState } from 'react';
import CollectorItemsList from './CollectorItemsList';
import ItemsFilters from './ItemsFilters';
import type { Collection } from '../api/firestore/services/misc/userCollections';
import { useGetUserCollectionQuery } from '../api/firestore/firestoreApi';
import { useParams } from 'react-router-dom';

function CollectorFilterableItems({ userId }: { userId?: string }) {
  const [itemNameClientFilter, setItemNameClientFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [startWithNameFilter, setStartWithNameFilter] = useState('');
  const [nameContainsTokens, setNameContainsTokens] = useState('');

  const { collectionId } = useParams<{ collectionId: string }>();

  const collection = useGetUserCollectionQuery(
    { id: collectionId || '', userId: userId || '', isPublicCollection: true },
    {
      skip: !collectionId,
    }
  ).data as Collection | undefined;

  return (
    <>
      {collectionId && collection?.description && (
        <div className="flex flex-col p-0 px-2">
          <p className="text-sm opacity-70 mt-1">{collection.description}</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        {/* Left column: NewItem and future filters */}
        <div className="md:col-span-2 space-y-6">
          <ItemsFilters
            userId={userId || ''}
            itemNameClientFilter={itemNameClientFilter}
            onItemNameClientFilterChange={setItemNameClientFilter}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            startWithNameFilter={startWithNameFilter}
            onStartWithNameFilterChange={setStartWithNameFilter}
            nameContainsTokens={nameContainsTokens}
            onNameContainsTokensChange={setNameContainsTokens}
          />
        </div>
        {/* Center column: ItemsList */}
        <div className="md:col-span-4">
          <CollectorItemsList
            userId={userId}
            itemNameClientFilter={itemNameClientFilter}
            selectedTags={selectedTags}
            startWithNameFilter={startWithNameFilter}
            nameContainsTokens={nameContainsTokens}
            collectionId={collectionId}
          />
        </div>
      </div>
    </>
  );
}

export default CollectorFilterableItems;

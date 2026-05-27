import { useState } from 'react';
import { useParams } from 'react-router-dom';
import MyItemsList from './MyItemsList';
import NewItem from './NewItem';
import ItemsFilters from './ItemsFilters';
import type { User } from 'firebase/auth/web-extension';
import type { Collection } from '../api/firestore/services/misc/userCollections';
import { useGetUserCollectionQuery } from '../api/firestore/firestoreApi';

function MyCollectionItems({
  user,
  isPublicCollection,
}: {
  user: User;
  isPublicCollection: boolean;
}) {
  const { collectionId } = useParams<{ collectionId: string }>();

  const collection = useGetUserCollectionQuery(
    { id: collectionId || '', userId: user.uid, isPublicCollection },
    {
      skip: !collectionId,
    }
  ).data as Collection | undefined;

  const [itemNameClientFilter, setItemNameClientFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [startWithNameFilter, setStartWithNameFilter] = useState('');
  const [nameContainsTokens, setNameContainsTokens] = useState('');

  return (
    <div className="space-y-6">
      {collection?.description && (
        <div className="flex flex-col p-0 px-8">
          <p className="text-sm opacity-70 mt-1">{collection.description}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        {/* Left column: NewItem and filters */}
        <div className="md:col-span-2 space-y-6">
          <NewItem
            userId={user.uid}
            isPublicItem={isPublicCollection}
            collectionId={collectionId}
          />
          <ItemsFilters
            userId={user.uid}
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
          <MyItemsList
            user={user}
            itemNameClientFilter={itemNameClientFilter}
            selectedTags={selectedTags}
            isPublicItem={isPublicCollection}
            startWithNameFilter={startWithNameFilter}
            nameContainsTokens={nameContainsTokens}
            collectionId={collectionId}
          />
        </div>
      </div>
    </div>
  );
}

export default MyCollectionItems;

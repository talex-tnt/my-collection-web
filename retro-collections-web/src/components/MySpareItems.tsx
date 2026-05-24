import { useState } from 'react';
import MyItemsList from './MyItemsList';
import NewItem from './NewItem';
import ItemsFilters from './ItemsFilters';
import type { User } from 'firebase/auth/web-extension';

function MySpareItems({ user }: { user: User }) {
  const [itemNameClientFilter, setItemNameClientFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [visibilityFilter, setVisibilityFilter] = useState<
    'public' | 'private'
  >('public');
  const [startWithNameFilter, setStartWithNameFilter] = useState('');
  const [nameContainsTokens, setNameContainsTokens] = useState('');

  const isPublicItem = visibilityFilter === 'public';
  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
      {/* Left column: NewItem and future filters */}
      <div className="md:col-span-2 space-y-6">
        <NewItem userId={user.uid} isPublicItem={isPublicItem} />
        <ItemsFilters
          userId={user.uid}
          itemNameClientFilter={itemNameClientFilter}
          onItemNameClientFilterChange={setItemNameClientFilter}
          selectedTags={selectedTags}
          setSelectedTags={setSelectedTags}
          visibilityFilter={visibilityFilter}
          onVisibilityFilterChange={setVisibilityFilter}
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
          isPublicItem={isPublicItem}
          startWithNameFilter={startWithNameFilter}
          nameContainsTokens={nameContainsTokens}
        />
      </div>
    </div>
  );
}

export default MySpareItems;

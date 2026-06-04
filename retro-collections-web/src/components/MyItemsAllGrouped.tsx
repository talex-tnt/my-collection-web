import { useState } from 'react';
import ItemsFilters from './ItemsFilters';
import type { User } from 'firebase/auth/web-extension';
import MyItemsListAll from './MyItemsListAll';

function MyItemsAllGrouped({ user }: { user: User }) {
  const [itemNameClientFilter, setItemNameClientFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [startWithNameFilter, setStartWithNameFilter] = useState('');
  const [nameContainsTokens, setNameContainsTokens] = useState('');

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
      <div className="md:col-span-2">
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
      <div className="md:col-span-4">
        <MyItemsListAll
          user={user}
          itemNameClientFilter={itemNameClientFilter}
          selectedTags={selectedTags}
          startWithNameFilter={startWithNameFilter}
          nameContainsTokens={nameContainsTokens}
        />
      </div>
    </div>
  );
}

export default MyItemsAllGrouped;

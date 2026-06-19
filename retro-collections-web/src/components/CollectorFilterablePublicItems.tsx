import { useState } from 'react';
import CollectorPublicItemsList from './CollectorPublicItemsList';
import ItemsFilters from './ItemsFilters';

function CollectorFilterablePublicItems({ userId }: { userId?: string }) {
  const [itemNameClientFilter, setItemNameClientFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [startWithNameFilter, setStartWithNameFilter] = useState('');
  const [nameContainsTokens, setNameContainsTokens] = useState('');

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
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
      <div className="md:col-span-4">
        <CollectorPublicItemsList
          userId={userId}
          itemNameClientFilter={itemNameClientFilter}
          selectedTags={selectedTags}
          startWithNameFilter={startWithNameFilter}
          nameContainsTokens={nameContainsTokens}
        />
      </div>
    </div>
  );
}

export default CollectorFilterablePublicItems;

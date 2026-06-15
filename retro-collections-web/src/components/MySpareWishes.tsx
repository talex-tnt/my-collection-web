import { useState } from 'react';
import type { User } from 'firebase/auth/web-extension';
import NewWish from './NewWish';
import WishesFilters from './WishesFilters';
import MyWishesList from './MyWishesList';

function MySpareWishes({
  user,
  isPublicWish,
}: {
  user: User;
  isPublicWish: boolean;
}) {
  const [wishNameClientFilter, setWishNameClientFilter] = useState('');
  const [selectedWishTags, setSelectedWishTags] = useState<string[]>([]);
  const [startWithNameFilter, setStartWithNameFilter] = useState('');
  const [nameContainsTokens, setNameContainsTokens] = useState('');

  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
      <div className="md:col-span-2 space-y-6">
        <NewWish userId={user.uid} isPublicWish={isPublicWish} />
        <WishesFilters
          userId={user.uid}
          wishNameClientFilter={wishNameClientFilter}
          onWishNameClientFilterChange={setWishNameClientFilter}
          selectedWishTags={selectedWishTags}
          setSelectedWishTags={setSelectedWishTags}
          startWithNameFilter={startWithNameFilter}
          onStartWithNameFilterChange={setStartWithNameFilter}
          nameContainsTokens={nameContainsTokens}
          onNameContainsTokensChange={setNameContainsTokens}
        />
      </div>
      <div className="md:col-span-4">
        <MyWishesList
          user={user}
          wishNameClientFilter={wishNameClientFilter}
          selectedWishTags={selectedWishTags}
          isPublicWish={isPublicWish}
          startWithNameFilter={startWithNameFilter}
          nameContainsTokens={nameContainsTokens}
        />
      </div>
    </div>
  );
}

export default MySpareWishes;

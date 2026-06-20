import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGetUserWishlistQuery } from '../api/firestore/firestoreApi';
import type { Wishlist } from '../api/firestore/services/misc/userWishlists';
import WishesFilters from './WishesFilters';
import CollectorWishesList from './CollectorWishesList';

function CollectorFilterableWishes({ userId }: { userId?: string }) {
  const [wishNameClientFilter, setWishNameClientFilter] = useState('');
  const [selectedWishTags, setSelectedWishTags] = useState<string[]>([]);
  const [startWithNameFilter, setStartWithNameFilter] = useState('');
  const [nameContainsTokens, setNameContainsTokens] = useState('');

  const { wishlistId } = useParams<{ wishlistId: string }>();

  const wishlist = useGetUserWishlistQuery(
    { id: wishlistId || '', userId: userId || '', isPublicWishlist: true },
    { skip: !wishlistId || !userId }
  ).data as Wishlist | undefined;

  return (
    <div className="ml-0 md:ml-4">
      {wishlistId && wishlist?.name ? (
        <div className="flex flex-col p-0 py-2">
          <p className="text-md mt-1">{wishlist.name}</p>
        </div>
      ) : null}
      {wishlistId && wishlist?.description ? (
        <div className="flex flex-col p-0 px-2">
          <p className="text-sm opacity-70 mt-1">{wishlist.description}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <div className="md:col-span-2 space-y-6">
          <WishesFilters
            userId={userId || ''}
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
          <CollectorWishesList
            userId={userId}
            wishNameClientFilter={wishNameClientFilter}
            selectedWishTags={selectedWishTags}
            startWithNameFilter={startWithNameFilter}
            nameContainsTokens={nameContainsTokens}
            wishlistId={wishlistId}
          />
        </div>
      </div>
    </div>
  );
}

export default CollectorFilterableWishes;

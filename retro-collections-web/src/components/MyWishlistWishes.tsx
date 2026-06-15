import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { User } from 'firebase/auth/web-extension';
import { useGetUserWishlistQuery } from '../api/firestore/firestoreApi';
import type { Wishlist } from '../api/firestore/services/misc/userWishlists';
import NewWish from './NewWish';
import WishesFilters from './WishesFilters';
import MyWishesList from './MyWishesList';

function MyWishlistWishes({
  user,
  isPublicWishlist,
}: {
  user: User;
  isPublicWishlist: boolean;
}) {
  const { wishlistId } = useParams<{ wishlistId: string }>();

  const wishlist = useGetUserWishlistQuery(
    { id: wishlistId || '', userId: user.uid, isPublicWishlist },
    { skip: !wishlistId }
  ).data as Wishlist | undefined;

  const [wishNameClientFilter, setWishNameClientFilter] = useState('');
  const [selectedWishTags, setSelectedWishTags] = useState<string[]>([]);
  const [startWithNameFilter, setStartWithNameFilter] = useState('');
  const [nameContainsTokens, setNameContainsTokens] = useState('');

  return (
    <div className="space-y-6">
      {wishlist?.description ? (
        <div className="flex flex-col p-0 px-8">
          <p className="text-sm opacity-70 mt-1">{wishlist.description}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <div className="md:col-span-2 space-y-6">
          <NewWish
            userId={user.uid}
            isPublicWish={isPublicWishlist}
            wishlistId={wishlistId}
          />
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
            isPublicWish={isPublicWishlist}
            startWithNameFilter={startWithNameFilter}
            nameContainsTokens={nameContainsTokens}
            wishlistId={wishlistId}
          />
        </div>
      </div>
    </div>
  );
}

export default MyWishlistWishes;

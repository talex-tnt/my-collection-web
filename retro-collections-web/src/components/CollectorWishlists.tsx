import { useNavigate } from 'react-router-dom';
import type { Wishlist } from '../api/firestore/services/misc/userWishlists';
import WishlistsList from './WishlistsList';

function CollectorWishlists({ userId }: { userId: string }) {
  const navigate = useNavigate();

  const onWishlistClick = (wishlist: Wishlist) => {
    // Navigates relatively to the current path (e.g., /dashboard -> /dashboard/123)
    navigate(wishlist.id);
  };
  return (
    <WishlistsList
      userId={userId}
      isPublicWishlist={true}
      onWishlistClick={onWishlistClick}
      readOnly
    />
  );
}

export default CollectorWishlists;

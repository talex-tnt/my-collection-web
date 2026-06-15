import { useNavigate } from 'react-router-dom';
import type { Wishlist } from '../api/firestore/services/misc/userWishlists';
import WishlistsList from './WishlistsList';
import type { User } from 'firebase/auth/web-extension';

function MyWishlists({
  user,
  isPublicWishlist,
}: {
  user: User;
  isPublicWishlist: boolean;
}) {
  const navigate = useNavigate();

  const onWishlistClick = (wishlist: Wishlist) => {
    // Navigates relatively to the current path (e.g., /dashboard -> /dashboard/123)
    navigate(wishlist.id);
  };

  return (
    <WishlistsList
      userId={user.uid}
      isPublicWishlist={isPublicWishlist}
      onWishlistClick={onWishlistClick}
    />
  );
}

export default MyWishlists;

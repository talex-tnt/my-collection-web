import {
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from 'react-router-dom';
import { useCurrentUser } from '../utils/hooks';
import { useGetUserWishlistsQuery } from '../api/firestore/firestoreApi';
import MyWishlists from '../components/MyWishlists';
import MyWishlistWishes from '../components/MyWishlistWishes';
import MyWishesBreadcrumb from '../components/MyWishesBreadcrumb';

function MyWishlistsPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();

  const isPrivate = location.pathname.includes('/private');
  const visibility: 'public' | 'private' = isPrivate ? 'private' : 'public';

  const { data: wishlistsData } = useGetUserWishlistsQuery(
    { userId: user?.uid || '', isPublicWishlist: visibility === 'public' },
    { skip: !user?.uid }
  );

  const pathSegments = location.pathname.split('/');
  const isDeepView = pathSegments.length > 4 && pathSegments[3] === 'wishlists';
  const currentWishlistId = isDeepView ? pathSegments[4] : null;

  const handleVisibilityChange = (newVis: 'public' | 'private') => {
    const targetSubPath = currentWishlistId
      ? `wishlists/${currentWishlistId}`
      : 'wishlists';
    navigate(`/my-wishlists/${newVis}/${targetSubPath}`);
  };

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <MyWishesBreadcrumb
        visibility={visibility}
        currentWishlistId={currentWishlistId}
        wishlists={wishlistsData?.wishlists || []}
        onVisibilityChange={handleVisibilityChange}
        onNavigate={navigate}
      />

      <Routes>
        <Route
          path="/:visibility/wishlists"
          element={
            <MyWishlists
              user={user}
              isPublicWishlist={visibility === 'public'}
            />
          }
        />
        <Route
          path="/:visibility/wishlists/:wishlistId"
          element={
            <MyWishlistWishes
              user={user}
              isPublicWishlist={visibility === 'public'}
            />
          }
        />
        <Route
          path="*"
          element={<Navigate to="/my-wishlists/public/wishlists" replace />}
        />
      </Routes>
    </div>
  );
}

export default MyWishlistsPage;

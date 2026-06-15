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
import MySpareWishes from '../components/MySpareWishes';
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

  if (!user) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">My Wishlists</h2>
          <p>Please log in to manage your wishlists.</p>
        </div>
      </div>
    );
  }

  const tab = location.pathname.includes('/wishlists') ? 'wishlists' : 'spare';
  const pathSegments = location.pathname.split('/');
  const isDeepView = pathSegments.length > 4 && pathSegments[3] === 'wishlists';
  const currentWishlistId = isDeepView ? pathSegments[4] : null;

  const handleVisibilityChange = (newVis: 'public' | 'private') => {
    const targetSubPath = currentWishlistId ? 'wishlists' : tab;
    navigate(`/my-wishlists/${newVis}/${targetSubPath}`);
  };

  return (
    <div>
      <MyWishesBreadcrumb
        visibility={visibility}
        tab={tab}
        currentWishlistId={currentWishlistId}
        wishlists={wishlistsData?.wishlists || []}
        onVisibilityChange={handleVisibilityChange}
        onNavigate={navigate}
      />

      <Routes>
        <Route
          path="/:visibility/spare"
          element={<MySpareWishes user={user} isPublicWish={visibility === 'public'} />}
        />
        <Route
          path="/:visibility/wishlists"
          element={<MyWishlists user={user} isPublicWishlist={visibility === 'public'} />}
        />
        <Route
          path="/:visibility/wishlists/:wishlistId"
          element={<MyWishlistWishes user={user} isPublicWishlist={visibility === 'public'} />}
        />
        <Route path="*" element={<Navigate to="/my-wishlists/public/wishlists" replace />} />
      </Routes>
    </div>
  );
}

export default MyWishlistsPage;

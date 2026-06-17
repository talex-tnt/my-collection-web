import {
  useParams,
  useNavigate,
  useLocation,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import {
  useGetUserByIdQuery,
  useGetUserWishlistsQuery,
} from '../api/firestore/firestoreApi';
import CollectorFilterableWishes from '../components/CollectorFilterableWishes';
import CollectorWishlists from '../components/CollectorWishlists';
import CollectorWishesBreadcrumb from '../components/CollectorWishesBreadcrumb';

function CollectorWishlistsPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: user } = useGetUserByIdQuery(userId || '', {
    skip: !userId,
  });

  const { data: wishlistsData } = useGetUserWishlistsQuery(
    { userId: userId || '', isPublicWishlist: true },
    { skip: !userId }
  );

  if (!userId) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Collector Wishlists</h2>
          <p>Missing user id.</p>
        </div>
      </div>
    );
  }

  const pathSegments = location.pathname.split('/');
  const isDeepView = pathSegments.length > 5 && pathSegments[4] === 'wishlists';
  const currentWishlistId = isDeepView ? pathSegments[5] : null;

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body space-y-4 px-2 sm:px-4">
        <div className="mb-0">
          <h2 className="card-title text-lg">Collector Wishlists</h2>
          <p className="text-sm text-base-content/70">
            {user?.nickname ? `@${user.nickname}` : user?.name || userId}
          </p>
          <div className="mt-3 inline-flex gap-2">
            <button
              className="btn btn-xs"
              type="button"
              onClick={() => navigate(`/collectors/${userId}/collections`)}
            >
              Collections
            </button>
            <button className="btn btn-xs btn-primary" type="button">
              Wishlists
            </button>
          </div>
        </div>

        <CollectorWishesBreadcrumb
          currentWishlistId={currentWishlistId}
          wishlists={wishlistsData?.wishlists || []}
          onNavigate={(targetSubPath: string) =>
            navigate(`/collectors/${userId}/wishlists${targetSubPath}`)
          }
        />

        <Routes>
          <Route
            path="/wishlists"
            element={<CollectorWishlists userId={userId} />}
          />
          <Route
            path="/wishlists/:wishlistId"
            element={<CollectorFilterableWishes userId={userId} />}
          />
          <Route
            path="*"
            element={
              <Navigate
                to={`/collectors/${userId}/wishlists/wishlists`}
                replace
              />
            }
          />
        </Routes>
      </div>
    </div>
  );
}

export default CollectorWishlistsPage;

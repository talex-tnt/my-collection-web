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
  useGetUserCollectionsQuery,
} from '../api/firestore/firestoreApi';
import CollectorFilterableItems from '../components/CollectorFilterableItems';
import CollectorFilterablePublicItems from '../components/CollectorFilterablePublicItems';
import CollectorCollections from '../components/CollectorCollections';
import CollectorItemsBreadcrumb from '../components/CollectorItemsBreadcrumb';
import CollectorWishlists from '../components/CollectorWishlists';
import CollectorFilterableWishes from '../components/CollectorFilterableWishes';

function CollectorPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: user } = useGetUserByIdQuery(userId || '', {
    skip: !userId,
  });

  const { data: collectionsData } = useGetUserCollectionsQuery(
    { userId: userId || '', isPublicCollection: true },
    { skip: !userId }
  );

  if (!userId) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Collector</h2>
          <p>Missing user id.</p>
        </div>
      </div>
    );
  }

  const tab = location.pathname.includes('/collections')
    ? 'collections'
    : location.pathname.includes('/spare')
      ? 'spare'
      : location.pathname.includes('/wishlists')
        ? 'wishlists'
        : 'collectibles';
  const pathSegments = location.pathname.split('/');
  const isDeepView =
    pathSegments.length > 4 && pathSegments[3] === 'collections';
  const currentCollectionId = isDeepView ? pathSegments[4] : null;

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body space-y-4 px-2 sm:px-4 pt-0">
        <div className="mb-0 ">
          <h2 className="card-title text-lg">Collector</h2>
          <p className="text-sm text-base-content/70">
            {user?.nickname ? `@${user.nickname}` : user?.name || userId}
          </p>
          <div className="hidden md:block mt-3 mb-2 space-x-2">
            <div className="ml-4 inline-flex gap-2"></div>
            <button
              className={`btn btn-xs  btn-outline ${
                tab === 'collectibles' ? 'btn-primary' : ''
              }`}
              type="button"
              onClick={() => navigate(`/collectors/${userId}/collectibles`)}
            >
              All Collectibles
            </button>
            <button
              className={`btn btn-xs ${tab === 'spare' ? 'btn-primary' : ''}`}
              type="button"
              onClick={() => navigate(`/collectors/${userId}/spare`)}
            >
              Spare Only
            </button>
            <button
              className={`btn btn-xs ${tab === 'collections' ? 'btn-primary' : ''}`}
              type="button"
              onClick={() => navigate(`/collectors/${userId}/collections`)}
            >
              Collections
            </button>
            <button
              className={`btn btn-xs ${tab === 'wishlists' ? 'text-error' : ''}`}
              type="button"
              onClick={() => navigate(`/collectors/${userId}/wishlists`)}
            >
              Wishlists
            </button>
          </div>
        </div>
        <div className="block md:hidden mb-0">
          <CollectorItemsBreadcrumb
            tab={tab}
            currentCollectionId={currentCollectionId}
            collections={collectionsData?.collections || []}
            onNavigate={(targetSubPath: string) =>
              navigate(`/collectors/${userId}${targetSubPath}`)
            }
          />
        </div>

        <Routes>
          <Route
            path="/collectibles"
            element={<CollectorFilterablePublicItems userId={userId} />}
          />
          <Route
            path="/spare"
            element={<CollectorFilterableItems userId={userId} />}
          />
          <Route
            path="/collections"
            element={<CollectorCollections userId={userId} />}
          />
          <Route
            path="/collections/:collectionId"
            element={<CollectorFilterableItems userId={userId} />}
          />
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
              <Navigate to={`/collectors/${userId}/collectibles`} replace />
            }
          />
        </Routes>
      </div>
    </div>
  );
}

export default CollectorPage;

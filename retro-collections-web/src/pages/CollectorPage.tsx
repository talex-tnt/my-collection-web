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
      : 'collectibles';
  const pathSegments = location.pathname.split('/');
  const isDeepView =
    pathSegments.length > 4 && pathSegments[3] === 'collections';
  const currentCollectionId = isDeepView ? pathSegments[4] : null;

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body space-y-4 px-2 sm:px-4">
        <div className="mb-0">
          <h2 className="card-title text-lg">Collector</h2>
          <p className="text-sm text-base-content/70">
            {user?.nickname ? `@${user.nickname}` : user?.name || userId}
          </p>
          <div className="mt-3 inline-flex gap-2">
            <button
              className={`btn btn-xs ${
                tab === 'collectibles' ? 'btn-primary' : ''
              }`}
              type="button"
              onClick={() => navigate(`/collectors/${userId}/collectibles`)}
            >
              Collectibles
            </button>
            <button
              className={`btn btn-xs ${tab === 'spare' ? 'btn-primary' : ''}`}
              type="button"
              onClick={() => navigate(`/collectors/${userId}/spare`)}
            >
              Spare Collectibles
            </button>
            <button
              className={`btn btn-xs ${tab === 'collections' ? 'btn-primary' : ''}`}
              type="button"
              onClick={() => navigate(`/collectors/${userId}/collections`)}
            >
              Collections
            </button>
            <button
              className="btn btn-xs"
              type="button"
              onClick={() =>
                navigate(`/collectors/${userId}/wishlists/wishlists`)
              }
            >
              Wishlists
            </button>
          </div>
        </div>

        <CollectorItemsBreadcrumb
          tab={tab}
          currentCollectionId={currentCollectionId}
          collections={collectionsData?.collections || []}
          onNavigate={(targetSubPath: string) =>
            navigate(`/collectors/${userId}${targetSubPath}`)
          }
        />

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

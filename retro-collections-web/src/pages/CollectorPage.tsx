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
import CollectorSpareItems from '../components/CollectorSpareItems';
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
    : 'spare';
  const pathSegments = location.pathname.split('/');
  const isDeepView =
    pathSegments.length > 4 && pathSegments[3] === 'collections';
  const currentCollectionId = isDeepView ? pathSegments[4] : null;

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body space-y-4">
        <div>
          <h2 className="card-title text-lg">Collector</h2>
          <p className="text-sm text-base-content/70">
            {user?.nickname ? `@${user.nickname}` : user?.name || userId}
          </p>
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
            path="/spare"
            element={<CollectorSpareItems userId={userId} />}
          />
          <Route
            path="/collections"
            element={<CollectorCollections userId={userId} />}
          />
          <Route
            path="/collections/:collectionId"
            element={<CollectorSpareItems userId={userId} />}
          />
          <Route
            path="*"
            element={
              <Navigate to={`/collectors/${userId}/collections`} replace />
            }
          />
        </Routes>
      </div>
    </div>
  );
}

export default CollectorPage;

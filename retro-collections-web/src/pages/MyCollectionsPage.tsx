import {
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from 'react-router-dom';
import MySpareItems from '../components/MySpareItems';
import MyCollections from '../components/MyCollections';
import { useCurrentUser } from '../utils/hooks';
import MyCollectionItems from '../components/MyCollectionItems';
import { useGetUserCollectionsQuery } from '../api/firestore/firestoreApi';
import MyItemsBreadcrumb from '../components/MyItemsBreadcrumb';
import LoginWithGoogle from '../components/LoginWithGoogle';

function MyCollectionsPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();

  const isPrivate = location.pathname.includes('/private');
  const visibility: 'public' | 'private' = isPrivate ? 'private' : 'public';

  const { data: collectionsData } = useGetUserCollectionsQuery(
    { userId: user?.uid || '', isPublicCollection: visibility === 'public' },
    { skip: !user?.uid }
  );

  if (!user) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">My Items</h2>
          <p>Please log in to manage your items.</p>
          <LoginWithGoogle className="btn btn-primary max-w-xs" />
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

  const handleVisibilityChange = (newVis: 'public' | 'private') => {
    const targetSubPath = currentCollectionId ? 'collections' : tab;
    navigate(`/my-collections/${newVis}/${targetSubPath}`);
  };

  return (
    <div>
      <MyItemsBreadcrumb
        visibility={visibility}
        tab={tab}
        currentCollectionId={currentCollectionId}
        collections={collectionsData?.collections || []}
        onVisibilityChange={handleVisibilityChange}
        onNavigate={navigate}
      />

      <Routes>
        <Route
          path="/:visibility/spare"
          element={
            <MySpareItems user={user} isPublicItem={visibility === 'public'} />
          }
        />
        <Route
          path="/:visibility/collections"
          element={
            <MyCollections
              user={user}
              isPublicCollection={visibility === 'public'}
            />
          }
        />
        <Route
          path="/:visibility/collections/:collectionId"
          element={
            <MyCollectionItems
              user={user}
              isPublicCollection={visibility === 'public'}
            />
          }
        />
        <Route
          path="*"
          element={<Navigate to="/my-collections/public/collections" replace />}
        />
      </Routes>
    </div>
  );
}

export default MyCollectionsPage;

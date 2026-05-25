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
import { FiEye, FiEyeOff } from 'react-icons/fi';
import MyCollectionItems from '../components/MyCollectionItems';

function AllMyItemsPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">My Items</h2>
          <p>Please log in to manage your items.</p>
        </div>
      </div>
    );
  }

  // 1. Extract visibility directly from the URL path
  const isPrivate = location.pathname.includes('/private');
  const visibility: 'public' | 'private' = isPrivate ? 'private' : 'public';

  // 2. Determine tab from URL structure
  const tab = location.pathname.includes('/collections')
    ? 'collections'
    : 'spare';

  // Helper to handle switching visibility while preserving the current tab/view
  const handleVisibilityToggle = (toPublic: boolean) => {
    const newVisibility = toPublic ? 'public' : 'private';
    const currentSubPath = location.pathname.includes('/collections')
      ? 'collections'
      : 'spare';

    // If we are deep inside a collection, fallback to the main collections list on toggle
    const isDeepDoc = location.pathname.split('/').length > 4;
    const finalSubPath = isDeepDoc ? 'collections' : currentSubPath;

    navigate(`/my-collectibles/${newVisibility}/${finalSubPath}`);
  };

  return (
    <div>
      <div className="tabs tabs-boxed mb-4">
        <div className="flex gap-2 items-center">
          <label className="inline-flex cursor-pointer gap-2 select-none items-center text-xs font-medium mr-6">
            <span className="inline-flex items-center gap-1 min-w-[65px] justify-end transition-colors">
              {visibility === 'public' ? (
                <>
                  <FiEye className="h-3.5 w-3.5 text-primary" />
                  <span className="text-primary font-semibold">Public</span>
                </>
              ) : (
                <>
                  <FiEyeOff className="h-3.5 w-3.5 text-base-content/50" />
                  <span className="text-base-content/50">Public</span>
                </>
              )}
            </span>
            <input
              type="checkbox"
              className="toggle toggle-xs toggle-primary"
              checked={visibility === 'public'}
              onChange={(e) => handleVisibilityToggle(e.target.checked)}
            />
          </label>
        </div>
        <button
          className={`tab${tab === 'collections' ? ' tab-active' : ''}`}
          onClick={() => navigate(`/my-collectibles/${visibility}/collections`)}
        >
          Collections
        </button>
        <button
          className={`tab${tab === 'spare' ? ' tab-active' : ''}`}
          onClick={() => navigate(`/my-collectibles/${visibility}/spare`)}
        >
          Spare Collectibles
        </button>
      </div>

      <Routes>
        {/* Parametrized routing handling both /public and /private */}
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
        {/* Default redirect to public/spare */}
        <Route
          path="*"
          element={
            <Navigate to="/my-collectibles/public/collections" replace />
          }
        />
      </Routes>
    </div>
  );
}

export default AllMyItemsPage;

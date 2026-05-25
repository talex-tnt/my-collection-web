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

  // 2. Determine view mode from URL structure
  const tab = location.pathname.includes('/collections')
    ? 'collections'
    : 'spare';

  // Helper to handle switching visibility while preserving the current view
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

  // Handles dropdown selection changes
  const handleViewChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const targetView = e.target.value;
    navigate(`/my-collectibles/${visibility}/${targetView}`);
  };

  return (
    <div>
      {/* Control bar using DaisyUI utilities */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-base-200 rounded-xl mb-4">
        {/* Toggle Controls */}
        <div className="flex items-center">
          <label className="inline-flex cursor-pointer gap-2 select-none items-center text-xs font-medium">
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

        {/* View Selection Dropdown via DaisyUI select component */}
        <div className="form-control w-full max-w-xs">
          <select
            className="select select-bordered select-sm w-full"
            value={tab}
            onChange={handleViewChange}
          >
            <option value="collections">Collections</option>
            <option value="spare">Spare Collectibles</option>
          </select>
        </div>
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
        {/* Default redirect to public/collections */}
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

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

  // Determine tab from URL
  const tab = location.pathname.endsWith('/collections')
    ? 'collections'
    : 'spare';

  return (
    <div>
      <div className="tabs tabs-boxed mb-4">
        <button
          className={`tab${tab === 'spare' ? ' tab-active' : ''}`}
          onClick={() => navigate('/my-collectibles/spare')}
        >
          Spare Collectibles
        </button>
        <button
          className={`tab${tab === 'collections' ? ' tab-active' : ''}`}
          onClick={() => navigate('/my-collectibles/collections')}
        >
          Collections
        </button>
      </div>
      <Routes>
        <Route path="/spare" element={<MySpareItems user={user} />} />
        <Route path="/collections" element={<MyCollections />} />
        {/* Default redirect to /spare */}
        <Route
          path="*"
          element={<Navigate to="/my-collectibles/spare" replace />}
        />
      </Routes>
    </div>
  );
}

export default AllMyItemsPage;

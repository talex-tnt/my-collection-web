import {
  useParams,
  useNavigate,
  useLocation,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { useGetUserByIdQuery } from '../api/firestore/firestoreApi';
import CollectorSpareItems from '../components/CollectorSpareItems';
import CollectorCollections from '../components/CollectorCollections';

function CollectorPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: user } = useGetUserByIdQuery(userId || '', {
    skip: !userId,
  });

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

  // 🔥 determine active tab from URL
  const tab = location.pathname.endsWith('/collections')
    ? 'collections'
    : 'spare';

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body space-y-4">
        {/* HEADER */}
        <div>
          <h2 className="card-title text-lg">Collector</h2>
          <p className="text-sm text-base-content/70">
            {user?.nickname ? `@${user.nickname}` : user?.name || userId}
          </p>
        </div>

        {/* TABS */}
        <div className="tabs tabs-boxed">
          <button
            className={`tab ${tab === 'spare' ? 'tab-active' : ''}`}
            onClick={() => navigate(`/collectors/${userId}/spare`)}
          >
            Spare Items
          </button>

          <button
            className={`tab ${tab === 'collections' ? 'tab-active' : ''}`}
            onClick={() => navigate(`/collectors/${userId}/collections`)}
          >
            Collections
          </button>
        </div>

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
            path="*"
            element={<Navigate to={`/collectors/${userId}/spare`} replace />}
          />
        </Routes>
      </div>
    </div>
  );
}

export default CollectorPage;

import { useNavigate } from 'react-router-dom'; // 1. Import the navigation hook
import { useCurrentUser } from '../utils/hooks';
import MyItemsAllGrouped from '../components/MyItemsAllGrouped';
import { FiArrowRight as Icon } from 'react-icons/fi';
function MyCollectiblesPage() {
  const user = useCurrentUser();
  const navigate = useNavigate(); // 2. Initialize the navigate function

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

  return (
    <div className="space-y-4">
      {/* Page header with title and shortcut navigation */}
      <div className="flex justify-between items-center border-b pb-4 border-base-300">
        <h1 className="text-2xl font-bold ml-2">My Collectibles</h1>

        {/* Shortcut button to switch to Collections */}
        <button
          onClick={() => navigate('/my-collections')}
          className="btn btn-outline btn-primary btn-sm gap-1"
        >
          My Collections
          <Icon className="w-4 h-4" />
        </button>
      </div>

      {/* Main layout with filters and items list */}
      <MyItemsAllGrouped user={user} />
    </div>
  );
}

export default MyCollectiblesPage;

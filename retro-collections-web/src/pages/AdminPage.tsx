import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';

import Admin from '../components/Admin';
import { auth } from '../lib/firebase';
import { useIsAdmin } from '../hooks';
import LoginWithGoogle from '../components/LoginWithGoogle';

function AdminPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const isAdmin = useIsAdmin(currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return unsubscribe;
  }, []);

  if (!currentUser) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Admin</h2>
          <p>
            Please log in with the admin account to manage authorized users.
          </p>
          <LoginWithGoogle className="btn btn-primary max-w-xs" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Admin</h2>

          <p className="text-base-content/70">
            Access denied. You must be the admin user to view this page.
          </p>

          <p className="mt-2">
            Logged in as: <strong>{currentUser.email}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Admin Dashboard</h2>

          <p className="text-base-content/70">
            Current user: {currentUser.displayName || currentUser.email}
          </p>

          <p className="text-sm">UID: {currentUser.uid}</p>
        </div>
      </div>

      <Admin />
    </div>
  );
}

export default AdminPage;

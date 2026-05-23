import { HashRouter, Routes, Route } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import HomePage from '../pages/HomePage';
import AdminPage from '../pages/AdminPage';
import SettingsPage from '../pages/SettingsPage';
import CollectorPage from '../pages/CollectorPage';
import CollectorsPage from '../pages/CollectorsPage';
import UsersPage from '../pages/UsersPage';
import AllMyItemsPage from '../pages/AllMyItemsPage';
import ProfilePage from '../pages/ProfilePage';
import TagsPage from '../pages/TagsPage';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { useGetRuntimeConfigQuery } from '../api/firestore/firestoreApi';
import { initGoogleDriveAuth } from '../api/google-drive/googleDriveAuth';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const { isLoading: isRuntimeConfigLoading, isError: isRuntimeConfigError } =
    useGetRuntimeConfigQuery(undefined, {
      skip: !isAuthenticated,
    });

  useEffect(() => {
    initGoogleDriveAuth(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setIsAuthenticated(Boolean(currentUser));
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  if (isAuthenticated && isRuntimeConfigLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-200 text-base-content">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <span className="loading loading-spinner loading-lg" />
            <p>Loading Firestore config...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated && isRuntimeConfigError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-200 text-base-content">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Firestore config unavailable</h2>
            <p>
              Please try again after the public runtime config is reachable.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="flex flex-col min-h-screen bg-base-200 text-base-content">
        <div className="flex-1">
          <div className="mx-auto max-w-screen-2xl space-y-8 px-4 py-8">
            <Header />

            <div className="space-y-6">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/my-collectibles/*" element={<AllMyItemsPage />} />
                <Route
                  path="/collectors/:userId/*"
                  element={<CollectorPage />}
                />
                <Route path="/collectors" element={<CollectorsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route
                  path="/tags"
                  element={user ? <TagsPage user={user} /> : null}
                />
              </Routes>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </HashRouter>
  );
}

export default App;

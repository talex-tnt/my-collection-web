import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, getIsAdmin } from '../lib/firebase';
import {
  useCreateOrUpdatePrivateUserMutation,
  useCreateOrUpdateUserMutation,
  useLazyIsUserAuthorizedQuery,
} from '../api/firestore/firestoreApi';
import { useIsAdmin } from '../hooks';

import { useDispatch } from 'react-redux';
import { clearAuth, setAccessToken } from '../store/authSlice';
// import { EXPIRY_KEY, TOKEN_KEY } from '../api/google-drive/googleDriveAuth';

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const isAdmin = useIsAdmin(user);

  const [checkAuthorizedUser] = useLazyIsUserAuthorizedQuery();
  const [createOrUpdateUser] = useCreateOrUpdateUserMutation();
  const [createOrUpdatePrivateUser] = useCreateOrUpdatePrivateUserMutation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return unsubscribe;
  }, []);

  const login = async () => {
    try {
      setError('');

      await setPersistence(auth, browserLocalPersistence);

      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.readonly');

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        dispatch(setAccessToken(credential.accessToken));

        // const tokenResult = await result.user.getIdTokenResult();
        // const expiryTime = new Date(tokenResult.expirationTime).getTime();

        // sessionStorage.setItem(TOKEN_KEY, credential?.accessToken);
        // sessionStorage.setItem(EXPIRY_KEY, expiryTime.toString());
      }
      const currentUser = result.user;
      const email = currentUser.email || '';

      let authorized = false;

      const admin = await getIsAdmin();

      if (admin) {
        authorized = true;
      } else {
        const response = await checkAuthorizedUser(email);
        authorized = response.data ?? false;
      }

      if (!authorized) {
        await signOut(auth);
        setError(`Access denied. User ${email} is not authorized.`);
        setUser(null);
        return;
      }

      await createOrUpdateUser({
        id: currentUser.uid,
        name: currentUser.displayName || '',
      });

      await createOrUpdatePrivateUser({
        id: currentUser.uid,
        email: currentUser.email || '',
        lastLogin: new Date().toISOString(),
      });

      // if (credential) {
      //   const accessToken = credential.accessToken;
      //   const res = await fetch(`https://www.googleapis.com/drive/v3/files`, {
      //     headers: {
      //       Authorization: `Bearer ${accessToken}`,
      //     },
      //   });
      //   console.log('Google Drive API response:', res);
      // } else {
      //   setError('Failed to obtain authentication credential.');
      //   return;
      // }
    } catch (loginError) {
      console.error('Login error:', loginError);
      setError('Login failed. Please try again.');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      dispatch(clearAuth());
      setError('');
    } catch (logoutError) {
      console.error('Logout error:', logoutError);
    }
  };
  // console.log('Current user in Header:', user);

  return (
    // <header className="rounded-box border border-base-300 bg-base-100 shadow-sm">
    <header className="mb-0">
      <div className="navbar p-0 mb-4">
        <div className="flex flex-col lg:flex-row items-start gap-3 lg:items-center mr-4 w-full">
          <div>
            <h1 className="text-2xl font-bold mb-2 ml-2 mt-2 mr-4">
              Retro Collections
            </h1>
            {/* <p className="text-sm text-base-content/70 mb-2 ml-2">
              Organize, tag, and share your retro collections. Manage
              collectibles, track items, customize tags, and control visibility.
            </p> */}
          </div>

          {/* Mobile: select dropdown navigation */}
          <div className="relative w-full block lg:hidden">
            <select
              className="select select-bordered w-full max-w-xs"
              value={(() => {
                if (location.pathname.startsWith('/my-collectibles'))
                  return '/my-collectibles';
                if (location.pathname.startsWith('/my-collections'))
                  return '/my-collections';
                if (location.pathname.startsWith('/tags')) return '/tags';
                if (location.pathname.startsWith('/collectors'))
                  return '/collectors';
                if (location.pathname.startsWith('/settings'))
                  return '/settings';
                if (isAdmin && location.pathname.startsWith('/users'))
                  return '/users';
                if (isAdmin && location.pathname.startsWith('/admin'))
                  return '/admin';
                return '/my-collections';
              })()}
              onChange={(e) => navigate(e.target.value)}
            >
              <option value="/my-collectibles">My Collectibles</option>
              <option value="/my-collections">My Collections</option>
              <option value="/collectors">Collectors</option>
              <option value="/tags">Tags</option>
              <option value="/settings">Settings</option>
              {isAdmin && <option value="/users">Users</option>}
              {isAdmin && <option value="/admin">Admin</option>}
            </select>
          </div>

          {/* Desktop: tab navigation */}
          <nav className="tabs tabs-boxed flex-wrap gap-2 hidden lg:flex">
            <NavLink
              to="/my-collectibles"
              className={({ isActive }) =>
                isActive ? 'tab tab-active' : 'tab'
              }
            >
              My Collectibles
            </NavLink>
            <NavLink
              to="/my-collections"
              className={({ isActive }) =>
                isActive ? 'tab tab-active' : 'tab'
              }
            >
              My Collections
            </NavLink>
            <NavLink
              to="/collectors"
              className={({ isActive }) =>
                isActive ? 'tab tab-active' : 'tab'
              }
            >
              Collectors
            </NavLink>
            <NavLink
              to="/tags"
              className={({ isActive }) =>
                isActive ? 'tab tab-active' : 'tab'
              }
            >
              Tags
            </NavLink>

            <NavLink
              to="/settings"
              className={({ isActive }) =>
                isActive ? 'tab tab-active' : 'tab'
              }
            >
              Settings
            </NavLink>
            {isAdmin && (
              <NavLink
                to="/users"
                className={({ isActive }) =>
                  isActive ? 'tab tab-active' : 'tab'
                }
              >
                Users
              </NavLink>
            )}
            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  isActive ? 'tab tab-active' : 'tab'
                }
              >
                Admin
              </NavLink>
            )}
          </nav>
        </div>

        <div className="dropdown dropdown-end">
          <button tabIndex={0} className="btn btn-ghost gap-3 px-1 sm:px-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">
                {user?.displayName || user?.email || 'Guest'}
              </p>
              <p className="text-xs text-base-content/70 whitespace-nowrap">
                {user ? 'Signed in' : 'Not signed in'}
              </p>
            </div>
            <div className="avatar">
              {user?.photoURL ? (
                <div className="w-8 h-8 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 overflow-hidden">
                  <img
                    src={user.photoURL}
                    alt="avatar"
                    className="w-8 h-8 object-cover"
                  />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary text-primary-content flex items-center justify-center">
                  <span className="text-xs font-semibold">
                    {(user?.displayName || user?.email || 'G')
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </button>

          <div
            tabIndex={0}
            className="dropdown-content z-10 mt-3 w-80 rounded-box border border-base-300 bg-base-100 p-4 shadow-xl"
          >
            {error && <div className="alert alert-error mb-3">{error}</div>}

            {user ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-base-content/70">Signed in as</p>
                  <p className="font-semibold">
                    {user.displayName || user.email}
                  </p>
                </div>
                <div className="space-y-1 text-sm text-base-content/80">
                  <p>{user.email}</p>
                  <p className="break-all">UID: {user.uid}</p>
                </div>

                <NavLink
                  to="/profile"
                  className="btn btn-ghost w-full justify-start"
                >
                  Edit Profile
                </NavLink>

                <button className="btn btn-primary w-full" onClick={logout}>
                  Logout
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-base-content/70">
                  Sign in to manage your collections and items.
                </p>
                <button className="btn btn-primary w-full" onClick={login}>
                  Login with Google
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;

import { useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
  signInWithPopup,
} from 'firebase/auth';
import { useDispatch } from 'react-redux';
import {
  useCreateOrUpdatePrivateUserMutation,
  useCreateOrUpdateUserMutation,
} from '../api/firestore/firestoreApi';
import { auth } from '../lib/firebase';
import { setAccessToken } from '../store/authSlice';

type AccessClaims = {
  admin?: boolean;
  enabled?: boolean;
  tester?: boolean;
};

const canAccessMainFromClaims = (claims: AccessClaims) => {
  return (
    claims.admin === true || (claims.enabled === true && claims.tester !== true)
  );
};

type LoginWithGoogleProps = {
  className?: string;
  children?: ReactNode;
};

function LoginWithGoogle({
  className = 'btn btn-primary w-full',
  children,
}: LoginWithGoogleProps) {
  const dispatch = useDispatch();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');
  const [createOrUpdateUser] = useCreateOrUpdateUserMutation();
  const [createOrUpdatePrivateUser] = useCreateOrUpdatePrivateUserMutation();

  const login = async () => {
    if (isLoggingIn) return;

    setIsLoggingIn(true);
    setError('');

    try {
      await setPersistence(auth, browserLocalPersistence);

      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.readonly');

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        dispatch(setAccessToken(credential.accessToken));
      }

      const currentUser = result.user;
      const email = currentUser.email || '';

      const tokenResult = await currentUser.getIdTokenResult(true);
      const claims = tokenResult.claims as AccessClaims;
      const authorized = canAccessMainFromClaims(claims);

      if (!authorized) {
        console.info('User is signed in but does not have main access yet.', {
          uid: currentUser.uid,
          email: email || currentUser.email || '',
        });
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
    } catch (loginError) {
      console.error('Login error:', loginError);
      setError('Login failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={login}
        disabled={isLoggingIn}
      >
        {isLoggingIn ? 'Signing in...' : (children ?? 'Login with Google')}
      </button>
      {error && <div className="alert alert-error mt-2">{error}</div>}
    </>
  );
}

export default LoginWithGoogle;

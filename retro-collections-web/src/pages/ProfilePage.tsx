import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import UserProfile from '../components/UserProfile';
import LoginWithGoogle from '../components/LoginWithGoogle';

function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return unsubscribe;
  }, []);

  if (!user) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">My Profile</h2>
          <p>Please log in to view and edit your profile.</p>
          <LoginWithGoogle className="btn btn-primary max-w-xs" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <UserProfile user={user} />
    </div>
  );
}

export default ProfilePage;

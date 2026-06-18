import SettingsWiki from '../components/SettingsWiki';
import SettingsRawg from '../components/SettingsRawg';
import SettingsUI from '../components/SettingsUI';
import { useCurrentUser } from '../utils/hooks';
import LoginWithGoogle from '../components/LoginWithGoogle';

export default function SettingsPage() {
  const user = useCurrentUser();
  if (!user) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Account Settings</h2>
          <p>Please log in to manage Settings.</p>
          <LoginWithGoogle className="btn btn-primary max-w-xs" />
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-xl mx-auto mt-8 p-6 bg-base-200 rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6">Account Settings</h1>
      <div className="space-y-4">
        <SettingsWiki />
        <SettingsRawg />
        <SettingsUI />
      </div>
    </div>
  );
}

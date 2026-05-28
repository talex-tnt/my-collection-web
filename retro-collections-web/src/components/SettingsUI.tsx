import { useState, useEffect } from 'react';
import { useUISettings } from '../utils/hooks';

export default function SettingsUI() {
  const [uiSettings, setUISettings, { isLoading, isUpdating, getError }] =
    useUISettings();

  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveError(null);
  }, [uiSettings]);

  const handleToggleSuggestions = async (checked: boolean) => {
    setSaveError(null);
    try {
      await setUISettings({
        collapseImages: checked,
      });
    } catch (err: unknown) {
      setSaveError(
        (err as { message?: string })?.message || 'Failed to update settings'
      );
    }
  };

  return (
    <div className="">
      {isLoading ? (
        <div className="text-base-content/60 flex items-center gap-2">
          <span className="loading loading-spinner loading-sm"></span>
          Loading settings...
        </div>
      ) : getError ? (
        <div className="text-error bg-error/10 p-3 rounded-md text-sm">
          Failed to load settings. Please try again.
        </div>
      ) : (
        <div className="space-y-4">
          {/* UI Integration Section */}
          <div className="bg-base-100 rounded-lg p-4 border border-base-300">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <span>🌐</span> UI Integration
                </h2>
                <p className="text-xs text-base-content/60 mt-1">
                  Collapse images in the UI to save space and improve rendering
                  performance while animating.
                </p>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={uiSettings?.collapseImages ?? false}
                    disabled={isUpdating}
                    onChange={(e) => handleToggleSuggestions(e.target.checked)}
                  />
                </label>
              </div>
            </div>
          </div>

          {saveError && (
            <div className="text-error text-xs bg-error/10 px-3 py-2 rounded-md mt-2">
              ⚠️ {saveError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

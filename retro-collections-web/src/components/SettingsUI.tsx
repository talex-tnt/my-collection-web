import { useState, useEffect } from 'react';
import { useUISettings } from '../utils/hooks';

const allPageSizeOption = { value: Number.MAX_SAFE_INTEGER, label: 'All' };
const defaultListPageSizeOptions = [5, 10, 25, 50, 100, 250, 500];

const imageSizeOptions = [
  { value: 10, label: '10w' },
  { value: 25, label: '25w' },
  { value: 50, label: '50w' },
  { value: 100, label: '100w' },
  { value: 200, label: '200w' },
  { value: 250, label: '250w' },
  { value: 300, label: '300w' },
  { value: 400, label: '400w' },
  { value: 500, label: '500w' },
];

export default function SettingsUI() {
  const [uiSettings, setUISettings, { isLoading, isUpdating, getError }] =
    useUISettings();

  const [saveError, setSaveError] = useState<string | null>(null);

  const pageSize = uiSettings?.defaultListPageSize ?? 10;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveError(null);
  }, [uiSettings]);

  const handleToggleSuggestions = async ({
    enableImageProxy,
    collapseImages,
    defaultListPageSize,
    desktopPreviewImageSize,
    mobilePreviewImageSize,
  }: {
    enableImageProxy?: boolean;
    collapseImages?: boolean;
    defaultListPageSize?: number;
    desktopPreviewImageSize?: number;
    mobilePreviewImageSize?: number;
  }) => {
    setSaveError(null);
    try {
      await setUISettings({
        collapseImages: collapseImages ?? uiSettings?.collapseImages ?? false,
        enableImageProxy:
          enableImageProxy ?? uiSettings?.enableImageProxy ?? true,
        defaultListPageSize:
          defaultListPageSize ?? uiSettings?.defaultListPageSize ?? 10,
        desktopPreviewImageSize:
          desktopPreviewImageSize ?? uiSettings?.desktopPreviewImageSize ?? 300,
        mobilePreviewImageSize:
          mobilePreviewImageSize ?? uiSettings?.mobilePreviewImageSize ?? 200,
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
                  <span>🌐</span> Collapse Images
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
                    onChange={(e) =>
                      handleToggleSuggestions({
                        collapseImages: e.target.checked,
                      })
                    }
                  />
                </label>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 mt-6">
                  <span>🌐</span> Enable Image Proxy
                </h2>
                <p className="text-xs text-base-content/60 mt-1">
                  Enable the image proxy to bypass CORS issues when loading
                  images from external sources (e.g., Google Drive, Dropbox from
                  Safari).
                </p>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={uiSettings?.enableImageProxy ?? true}
                    disabled={isUpdating}
                    onChange={(e) =>
                      handleToggleSuggestions({
                        enableImageProxy: e.target.checked,
                      })
                    }
                  />
                </label>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 mt-6">
                  <span>🌐</span> Default List Page Size
                </h2>
                <p className="text-xs text-base-content/60 mt-1">
                  Set the default number of items to display per page in lists.
                </p>
                <p className="text-xs text-base-content/60 mt-1">
                  This setting allows you to control how many items are shown on
                  each page of your lists by default.
                </p>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer">
                  <select
                    className="select select-xs select-bordered w-20"
                    value={pageSize}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      handleToggleSuggestions({
                        defaultListPageSize: val,
                      });
                    }}
                  >
                    {defaultListPageSizeOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                    <option value={allPageSizeOption.value}>
                      {allPageSizeOption.label}
                    </option>
                  </select>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 mt-6">
                  <span>🌐</span> Desktop Preview Image Size
                </h2>
                <p className="text-xs text-base-content/60 mt-1">
                  Set the default size for desktop preview images.
                </p>
                <p className="text-xs text-base-content/60 mt-1">
                  This setting allows you to control the size of images
                  displayed in the desktop preview.
                </p>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer">
                  <select
                    className="select select-xs select-bordered w-20"
                    value={uiSettings?.desktopPreviewImageSize ?? 300}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      handleToggleSuggestions({
                        desktopPreviewImageSize: val,
                      });
                    }}
                  >
                    {imageSizeOptions.map((n) => (
                      <option key={n.value} value={n.value}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 mt-6">
                  <span>🌐</span> Mobile Preview Image Size
                </h2>
                <p className="text-xs text-base-content/60 mt-1">
                  Set the default size for mobile preview images.
                </p>
                <p className="text-xs text-base-content/60 mt-1">
                  This setting allows you to control the size of images
                  displayed in the mobile preview.
                </p>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer">
                  <select
                    className="select select-xs select-bordered w-20"
                    value={uiSettings?.mobilePreviewImageSize ?? 200}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      handleToggleSuggestions({
                        mobilePreviewImageSize: val,
                      });
                    }}
                  >
                    {imageSizeOptions.map((n) => (
                      <option key={n.value} value={n.value}>
                        {n.label}
                      </option>
                    ))}
                  </select>
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

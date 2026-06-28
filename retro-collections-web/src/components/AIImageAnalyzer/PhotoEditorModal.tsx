import { useEffect, useMemo, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { createPortal } from 'react-dom';
import { createEditedImageFile } from './imageEditing';

interface PhotoEditorModalProps {
  imageSrc: string;
  fileName: string;
  mimeType: string;
  onCancel: () => void;
  onSave: (file: File) => void;
}

type AspectOption = {
  label: string;
  value: number;
};

const aspectOptions: AspectOption[] = [
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
];

export function PhotoEditorModal({
  imageSrc,
  fileName,
  mimeType,
  onCancel,
  onSave,
}: PhotoEditorModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number>(4 / 3);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [browserZoomScale, setBrowserZoomScale] = useState(1);

  const activeAspect = useMemo(() => aspect, [aspect]);
  const isBrowserZoomAbove100 = browserZoomScale > 1.01;

  useEffect(() => {
    const detectBrowserZoomScale = () => {
      const visualViewportScale = window.visualViewport?.scale;

      if (visualViewportScale && Number.isFinite(visualViewportScale)) {
        return visualViewportScale;
      }

      const outerInnerRatio = window.outerWidth / window.innerWidth;
      if (Number.isFinite(outerInnerRatio) && outerInnerRatio > 0) {
        return outerInnerRatio;
      }

      return 1;
    };

    const updateBrowserZoomScale = () => {
      setBrowserZoomScale(detectBrowserZoomScale());
    };

    updateBrowserZoomScale();

    window.addEventListener('resize', updateBrowserZoomScale);
    window.visualViewport?.addEventListener('resize', updateBrowserZoomScale);

    return () => {
      window.removeEventListener('resize', updateBrowserZoomScale);
      window.visualViewport?.removeEventListener(
        'resize',
        updateBrowserZoomScale
      );
    };
  }, []);

  useEffect(() => {
    if (isBrowserZoomAbove100 && zoom !== 1) {
      setZoom(1);
    }
  }, [isBrowserZoomAbove100, zoom]);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAspect(4 / 3);
    setErrorMessage(null);
  };

  const handleRotateLeft = () => {
    setRotation((currentRotation) => currentRotation - 90);
  };

  const handleRotateRight = () => {
    setRotation((currentRotation) => currentRotation + 90);
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) {
      setErrorMessage('Select an area before saving.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const editedFile = await createEditedImageFile({
        imageSrc,
        pixelCrop: croppedAreaPixels,
        rotation,
        fileName,
        mimeType,
      });
      onSave(editedFile);
    } catch (error) {
      console.error('Failed to edit image:', error);
      setErrorMessage('Unable to apply edits. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="modal modal-open fixed inset-0 z-[110000] bg-black/80">
      <div className="relative h-full w-full flex flex-col bg-base-100 overflow-y-auto">
        <button
          type="button"
          className="btn btn-circle btn-sm btn-ghost fixed right-2 top-2 z-[110010]"
          onClick={onCancel}
          disabled={isSaving}
          aria-label="Close photo editor"
          title="Close"
        >
          ✕
        </button>

        <div className="sticky top-0 z-20 flex items-center justify-between p-3 pr-12 border-b border-base-300 bg-base-100">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </button>
          <h3 className="font-semibold text-sm">Edit Photo</h3>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div
          className={`relative flex-1 min-h-[40vh] bg-black ${
            isBrowserZoomAbove100 ? 'pointer-events-none' : ''
          }`}
          style={{ touchAction: isBrowserZoomAbove100 ? 'pinch-zoom' : 'none' }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={activeAspect}
            minZoom={1}
            maxZoom={isBrowserZoomAbove100 ? 1 : 4}
            zoomWithScroll={!isBrowserZoomAbove100}
            showGrid={true}
            onCropChange={setCrop}
            onZoomChange={(nextZoom) => {
              if (!isBrowserZoomAbove100) {
                setZoom(nextZoom);
              }
            }}
            onRotationChange={setRotation}
            onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
          />
        </div>

        <div className="sticky bottom-0 z-20 p-3 space-y-3 border-t border-base-300 bg-base-100 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={handleRotateLeft}
              disabled={isSaving}
            >
              ↺ Left
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={handleRotateRight}
              disabled={isSaving}
            >
              Right ↻
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={handleReset}
              disabled={isSaving}
            >
              Reset
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto">
            {aspectOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                className={`btn btn-xs ${aspect === option.value ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setAspect(option.value)}
                disabled={isSaving}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="text-xs font-medium block">
            Zoom
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="range range-primary range-sm mt-1"
              disabled={isSaving || isBrowserZoomAbove100}
            />
          </label>

          {isBrowserZoomAbove100 && (
            <p className="text-[11px] opacity-65">
              Image zoom is disabled while browser zoom is above 100%. Pinch or
              zoom out the page to re-enable it.
            </p>
          )}

          <p className="text-[11px] opacity-55">
            Browser zoom shortcut: Cmd+0 to reset page zoom.
          </p>

          <label className="text-xs font-medium block">
            Rotation
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="range range-primary range-sm mt-1"
              disabled={isSaving}
            />
          </label>

          {errorMessage && (
            <div className="alert alert-error text-xs py-2 px-3">{errorMessage}</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useListFilesQuery } from '../api/google-drive/googleDriveApi';
import type { FileType, FolderType } from '../api/firestore/types/shared';
import DriveImage from './DriveImage';
import { PreviewImage } from './PreviewImage';

type ItemImagesProps = {
  folder?: FolderType;
};

const ItemImages = ({ folder }: ItemImagesProps) => {
  const folderId = folder?.id;

  const [activeImage, setActiveImage] = useState<FileType | null>(null);

  const { data, isLoading } = useListFilesQuery(
    {
      folderId: folderId || 'root',
    },
    {
      skip: !folderId,
    }
  );

  const files = data?.files || [];

  const images: FileType[] = files.filter((f: FileType) =>
    f.mimeType?.startsWith('image/')
  );

  /* ---------------- ESC CLOSE ---------------- */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveImage(null);
    };

    if (activeImage) {
      document.addEventListener('keydown', onKeyDown);

      const htmlStyle = document.documentElement.style;
      const bodyStyle = document.body.style;

      const previousHtmlOverflow = htmlStyle.overflow;
      const previousHtmlOverflowX = htmlStyle.overflowX;
      const previousBodyOverflow = bodyStyle.overflow;
      const previousBodyOverflowX = bodyStyle.overflowX;
      const previousBodyWidth = bodyStyle.width;

      htmlStyle.overflow = 'hidden';
      htmlStyle.overflowX = 'hidden';
      bodyStyle.overflow = 'hidden';
      bodyStyle.overflowX = 'hidden';
      bodyStyle.width = '100%';

      return () => {
        document.removeEventListener('keydown', onKeyDown);
        htmlStyle.overflow = previousHtmlOverflow;
        htmlStyle.overflowX = previousHtmlOverflowX;
        bodyStyle.overflow = previousBodyOverflow;
        bodyStyle.overflowX = previousBodyOverflowX;
        bodyStyle.width = previousBodyWidth;
      };
    }

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeImage]);

  if (!folderId) {
    return <div className="text-xs opacity-60">No image folder selected.</div>;
  }

  return (
    <div className="mt-4">
      {/* <h4 className="font-semibold text-sm mb-2">Images</h4> */}

      {/* LOADING */}
      {isLoading && (
        <div className="flex items-center gap-2 my-2">
          <span className="loading loading-spinner loading-xs" />
          <span className="text-xs opacity-70">Loading images...</span>
        </div>
      )}

      {/* EMPTY */}
      {!isLoading && images.length === 0 && (
        <div className="text-xs opacity-60">No images in this folder.</div>
      )}

      {/* GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {images.map((img) => (
          <div
            key={img.id}
            className="flex flex-col items-center cursor-pointer"
            onClick={() => setActiveImage(img)}
          >
            <div className="w-full bg-base-200 rounded overflow-hidden flex items-center justify-center hover:opacity-90 transition">
              {/* <DriveImage fileId={img.id ?? ''} name={img.name ?? ''} /> */}
              <PreviewImage
                driveId={img?.id}
                size="w300"
                alt={img.name || 'Item preview'}
                className="w-full h-auto rounded-md" // custom styling still flows through
              />
            </div>

            <span
              className="text-xs mt-1 truncate max-w-[100px]"
              title={img.name}
            >
              {img.name}
            </span>
          </div>
        ))}
      </div>

      {/* ---------------- FULLSCREEN LIGHTBOX ---------------- */}
      {activeImage &&
        createPortal(
          <div
            className="fixed inset-0 z-[120000] bg-black/80 flex items-center justify-center p-2 sm:p-4"
            onClick={() => setActiveImage(null)}
            onWheelCapture={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="btn btn-circle btn-sm btn-ghost fixed right-3 top-3 z-[120010]"
              onClick={() => setActiveImage(null)}
              aria-label="Close zoomed image"
              title="Close"
            >
              ✕
            </button>
            <div
              className="w-full max-w-5xl h-[calc(100dvh-1rem)] sm:h-[calc(100dvh-2rem)] flex items-center justify-center overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <DriveImage
                fileId={activeImage.id ?? ''}
                name={activeImage.name ?? ''}
                style={{
                  width: 'auto',
                  height: 'auto',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: '8px',
                }}
              />
              {/* <img
                src={`https://drive.google.com/uc?id=${activeImage.id}`}
                alt={activeImage.name}
                className="max-w-full max-h-full object-contain rounded"
              /> */}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default ItemImages;

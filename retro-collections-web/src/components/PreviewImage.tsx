import React, { useState } from 'react';
import { useUISettings } from '../utils/hooks';

interface PreviewImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  driveId?: string;
  size?: 'w100' | 'w200' | 'w300' | 'w400' | 'w800' | 'w1600';
  fallbackUrl?: string;
}

export const PreviewImage: React.FC<PreviewImageProps> = ({
  driveId,
  size = 'w200',
  fallbackUrl = 'https://placehold.co/200x200?text=No+Image',
  className = '',
  alt = 'Preview',
  ...props
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [uiSettings] = useUISettings();
  const enableProxy = uiSettings?.enableImageProxy ?? true;

  // If there's no ID, immediately default to the fallback
  if (!driveId) {
    return <img src={fallbackUrl} alt={alt} className={className} {...props} />;
  }

  // Construct the Vercel proxy URL
  const proxyUrl = enableProxy
    ? `https://image-proxy-roan.vercel.app/api/drive-proxy?id=${driveId}&sz=${size}`
    : `https://drive.google.com/thumbnail?id=${driveId}&sz=${size}`;

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Loading Spinner Overlaid */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded animate-pulse">
          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* The Actual Image */}
      <img
        src={error ? fallbackUrl : proxyUrl}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
        className={`w-full h-auto object-cover transition-opacity duration-300 ${
          loading ? 'opacity-0' : 'opacity-100'
        }`}
        {...props}
      />
    </div>
  );
};

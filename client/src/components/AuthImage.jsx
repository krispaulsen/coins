import { useEffect, useState } from 'react';
import { fetchImageBlob } from '../api/client.js';

export default function AuthImage({ src, alt, className }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setBlobUrl(null);
      setError(false);
      return undefined;
    }

    let active = true;
    let objectUrl;
    setBlobUrl(null);
    setError(false);

    fetchImageBlob(src)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setError(false);
      })
      .catch(() => {
        if (active) {
          setError(true);
          setBlobUrl(null);
        }
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-800 text-slate-500 ${className}`}
      >
        No image
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-800 text-red-400 ${className}`}
      >
        Failed to load
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-800 text-slate-500 ${className}`}
      >
        Loading...
      </div>
    );
  }

  return <img src={blobUrl} alt={alt} className={className} />;
}

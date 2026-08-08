import { useEffect, useState } from 'react';
import { fetchImageBlob } from '../api/client.js';
import ImageLightbox from './ImageLightbox.jsx';

export default function AuthImage({ src, alt, className, zoomable = false }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!src) {
      setBlobUrl(null);
      setError(false);
      setOpen(false);
      return undefined;
    }

    let active = true;
    let objectUrl;
    setBlobUrl(null);
    setError(false);
    setOpen(false);

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

  const img = (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
    />
  );

  if (!zoomable) {
    return img;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full cursor-zoom-in border-0 bg-transparent p-0 text-left"
        title="View full size"
        aria-label={`View full size: ${alt || 'image'}`}
      >
        {img}
      </button>
      {open && (
        <ImageLightbox
          src={blobUrl}
          alt={alt}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

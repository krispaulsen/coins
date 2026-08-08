import { useEffect } from 'react';

/**
 * Full-size image overlay. Expects an already-resolved blob/object URL
 * (or any displayable src) so we don't re-fetch.
 */
export default function ImageLightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image preview'}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-md border border-slate-600 bg-slate-900/80 px-3 py-1.5 text-sm text-slate-200 hover:border-amber-500 hover:text-white"
      >
        Close
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[95vw] object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

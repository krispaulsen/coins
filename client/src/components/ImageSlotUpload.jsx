import { useCallback, useMemo, useState } from 'react';
import api from '../api/client.js';
import AuthImage from './AuthImage.jsx';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function normalizeImageFile(fileOrBlob, fallbackName = 'clipboard.png') {
  if (!fileOrBlob) return null;

  const type = fileOrBlob.type || 'image/png';
  if (!ALLOWED_TYPES.has(type) && !type.startsWith('image/')) {
    return null;
  }

  // Server only accepts jpeg/png/webp; reject other image/* (e.g. gif, bmp)
  if (!ALLOWED_TYPES.has(type)) {
    const err = new Error('Only JPEG, PNG, and WebP images are allowed');
    err.code = 'UNSUPPORTED_TYPE';
    throw err;
  }

  if (fileOrBlob instanceof File && fileOrBlob.name) {
    return fileOrBlob;
  }

  const ext = type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png';
  const name =
    fileOrBlob.name && fileOrBlob.name.includes('.')
      ? fileOrBlob.name
      : fallbackName.replace(/\.\w+$/, `.${ext}`);

  return new File([fileOrBlob], name, { type });
}

function fileFromClipboardEvent(e) {
  const items = e.clipboardData?.items;
  if (items) {
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        return item.getAsFile();
      }
    }
  }

  const files = e.clipboardData?.files;
  if (files?.length) {
    for (const file of files) {
      if (file.type.startsWith('image/')) return file;
    }
  }

  return null;
}

async function fileFromClipboardApi() {
  if (!navigator.clipboard?.read) {
    const err = new Error(
      'Clipboard read is not supported in this browser. Use Ctrl+V / Cmd+V instead, or upload a file.'
    );
    err.code = 'CLIPBOARD_UNSUPPORTED';
    throw err;
  }

  let items;
  try {
    items = await navigator.clipboard.read();
  } catch (err) {
    if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
      const denied = new Error(
        'Clipboard permission denied. Allow clipboard access, or paste with Ctrl+V / Cmd+V.'
      );
      denied.code = 'CLIPBOARD_DENIED';
      throw denied;
    }
    throw err;
  }

  for (const item of items) {
    const imageType = item.types.find((t) => ALLOWED_TYPES.has(t) || t.startsWith('image/'));
    if (!imageType) continue;
    const blob = await item.getType(imageType);
    return blob;
  }

  return null;
}

export default function ImageSlotUpload({ itemId, imageUrls, onUpdated }) {
  const [uploading, setUploading] = useState(null);
  const [error, setError] = useState('');
  const [activeSlot, setActiveSlot] = useState('obverse');

  const defaultPasteSlot = useMemo(() => {
    if (!imageUrls?.obverse) return 'obverse';
    if (!imageUrls?.reverse) return 'reverse';
    return 'additional';
  }, [imageUrls]);

  const upload = useCallback(
    async (slot, file) => {
      if (!file) return;
      setUploading(slot);
      setError('');

      try {
        const normalized = normalizeImageFile(file);
        if (!normalized) {
          setError('No image found to upload');
          return;
        }

        const formData = new FormData();
        formData.append('image', normalized);
        const res = await api.post(`/items/${itemId}/images/${slot}`, formData);
        onUpdated(res.data);
      } catch (err) {
        if (err?.code === 'UNSUPPORTED_TYPE') {
          setError(err.message);
        } else {
          setError(err.response?.data?.error || err.message || 'Upload failed');
        }
      } finally {
        setUploading(null);
      }
    },
    [itemId, onUpdated]
  );

  const removeImage = async (fileId) => {
    if (!window.confirm('Remove this image permanently?')) return;

    setError('');
    try {
      const res = await api.delete(`/items/${itemId}/images/${fileId}`);
      onUpdated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  const handlePasteEvent = (e, slotOverride) => {
    const raw = fileFromClipboardEvent(e);
    if (!raw) return;

    e.preventDefault();
    const slot = slotOverride || activeSlot || defaultPasteSlot;
    setActiveSlot(slot);
    upload(slot, raw).catch(() => {});
  };

  const pasteFromClipboard = async (slot) => {
    setActiveSlot(slot);
    setError('');

    try {
      const raw = await fileFromClipboardApi();
      if (!raw) {
        setError('No image on the clipboard. Copy a photo first, then paste.');
        return;
      }
      await upload(slot, raw);
    } catch (err) {
      setError(err.message || 'Could not read clipboard');
    }
  };

  const slots = [
    { key: 'obverse', label: 'Obverse' },
    { key: 'reverse', label: 'Reverse' },
  ];

  return (
    <div
      className="space-y-4 rounded-lg outline-none focus-within:ring-1 focus-within:ring-amber-500/40"
      tabIndex={0}
      onFocus={() => {
        if (!activeSlot) setActiveSlot(defaultPasteSlot);
      }}
      onPaste={(e) => handlePasteEvent(e)}
    >
      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="text-xs text-slate-500">
        Upload a file or paste an image (Ctrl+V / Cmd+V). Click a slot to choose where it goes;
        keyboard paste uses the highlighted slot (defaults to the first empty side, then
        Additional).
      </p>

      <div className="flex flex-wrap gap-4">
        {slots.map(({ key, label }) => {
          const isActive = activeSlot === key;
          return (
            <div
              key={key}
              className={`space-y-2 rounded-md border p-3 ${
                isActive
                  ? 'border-amber-500/60 bg-slate-950/50'
                  : 'border-slate-800 bg-transparent'
              }`}
              onClick={() => setActiveSlot(key)}
              onPaste={(e) => handlePasteEvent(e, key)}
            >
              <p className="text-sm font-medium text-slate-300">{label}</p>
              <div className="flex flex-wrap gap-2">
                <label className="inline-block cursor-pointer rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-amber-500">
                  {uploading === key
                    ? 'Uploading...'
                    : imageUrls?.[key]
                      ? `Replace (browse)`
                      : `Browse file`}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={!!uploading}
                    onChange={(e) => {
                      setActiveSlot(key);
                      upload(key, e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={!!uploading}
                  onClick={() => pasteFromClipboard(key)}
                  className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-amber-500 disabled:opacity-50"
                >
                  {uploading === key ? 'Uploading...' : 'Paste'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={`space-y-2 rounded-md border p-3 ${
          activeSlot === 'additional'
            ? 'border-amber-500/60 bg-slate-950/50'
            : 'border-slate-800'
        }`}
        onClick={() => setActiveSlot('additional')}
        onPaste={(e) => handlePasteEvent(e, 'additional')}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-300">Additional Images</p>
          <div className="flex flex-wrap gap-3">
            <label className="cursor-pointer text-sm text-amber-400 hover:text-amber-300">
              {uploading === 'additional' ? 'Uploading...' : '+ Browse'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={!!uploading}
                onChange={(e) => {
                  setActiveSlot('additional');
                  upload('additional', e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              type="button"
              disabled={!!uploading}
              onClick={() => pasteFromClipboard('additional')}
              className="text-sm text-amber-400 hover:text-amber-300 disabled:opacity-50"
            >
              {uploading === 'additional' ? 'Uploading...' : 'Paste'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(imageUrls?.additional || []).map((url) => {
            const fileId = url.split('/').pop();
            return (
              <div key={url} className="relative">
                <AuthImage
                  src={url}
                  alt="Additional"
                  zoomable
                  className="aspect-square w-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(fileId);
                  }}
                  className="absolute right-2 top-2 z-10 rounded bg-slate-950/80 px-2 py-1 text-xs text-red-400 hover:bg-slate-950"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

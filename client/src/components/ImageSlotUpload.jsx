import { useState } from 'react';
import api from '../api/client.js';
import AuthImage from './AuthImage.jsx';

export default function ImageSlotUpload({ itemId, imageUrls, onUpdated }) {
  const [uploading, setUploading] = useState(null);
  const [error, setError] = useState('');

  const upload = async (slot, file) => {
    if (!file) return;
    setUploading(slot);
    setError('');

    try {
      const formData = new FormData();
      formData.append('image', file);
      // Do not set Content-Type manually — boundary is required for multer.
      const res = await api.post(`/items/${itemId}/images/${slot}`, formData);
      onUpdated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

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

  const slots = [
    { key: 'obverse', label: 'Obverse' },
    { key: 'reverse', label: 'Reverse' },
  ];

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-4">
        {slots.map(({ key, label }) => (
          <div key={key} className="space-y-2">
            <label className="inline-block cursor-pointer rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-amber-500">
              {uploading === key
                ? 'Uploading...'
                : imageUrls?.[key]
                  ? `Replace ${label}`
                  : `Upload ${label}`}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={!!uploading}
                onChange={(e) => {
                  upload(key, e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-300">Additional Images</p>
          <label className="cursor-pointer text-sm text-amber-400 hover:text-amber-300">
            {uploading === 'additional' ? 'Uploading...' : '+ Add image'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={!!uploading}
              onChange={(e) => {
                upload('additional', e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
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

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
      const res = await api.post(`/items/${itemId}/images/${slot}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUpdated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const removeImage = async (fileId) => {
    setError('');
    try {
      const res = await api.delete(`/items/${itemId}/images/${fileId}`);
      onUpdated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  const slots = [
    { key: 'obverse', label: 'Obverse', url: imageUrls?.obverse, fileId: null },
    { key: 'reverse', label: 'Reverse', url: imageUrls?.reverse, fileId: null },
  ];

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {slots.map(({ key, label, url }) => (
          <div key={key} className="space-y-2">
            <p className="text-sm font-medium text-slate-300">{label}</p>
            <AuthImage src={url} alt={label} className="aspect-square w-full rounded-lg object-cover" />
            <label className="inline-block cursor-pointer rounded-md border border-slate-700 px-3 py-2 text-sm hover:border-amber-500">
              {uploading === key ? 'Uploading...' : `Upload ${label}`}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={!!uploading}
                onChange={(e) => upload(key, e.target.files?.[0])}
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
              onChange={(e) => upload('additional', e.target.files?.[0])}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(imageUrls?.additional || []).map((url) => {
            const fileId = url.split('/').pop();
            return (
              <div key={url} className="relative">
                <AuthImage src={url} alt="Additional" className="aspect-square w-full rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(fileId)}
                  className="absolute right-2 top-2 rounded bg-slate-950/80 px-2 py-1 text-xs text-red-400"
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

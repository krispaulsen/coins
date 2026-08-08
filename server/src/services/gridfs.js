import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import sharp from 'sharp';

let bucket;

export function getBucket() {
  if (!bucket) {
    bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'coinImages' });
  }
  return bucket;
}

export async function processAndUploadImage(buffer, filename, metadata = {}) {
  const processed = await sharp(buffer)
    .rotate()
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  const bucket = getBucket();
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: 'image/jpeg',
      metadata,
    });

    uploadStream.on('error', reject);
    uploadStream.on('finish', () => resolve(uploadStream.id));
    uploadStream.end(processed);
  });
}

export async function deleteFile(fileId) {
  if (!fileId) return;
  const bucket = getBucket();
  try {
    await bucket.delete(fileId);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

export async function deleteFiles(fileIds) {
  await Promise.all(fileIds.filter(Boolean).map((id) => deleteFile(id)));
}

export function openDownloadStream(fileId) {
  const bucket = getBucket();
  return bucket.openDownloadStream(fileId);
}

export async function fileExists(fileId) {
  const bucket = getBucket();
  const files = await bucket.find({ _id: fileId }).limit(1).toArray();
  return files.length > 0;
}

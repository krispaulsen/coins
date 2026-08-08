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
  const uploadStream = bucket.openUploadStream(filename, {
    contentType: 'image/jpeg',
    metadata,
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const succeed = () => {
      if (settled) return;
      settled = true;
      resolve(uploadStream.id);
    };
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    uploadStream.once('error', fail);
    // Drivers vary between 'finish' and 'close' for write completion
    uploadStream.once('finish', succeed);
    uploadStream.once('close', succeed);
    uploadStream.end(processed);
  });
}

export async function deleteFile(fileId) {
  if (!fileId) return;
  const bucket = getBucket();
  try {
    const id =
      typeof fileId === 'string'
        ? new mongoose.Types.ObjectId(fileId)
        : fileId;
    await bucket.delete(id);
  } catch (err) {
    // File already gone — ignore
    if (err?.code === 'ENOENT' || err?.codeName === 'FileNotFound') return;
    throw err;
  }
}

export async function deleteFiles(fileIds) {
  await Promise.all(fileIds.filter(Boolean).map((id) => deleteFile(id)));
}

function asObjectId(fileId) {
  if (fileId instanceof mongoose.Types.ObjectId) return fileId;
  return new mongoose.Types.ObjectId(fileId);
}

export function openDownloadStream(fileId) {
  const bucket = getBucket();
  return bucket.openDownloadStream(asObjectId(fileId));
}

export async function fileExists(fileId) {
  const bucket = getBucket();
  const files = await bucket.find({ _id: asObjectId(fileId) }).limit(1).toArray();
  return files.length > 0;
}

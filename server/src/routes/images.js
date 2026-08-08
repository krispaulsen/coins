import { Router } from 'express';
import mongoose from 'mongoose';
import Item from '../models/Item.js';
import { authRequired } from '../middleware/auth.js';
import { openDownloadStream, fileExists } from '../services/gridfs.js';

const router = Router();

router.get('/:fileId', authRequired, async (req, res, next) => {
  try {
    const fileId = req.params.fileId;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid image id' });
    }

    const objectId = new mongoose.Types.ObjectId(fileId);
    const exists = await fileExists(objectId);
    if (!exists) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const owned = await Item.findOne({
      userId: req.user.id,
      $or: [
        { 'images.obverseFileId': objectId },
        { 'images.reverseFileId': objectId },
        { 'images.additionalFileIds': objectId },
      ],
    });

    if (!owned) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stream = openDownloadStream(objectId);
    stream.on('error', next);
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'private, max-age=3600');
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;

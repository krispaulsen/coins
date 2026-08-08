import { Router } from 'express';
import multer from 'multer';
import Item from '../models/Item.js';
import { authRequired } from '../middleware/auth.js';
import { calculateMetalValue, updateItemMetalValue } from '../services/metalValue.js';
import {
  processAndUploadImage,
  deleteFile,
  deleteFiles,
} from '../services/gridfs.js';

const router = Router();
router.use(authRequired);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

/**
 * Return API-relative image paths. The client prefixes them with VITE_API_URL
 * so thumbnails work whether the API is localhost, Render, etc.
 */
function buildImageUrls(item) {
  const toPath = (id) => (id ? `/api/images/${id}` : null);

  return {
    obverse: toPath(item.images?.obverseFileId),
    reverse: toPath(item.images?.reverseFileId),
    additional: (item.images?.additionalFileIds || [])
      .filter(Boolean)
      .map((id) => `/api/images/${id}`),
    _authRequired: true,
  };
}

export function serializeItem(item, _req, breakdown = null) {
  const obj = item.toObject ? item.toObject() : { ...item };
  return {
    ...obj,
    imageUrls: buildImageUrls(obj),
    metalBreakdown: breakdown,
  };
}

async function findOwnedItem(id, userId) {
  return Item.findOne({ _id: id, userId });
}

function collectFileIds(item) {
  const ids = [];
  if (item.images?.obverseFileId) ids.push(item.images.obverseFileId);
  if (item.images?.reverseFileId) ids.push(item.images.reverseFileId);
  if (item.images?.additionalFileIds?.length) {
    ids.push(...item.images.additionalFileIds);
  }
  return ids;
}

router.get('/', async (req, res, next) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = { userId: req.user.id };

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { title: regex },
        { country: regex },
        { denomination: regex },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Item.find(query).sort({ updatedAt: -1 }).skip(skip).limit(Number(limit)),
      Item.countDocuments(query),
    ]);

    res.json({
      items: items.map((item) => serializeItem(item, req)),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const item = await Item.create({
      ...req.body,
      userId: req.user.id,
      images: {
        obverseFileId: null,
        reverseFileId: null,
        additionalFileIds: [],
      },
    });

    await updateItemMetalValue(item);
    const { breakdown } = await calculateMetalValue(item);
    res.status(201).json(serializeItem(item, req, breakdown));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await findOwnedItem(req.params.id, req.user.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const { breakdown } = await calculateMetalValue(item);
    res.json(serializeItem(item, req, breakdown));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const item = await findOwnedItem(req.params.id, req.user.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const allowed = [
      'title', 'itemType', 'country', 'year', 'denomination', 'mint',
      'grade', 'condition', 'catalogRefs', 'weightGrams', 'weightUnit',
      'diameterMm', 'diameterUnit', 'thicknessMm', 'thicknessUnit',
      'composition', 'purchasePrice', 'purchaseDate', 'notes',
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        item[key] = req.body[key];
      }
    }

    await item.save();
    await updateItemMetalValue(item);
    const { breakdown } = await calculateMetalValue(item);
    res.json(serializeItem(item, req, breakdown));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const item = await findOwnedItem(req.params.id, req.user.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await deleteFiles(collectFileIds(item));
    await item.deleteOne();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/images/:slot', upload.single('image'), async (req, res, next) => {
  try {
    const item = await findOwnedItem(req.params.id, req.user.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const slot = req.params.slot;
    if (!['obverse', 'reverse', 'additional'].includes(slot)) {
      return res.status(400).json({ error: 'Invalid image slot' });
    }

    const fileId = await processAndUploadImage(
      req.file.buffer,
      `${item._id}-${slot}-${Date.now()}.jpg`,
      { itemId: item._id.toString(), userId: req.user.id, slot }
    );

    if (slot === 'obverse') {
      if (item.images.obverseFileId) await deleteFile(item.images.obverseFileId);
      item.images.obverseFileId = fileId;
    } else if (slot === 'reverse') {
      if (item.images.reverseFileId) await deleteFile(item.images.reverseFileId);
      item.images.reverseFileId = fileId;
    } else {
      item.images.additionalFileIds.push(fileId);
    }

    await item.save();
    res.json(serializeItem(item, req));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/images/:fileId', async (req, res, next) => {
  try {
    const item = await findOwnedItem(req.params.id, req.user.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const fileId = req.params.fileId;
    let removed = false;

    if (item.images.obverseFileId?.toString() === fileId) {
      await deleteFile(item.images.obverseFileId);
      item.images.obverseFileId = null;
      removed = true;
    } else if (item.images.reverseFileId?.toString() === fileId) {
      await deleteFile(item.images.reverseFileId);
      item.images.reverseFileId = null;
      removed = true;
    } else {
      const idx = item.images.additionalFileIds.findIndex(
        (id) => id.toString() === fileId
      );
      if (idx >= 0) {
        await deleteFile(item.images.additionalFileIds[idx]);
        item.images.additionalFileIds.splice(idx, 1);
        removed = true;
      }
    }

    if (!removed) {
      return res.status(404).json({ error: 'Image not found on this item' });
    }

    await item.save();
    res.json(serializeItem(item, req));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/recalculate-value', async (req, res, next) => {
  try {
    const item = await findOwnedItem(req.params.id, req.user.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await updateItemMetalValue(item);
    const { breakdown } = await calculateMetalValue(item);
    res.json(serializeItem(item, req, breakdown));
  } catch (err) {
    next(err);
  }
});

export default router;

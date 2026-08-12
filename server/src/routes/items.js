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

export function serializeItem(item, _req, breakdown = null, extras = {}) {
  const obj = item.toObject ? item.toObject() : { ...item };
  return {
    ...obj,
    imageUrls: buildImageUrls(obj),
    metalBreakdown: breakdown,
    ...extras,
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

/**
 * Ensure setId (if provided) points at an owned set item.
 * Sets cannot be nested under other sets.
 */
async function resolveSetId(setId, userId, { itemType } = {}) {
  if (setId === null || setId === undefined || setId === '') {
    return null;
  }

  if (itemType === 'set') {
    const err = new Error('A set cannot be a member of another set');
    err.status = 400;
    throw err;
  }

  const parent = await Item.findOne({ _id: setId, userId });
  if (!parent) {
    const err = new Error('Parent set not found');
    err.status = 404;
    throw err;
  }
  if (parent.itemType !== 'set') {
    const err = new Error('Parent item is not a set');
    err.status = 400;
    throw err;
  }
  if (parent.setId) {
    const err = new Error('Cannot nest items under a set member');
    err.status = 400;
    throw err;
  }

  return parent._id;
}

/** Aggregate melt from members; persist on the set document. */
async function refreshSetMetalValue(setItem) {
  const members = await Item.find({
    userId: setItem.userId,
    setId: setItem._id,
  }).select('metalValueUsd');

  const total = members.reduce(
    (sum, m) => sum + Number(m.metalValueUsd || 0),
    0
  );
  setItem.metalValueUsd = Number(total.toFixed(2));
  setItem.metalValueUpdatedAt = new Date();
  await setItem.save();
  return setItem;
}

/** After a member's melt changes, refresh its parent set total. */
async function refreshParentSetIfAny(item) {
  if (!item.setId) return;
  const parent = await Item.findOne({
    _id: item.setId,
    userId: item.userId,
    itemType: 'set',
  });
  if (parent) {
    await refreshSetMetalValue(parent);
  }
}

async function loadMembers(setItem) {
  return Item.find({
    userId: setItem.userId,
    setId: setItem._id,
  }).sort({ denomination: 1, title: 1 });
}

router.get('/', async (req, res, next) => {
  try {
    const {
      search,
      page = 1,
      limit = 20,
      includeMembers,
      setId,
      favorite,
    } = req.query;
    const query = { userId: req.user.id };

    // Default: top-level only (loose items + sets). Members stay under their set.
    if (setId) {
      query.setId = setId;
    } else if (includeMembers !== 'true') {
      query.$or = [{ setId: null }, { setId: { $exists: false } }];
    }

    if (favorite === 'true') {
      query.isFavorite = true;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      const searchClause = {
        $or: [
          { title: regex },
          { country: regex },
          { denomination: regex },
        ],
      };
      // Combine with top-level filter without clobbering $or
      if (query.$or && !setId && includeMembers !== 'true') {
        query.$and = [
          { $or: query.$or },
          searchClause,
        ];
        delete query.$or;
      } else {
        Object.assign(query, searchClause);
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Item.find(query).sort({ updatedAt: -1 }).skip(skip).limit(Number(limit)),
      Item.countDocuments(query),
    ]);

    // For set cards on the dashboard: attach memberCount and aggregated melt
    const setIds = items
      .filter((i) => i.itemType === 'set')
      .map((i) => i._id);

    let memberStats = {};
    if (setIds.length) {
      // setIds already scoped to this user via the list query above
      const stats = await Item.aggregate([
        { $match: { setId: { $in: setIds } } },
        {
          $group: {
            _id: '$setId',
            memberCount: { $sum: 1 },
            metalValueUsd: { $sum: { $ifNull: ['$metalValueUsd', 0] } },
          },
        },
      ]);
      memberStats = Object.fromEntries(
        stats.map((s) => [
          s._id.toString(),
          {
            memberCount: s.memberCount,
            metalValueUsd: Number((s.metalValueUsd || 0).toFixed(2)),
          },
        ])
      );
    }

    res.json({
      items: items.map((item) => {
        const extras = {};
        if (item.itemType === 'set') {
          const stats = memberStats[item._id.toString()] || {
            memberCount: 0,
            metalValueUsd: 0,
          };
          extras.memberCount = stats.memberCount;
          // Prefer live aggregate so list stays accurate without extra writes
          extras.metalValueUsd = stats.metalValueUsd;
        }
        return serializeItem(item, req, null, extras);
      }),
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
    const body = { ...req.body };
    const resolvedSetId = await resolveSetId(body.setId, req.user.id, {
      itemType: body.itemType,
    });

    if (body.itemType === 'set') {
      body.setId = null;
    } else {
      body.setId = resolvedSetId;
    }

    if (body.setKind !== undefined && body.itemType !== 'set') {
      body.setKind = '';
    }

    const item = await Item.create({
      ...body,
      userId: req.user.id,
      images: {
        obverseFileId: null,
        reverseFileId: null,
        additionalFileIds: [],
      },
    });

    if (item.itemType === 'set') {
      item.metalValueUsd = 0;
      item.metalValueUpdatedAt = new Date();
      await item.save();
      res.status(201).json(
        serializeItem(item, req, [], { members: [], memberCount: 0 })
      );
      return;
    }

    await updateItemMetalValue(item);
    await refreshParentSetIfAny(item);
    const { breakdown } = await calculateMetalValue(item);
    res.status(201).json(serializeItem(item, req, breakdown));
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await findOwnedItem(req.params.id, req.user.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.itemType === 'set') {
      const members = await loadMembers(item);
      await refreshSetMetalValue(item);
      const serializedMembers = members.map((m) => serializeItem(m, req));
      return res.json(
        serializeItem(item, req, null, {
          members: serializedMembers,
          memberCount: members.length,
        })
      );
    }

    const { breakdown } = await calculateMetalValue(item);
    let parentSet = null;
    if (item.setId) {
      parentSet = await Item.findOne({
        _id: item.setId,
        userId: req.user.id,
      }).select('title year setKind itemType');
    }

    res.json(
      serializeItem(item, req, breakdown, {
        parentSet: parentSet
          ? {
              _id: parentSet._id,
              title: parentSet.title,
              year: parentSet.year,
              setKind: parentSet.setKind,
              itemType: parentSet.itemType,
            }
          : null,
      })
    );
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
      'title', 'itemType', 'setKind', 'setId', 'country', 'year', 'denomination',
      'mint', 'mintMark', 'grade', 'condition', 'catalogRefs', 'weightGrams', 'weightUnit',
      'diameterMm', 'diameterUnit', 'thicknessMm', 'thicknessUnit',
      'composition', 'purchasePrice', 'purchaseDate', 'notes', 'isFavorite',
    ];

    const previousSetId = item.setId?.toString() || null;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        item[key] = req.body[key];
      }
    }

    if (item.itemType === 'set') {
      item.setId = null;
    } else if (req.body.setId !== undefined) {
      item.setId = await resolveSetId(req.body.setId, req.user.id, {
        itemType: item.itemType,
      });
    }

    if (item.itemType !== 'set') {
      item.setKind = item.setKind || '';
    }

    await item.save();

    if (item.itemType === 'set') {
      await refreshSetMetalValue(item);
      const members = await loadMembers(item);
      return res.json(
        serializeItem(item, req, null, {
          members: members.map((m) => serializeItem(m, req)),
          memberCount: members.length,
        })
      );
    }

    await updateItemMetalValue(item);

    // Refresh old and new parent sets if membership changed
    const newSetId = item.setId?.toString() || null;
    if (previousSetId && previousSetId !== newSetId) {
      const oldParent = await Item.findOne({
        _id: previousSetId,
        userId: req.user.id,
        itemType: 'set',
      });
      if (oldParent) await refreshSetMetalValue(oldParent);
    }
    await refreshParentSetIfAny(item);

    const { breakdown } = await calculateMetalValue(item);
    res.json(serializeItem(item, req, breakdown));
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const item = await findOwnedItem(req.params.id, req.user.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const cascade = req.query.cascade === 'true';
    const parentSetId = item.setId;

    if (item.itemType === 'set') {
      const members = await Item.find({
        userId: req.user.id,
        setId: item._id,
      });

      if (cascade) {
        for (const member of members) {
          await deleteFiles(collectFileIds(member));
          await member.deleteOne();
        }
      } else {
        // Unlink members so they become loose collection items
        await Item.updateMany(
          { userId: req.user.id, setId: item._id },
          { $set: { setId: null } }
        );
      }
    }

    await deleteFiles(collectFileIds(item));
    await item.deleteOne();

    if (parentSetId) {
      const parent = await Item.findOne({
        _id: parentSetId,
        userId: req.user.id,
        itemType: 'set',
      });
      if (parent) await refreshSetMetalValue(parent);
    }

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

    if (item.itemType === 'set') {
      const members = await loadMembers(item);
      for (const member of members) {
        await updateItemMetalValue(member);
      }
      await refreshSetMetalValue(item);
      const refreshedMembers = await loadMembers(item);
      return res.json(
        serializeItem(item, req, null, {
          members: refreshedMembers.map((m) => serializeItem(m, req)),
          memberCount: refreshedMembers.length,
        })
      );
    }

    await updateItemMetalValue(item);
    await refreshParentSetIfAny(item);
    const { breakdown } = await calculateMetalValue(item);
    res.json(serializeItem(item, req, breakdown));
  } catch (err) {
    next(err);
  }
});

export default router;

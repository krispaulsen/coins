import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import Item from '../models/Item.js';
import { authRequired } from '../middleware/auth.js';
import { calculateMetalValue, updateItemMetalValue } from '../services/metalValue.js';
import {
  processAndUploadImage,
  deleteFile,
  deleteFiles,
} from '../services/gridfs.js';
import {
  loadTagVocabulary,
  MAX_TAGS_PER_ITEM,
  normalizeTagList,
  tagExactRegex,
} from '../services/tags.js';

const MAX_BULK_TAG_IDS = 100;

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
    tags: Array.isArray(obj.tags) ? obj.tags : [],
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

async function applyNormalizedTags(item, rawTags, userId) {
  const vocabulary = await loadTagVocabulary(Item, userId);
  item.tags = normalizeTagList(rawTags, { existingVocabulary: vocabulary });
}

function serializeParentSet(parent) {
  if (!parent) return null;
  return {
    _id: parent._id,
    title: parent.title,
    year: parent.year,
    setKind: parent.setKind,
    itemType: parent.itemType,
  };
}

async function loadParentSetMap(items, userId) {
  const ids = [
    ...new Set(
      items
        .map((item) => item.setId)
        .filter(Boolean)
        .map((id) => id.toString())
    ),
  ];
  if (!ids.length) return {};

  const parents = await Item.find({
    _id: { $in: ids },
    userId,
  }).select('title year setKind itemType');

  return Object.fromEntries(
    parents.map((parent) => [parent._id.toString(), serializeParentSet(parent)])
  );
}

/** Query flags may arrive as 'true', true, or ['true'] depending on host/parser. */
function queryFlagEnabled(value) {
  if (Array.isArray(value)) return value.some(queryFlagEnabled);
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return false;
}

async function presentItemList(items, req) {
  const setIds = items.filter((i) => i.itemType === 'set').map((i) => i._id);

  let memberStats = {};
  if (setIds.length) {
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

  const parentSetMap = await loadParentSetMap(items, req.user.id);

  return items.map((item) => {
    const extras = {};
    if (item.itemType === 'set') {
      const stats = memberStats[item._id.toString()] || {
        memberCount: 0,
        metalValueUsd: 0,
      };
      extras.memberCount = stats.memberCount;
      extras.metalValueUsd = stats.metalValueUsd;
    }
    if (item.setId) {
      extras.parentSet = parentSetMap[item.setId.toString()] || null;
    }
    return serializeItem(item, req, null, extras);
  });
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
      isFavorite,
      tag,
    } = req.query;
    const query = { userId: req.user.id };
    const tagRegex = tag ? tagExactRegex(tag) : null;
    const includeSetMembers = queryFlagEnabled(includeMembers);

    // Default: top-level only (loose items + sets). Members stay under their set.
    // A tag filter is an explicit browse: include matching set members too.
    if (setId) {
      query.setId = setId;
    } else if (tagRegex) {
      query.tags = tagRegex;
    } else if (!includeSetMembers) {
      query.$or = [{ setId: null }, { setId: { $exists: false } }];
    }

    if (queryFlagEnabled(favorite) || queryFlagEnabled(isFavorite)) {
      query.isFavorite = true;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      const searchClause = {
        $or: [
          { title: regex },
          { country: regex },
          { denomination: regex },
          { tags: regex },
        ],
      };
      // Combine with top-level filter without clobbering $or
      if (query.$or && !setId && !includeSetMembers && !tagRegex) {
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

    res.json({
      items: await presentItemList(items, req),
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

/**
 * Pinned dashboard favorites. Dedicated path so the filter cannot be dropped
 * if a host/proxy coerces or strips the `favorite` query flag.
 */
router.get('/favorites', async (req, res, next) => {
  try {
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50)
      : 12;
    const query = {
      userId: req.user.id,
      isFavorite: true,
      $or: [{ setId: null }, { setId: { $exists: false } }],
    };

    const [items, total] = await Promise.all([
      Item.find(query).sort({ updatedAt: -1 }).limit(limit),
      Item.countDocuments(query),
    ]);

    res.json({
      items: await presentItemList(items, req),
      pagination: {
        page: 1,
        limit,
        total,
        pages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Collection-wide stats for the dashboard.
 * Melt is summed on non-set items only so set members are not double-counted
 * against their parent set's stored total.
 */
router.get('/stats', async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const [meltAgg, topLevelCount] = await Promise.all([
      Item.aggregate([
        {
          $match: {
            userId,
            itemType: { $ne: 'set' },
          },
        },
        {
          $group: {
            _id: null,
            metalValueUsd: { $sum: { $ifNull: ['$metalValueUsd', 0] } },
            coinCount: { $sum: 1 },
          },
        },
      ]),
      Item.countDocuments({
        userId: req.user.id,
        $or: [{ setId: null }, { setId: { $exists: false } }],
      }),
    ]);

    const melt = meltAgg[0] || { metalValueUsd: 0, coinCount: 0 };

    res.json({
      metalValueUsd: Number((melt.metalValueUsd || 0).toFixed(2)),
      coinCount: melt.coinCount || 0,
      topLevelCount,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/tags', async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const tags = await Item.aggregate([
      { $match: { userId, tags: { $exists: true, $ne: [] } } },
      { $unwind: '$tags' },
      { $match: { tags: { $type: 'string', $ne: '' } } },
      {
        $group: {
          _id: { $toLower: '$tags' },
          name: { $first: '$tags' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, name: 1 } },
      { $project: { _id: 0, name: 1, count: 1 } },
    ]);
    res.json({ tags });
  } catch (err) {
    next(err);
  }
});

router.patch('/tags', async (req, res, next) => {
  try {
    const fromRegex = tagExactRegex(req.body?.from);
    const toName = normalizeTagList([req.body?.to])[0];
    if (!fromRegex || !toName) {
      return res.status(400).json({ error: 'Both from and to tag names are required' });
    }

    const vocabulary = await loadTagVocabulary(Item, req.user.id);
    const [canonicalTo] = normalizeTagList([toName], { existingVocabulary: vocabulary });

    const matched = await Item.find({
      userId: req.user.id,
      tags: fromRegex,
    }).select('tags');

    let updated = 0;
    for (const item of matched) {
      const next = normalizeTagList(
        (item.tags || []).map((tag) => (fromRegex.test(tag) ? canonicalTo : tag)),
        { existingVocabulary: [canonicalTo, ...(item.tags || [])] }
      );
      const changed =
        next.length !== (item.tags || []).length ||
        next.some((tag, i) => tag !== item.tags[i]);
      if (changed) {
        item.tags = next;
        await item.save();
        updated += 1;
      }
    }

    res.json({ success: true, updated, name: canonicalTo });
  } catch (err) {
    next(err);
  }
});

router.post('/tags/apply', async (req, res, next) => {
  try {
    const rawIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds : [];
    if (!rawIds.length) {
      return res.status(400).json({ error: 'Select at least one item' });
    }
    if (rawIds.length > MAX_BULK_TAG_IDS) {
      return res.status(400).json({
        error: `You can tag at most ${MAX_BULK_TAG_IDS} items at once`,
      });
    }

    const itemIds = [
      ...new Set(
        rawIds
          .filter((id) => mongoose.isValidObjectId(id))
          .map((id) => String(id))
      ),
    ];
    if (!itemIds.length) {
      return res.status(400).json({ error: 'Select at least one item' });
    }

    const vocabulary = await loadTagVocabulary(Item, req.user.id);
    const [canonical] = normalizeTagList([req.body?.tag], {
      existingVocabulary: vocabulary,
    });
    if (!canonical) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const items = await Item.find({
      userId: req.user.id,
      _id: { $in: itemIds },
    }).select('tags');

    let updated = 0;
    let alreadyTagged = 0;
    let skippedLimit = 0;

    for (const item of items) {
      const current = item.tags || [];
      const hasTag = current.some(
        (tag) => tag.toLowerCase() === canonical.toLowerCase()
      );
      if (hasTag) {
        alreadyTagged += 1;
        continue;
      }
      if (current.length >= MAX_TAGS_PER_ITEM) {
        skippedLimit += 1;
        continue;
      }

      item.tags = normalizeTagList([...current, canonical], {
        existingVocabulary: [canonical, ...current],
      });
      await item.save();
      updated += 1;
    }

    res.json({
      success: true,
      name: canonical,
      updated,
      alreadyTagged,
      skippedLimit,
      notFound: itemIds.length - items.length,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/tags/:name', async (req, res, next) => {
  try {
    const nameRegex = tagExactRegex(req.params.name);
    if (!nameRegex) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const result = await Item.updateMany(
      { userId: req.user.id, tags: nameRegex },
      { $pull: { tags: nameRegex } }
    );

    res.json({ success: true, updated: result.modifiedCount || 0 });
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

    const vocabulary = await loadTagVocabulary(Item, req.user.id);
    const tags = normalizeTagList(body.tags, { existingVocabulary: vocabulary });

    const item = await Item.create({
      ...body,
      tags,
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
      'composition', 'purchasePrice', 'purchaseDate', 'notes', 'tags', 'isFavorite',
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

    if (req.body.tags !== undefined) {
      await applyNormalizedTags(item, req.body.tags, req.user.id);
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

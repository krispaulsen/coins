export const MAX_TAG_LENGTH = 32;
export const MAX_TAGS_PER_ITEM = 20;

/** Trim, collapse whitespace, cap length. Empty → null. */
export function normalizeTagName(raw) {
  if (raw == null) return null;
  const name = String(raw).trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
  return name || null;
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive exact matcher for a stored tag name. */
export function tagExactRegex(raw) {
  const name = normalizeTagName(raw);
  if (!name) return null;
  return new RegExp(`^${escapeRegex(name)}$`, 'i');
}

/**
 * Deduped tag list, preferring existing vocabulary casing so "Silver" and
 * "silver" do not fork. Caps at MAX_TAGS_PER_ITEM.
 */
export function normalizeTagList(list, { existingVocabulary = [] } = {}) {
  const vocabByLower = new Map();
  for (const entry of existingVocabulary) {
    const name = normalizeTagName(entry);
    if (!name) continue;
    const key = name.toLowerCase();
    if (!vocabByLower.has(key)) vocabByLower.set(key, name);
  }

  const seen = new Set();
  const result = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const name = normalizeTagName(raw);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(vocabByLower.get(key) || name);
    if (result.length >= MAX_TAGS_PER_ITEM) break;
  }
  return result;
}

export async function loadTagVocabulary(Item, userId) {
  const tags = await Item.distinct('tags', { userId });
  return (tags || []).filter(Boolean);
}

import SpotPriceCache from '../models/SpotPriceCache.js';

const CACHE_TTL_MS = 60 * 60 * 1000;
const METALS = ['gold', 'silver', 'copper', 'platinum', 'palladium', 'nickel'];

const METALMETRIC_KEYS = {
  gold: 'gold',
  silver: 'silver',
  copper: 'copper',
  platinum: 'platinum',
  palladium: 'palladium',
};

const AURUM_KEYS = {
  gold: 'gold',
  silver: 'silver',
  copper: 'copper',
  platinum: 'platinum',
  palladium: 'palladium',
};

async function fetchFromMetalMetric() {
  const response = await fetch(
    'https://metalmetric.com/api/gpt?action=spot_prices&metal=all'
  );
  if (!response.ok) throw new Error('MetalMetric request failed');

  const data = await response.json();
  const prices = data.prices || data.data || data;

  const result = {};
  for (const metal of METALS) {
    const key = METALMETRIC_KEYS[metal];
    if (key && prices[key] != null) {
      result[metal] = Number(prices[key]);
    }
  }
  return result;
}

async function fetchFromAurum() {
  const response = await fetch('https://aurumrates.com/api/v1/spot?metals=gold,silver,platinum,palladium,copper');
  if (!response.ok) throw new Error('AURUM request failed');

  const data = await response.json();
  const metals = data.metals || data.data || data;

  const result = {};
  for (const metal of METALS) {
    const key = AURUM_KEYS[metal];
    if (key && metals[key]?.price != null) {
      result[metal] = Number(metals[key].price);
    } else if (key && metals[key] != null && typeof metals[key] === 'number') {
      result[metal] = Number(metals[key]);
    }
  }
  return result;
}

async function fetchLivePrices() {
  try {
    const prices = await fetchFromMetalMetric();
    if (Object.keys(prices).length >= 3) return prices;
  } catch (err) {
    console.warn('MetalMetric failed, trying AURUM:', err.message);
  }

  return fetchFromAurum();
}

async function isCacheFresh() {
  const cached = await SpotPriceCache.find();
  if (cached.length === 0) return false;

  const oldest = cached.reduce(
    (min, row) => (row.fetchedAt < min ? row.fetchedAt : min),
    cached[0].fetchedAt
  );
  return Date.now() - oldest.getTime() < CACHE_TTL_MS;
}

export async function getSpotPrices(forceRefresh = false) {
  if (!forceRefresh && (await isCacheFresh())) {
    const cached = await SpotPriceCache.find().lean();
    return Object.fromEntries(
      cached.map((row) => [row.metal, row.pricePerTroyOzUsd])
    );
  }

  const live = await fetchLivePrices();
  const now = new Date();

  await Promise.all(
    Object.entries(live).map(([metal, pricePerTroyOzUsd]) =>
      SpotPriceCache.findOneAndUpdate(
        { metal },
        { pricePerTroyOzUsd, fetchedAt: now },
        { upsert: true, new: true }
      )
    )
  );

  return live;
}

export async function getSpotPriceMap() {
  return getSpotPrices(false);
}

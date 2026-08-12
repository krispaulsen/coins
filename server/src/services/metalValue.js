import { getSpotPriceMap } from './spotPrices.js';

const GRAMS_PER_TROY_OZ = 31.1034768;

export async function calculateMetalValue(item) {
  if (!item.weightGrams || !item.composition?.length) {
    return { totalUsd: 0, breakdown: [] };
  }

  const spotPrices = await getSpotPriceMap();
  const breakdown = [];
  let totalUsd = 0;

  for (const entry of item.composition) {
    // Spot prices are keyed by lowercase metal name; free-text materials have no spot.
    const spotKey = String(entry.metal || '').toLowerCase();
    const spot = spotPrices[spotKey];
    if (!spot) continue;

    const metalWeightGrams =
      item.weightGrams * (entry.percent / 100) * entry.purity;
    const metalWeightOz = metalWeightGrams / GRAMS_PER_TROY_OZ;
    const valueUsd = metalWeightOz * spot;

    breakdown.push({
      metal: entry.metal,
      percent: entry.percent,
      purity: entry.purity,
      weightOz: Number(metalWeightOz.toFixed(6)),
      spotPerOz: spot,
      valueUsd: Number(valueUsd.toFixed(2)),
    });

    totalUsd += valueUsd;
  }

  return {
    totalUsd: Number(totalUsd.toFixed(2)),
    breakdown,
  };
}

export async function updateItemMetalValue(item) {
  const { totalUsd } = await calculateMetalValue(item);
  item.metalValueUsd = totalUsd;
  item.metalValueUpdatedAt = new Date();
  await item.save();
  return item;
}

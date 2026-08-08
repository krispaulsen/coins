import mongoose from 'mongoose';

const spotPriceCacheSchema = new mongoose.Schema(
  {
    metal: {
      type: String,
      required: true,
      unique: true,
      enum: ['gold', 'silver', 'copper', 'platinum', 'palladium', 'nickel'],
    },
    pricePerTroyOzUsd: {
      type: Number,
      required: true,
    },
    fetchedAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('SpotPriceCache', spotPriceCacheSchema);

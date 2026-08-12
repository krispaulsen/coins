import mongoose from 'mongoose';

const compositionSchema = new mongoose.Schema(
  {
    metal: {
      type: String,
      required: true,
      enum: ['gold', 'silver', 'copper', 'platinum', 'palladium', 'nickel'],
    },
    percent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    purity: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
  },
  { _id: false }
);

const itemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    itemType: {
      type: String,
      enum: ['coin', 'token', 'medal', 'banknote', 'set', 'other'],
      default: 'coin',
    },
    /**
     * Kind of multi-coin package when itemType is 'set'.
     * e.g. proof, mint, prestige, custom
     */
    setKind: {
      type: String,
      enum: ['proof', 'mint', 'prestige', 'custom', ''],
      default: '',
      trim: true,
    },
    /**
     * When set, this item is a member of a parent set (itemType 'set').
     * Top-level items (including sets themselves) leave this null/undefined.
     */
    setId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      default: null,
      index: true,
    },
    country: { type: String, trim: true, default: '' },
    year: { type: Number },
    denomination: { type: String, trim: true, default: '' },
    mint: { type: String, trim: true, default: '' },
    /** Letter mint mark (P, D, S, W, etc.) */
    mintMark: { type: String, trim: true, default: '' },
    grade: { type: String, trim: true, default: '' },
    condition: { type: String, trim: true, default: '' },
    catalogRefs: [{ type: String, trim: true }],
    /** Canonical weight used for melt-value math */
    weightGrams: { type: Number, min: 0 },
    /** Display/entry unit preference: grams or troy ounces */
    weightUnit: {
      type: String,
      enum: ['g', 'oz t'],
      default: 'g',
    },
    /** Canonical diameter in millimeters */
    diameterMm: { type: Number, min: 0 },
    /** Display/entry unit preference: mm or inches */
    diameterUnit: {
      type: String,
      enum: ['mm', 'in'],
      default: 'mm',
    },
    /** Canonical thickness in millimeters */
    thicknessMm: { type: Number, min: 0 },
    /** Display/entry unit preference: mm or inches */
    thicknessUnit: {
      type: String,
      enum: ['mm', 'in'],
      default: 'mm',
    },
    composition: [compositionSchema],
    purchasePrice: { type: Number, min: 0 },
    purchaseDate: { type: Date },
    notes: { type: String, trim: true, default: '' },
    images: {
      obverseFileId: { type: mongoose.Schema.Types.ObjectId },
      reverseFileId: { type: mongoose.Schema.Types.ObjectId },
      additionalFileIds: [{ type: mongoose.Schema.Types.ObjectId }],
    },
    metalValueUsd: { type: Number, default: 0 },
    metalValueUpdatedAt: { type: Date },
  },
  { timestamps: true }
);

itemSchema.index({ userId: 1, updatedAt: -1 });
itemSchema.index({ userId: 1, setId: 1 });

export default mongoose.model('Item', itemSchema);

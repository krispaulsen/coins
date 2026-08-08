import { Router } from 'express';
import { authRequired } from '../middleware/auth.js';
import { getSpotPrices } from '../services/spotPrices.js';

const router = Router();

router.get('/spot', authRequired, async (req, res, next) => {
  try {
    const force = req.query.refresh === 'true';
    const prices = await getSpotPrices(force);
    res.json({ prices, fetchedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

export default router;

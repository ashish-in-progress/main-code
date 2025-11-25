// ==================== src/routes/kite.routes.js ====================
import express from 'express';
import { KiteController } from '../controllers/kite.controller.js';

const router = express.Router();

router.post('/login', KiteController.login);
router.post('/verify-auth', KiteController.verifyAuth);
router.post('/profile', KiteController.getProfile);
router.post('/holdings', KiteController.getHoldings);
router.post('/positions', KiteController.getPositions);
router.post('/orders', KiteController.getOrders);
router.post('/quotes', KiteController.getQuotes);
router.post('/margins', KiteController.getMargins);

export default router;
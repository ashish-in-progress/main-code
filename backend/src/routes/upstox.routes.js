// ==================== src/routes/upstox.routes.js ====================
import express from 'express';
import { UpstoxController } from '../controllers/upstox.controller.js';

const router = express.Router();

router.get('/login', UpstoxController.getLogin);
router.post('/profile', UpstoxController.getProfile);
router.post('/holdings', UpstoxController.getHoldings);
router.post('/positions', UpstoxController.getPositions);

export default router;
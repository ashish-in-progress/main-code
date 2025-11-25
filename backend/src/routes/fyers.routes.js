import express from 'express';
import { FyersController } from '../controllers/fyers.controller.js';

const router = express.Router();

router.post('/connect', FyersController.connect);
router.post('/login', FyersController.login);
router.post('/verify-auth', FyersController.verifyAuth);

export default router;
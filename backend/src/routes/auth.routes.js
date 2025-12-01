// ==================== src/routes/auth.routes.js ====================
import express from 'express';
import { AuthController } from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', AuthController.me);
router.post('/refresh', AuthController.refresh);
export default router;
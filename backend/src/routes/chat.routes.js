import express from 'express';
import { ChatController } from '../controllers/chat.controller.js';

const router = express.Router();

router.post('/', ChatController.chat);
router.post('/reset', ChatController.resetConversation);
router.get('/history', ChatController.getHistory);

export default router;
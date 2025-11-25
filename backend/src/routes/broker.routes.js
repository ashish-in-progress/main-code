import express from 'express';
import { BrokerController } from '../controllers/broker.controller.js';

const router = express.Router();

router.get('/status', BrokerController.getStatus);
router.post('/select', BrokerController.selectBroker);
router.post('/logout', BrokerController.logout);
router.get('/session/info', BrokerController.getSessionInfo);
router.get('/holdings', BrokerController.getHoldings);
export default router;
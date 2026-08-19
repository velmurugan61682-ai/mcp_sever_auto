import express from 'express';
import {
  getCallSessions,
  placeOutboundCall,
  handleMrAssistantWebhook,
} from '../controllers/voiceCallController.js';

const router = express.Router();

router.get('/', getCallSessions);
router.post('/outbound', placeOutboundCall);
router.post('/webhook', handleMrAssistantWebhook);

export default router;

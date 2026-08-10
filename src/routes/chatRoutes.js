import express from 'express';
import { sendMessage, regenerateMessage, generateAIReply } from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/message', sendMessage);
router.post('/regenerate', regenerateMessage);
router.post('/generate-reply', generateAIReply);

export default router;

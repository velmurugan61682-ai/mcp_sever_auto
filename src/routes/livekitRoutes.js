import express from 'express';
import { generateLiveKitToken, tokenLimiter } from '../controllers/livekitController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All LiveKit endpoints require user authentication
router.use(protect);

router.post('/token', tokenLimiter, generateLiveKitToken);

export default router;

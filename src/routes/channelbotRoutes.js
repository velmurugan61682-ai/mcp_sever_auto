import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getChannelBotUsers, saveChannelBotConfig } from '../controllers/channelbotController.js';

const router = express.Router();

router.use(protect);

router.get('/users', getChannelBotUsers);
router.post('/config', saveChannelBotConfig);

export default router;

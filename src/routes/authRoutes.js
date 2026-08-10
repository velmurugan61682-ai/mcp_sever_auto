import express from 'express';
import { registerUser, loginUser, getMe, updateSettings, googleUser } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleUser);
router.get('/me', protect, getMe);
router.patch('/settings', protect, updateSettings);

export default router;


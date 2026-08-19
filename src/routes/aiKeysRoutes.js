import express from 'express';
import { getAIKeySettings, updateAIKeySettings } from '../controllers/aiKeysController.js';

const router = express.Router();

router.get('/', getAIKeySettings);
router.post('/', updateAIKeySettings);

export default router;

import express from 'express';
import { getStructuredActivity } from '../controllers/structuredActivityController.js';

const router = express.Router();

router.get('/', getStructuredActivity);

export default router;

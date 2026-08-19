import express from 'express';
import { executeBuzzzCommand } from '../controllers/buzzzAssistantController.js';

const router = express.Router();

router.post('/execute', executeBuzzzCommand);

export default router;

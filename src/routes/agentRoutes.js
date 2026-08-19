import express from 'express';
import {
  getAgents,
  createAgent,
  updateAgent,
  testAgentChat,
} from '../controllers/agentController.js';

const router = express.Router();

router.get('/', getAgents);
router.post('/', createAgent);
router.put('/:id', updateAgent);
router.post('/:id/test-chat', testAgentChat);

export default router;

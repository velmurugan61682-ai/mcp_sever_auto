import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getAutomations,
  createAutomation,
  toggleAutomation,
  testAutomation,
  deleteAutomation
} from '../controllers/automationController.js';

const router = express.Router();

router.use(protect);

router.get('/', getAutomations);
router.post('/', createAutomation);
router.patch('/:id/toggle', toggleAutomation);
router.post('/:id/test', testAutomation);
router.delete('/:id', deleteAutomation);

export default router;

import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { enforceTenantScope } from '../middleware/tenantScope.js';
import {
  getAutomations,
  createDraftWorkflow,
  updateWorkflowStep,
  publishWorkflow,
  createAutomation,
  toggleAutomation,
  testAutomation,
  deleteAutomation
} from '../controllers/automationController.js';

const router = express.Router();

router.use(protect);
router.use(enforceTenantScope);

router.get('/', getAutomations);
router.post('/', createAutomation);
router.post('/draft', createDraftWorkflow);
router.patch('/:id/step', updateWorkflowStep);
router.post('/:id/publish', publishWorkflow);
router.patch('/:id/toggle', toggleAutomation);
router.post('/:id/test', testAutomation);
router.delete('/:id', deleteAutomation);

export default router;

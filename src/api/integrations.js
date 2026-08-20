import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { enforceTenantScope } from '../middleware/tenantScope.js';
import {
  listIntegrations,
  connectIntegration,
  getIntegrationDependents,
  disconnectIntegration
} from '../controllers/integrationsController.js';

const router = express.Router();

router.use(protect);
router.use(enforceTenantScope);

router.get('/', listIntegrations);
router.post('/:provider/connect', connectIntegration);
router.get('/:provider/dependents', getIntegrationDependents);
router.post('/:provider/disconnect', disconnectIntegration);

export default router;

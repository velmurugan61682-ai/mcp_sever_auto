import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { enforceTenantScope } from '../middleware/tenantScope.js';
import { deployIndustryPackTemplates } from '../controllers/agentLibraryController.js';

const router = express.Router();

router.use(protect);
router.use(enforceTenantScope);

router.post('/deploy', deployIndustryPackTemplates);

export default router;

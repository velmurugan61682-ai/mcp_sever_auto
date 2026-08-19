import express from 'express';
import { protect, requirePermission } from '../middleware/authMiddleware.js';
import enforceTenantScope from '../middleware/tenantScope.js';
import { getCampaigns, createCampaign } from '../controllers/campaignController.js';

const router = express.Router();

router.use(protect, enforceTenantScope);

router.get('/', requirePermission('campaigns.execute', 'crm.read'), getCampaigns);
router.post('/', requirePermission('campaigns.execute'), createCampaign);

export default router;

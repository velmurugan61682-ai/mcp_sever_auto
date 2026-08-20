import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { enforceTenantScope } from '../middleware/tenantScope.js';
import {
  getSettings,
  updateAIKeys,
  clearAIKey,
  updateAutonomyCeiling,
  applyIndustryPack
} from '../controllers/settingsController.js';

const router = express.Router();

router.use(protect);
router.use(enforceTenantScope);

router.get('/', getSettings);
router.put('/ai-keys', updateAIKeys);
router.delete('/ai-keys/:type', clearAIKey);
router.put('/autonomy-ceiling', updateAutonomyCeiling);
router.post('/industry-pack/apply', applyIndustryPack);

export default router;

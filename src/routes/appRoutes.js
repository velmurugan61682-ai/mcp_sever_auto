import express from 'express';
import {
  getApps,
  getConnectedApps,
  getAppById,
  connectAppConnector,
  disconnectAppConnector,
  syncAppConnector,
  getAppItemsController,
  getAppToolsController,
  callAppToolController
} from '../controllers/appController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getApps);
router.get('/connected', getConnectedApps);
router.get('/:appId', getAppById);
router.post('/:appId/connect', connectAppConnector);
router.post('/:appId/reconnect', connectAppConnector);
router.delete('/:appId/disconnect', disconnectAppConnector);
router.post('/:appId/sync', syncAppConnector);
router.get('/:appId/items', getAppItemsController);
router.get('/:appId/tools', getAppToolsController);
router.post('/:appId/tools/:toolName/call', callAppToolController);

export default router;

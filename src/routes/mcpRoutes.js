import express from 'express';
import {
  getServers,
  addServer,
  updateServer,
  deleteServer,
  testServerConnection,
  connectServer,
  discoverTools,
  getServerTools,
  executeToolById
} from '../controllers/mcpController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/servers')
  .get(getServers)
  .post(addServer);

router.route('/servers/:id')
  .patch(updateServer)
  .delete(deleteServer);

router.post('/servers/:id/test', testServerConnection);
router.post('/servers/:id/connect', connectServer);
router.post('/servers/:id/discover', discoverTools);
router.get('/servers/:id/tools', getServerTools);

router.post('/tools/:toolId/execute', executeToolById);
router.post('/tools/call', executeToolById);

export default router;

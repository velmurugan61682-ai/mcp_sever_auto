import express from 'express';
import { protect, requirePermission } from '../middleware/authMiddleware.js';
import enforceTenantScope from '../middleware/tenantScope.js';
import {
  getAppointments,
  createAppointment,
  sendConfirmation,
  sendAllPendingConfirmations,
  checkSlots,
} from '../controllers/appointmentController.js';

const router = express.Router();

router.use(protect, enforceTenantScope);

router.get('/slots/available', requirePermission('appointments.read'), checkSlots);
router.get('/', requirePermission('appointments.read'), getAppointments);
router.post('/', requirePermission('appointments.write'), createAppointment);
router.post('/confirm-all', requirePermission('appointments.write'), sendAllPendingConfirmations);
router.post('/:id/confirm', requirePermission('appointments.write'), sendConfirmation);

export default router;

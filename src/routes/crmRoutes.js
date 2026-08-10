import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getLeads, createLead, updateLead, deleteLead, addLeadNote } from '../controllers/crmController.js';

const router = express.Router();

router.use(protect);

router.get('/leads', getLeads);
router.post('/leads', createLead);
router.put('/leads/:id', updateLead);
router.delete('/leads/:id', deleteLead);
router.post('/leads/:id/notes', addLeadNote);

export default router;

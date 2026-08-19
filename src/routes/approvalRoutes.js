import express from 'express';
import { getApprovalItems, decideApproval } from '../controllers/approvalController.js';

const router = express.Router();

router.get('/', getApprovalItems);
router.post('/:id/decide', decideApproval);

export default router;

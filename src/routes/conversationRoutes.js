import express from 'express';
import {
  getConversations,
  createConversation,
  getConversationById,
  updateConversation,
  deleteConversation
} from '../controllers/chatController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getConversations)
  .post(createConversation);

router.route('/:id')
  .get(getConversationById)
  .patch(updateConversation)
  .delete(deleteConversation);

export default router;

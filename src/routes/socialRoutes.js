import express from 'express';
import {
  getSocialPosts,
  createSocialPost,
  generateAICaption,
  generateAIImage,
  approveSocialPost,
} from '../controllers/socialController.js';

const router = express.Router();

router.get('/', getSocialPosts);
router.post('/', createSocialPost);
router.post('/generate-caption', generateAICaption);
router.post('/generate-image', generateAIImage);
router.post('/:id/approve', approveSocialPost);

export default router;

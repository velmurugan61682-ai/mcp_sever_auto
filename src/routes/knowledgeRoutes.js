import express from 'express';
import {
  getKnowledgeSources,
  createKnowledgeSource,
  testKnowledgeRetrieval,
} from '../controllers/knowledgeController.js';

const router = express.Router();

router.get('/', getKnowledgeSources);
router.post('/', createKnowledgeSource);
router.post('/test-retrieval', testKnowledgeRetrieval);

export default router;

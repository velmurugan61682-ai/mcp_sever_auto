import express from 'express';
import mongoose from 'mongoose';
import { queueManager } from '../config/queueConfig.js';

const router = express.Router();

const baseHealth = () => ({
  service: 'mcp.ai backend',
  timestamp: new Date().toISOString(),
  uptime: Math.floor(process.uptime()),
  mongo: {
    readyState: mongoose.connection.readyState,
    status: mongoose.connection.readyState === 1 ? 'connected' : 'not_connected'
  },
  queues: queueManager.getHealth()
});

router.get('/', (req, res) => {
  const health = baseHealth();
  res.status(200).json({
    status: health.mongo.status === 'connected' ? 'healthy' : 'degraded',
    ...health
  });
});

router.get('/ready', (req, res) => {
  const health = baseHealth();
  const ready = health.mongo.status === 'connected' && health.queues.status === 'ready';
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'degraded',
    ...health
  });
});

export default router;

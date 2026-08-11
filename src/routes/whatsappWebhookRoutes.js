import express from 'express';
import { processIncomingInboxEvent } from '../services/inboxSyncService.js';
import { ConnectedApp } from '../models/ConnectedApp.js';
import { User } from '../models/User.js';

const router = express.Router();

// GET /webhook/whatsapp — Meta Webhook Verification Endpoint
router.get(['/webhook/whatsapp', '/whatsapp', '/'], (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'mcp_whatsapp_verify_token_secret';

  if (mode && token) {
    if (mode === 'subscribe' && token === expectedVerifyToken) {
      console.log('[WhatsApp Webhook] Verification successful. Challenge echoed.');
      return res.status(200).send(challenge);
    } else {
      console.warn('[WhatsApp Webhook] Verification failed. Token mismatch.');
      return res.sendStatus(403);
    }
  }

  res.sendStatus(400);
});

// POST /webhook/whatsapp — Meta Webhook Event Notification Endpoint
router.post(['/webhook/whatsapp', '/whatsapp', '/'], async (req, res) => {
  try {
    const body = req.body;

    if (body.object === 'whatsapp_business_account' || body.entry) {
      // Resolve target user ID for multi-tenant isolation
      let targetUserId = req.body?.userId || req.query?.userId;
      if (!targetUserId) {
        const connectedWhatsapp = await ConnectedApp.findOne({ appId: 'whatsapp', status: 'connected' });
        if (connectedWhatsapp) {
          targetUserId = connectedWhatsapp.userId;
        } else {
          const firstUser = await User.findOne({}).select('_id');
          if (firstUser) {
            targetUserId = firstUser._id;
          }
        }
      }

      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value || {};
          const messages = value.messages || [];
          const contacts = value.contacts || [];

          for (const msg of messages) {
            const senderPhone = msg.from || (contacts[0] ? contacts[0].wa_id : 'unknown_sender');
            const senderName = (contacts[0] && contacts[0].profile) ? contacts[0].profile.name : senderPhone;
            const messageText = msg.text?.body || msg.caption || '[Media Message]';
            const timestamp = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date();
            const platformEventId = msg.id || `wamid.${Date.now()}`;

            if (targetUserId) {
              await processIncomingInboxEvent({
                userId: targetUserId,
                connectionId: 'whatsapp',
                platform: 'whatsapp',
                platformEventId,
                platformThreadId: senderPhone,
                type: 'message',
                sender: {
                  id: senderPhone,
                  name: senderName,
                  isMe: false
                },
                title: senderName,
                content: messageText,
                timestamp,
                priority: 'normal'
              });
            }
          }
        }
      }

      return res.status(200).json({ status: 'EVENT_RECEIVED' });
    } else {
      return res.sendStatus(404);
    }
  } catch (err) {
    console.error('[WhatsApp Webhook] Processing error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;

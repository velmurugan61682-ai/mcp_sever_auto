import { queueManager } from '../config/queueConfig.js';
import Campaign from '../models/Campaign.js';
import StructuredActivity from '../models/StructuredActivity.js';
import GoWhatsConnector from '../services/connectors/gowhats.js';

const gowhats = new GoWhatsConnector(process.env.GOWHATS_API_KEY, process.env.GOWHATS_WEBHOOK_SECRET);

/**
 * Worker: Processes throttled outbound campaigns respecting rate limits & quiet hours
 */
queueManager.registerWorker('campaign-delivery', async (job) => {
  const { campaignId, recipient, messageTemplate } = job.data;

  // Check quiet hours (e.g., between 9 PM and 8 AM)
  const currentHour = new Date().getHours();
  if (currentHour >= 21 || currentHour < 8) {
    console.log(`[Campaign Worker] Quiet hours active (${currentHour}:00). Delaying recipient ${recipient.name}.`);
    return;
  }

  try {
    const customizedMessage = messageTemplate
      .replace(/{{name}}/g, recipient.name || 'there')
      .replace(/{{time}}/g, 'tomorrow');

    if (recipient.channel === 'whatsapp' || !recipient.channel) {
      await gowhats.sendMessage({
        to: recipient.destination,
        text: customizedMessage,
      });
    }

    // Update recipient status inside Campaign
    if (campaignId) {
      await Campaign.updateOne(
        { _id: campaignId, 'recipients.destination': recipient.destination },
        {
          $set: {
            'recipients.$.status': 'sent',
            'recipients.$.deliveredAt': new Date(),
          },
          $inc: { 'metrics.sentCount': 1 },
        }
      );
    }
  } catch (error) {
    if (campaignId) {
      await Campaign.updateOne(
        { _id: campaignId, 'recipients.destination': recipient.destination },
        {
          $set: {
            'recipients.$.status': 'failed',
            'recipients.$.failureReason': error.message,
          },
          $inc: { 'metrics.failedCount': 1 },
        }
      );
    }
    throw error;
  }
});

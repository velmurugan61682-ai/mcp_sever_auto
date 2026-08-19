import Campaign from '../models/Campaign.js';
import { CRMLead } from '../models/CRMLead.js';
import StructuredActivity from '../models/StructuredActivity.js';
import { campaignQueue, QueueUnavailableError } from '../config/queueConfig.js';

const getWorkspaceId = (req) => req.auth.workspaceId;

export const getCampaigns = async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const campaigns = await Campaign.find({ workspaceId }).sort({ createdAt: -1 });
    res.json({ success: true, count: campaigns.length, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCampaign = async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { name, channel, segmentTarget, messageTemplate, sendRatePerMinute, scheduledFor } = req.body;

    if (!name || !messageTemplate) {
      return res.status(400).json({ success: false, message: 'Campaign name and message template are required' });
    }

    const leads = await CRMLead.find({ workspaceId });
    const recipients = leads
      .map((lead) => ({
        contactId: lead._id,
        name: lead.name,
        destination: lead.phone || lead.email,
        channel: channel || 'whatsapp',
        status: 'queued',
      }))
      .filter((recipient) => recipient.destination);

    const campaign = await Campaign.create({
      workspaceId,
      name,
      channel: channel || 'whatsapp',
      segmentTarget: segmentTarget || 'all_leads',
      messageTemplate,
      sendRatePerMinute: sendRatePerMinute || 60,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      status: recipients.length > 0 ? 'scheduled' : 'draft',
      recipients,
      metrics: {
        totalRecipients: recipients.length,
        sentCount: 0,
        deliveredCount: 0,
        repliedCount: 0,
        convertedCount: 0,
        failedCount: 0,
      },
    });

    if (recipients.length > 0) {
      await campaignQueue.add(
        'campaign.delivery',
        {
          workspaceId: String(workspaceId),
          jobType: 'campaign.delivery',
          entityId: String(campaign._id),
          campaignId: String(campaign._id),
          idempotencyKey: `campaign:${campaign._id}`,
          scheduledFor: scheduledFor || null
        },
        {
          jobId: `campaign:${campaign._id}`,
          delay: scheduledFor ? Math.max(new Date(scheduledFor).getTime() - Date.now(), 0) : 0,
          attempts: 3,
          backoff: { type: 'exponential', delay: 10000 }
        }
      );
    }

    await StructuredActivity.create({
      workspaceId,
      actor: 'BUZZZ Campaign Manager',
      actorType: 'workflow',
      mode: recipients.length > 0 ? 'autonomous' : 'blocked_guardrail',
      action: recipients.length > 0 ? `Queued Campaign: ${name}` : `Created Draft Campaign: ${name}`,
      category: 'messages',
      detail: recipients.length > 0 ? `Queued ${recipients.length} recipients via ${campaign.channel}.` : 'No reachable CRM recipients were available.',
      outcome: recipients.length > 0 ? 'success' : 'blocked',
      linkedEntityId: campaign._id.toString(),
    });

    res.status(recipients.length > 0 ? 202 : 201).json({ success: true, data: campaign });
  } catch (error) {
    const statusCode = error instanceof QueueUnavailableError || error.code === 'QUEUE_UNAVAILABLE' ? 503 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

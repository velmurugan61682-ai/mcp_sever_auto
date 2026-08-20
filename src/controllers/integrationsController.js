import { Integration } from '../models/Integration.js';
import { Agent } from '../models/Agent.js';
import { AutomationWorkflow } from '../models/AutomationWorkflow.js';
import { Campaign } from '../models/Campaign.js';
import { StructuredActivity } from '../models/StructuredActivity.js';
import { GoWhatsAdapter } from '../providers/gowhats/adapter.js';
import { InstaxBotAdapter } from '../providers/instaxbot/adapter.js';
import { StripeAdapter } from '../providers/stripe/adapter.js';
import { HubSpotAdapter } from '../providers/hubspot/adapter.js';
import { ShopifyAdapter } from '../providers/shopify/adapter.js';
import { GoogleCalendarAdapter } from '../providers/googleCalendar/adapter.js';
import { LiveKitVoiceAdapter } from '../providers/livekitVoice/adapter.js';

export const getAdapterInstance = (provider, options = {}) => {
  switch (provider) {
    case 'gowhats':
    case 'whatsapp':
      return new GoWhatsAdapter(options);
    case 'instaxbot':
    case 'instagram':
      return new InstaxBotAdapter(options);
    case 'stripe':
      return new StripeAdapter(options);
    case 'hubspot':
      return new HubSpotAdapter(options);
    case 'shopify':
      return new ShopifyAdapter(options);
    case 'googleCalendar':
    case 'gcal':
      return new GoogleCalendarAdapter(options);
    case 'livekit':
    case 'livekitVoice':
      return new LiveKitVoiceAdapter(options);
    default:
      return new HubSpotAdapter(options);
  }
};

export const listIntegrations = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const items = await Integration.find({ workspaceId });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const connectIntegration = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { provider } = req.params;
    const { apiKey, credentials = {} } = req.body;

    const creds = apiKey ? { ...credentials, apiKey, accessToken: apiKey, secretKey: apiKey } : credentials;
    const adapter = getAdapterInstance(provider, { workspaceId, ...creds });

    const health = await adapter.healthCheck();
    if (health.status === 'error') {
      return res.status(400).json({
        success: false,
        message: `Connection test failed for ${provider}: ${health.reason || 'Invalid API key'}`
      });
    }

    const integration = await Integration.findOneAndUpdate(
      { workspaceId, provider },
      {
        workspaceId,
        provider,
        name: provider.toUpperCase(),
        status: 'connected',
        credentials: creds,
        lastConnected: new Date(),
        lastHealthCheck: new Date(),
        healthReason: null
      },
      { upsert: true, new: true }
    );

    await StructuredActivity.create({
      workspaceId,
      actorType: 'user',
      actorId: req.user?._id,
      action: `CONNECT_INTEGRATION_${provider.toUpperCase()}`,
      outcome: 'success',
      details: { provider, status: 'connected' }
    }).catch(() => {});

    res.json({
      success: true,
      message: `${provider} successfully connected.`,
      data: integration
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getIntegrationDependents = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { provider } = req.params;

    const dependents = [];

    // Scan agents using tools or channels matching this provider
    const agents = await Agent.find({ workspaceId }).lean();
    agents.forEach((agent) => {
      const tools = agent.tools || [];
      const channels = agent.channels || [];
      if (
        tools.some((t) => t.toLowerCase().includes(provider)) ||
        channels.some((c) => c.toLowerCase().includes(provider))
      ) {
        dependents.push({ id: agent._id, name: agent.name, type: 'agent', details: `Uses ${provider} channel/tool` });
      }
    });

    // Scan workflows matching targetApp or trigger
    const workflows = await AutomationWorkflow.find({ workspaceId }).lean();
    workflows.forEach((wf) => {
      if ((wf.targetApp && wf.targetApp.toLowerCase().includes(provider)) || (wf.trigger && wf.trigger.toLowerCase().includes(provider))) {
        dependents.push({ id: wf._id, name: wf.name, type: 'workflow', details: `Automated graph trigger/action` });
      }
    });

    // Scan campaigns
    const campaigns = await Campaign.find({ workspaceId }).lean();
    campaigns.forEach((camp) => {
      if (camp.channel && camp.channel.toLowerCase().includes(provider)) {
        dependents.push({ id: camp._id, name: camp.name, type: 'campaign', details: `Broadcast channel ${camp.channel}` });
      }
    });

    res.json({
      success: true,
      provider,
      hasDependents: dependents.length > 0,
      dependentsCount: dependents.length,
      dependents
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const disconnectIntegration = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { provider } = req.params;

    await Integration.findOneAndUpdate(
      { workspaceId, provider },
      {
        status: 'not_connected',
        credentials: {},
        lastHealthCheck: new Date(),
        healthReason: 'User disconnected'
      }
    );

    await StructuredActivity.create({
      workspaceId,
      actorType: 'user',
      actorId: req.user?._id,
      action: `DISCONNECT_INTEGRATION_${provider.toUpperCase()}`,
      outcome: 'success',
      details: { provider, status: 'not_connected' }
    }).catch(() => {});

    res.json({
      success: true,
      message: `${provider} successfully disconnected.`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  listIntegrations,
  connectIntegration,
  getIntegrationDependents,
  disconnectIntegration
};

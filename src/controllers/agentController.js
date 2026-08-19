import Agent from '../models/Agent.js';
import AIKeySetting from '../models/AIKeySetting.js';
import { canAgentDo } from '../services/autonomyService.js';
import StructuredActivity from '../models/StructuredActivity.js';
import ApprovalItem from '../models/ApprovalItem.js';

export const getAgents = async (req, res) => {
  try {
    let agents = await Agent.find().sort({ createdAt: -1 });

    // If no agents exist yet, seed the default 6 specialized agents
    if (agents.length === 0) {
      const defaultAgents = [
        {
          name: 'Sarah',
          type: 'sales',
          roleTitle: 'Enterprise Sales & Deal Closer',
          tone: 'consultative',
          autonomyLevel: 3,
          status: 'active',
          tools: ['crm', 'calendar', 'gowhats_whatsapp'],
          permissions: ['CAN_SEND_MESSAGE', 'CAN_CREATE_DEAL', 'CAN_BOOK_APPOINTMENT'],
          goals: ['Qualify inbound prospects', 'Schedule enterprise demos', 'Accelerate pipeline velocity'],
          guardrails: [{ name: 'Discount Cap', condition: 'Max 10% discount', action: 'require_approval' }],
        },
        {
          name: 'Kai',
          type: 'support',
          roleTitle: 'Tier-1 Customer Support Specialist',
          tone: 'empathetic',
          autonomyLevel: 2,
          status: 'active',
          tools: ['ticketing', 'gowhats_whatsapp', 'instaxbot_instagram'],
          permissions: ['CAN_SEND_MESSAGE'],
          goals: ['Resolve inquiries under 5 minutes', 'De-escalate unhappy customers', 'Escalate refunds'],
          guardrails: [{ name: 'Refund Guardrail', condition: 'Refund requests must route to manager', action: 'require_approval' }],
        },
        {
          name: 'Ana',
          type: 'appointment',
          roleTitle: 'Scheduling & In-Person Visit Coordinator',
          tone: 'friendly',
          autonomyLevel: 2,
          status: 'active',
          tools: ['calendar', 'gowhats_whatsapp'],
          permissions: ['CAN_SEND_MESSAGE', 'CAN_BOOK_APPOINTMENT'],
          goals: ['Eliminate no-shows', 'Confirm upcoming visits', 'Reschedule on demand'],
        },
        {
          name: 'Voz',
          type: 'voice',
          roleTitle: 'Voice Phone Agent (MrAssistant.ai)',
          tone: 'professional',
          autonomyLevel: 3,
          status: 'active',
          tools: ['mrassistant_voice', 'calendar', 'crm'],
          permissions: ['CAN_PLACE_CALL', 'CAN_BOOK_APPOINTMENT'],
          goals: ['Answer inbound calls', 'Qualify phone leads', 'Write call summaries to CRM'],
        },
        {
          name: 'Sky',
          type: 'social',
          roleTitle: 'Social Media & Brand Growth Manager',
          tone: 'friendly',
          autonomyLevel: 2,
          status: 'active',
          tools: ['social', 'instaxbot_instagram'],
          permissions: ['CAN_POST_SOCIAL', 'CAN_SEND_MESSAGE'],
          goals: ['Draft weekly content', 'Reply to Instagram DMs', 'Capture social comments as leads'],
        },
        {
          name: 'Mira',
          type: 'retention',
          roleTitle: 'Customer Success & Retention AI',
          tone: 'empathetic',
          autonomyLevel: 2,
          status: 'active',
          tools: ['crm', 'gowhats_whatsapp'],
          permissions: ['CAN_SEND_MESSAGE', 'CAN_CREATE_LEAD'],
          goals: ['Win back lapsed customers', 'Gather NPS feedback', 'Identify churn risks'],
        },
      ];

      agents = await Agent.insertMany(defaultAgents);
    }

    res.json({ success: true, count: agents.length, data: agents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAgent = async (req, res) => {
  try {
    const agent = new Agent(req.body);
    await agent.save();
    res.status(201).json({ success: true, data: agent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const settings = await AIKeySetting.findOne();
    const ceiling = settings?.workspaceAutonomyCeiling ?? 4;

    if (req.body.autonomyLevel && req.body.autonomyLevel > ceiling) {
      return res.status(400).json({
        success: false,
        message: `Cannot set agent autonomy to Level ${req.body.autonomyLevel}. The workspace autonomy ceiling is set to Level ${ceiling}. Adjust the ceiling in Settings first.`,
      });
    }

    const agent = await Agent.findByIdAndUpdate(id, req.body, { new: true });
    res.json({ success: true, data: agent });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const testAgentChat = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    const agent = await Agent.findById(id);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    const settings = await AIKeySetting.findOne();
    const ceiling = settings?.workspaceAutonomyCeiling ?? 4;

    // Evaluate governance for whatever the customer asks
    const lower = (message || '').toLowerCase();
    let requiresApproval = false;
    let gateReason = '';
    let reply = '';

    if (lower.includes('discount') || lower.includes('30%') || lower.includes('20%')) {
      const check = canAgentDo(agent, 'CAN_ISSUE_CREDIT', ceiling, { text: message });
      if (!check.allowed && check.requiresApproval) {
        requiresApproval = true;
        gateReason = check.reason;
        reply = `I would love to help you with special pricing, but discounts above 10% require manager review. I have queued an approval request with our team!`;
      } else {
        reply = `We can offer our standard promotional package with a 5% introductory discount!`;
      }
    } else if (lower.includes('refund') || lower.includes('money back')) {
      const check = canAgentDo(agent, 'CAN_ISSUE_REFUND', ceiling, { text: message });
      requiresApproval = true;
      gateReason = check.reason || 'Refund requests require human sign-off.';
      reply = `I have logged your refund inquiry and routed it directly to our finance management queue for immediate assistance.`;
    } else if (lower.includes('appointment') || lower.includes('book') || lower.includes('schedule')) {
      reply = `Certainly! I have open slots available tomorrow at 11:00 AM and 2:30 PM. Would you prefer in-person at our Downtown Branch or a video consultation?`;
    } else {
      reply = `Hello! I'm ${agent.name}, your ${agent.roleTitle}. How can I assist you with your goals today?`;
    }

    res.json({
      success: true,
      agentName: agent.name,
      effectiveAutonomyLevel: Math.min(agent.autonomyLevel, ceiling),
      reply,
      requiresApproval,
      gateReason,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

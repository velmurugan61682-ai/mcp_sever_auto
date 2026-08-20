import { canAgentDo, agentAct } from '../../engines/governance.js';
import { Contact } from '../../models/Contact.js';
import { Deal } from '../../models/Deal.js';
import { Appointment } from '../../models/Appointment.js';
import { Campaign } from '../../models/Campaign.js';
import { AutomationWorkflow } from '../../models/AutomationWorkflow.js';
import { KnowledgeSource } from '../../models/KnowledgeSource.js';
import { CallSession } from '../../models/CallSession.js';
import { ApprovalItem } from '../../models/ApprovalItem.js';
import { StructuredActivity } from '../../models/StructuredActivity.js';
import { calculateAvailableSlots } from '../../engines/availability.js';
import { retrieveKnowledge } from '../../engines/retrieval.js';
import { runWorkflow } from '../../engines/workflow.js';

export const TOOL_ACTION_MAPPING = {
  'crm.createContact': 'CAN_CREATE_LEAD',
  'crm.updateContact': 'CAN_UPDATE_DEAL',
  'crm.moveDeal': 'CAN_UPDATE_DEAL',
  'crm.searchContacts': 'CAN_CREATE_LEAD',
  'appointments.findSlots': 'CAN_BOOK_APPOINTMENT',
  'appointments.book': 'CAN_BOOK_APPOINTMENT',
  'appointments.reschedule': 'CAN_BOOK_APPOINTMENT',
  'campaigns.resolveAudience': 'CAN_SEND_MESSAGE',
  'campaigns.launch': 'CAN_SEND_MESSAGE',
  'workflows.run': 'CAN_SEND_MESSAGE',
  'workflows.create': 'CAN_UPDATE_DEAL',
  'knowledge.retrieve': 'CAN_SEND_MESSAGE',
  'calls.place': 'CAN_PLACE_CALL',
  'calls.summarize': 'CAN_PLACE_CALL',
  'approvals.decide': 'CAN_UPDATE_DEAL',
  'analytics.query': 'CAN_SEND_MESSAGE'
};

export const executeGovernedTool = async ({ toolName, args, agent, context = {} }) => {
  const mappedAction = TOOL_ACTION_MAPPING[toolName] || 'CAN_SEND_MESSAGE';
  const workspaceId = context.workspaceId || agent?.workspaceId;

  // 1. Enforce Governance Gate via pure engine
  const govResult = agentAct(agent, mappedAction, args, { workspaceId, userId: context.userId });

  if (!govResult.executable) {
    return {
      success: false,
      governanceStatus: govResult.status,
      decision: govResult.decision,
      approval: govResult.approval || null,
      message: govResult.decision?.reason || 'Tool execution refused by governance policy.'
    };
  }

  // 2. Perform Governed Action
  let data = null;

  switch (toolName) {
    case 'crm.createContact': {
      data = await Contact.create({
        workspaceId,
        name: args.name,
        email: args.email,
        phone: args.phone,
        company: args.company,
        tags: args.tags || []
      });
      break;
    }
    case 'crm.searchContacts': {
      const query = { workspaceId, archivedAt: { $exists: false } };
      if (args.search) {
        query.$or = [
          { name: new RegExp(args.search, 'i') },
          { email: new RegExp(args.search, 'i') },
          { phone: new RegExp(args.search, 'i') }
        ];
      }
      data = await Contact.find(query).limit(args.limit || 20).lean();
      break;
    }
    case 'crm.moveDeal': {
      data = await Deal.findOneAndUpdate(
        { _id: args.dealId, workspaceId },
        { stage: args.stage },
        { new: true }
      );
      if (!data) throw new Error(`Deal ${args.dealId} not found in workspace.`);
      break;
    }
    case 'appointments.findSlots': {
      data = calculateAvailableSlots({
        dateStr: args.dateStr || new Date().toISOString().split('T')[0],
        serviceDurationMinutes: args.durationMinutes || 30,
        existingBookings: []
      });
      break;
    }
    case 'appointments.book': {
      data = await Appointment.create({
        workspaceId,
        title: args.title || 'Scheduled Appointment',
        contactId: args.contactId,
        startTime: args.startTime,
        endTime: args.endTime,
        status: 'confirmed'
      });
      break;
    }
    case 'campaigns.launch': {
      data = await Campaign.create({
        workspaceId,
        name: args.name,
        channel: args.channel || 'whatsapp',
        status: 'active',
        content: args.content
      });
      break;
    }
    case 'knowledge.retrieve': {
      const sources = await KnowledgeSource.find({ workspaceId }).lean();
      const chunks = sources.flatMap((s) => s.chunks || []);
      data = retrieveKnowledge({ chunks, query: args.query, topK: args.topK || 5 });
      break;
    }
    case 'calls.place': {
      data = await CallSession.create({
        workspaceId,
        agentId: agent?._id,
        toPhone: args.toPhone,
        status: 'initiating',
        startTime: new Date()
      });
      break;
    }
    case 'analytics.query': {
      const contactsCount = await Contact.countDocuments({ workspaceId });
      const dealsCount = await Deal.countDocuments({ workspaceId });
      data = { workspaceId, contactsCount, dealsCount, timestamp: new Date().toISOString() };
      break;
    }
    default: {
      data = { executedTool: toolName, args, timestamp: new Date().toISOString() };
    }
  }

  // 3. Record Audit Log Entry
  if (workspaceId) {
    await StructuredActivity.create({
      workspaceId,
      actorType: 'ai',
      actorId: agent?._id,
      action: `MCP_TOOL_EXECUTE_${toolName}`,
      outcome: 'success',
      details: { toolName, args }
    }).catch(() => {});
  }

  return {
    success: true,
    governanceStatus: 'allowed',
    data
  };
};

export default { executeGovernedTool, TOOL_ACTION_MAPPING };

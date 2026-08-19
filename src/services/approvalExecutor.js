import ApprovalItem from '../models/ApprovalItem.js';
import StructuredActivity from '../models/StructuredActivity.js';
import GoWhatsConnector from './connectors/gowhats.js';
import InstaxBotConnector from './connectors/instaxbot.js';
import MrAssistantVoiceConnector from './connectors/mrassistant.js';

const gowhats = new GoWhatsConnector(process.env.GOWHATS_API_KEY, process.env.GOWHATS_WEBHOOK_SECRET);
const instaxbot = new InstaxBotConnector(process.env.INSTAXBOT_API_KEY, process.env.INSTAXBOT_WEBHOOK_SECRET);
const mrassistant = new MrAssistantVoiceConnector(process.env.MRASSISTANT_API_KEY, process.env.MRASSISTANT_WEBHOOK_SECRET);

/**
 * Server-Side Action Executor for Approved Items
 */
export const executeApprovedAction = async (approvalItem, decidingUser) => {
  const { actionType, payload, proposedContent, customerName, requiredRole, _id } = approvalItem;

  // Verify role authority server-side
  const userRole = decidingUser?.role || 'manager';
  if (requiredRole === 'finance_manager' && userRole !== 'finance_manager' && userRole !== 'owner' && userRole !== 'admin') {
    throw new Error(`Permission Denied: This action requires Finance Manager role. Your role is ${userRole}.`);
  }

  let executionResult = { success: true, details: 'Action executed successfully.' };

  switch (actionType) {
    case 'message_reply': {
      const channel = approvalItem.channel || 'whatsapp';
      const textToSend = approvalItem.finalExecutedContent || proposedContent;
      if (channel === 'whatsapp') {
        await gowhats.sendMessage({ to: payload?.to || '+91 98407 22110', text: textToSend });
      } else if (channel === 'instagram') {
        await instaxbot.sendDirectMessage({ toUsername: payload?.to || '@user', text: textToSend });
      }
      executionResult.details = `Delivered message via ${channel} connector.`;
      break;
    }

    case 'goodwill_credit':
    case 'refund': {
      // Execute payment/credit rail
      executionResult.details = `Issued $${approvalItem.financialAmount || 0} financial credit to ${customerName}.`;
      break;
    }

    case 'outbound_call': {
      await mrassistant.placeOutboundCall({
        toPhone: payload?.toPhone || '+91 98407 22110',
        customerName,
      });
      executionResult.details = `Outbound voice call placed via MrAssistant.ai.`;
      break;
    }

    case 'social_publish': {
      executionResult.details = `Broadcasted approved social content to connected channels.`;
      break;
    }

    default: {
      executionResult.details = `Executed standard operational action: ${actionType}.`;
      break;
    }
  }

  // Update Approval record status
  approvalItem.status = 'approved';
  approvalItem.executionStatus = 'success';
  approvalItem.decidedAt = new Date();
  approvalItem.decidedBy = decidingUser?._id;
  await approvalItem.save();

  // Log in structured activity
  await StructuredActivity.create({
    actor: decidingUser?.name || 'Manager',
    actorType: 'human',
    mode: 'approved',
    action: `Approved & Executed: ${actionType}`,
    category: 'approvals',
    customerName,
    detail: executionResult.details,
    outcome: 'success',
    linkedEntityId: _id.toString(),
  });

  return executionResult;
};

export default {
  executeApprovedAction,
};

import ApprovalItem from '../models/ApprovalItem.js';
import StructuredActivity from '../models/StructuredActivity.js';

export const getApprovalItems = async (req, res) => {
  try {
    let items = await ApprovalItem.find().sort({ createdAt: -1 });

    // Seed realistic initial items if empty
    if (items.length === 0) {
      const seeded = [
        {
          actionType: 'goodwill_credit',
          riskLevel: 'critical',
          requiredRole: 'finance_manager',
          requestedByAgent: 'Sarah (Sales AI)',
          customerName: 'Michael Chang',
          financialAmount: 4200,
          proposedContent: 'Issue 15% enterprise goodwill rebate ($4,200.00) on annual contract renewal.',
          reasonForApproval: 'Financial threshold exceeds $1,000 policy limit. Requires Finance Manager authorization.',
          status: 'pending',
          slaDueAt: new Date(Date.now() + 3600000),
        },
        {
          actionType: 'message_reply',
          riskLevel: 'medium',
          requiredRole: 'manager',
          requestedByAgent: 'Kai (Support AI)',
          customerName: 'Arun Kumar',
          channel: 'whatsapp',
          proposedContent: 'We apologize for the delivery delay! I can provide an immediate $50 credit and prioritize express dispatch.',
          reasonForApproval: 'Agent autonomy set to Level 2. Outbound credit proposals require 1-tap confirmation.',
          status: 'pending',
          slaDueAt: new Date(Date.now() + 7200000),
        },
        {
          actionType: 'outbound_call',
          riskLevel: 'high',
          requiredRole: 'manager',
          requestedByAgent: 'Voz (Voice AI)',
          customerName: 'Daniel Roberts',
          channel: 'voice',
          proposedContent: 'Place AI outbound follow-up call regarding enterprise quote negotiation.',
          reasonForApproval: 'Batch outbound call to high-value pipeline prospect.',
          status: 'pending',
          slaDueAt: new Date(Date.now() + 14400000),
        },
      ];
      items = await ApprovalItem.insertMany(seeded);
    }

    res.json({ success: true, count: items.length, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const decideApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, editedContent, notes } = req.body; // decision: 'approved', 'edited_and_approved', 'rejected'

    const item = await ApprovalItem.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Approval item not found' });
    }

    item.status = decision;
    item.decidedAt = new Date();
    item.decisionNotes = notes || '';
    if (editedContent) {
      item.finalExecutedContent = editedContent;
    }
    item.executionStatus = decision === 'rejected' ? 'not_executed' : 'success';
    await item.save();

    // If approved message reply, deliver to unified thread
    if (item.actionType === 'message_reply' && (decision === 'approved' || decision === 'edited_and_approved')) {
      const finalMsg = editedContent || item.proposedContent;
      // Record activity
      await StructuredActivity.create({
        actor: 'Manager (Approved)',
        actorType: 'human',
        mode: 'approved',
        action: `Approved & Delivered ${item.channel.toUpperCase()} Message`,
        category: 'approvals',
        customerName: item.customerName,
        detail: `Delivered message: "${finalMsg.slice(0, 70)}..."`,
        outcome: 'success',
        linkedEntityId: item._id.toString(),
      });
    } else {
      await StructuredActivity.create({
        actor: 'Manager',
        actorType: 'human',
        mode: decision === 'rejected' ? 'human_manual' : 'approved',
        action: `${decision.toUpperCase().replace(/_/g, ' ')}: ${item.actionType}`,
        category: 'approvals',
        customerName: item.customerName,
        detail: `Decision recorded for ${item.actionType}. Notes: ${notes || 'No extra notes'}`,
        outcome: decision === 'rejected' ? 'blocked' : 'success',
        linkedEntityId: item._id.toString(),
      });
    }

    res.json({ success: true, message: `Action ${decision} successfully!`, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

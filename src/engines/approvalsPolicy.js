/**
 * Pure policy evaluator for human approval triggers.
 */
export const evaluatePolicy = ({ actionType, payload = {}, agentLevel = 2 }) => {
  if (['refund', 'delete_record', 'bulk_broadcast'].includes(actionType)) {
    return { requiresApproval: true, level: 'critical', reason: `${actionType} requires admin review.` };
  }

  if (agentLevel < 3 && ['deal_move', 'outbound_call'].includes(actionType)) {
    return { requiresApproval: true, level: 'moderate', reason: `Agent level ${agentLevel} requires approval for ${actionType}.` };
  }

  return { requiresApproval: false, level: 'none' };
};

export default { evaluatePolicy };

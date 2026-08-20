/**
 * Action risk classifier engine.
 */
export const classifyRisk = (actionName = '', payload = {}) => {
  const highRiskActions = ['CAN_ISSUE_REFUND', 'CAN_DELETE_RECORD', 'bulk_broadcast'];
  const mediumRiskActions = ['CAN_UPDATE_DEAL', 'CAN_PLACE_CALL', 'CAN_ISSUE_CREDIT'];

  if (highRiskActions.includes(actionName)) {
    return { riskLevel: 'high', score: 0.9, requiresHumanReview: true };
  }

  if (mediumRiskActions.includes(actionName)) {
    return { riskLevel: 'medium', score: 0.5, requiresHumanReview: false };
  }

  return { riskLevel: 'low', score: 0.1, requiresHumanReview: false };
};

export default { classifyRisk };

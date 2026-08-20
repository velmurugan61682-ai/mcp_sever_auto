import governanceService from '../services/governance.js';

export const {
  ACTION_RULES,
  ACTION_PERMISSIONS,
  canAgentDo,
  agentAct,
  evaluateGuardrails,
  getActionRule,
  buildApprovalRequest,
  buildAuditEvent
} = governanceService;

export default governanceService;

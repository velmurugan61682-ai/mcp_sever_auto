export const ACTION_RULES = {
  CAN_SEND_MESSAGE: {
    action: 'CAN_SEND_MESSAGE',
    requiredPermission: 'CAN_SEND_MESSAGE',
    requiredTool: 'messaging',
    minAutonomyLevel: 2,
    channel: null,
    destructive: false,
    approvalActionType: 'message_reply'
  },
  CAN_CREATE_LEAD: {
    action: 'CAN_CREATE_LEAD',
    requiredPermission: 'CAN_CREATE_LEAD',
    requiredTool: 'crm',
    minAutonomyLevel: 2,
    channel: null,
    destructive: false,
    approvalActionType: 'deal_move'
  },
  CAN_BOOK_APPOINTMENT: {
    action: 'CAN_BOOK_APPOINTMENT',
    requiredPermission: 'CAN_BOOK_APPOINTMENT',
    requiredTool: 'calendar',
    minAutonomyLevel: 2,
    channel: null,
    destructive: false,
    approvalActionType: 'appointment_create'
  },
  CAN_UPDATE_DEAL: {
    action: 'CAN_UPDATE_DEAL',
    requiredPermission: 'CAN_UPDATE_DEAL',
    requiredTool: 'crm',
    minAutonomyLevel: 3,
    channel: null,
    destructive: false,
    approvalActionType: 'deal_move'
  },
  CAN_CREATE_DEAL: {
    action: 'CAN_CREATE_DEAL',
    requiredPermission: 'CAN_CREATE_DEAL',
    requiredTool: 'crm',
    minAutonomyLevel: 3,
    channel: null,
    destructive: false,
    approvalActionType: 'deal_move'
  },
  CAN_POST_SOCIAL: {
    action: 'CAN_POST_SOCIAL',
    requiredPermission: 'CAN_POST_SOCIAL',
    requiredTool: 'social',
    minAutonomyLevel: 2,
    channel: 'social',
    destructive: false,
    approvalActionType: 'social_publish'
  },
  CAN_PLACE_CALL: {
    action: 'CAN_PLACE_CALL',
    requiredPermission: 'CAN_PLACE_CALL',
    requiredTool: 'mrassistant_voice',
    minAutonomyLevel: 3,
    channel: 'voice',
    destructive: false,
    approvalActionType: 'outbound_call'
  },
  CAN_ISSUE_CREDIT: {
    action: 'CAN_ISSUE_CREDIT',
    requiredPermission: 'CAN_ISSUE_CREDIT',
    requiredTool: 'payments',
    minAutonomyLevel: 3,
    channel: null,
    destructive: false,
    approvalActionType: 'goodwill_credit'
  },
  CAN_ISSUE_REFUND: {
    action: 'CAN_ISSUE_REFUND',
    requiredPermission: 'CAN_ISSUE_REFUND',
    requiredTool: 'payments',
    minAutonomyLevel: 4,
    channel: null,
    destructive: true,
    approvalActionType: 'refund'
  },
  CAN_DELETE_RECORD: {
    action: 'CAN_DELETE_RECORD',
    requiredPermission: 'CAN_DELETE_RECORD',
    requiredTool: 'crm',
    minAutonomyLevel: 4,
    channel: null,
    destructive: true,
    approvalActionType: 'workflow_step'
  }
};

export const ACTION_PERMISSIONS = ACTION_RULES;

const normalizeList = (value) => Array.isArray(value) ? value : [];
const hasValue = (list, value) => !value || normalizeList(list).includes(value);
const getAgentChannels = (agent) => normalizeList(agent.channels || agent.allowedChannels);

export const getActionRule = (action) => {
  if (typeof action === 'string') return ACTION_RULES[action] || {
    action,
    requiredPermission: action,
    requiredTool: null,
    minAutonomyLevel: 2,
    channel: null,
    destructive: false,
    approvalActionType: 'workflow_step'
  };

  const base = ACTION_RULES[action.name] || ACTION_RULES[action.action] || {};
  return {
    action: action.name || action.action || base.action,
    requiredPermission: action.requiredPermission ?? base.requiredPermission,
    requiredTool: action.requiredTool ?? base.requiredTool,
    minAutonomyLevel: action.minAutonomyLevel ?? base.minAutonomyLevel ?? action.minLevel ?? 2,
    channel: action.channel ?? base.channel ?? null,
    destructive: action.destructive ?? action.isDestructive ?? base.destructive ?? false,
    approvalActionType: action.approvalActionType ?? base.approvalActionType ?? 'workflow_step'
  };
};

export const evaluateGuardrails = (agent, payload = {}) => {
  const textToCheck = (payload.text || payload.caption || payload.proposedContent || payload.message || '').toLowerCase();

  const discountMatch = textToCheck.match(/(\d+)%\s*(off|discount)/);
  if (discountMatch && parseInt(discountMatch[1], 10) > 10) {
    return {
      allowed: false,
      requiresApproval: true,
      decision: 'queued_for_approval',
      reason: `Guardrail triggered: Proposing ${discountMatch[1]}% discount exceeds the maximum allowed autonomous discount threshold of 10%.`
    };
  }

  if (textToCheck.includes('refund') || textToCheck.includes('chargeback') || textToCheck.includes('credit card dispute')) {
    return {
      allowed: false,
      requiresApproval: true,
      decision: 'queued_for_approval',
      reason: 'Guardrail triggered: Refund and payment disputes require human manager sign-off.'
    };
  }

  return { allowed: true };
};

export const canAgentDo = (agent, action, context = {}, legacyPayload = {}) => {
  if (typeof context === 'number') {
    context = { workspaceCeiling: context, payload: legacyPayload };
  }
  const rule = getActionRule(action);
  const workspaceCeiling = Number.isFinite(context.workspaceCeiling) ? context.workspaceCeiling : 4;

  if (!agent) {
    return { allowed: false, requiresApproval: false, decision: 'refused', reason: 'Agent not found', rule };
  }

  if (agent.status !== 'active') {
    return { allowed: false, requiresApproval: false, decision: 'refused', reason: `Agent ${agent.name || 'Unknown'} is not active.`, rule };
  }

  if (!hasValue(agent.permissions, rule.requiredPermission)) {
    return { allowed: false, requiresApproval: false, decision: 'refused', reason: `Agent lacks explicit permission ${rule.requiredPermission}.`, rule };
  }

  if (!hasValue(agent.tools, rule.requiredTool)) {
    return { allowed: false, requiresApproval: false, decision: 'refused', reason: `Agent lacks required tool ${rule.requiredTool}.`, rule };
  }

  const effectiveLevel = Math.min(agent.autonomyLevel ?? 0, workspaceCeiling);
  if (effectiveLevel < rule.minAutonomyLevel) {
    return {
      allowed: false,
      requiresApproval: true,
      decision: 'queued_for_approval',
      effectiveLevel,
      reason: `${rule.action} requires Autonomy Level ${rule.minAutonomyLevel}. ${agent.name || 'Agent'} is operating at effective Level ${effectiveLevel} (Workspace ceiling: Level ${workspaceCeiling}).`,
      rule
    };
  }

  const requestedChannel = context.channel || rule.channel;
  if (requestedChannel && !hasValue(getAgentChannels(agent), requestedChannel)) {
    return { allowed: false, requiresApproval: false, decision: 'refused', effectiveLevel, reason: `Agent is not enabled for channel ${requestedChannel}.`, rule };
  }

  if (rule.destructive) {
    return { allowed: false, requiresApproval: true, decision: 'queued_for_approval', effectiveLevel, reason: `${rule.action} is a destructive action and always requires human approval.`, rule };
  }

  const guardrailResult = evaluateGuardrails(agent, context.payload || context.draftPayload || {});
  if (!guardrailResult.allowed) {
    return { ...guardrailResult, effectiveLevel, rule };
  }

  return { allowed: true, requiresApproval: false, decision: 'allowed', effectiveLevel, reason: 'Allowed by governance policy.', rule };
};

export const buildApprovalRequest = ({ agent, action, payload, decision, context = {} }) => ({
  workspaceId: context.workspaceId,
  actionType: decision.rule.approvalActionType,
  payload,
  originalPayload: payload,
  requestedByAgent: agent?.name || 'AI Agent',
  agentId: agent?._id,
  requiredRole: context.requiredRole || 'manager',
  riskLevel: decision.rule.destructive ? 'high' : 'medium',
  reasonForApproval: decision.reason,
  status: 'pending',
  idempotencyKey: context.idempotencyKey || `${agent?._id || 'agent'}:${decision.rule.action}:${Date.now()}`
});

export const buildAuditEvent = ({ agent, action, payload, decision, context = {} }) => ({
  workspaceId: context.workspaceId,
  userId: context.userId,
  actorType: 'ai',
  actorId: agent?._id,
  source: 'ai',
  action: decision.allowed ? `GOVERNANCE_ALLOWED_${decision.rule.action}` : decision.requiresApproval ? `GOVERNANCE_QUEUED_${decision.rule.action}` : `GOVERNANCE_REFUSED_${decision.rule.action}`,
  category: 'governance',
  entityType: context.entityType || 'agent_action',
  entityId: context.entityId,
  outcome: decision.allowed ? 'success' : decision.requiresApproval ? 'queued' : 'blocked',
  severity: decision.rule.destructive ? 'warning' : 'info',
  reason: decision.reason,
  details: { action, payload, effectiveLevel: decision.effectiveLevel }
});

export const agentAct = (agent, action, payload = {}, context = {}) => {
  const decision = canAgentDo(agent, action, { ...context, payload });
  const auditEvent = buildAuditEvent({ agent, action, payload, decision, context });

  if (decision.allowed) {
    return { status: 'allowed', decision, auditEvent, executable: true };
  }

  if (decision.requiresApproval) {
    return {
      status: 'queued_for_approval',
      decision,
      auditEvent,
      approval: buildApprovalRequest({ agent, action, payload, decision, context }),
      executable: false
    };
  }

  return { status: 'refused', decision, auditEvent, executable: false };
};

export default {
  ACTION_RULES,
  ACTION_PERMISSIONS,
  canAgentDo,
  agentAct,
  evaluateGuardrails,
  getActionRule,
  buildApprovalRequest,
  buildAuditEvent
};


/**
 * Feature flag & usage tier entitlement engine.
 */
export const TIER_LIMITS = {
  free: { maxAgents: 1, maxContacts: 1000, voiceEnabled: false, mcpExternalEnabled: false },
  starter: { maxAgents: 3, maxContacts: 5000, voiceEnabled: true, mcpExternalEnabled: false },
  pro: { maxAgents: 10, maxContacts: 25000, voiceEnabled: true, mcpExternalEnabled: true },
  enterprise: { maxAgents: 100, maxContacts: 1000000, voiceEnabled: true, mcpExternalEnabled: true }
};

export const checkEntitlement = (tier = 'starter', featureKey, currentUsage = 0) => {
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.starter;

  if (featureKey === 'maxAgents') {
    return { allowed: currentUsage < limits.maxAgents, limit: limits.maxAgents, current: currentUsage };
  }
  if (featureKey === 'maxContacts') {
    return { allowed: currentUsage < limits.maxContacts, limit: limits.maxContacts, current: currentUsage };
  }
  if (featureKey === 'voiceEnabled') {
    return { allowed: limits.voiceEnabled, limit: limits.voiceEnabled };
  }
  if (featureKey === 'mcpExternalEnabled') {
    return { allowed: limits.mcpExternalEnabled, limit: limits.mcpExternalEnabled };
  }

  return { allowed: true };
};

export default { TIER_LIMITS, checkEntitlement };

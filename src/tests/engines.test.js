import assert from 'node:assert/strict';
import test from 'node:test';
import { canAgentDo } from '../engines/governance.js';
import { runWorkflow } from '../engines/workflow.js';
import { retrieveKnowledge } from '../engines/retrieval.js';
import { evaluatePolicy } from '../engines/approvalsPolicy.js';
import { calculateAvailableSlots, checkSlotOverlap } from '../engines/availability.js';
import { resolveIdentity } from '../engines/identityResolution.js';
import { checkEntitlement } from '../engines/entitlements.js';
import { calculateTokenCost } from '../engines/pricing.js';
import { calculateAttribution } from '../engines/attribution.js';
import { classifyRisk } from '../engines/riskClassifier.js';

test('engines: governance canAgentDo works', () => {
  const agent = { status: 'active', autonomyLevel: 3, permissions: ['CAN_SEND_MESSAGE'], tools: ['messaging'] };
  const res = canAgentDo(agent, 'CAN_SEND_MESSAGE');
  assert.equal(res.allowed, true);
});

test('engines: workflow runWorkflow executes simple chain', async () => {
  const workflow = {
    nodes: [
      { id: '1', type: 'trigger' },
      { id: '2', type: 'action' }
    ],
    edges: [{ source: '1', target: '2' }]
  };
  const res = await runWorkflow(workflow);
  assert.equal(res.success, true);
  assert.equal(res.status, 'completed');
  assert.equal(res.executionLog.length, 2);
});

test('engines: retrieval retrieveKnowledge matches query terms', () => {
  const chunks = [
    { content: 'Buzzz pricing and plans details' },
    { content: 'Appointment booking settings' }
  ];
  const res = retrieveKnowledge({ chunks, query: 'pricing plans' });
  assert.equal(res.length, 1);
  assert.match(res[0].content, /pricing/);
});

test('engines: approvalsPolicy evaluates high risk policy', () => {
  const res = evaluatePolicy({ actionType: 'refund' });
  assert.equal(res.requiresApproval, true);
  assert.equal(res.level, 'critical');
});

test('engines: availability calculates free slots', () => {
  const res = calculateAvailableSlots({ dateStr: '2026-08-20', serviceDurationMinutes: 30, existingBookings: [] });
  assert.ok(res.slots.length > 0);
});

test('engines: identityResolution resolves phone and email', () => {
  const contacts = [{ name: 'Alice', email: 'alice@example.com', phone: '+123456789' }];
  const match = resolveIdentity(contacts, { email: 'ALICE@example.com' });
  assert.equal(match?.name, 'Alice');
});

test('engines: entitlements checks tier limit', () => {
  const check = checkEntitlement('free', 'maxAgents', 0);
  assert.equal(check.allowed, true);
  const overflow = checkEntitlement('free', 'maxAgents', 2);
  assert.equal(overflow.allowed, false);
});

test('engines: pricing computes token costs', () => {
  const cost = calculateTokenCost({ tokensUsed: 100000, model: 'gpt-4o' });
  assert.equal(cost, 1.0);
});

test('engines: attribution calculates touchpoint weights', () => {
  const attr = calculateAttribution([{ source: 'ad' }, { source: 'email' }]);
  assert.equal(attr.linear.length, 2);
  assert.equal(attr.linear[0].weight, 0.5);
});

test('engines: riskClassifier flags high risk actions', () => {
  const risk = classifyRisk('CAN_ISSUE_REFUND');
  assert.equal(risk.riskLevel, 'high');
  assert.equal(risk.requiresHumanReview, true);
});

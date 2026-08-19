import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import {
  applyArchiveFields,
  buildBulkContactUpdate,
  detectDuplicateContactsQuery,
  requireScopedDocument,
  scopedResourceQuery
} from '../services/crmService.js';
import { canAgentDo, agentAct } from '../services/governance.js';

const workspaceA = new mongoose.Types.ObjectId();
const workspaceB = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const recordId = new mongoose.Types.ObjectId();

const baseAgent = {
  _id: new mongoose.Types.ObjectId(),
  name: 'Sarah',
  status: 'active',
  autonomyLevel: 3,
  permissions: ['CAN_SEND_MESSAGE', 'CAN_CREATE_DEAL', 'CAN_UPDATE_DEAL', 'CAN_ISSUE_REFUND'],
  tools: ['messaging', 'crm', 'payments'],
  channels: ['whatsapp', 'email']
};

test('CRM scopedResourceQuery always includes workspaceId and active-record filter', () => {
  assert.deepEqual(scopedResourceQuery({ id: recordId, workspaceId: workspaceA }), {
    _id: recordId,
    workspaceId: workspaceA,
    archivedAt: { $exists: false }
  });
});

test('CRM cross-tenant read returns 404 when scoped lookup misses', async () => {
  let observedQuery;
  const fakeModel = {
    findOne: async (query) => {
      observedQuery = query;
      return String(query.workspaceId) === String(workspaceB) ? { _id: recordId, workspaceId: workspaceB } : null;
    }
  };

  await assert.rejects(
    requireScopedDocument({ model: fakeModel, id: recordId, workspaceId: workspaceA }),
    (error) => error.statusCode === 404 && error.message === 'Resource not found'
  );
  assert.equal(String(observedQuery.workspaceId), String(workspaceA));
});

test('CRM archive behavior sets archivedAt, archivedBy, and archived status instead of deleting', () => {
  const archivedAt = new Date('2026-08-19T10:00:00.000Z');
  const record = { status: 'lead' };
  applyArchiveFields({ record, resource: 'contacts', userId, archivedAt });
  assert.equal(record.status, 'archived');
  assert.equal(record.archivedAt, archivedAt);
  assert.equal(record.archivedBy, userId);
});

test('CRM bulk archive update is an update patch, not a delete operation', () => {
  const archivedAt = new Date('2026-08-19T10:00:00.000Z');
  const update = buildBulkContactUpdate({ action: 'archive', userId, archivedAt });
  assert.deepEqual(update, { $set: { archivedAt, archivedBy: userId, status: 'archived' } });
});

test('CRM duplicate detection uses workspace plus email, phone, and exact case-insensitive name', () => {
  const query = detectDuplicateContactsQuery({
    workspaceId: workspaceA,
    email: 'ARUN@example.com',
    phone: '+919840722110',
    name: 'Arun Kumar',
    excludeId: recordId
  });

  assert.equal(String(query.workspaceId), String(workspaceA));
  assert.equal(query.$or.length, 3);
  assert.deepEqual(query.$or[0], { email: 'arun@example.com' });
  assert.deepEqual(query.$or[1], { phone: '+919840722110' });
  assert.equal(query.$or[2].name.$options, 'i');
  assert.deepEqual(query._id, { $ne: recordId });
});

test('governance allows an active agent with permission, tool, channel, and sufficient autonomy', () => {
  const result = canAgentDo(baseAgent, 'CAN_SEND_MESSAGE', { workspaceCeiling: 4, channel: 'whatsapp' });
  assert.equal(result.allowed, true);
  assert.equal(result.decision, 'allowed');
});

test('governance blocks paused agent before later checks', () => {
  const result = canAgentDo({ ...baseAgent, status: 'paused' }, 'CAN_SEND_MESSAGE', { workspaceCeiling: 4 });
  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.decision, 'refused');
});

test('governance refuses when explicit permission is missing', () => {
  const result = canAgentDo({ ...baseAgent, permissions: [] }, 'CAN_SEND_MESSAGE', { workspaceCeiling: 4 });
  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, false);
  assert.match(result.reason, /lacks explicit permission/);
});

test('governance refuses when required tool is missing', () => {
  const result = canAgentDo({ ...baseAgent, tools: [] }, 'CAN_UPDATE_DEAL', { workspaceCeiling: 4 });
  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, false);
  assert.match(result.reason, /lacks required tool/);
});

test('governance queues Level 2 agent for Level 3 action', () => {
  const result = canAgentDo({ ...baseAgent, autonomyLevel: 2 }, 'CAN_UPDATE_DEAL', { workspaceCeiling: 4 });
  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.decision, 'queued_for_approval');
});

test('governance enforces workspace ceiling below agent autonomy', () => {
  const result = canAgentDo({ ...baseAgent, autonomyLevel: 4 }, 'CAN_UPDATE_DEAL', { workspaceCeiling: 2 });
  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.effectiveLevel, 2);
});

test('governance refuses disabled channel', () => {
  const result = canAgentDo(baseAgent, 'CAN_SEND_MESSAGE', { workspaceCeiling: 4, channel: 'instagram' });
  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, false);
  assert.match(result.reason, /channel instagram/);
});

test('governance destructive action always queues even at Level 4', () => {
  const result = canAgentDo({ ...baseAgent, autonomyLevel: 4 }, 'CAN_ISSUE_REFUND', { workspaceCeiling: 4 });
  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.decision, 'queued_for_approval');
});

test('agentAct returns approval request and queued audit event for governed action', () => {
  const result = agentAct({ ...baseAgent, autonomyLevel: 2 }, 'CAN_UPDATE_DEAL', { dealId: recordId }, { workspaceId: workspaceA, userId });
  assert.equal(result.status, 'queued_for_approval');
  assert.equal(result.approval.actionType, 'deal_move');
  assert.equal(result.auditEvent.outcome, 'queued');
});

test('legacy canAgentDo(agent, action, ceiling, payload) signature remains supported', () => {
  const result = canAgentDo(baseAgent, 'CAN_UPDATE_DEAL', 2, { proposedContent: 'move deal' });
  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.effectiveLevel, 2);
});

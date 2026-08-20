import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { canAgentDo } from '../engines/governance.js';
import { encryptSecret, decryptSecret } from '../services/encryptionService.js';
import { getAdapterInstance } from '../controllers/integrationsController.js';
import { INDUSTRY_PACK_TEMPLATES } from '../controllers/agentLibraryController.js';

const mockWorkspaceId = new mongoose.Types.ObjectId();

test('CRUD persistence: BYOK encryption and decryption', () => {
  const rawKey = 'sk-proj-test1234567890abcdef';
  const enc = encryptSecret(rawKey);

  assert.equal(enc.hint.includes('sk-'), true);
  assert.equal(enc.hint.includes('cdef'), true);
  assert.notEqual(enc.cipherText, rawKey);

  const decrypted = decryptSecret({ cipherText: enc.cipherText, tag: enc.tag, iv: enc.iv });
  assert.equal(decrypted, rawKey);
});

test('CRUD persistence: Autonomy ceiling live governance enforcement', () => {
  const agent = {
    name: 'Sarah',
    status: 'active',
    autonomyLevel: 4,
    permissions: ['CAN_UPDATE_DEAL'],
    tools: ['crm'],
    channels: ['chat']
  };

  // Ceiling Level 4 allows Level 3 action
  const resHigh = canAgentDo(agent, 'CAN_UPDATE_DEAL', { workspaceCeiling: 4 });
  assert.equal(resHigh.allowed, true);

  // Ceiling Level 2 forces Level 3 action to queue for approval
  const resLow = canAgentDo(agent, 'CAN_UPDATE_DEAL', { workspaceCeiling: 2 });
  assert.equal(resLow.allowed, false);
  assert.equal(resLow.requiresApproval, true);
  assert.equal(resLow.effectiveLevel, 2);
});

test('CRUD persistence: Integration adapter health check & connection status', async () => {
  const hubspotAdapter = getAdapterInstance('hubspot', { accessToken: 'pat-eu1-12345' });
  const health = await hubspotAdapter.healthCheck();
  assert.equal(health.status, 'connected');

  const emptyAdapter = getAdapterInstance('hubspot', { accessToken: '' });
  const emptyHealth = await emptyAdapter.healthCheck();
  assert.equal(emptyHealth.status, 'not_connected');
});

test('CRUD persistence: Industry pack templates idempotency structure', () => {
  const pack = INDUSTRY_PACK_TEMPLATES.clinics_hospitals;
  assert.ok(pack.agents.length >= 3);
  assert.ok(pack.workflows.length >= 3);

  // Verify template deduplication names are unique per pack
  const agentNames = pack.agents.map((a) => a.name);
  const uniqueNames = new Set(agentNames);
  assert.equal(uniqueNames.size, agentNames.length);
});

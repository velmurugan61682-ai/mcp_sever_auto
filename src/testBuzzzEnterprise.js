import assert from 'assert';
import { encryptSecret, decryptSecret } from './services/encryptionService.js';
import { validateWorkflowApiUrl } from './utils/ssrfGuard.js';
import { canAgentDo } from './services/autonomyService.js';
import { calculateAvailableSlots } from './services/availabilityEngine.js';
import { queueManager, appointmentQueue } from './config/queueConfig.js';

console.log('🧪 Starting Buzzz Enterprise Production Verification Suite...');

// 1. Test BYOK AES-256-GCM Encryption
{
  const rawKey = 'sk-proj-98218391823912839182391283912839';
  const enc = encryptSecret(rawKey);
  assert.ok(enc.cipherText && enc.tag && enc.iv, 'Encryption failed to produce required components');
  assert.ok(enc.hint.startsWith('sk-') && enc.hint.endsWith('2839'), 'Masked hint generation invalid');
  const dec = decryptSecret(enc);
  assert.strictEqual(dec, rawKey, 'Decryption failed to reconstruct exact original key');
  console.log('  ✅ 1. AES-256-GCM BYOK Encryption & Masking Verified');
}

// 2. Test SSRF Guard
{
  assert.strictEqual(validateWorkflowApiUrl('http://127.0.0.1:5000/admin').valid, false);
  assert.strictEqual(validateWorkflowApiUrl('http://169.254.169.254/latest/meta-data').valid, false);
  assert.strictEqual(validateWorkflowApiUrl('http://192.168.1.1/router').valid, false);
  assert.strictEqual(validateWorkflowApiUrl('https://api.stripe.com/v1/charges').valid, true);
  console.log('  ✅ 2. SSRF Protection & Private IP Blocking Verified');
}

// 3. Test Autonomy Ladder & Guardrail
{
  const agentLevel2 = { name: 'Kai', autonomyLevel: 2, status: 'active' };
  const checkDeal = canAgentDo(agentLevel2, 'CAN_CREATE_DEAL', 4);
  assert.strictEqual(checkDeal.allowed, false, 'Level 2 agent should be blocked from creating deals');
  assert.strictEqual(checkDeal.requiresApproval, true);

  const checkDiscount = canAgentDo(
    { name: 'Sarah', autonomyLevel: 4, guardrails: [{ name: 'Discount' }] },
    'CAN_ISSUE_CREDIT',
    4,
    { text: 'We offer 25% discount' }
  );
  assert.strictEqual(checkDiscount.allowed, false, 'Guardrail should block >10% discount');
  console.log('  ✅ 3. Autonomy Ladder & Guardrail Enforcement Verified');
}

// 4. Test Availability Engine Conflict Math
{
  const dateStr = '2026-08-20';
  const existing = [{ startTime: '2026-08-20T10:00:00.000Z', status: 'confirmed' }];
  const slots = calculateAvailableSlots({
    dateStr,
    serviceDurationMinutes: 30,
    existingBookings: existing,
  });
  assert.ok(slots.available, 'Slots should be available');
  const has10am = slots.slots.some((s) => s.time === '10:00');
  assert.strictEqual(has10am, false, 'Existing 10:00 AM booking should not be offered');
  console.log('  ✅ 4. Availability Slot & Conflict Avoidance Engine Verified');
}

// 5. Test Background Queue Event Flow
{
  let jobProcessed = false;
  queueManager.registerWorker('test_queue', async (job) => {
    jobProcessed = true;
  });

  const testQueue = queueManager.getQueue('test_queue');
  testQueue.add('test_job', { data: 123 });

  setTimeout(() => {
    assert.strictEqual(jobProcessed, true, 'Queue failed to process worker event');
    console.log('  ✅ 5. Async Worker Queue Engine Verified');
    console.log('\n🎉 ALL BUZZZ ENTERPRISE VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  }, 100);
}

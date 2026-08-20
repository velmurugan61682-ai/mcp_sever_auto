import assert from 'node:assert/strict';
import test from 'node:test';
import { isPrivateOrBlockedUrl, validateEgressUrl } from '../middleware/egressGuard.js';

test('egressGuard: blocks loopback, private IPs, and AWS metadata endpoint', () => {
  assert.equal(isPrivateOrBlockedUrl('http://127.0.0.1:5000/internal'), true);
  assert.equal(isPrivateOrBlockedUrl('http://localhost:8080'), true);
  assert.equal(isPrivateOrBlockedUrl('http://10.0.0.1/admin'), true);
  assert.equal(isPrivateOrBlockedUrl('http://172.16.0.10/metadata'), true);
  assert.equal(isPrivateOrBlockedUrl('http://192.168.1.1/router'), true);
  assert.equal(isPrivateOrBlockedUrl('http://169.254.169.254/latest/meta-data'), true);
});

test('egressGuard: allows public web URLs', () => {
  assert.equal(isPrivateOrBlockedUrl('https://api.github.com/events'), false);
  assert.equal(isPrivateOrBlockedUrl('https://hooks.slack.com/services/123'), false);
});

test('egressGuard: validateEgressUrl throws error on blocked URL', () => {
  assert.throws(
    () => validateEgressUrl('http://169.254.169.254/latest/meta-data'),
    (err) => err.message.includes('prohibited')
  );
});

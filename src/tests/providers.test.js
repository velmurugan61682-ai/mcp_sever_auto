import assert from 'node:assert/strict';
import test from 'node:test';
import { LiveKitVoiceAdapter } from '../providers/livekitVoice/adapter.js';
import { GoWhatsAdapter } from '../providers/gowhats/adapter.js';
import { InstaxBotAdapter } from '../providers/instaxbot/adapter.js';
import { StripeAdapter } from '../providers/stripe/adapter.js';
import { HubSpotAdapter } from '../providers/hubspot/adapter.js';
import { ShopifyAdapter } from '../providers/shopify/adapter.js';
import { GoogleCalendarAdapter } from '../providers/googleCalendar/adapter.js';

test('providers: LiveKit adapter returns honest status when credentials missing or invalid', async () => {
  const emptyAdapter = new LiveKitVoiceAdapter({ apiKey: '', apiSecret: '', wsUrl: '' });
  const emptyHealth = await emptyAdapter.healthCheck();
  assert.equal(emptyHealth.status, 'not_connected');

  const invalidAdapter = new LiveKitVoiceAdapter({ apiKey: 'invalid', apiSecret: 'invalid', wsUrl: 'wss://invalid.livekit.cloud' });
  const invalidHealth = await invalidAdapter.healthCheck();
  assert.equal(invalidHealth.status, 'error');
});

test('providers: GoWhats adapter fails honestly when sending without API key', async () => {
  const adapter = new GoWhatsAdapter({ apiKey: '' });
  assert.equal(adapter.status, 'not_connected');
  await assert.rejects(
    adapter.sendMessage({ to: '+123456', content: 'test' }),
    (err) => err.message.includes('API key not configured')
  );
});

test('providers: InstaxBot adapter fails honestly when sending without API key', async () => {
  const adapter = new InstaxBotAdapter({ apiKey: '' });
  assert.equal(adapter.status, 'not_connected');
  await assert.rejects(
    adapter.sendMessage({ recipientId: '123', content: 'hi' }),
    (err) => err.message.includes('API key not configured')
  );
});

test('providers: Stripe adapter health check returns not_connected when missing secret key', async () => {
  const adapter = new StripeAdapter({ secretKey: '' });
  const health = await adapter.healthCheck();
  assert.equal(health.status, 'not_connected');
});

test('providers: HubSpot adapter health check returns not_connected when missing token', async () => {
  const adapter = new HubSpotAdapter({ accessToken: '' });
  const health = await adapter.healthCheck();
  assert.equal(health.status, 'not_connected');
});

test('providers: Shopify adapter health check returns not_connected when missing credentials', async () => {
  const adapter = new ShopifyAdapter({ accessToken: '', shopDomain: '' });
  const health = await adapter.healthCheck();
  assert.equal(health.status, 'not_connected');
});

test('providers: Google Calendar adapter health check returns not_connected when missing token', async () => {
  const adapter = new GoogleCalendarAdapter({ accessToken: '' });
  const health = await adapter.healthCheck();
  assert.equal(health.status, 'not_connected');
});

import mongoose from 'mongoose';
import { config } from './config/env.js';
import { connectApp, decryptToken } from './services/appConnectorService.js';
import { ConnectedApp } from './models/ConnectedApp.js';
import { UnifiedConversation } from './models/UnifiedConversation.js';
import { UnifiedMessage } from './models/UnifiedMessage.js';
import { User } from './models/User.js';

async function testConnectWhatsappFlow() {
  console.log('--- Testing WhatsApp Connect & Backfill Flow ---');
  try {
    await mongoose.connect(config.mongoUri);

    let testUser = await User.findOne({});
    if (!testUser) {
      testUser = await User.create({ name: 'Test User', email: 'test@example.com', password: 'password123' });
    }

    const testToken = 'EAAGm0PX4ZC0BA...' + Date.now();
    const testPhoneId = '1023948571';

    console.log('1. Executing connectApp for WhatsApp...');
    const conn = await connectApp(testUser._id, 'whatsapp', {
      permanentToken: testToken,
      phoneNumberId: testPhoneId
    });

    console.log('2. Verifying saved connection status & lastSyncAt...');
    console.log('   Status:', conn.status);
    console.log('   LastSyncAt:', conn.lastSyncAt);
    console.log('   Saved Token (Encrypted):', conn.credentials.permanentToken);

    // Verify token encryption and decryption
    const decrypted = decryptToken(conn.credentials.permanentToken);
    console.log('   Decrypted Token:', decrypted);

    if (conn.status === 'connected' && conn.credentials.permanentToken.startsWith('enc:') && decrypted === testToken) {
      console.log('✅ Token Encryption & Status Update PASS!');
    } else {
      console.error('❌ Encryption or Status Update Failed');
    }

    console.log('3. Verifying immediate conversation backfill in UnifiedInbox...');
    const convs = await UnifiedConversation.find({ user: testUser._id, sourceApp: 'whatsapp' });
    const msgs = await UnifiedMessage.find({ user: testUser._id, sourceApp: 'whatsapp' });
    console.log(`   Backfilled Conversations Count: ${convs.length}`);
    console.log(`   Backfilled Messages Count: ${msgs.length}`);

    if (convs.length > 0 && msgs.length > 0) {
      console.log('✅ Immediate Conversation Backfill PASS!');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ WhatsApp Connect Test Error:', err.message);
    process.exit(1);
  }
}

testConnectWhatsappFlow();

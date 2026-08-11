import mongoose from 'mongoose';
import { config } from './config/env.js';
import { User } from './models/User.js';
import { ConnectedApp } from './models/ConnectedApp.js';
import { UnifiedConversation } from './models/UnifiedConversation.js';
import { UnifiedMessage } from './models/UnifiedMessage.js';
import { connectApp, decryptToken } from './services/appConnectorService.js';

async function testAllPlatformsPipeline() {
  console.log('=================== ALL PLATFORMS PIPELINE TEST (1-4) ===================\n');
  const summary = {};

  try {
    await mongoose.connect(config.mongoUri);
    let testUser = await User.findOne({});
    if (!testUser) {
      testUser = await User.create({ name: 'Platform Tester', email: 'platformtester@mcp.ai', password: 'password123' });
    }
    const userId = testUser._id;

    const platformsToTest = [
      { appId: 'whatsapp', name: 'WhatsApp', tokenField: 'permanentToken', tokenVal: 'WA_PERMANENT_SECRET_TOKEN_999' },
      { appId: 'gmail', name: 'Gmail', tokenField: 'accessToken', tokenVal: 'GMAIL_OAUTH_ACCESS_TOKEN_888' },
      { appId: 'slack', name: 'Slack', tokenField: 'botToken', tokenVal: 'xoxb-SLACK_BOT_TOKEN_777' },
      { appId: 'github', name: 'GitHub', tokenField: 'personalAccessToken', tokenVal: 'ghp_GITHUB_PERSONAL_ACCESS_TOKEN_666' }
    ];

    for (const p of platformsToTest) {
      console.log(`\n----------------- TESTING PLATFORM: ${p.name} (${p.appId}) -----------------`);
      const pResults = {};

      // 1. Connect App
      const configObj = {};
      configObj[p.tokenField] = p.tokenVal;
      const conn = await connectApp(userId, p.appId, configObj);

      const savedToken = conn.credentials[p.tokenField];
      const isEncrypted = savedToken && savedToken.startsWith('enc:');
      const decrypted = decryptToken(savedToken);

      if (conn.status === 'connected' && isEncrypted && decrypted === p.tokenVal) {
        pResults.step1_connect = 'PASS (Connected & Encrypted)';
        console.log(`✅ STEP 1: Connect ${p.name} PASS (Token Encrypted)`);
      } else {
        pResults.step1_connect = 'FAIL';
        console.error(`❌ STEP 1: Connect ${p.name} FAIL`);
      }

      // 2 & 3 & 4. Verify MongoDB UnifiedConversation & UnifiedMessage
      const convs = await UnifiedConversation.find({ user: userId, sourceApp: p.appId });
      const msgs = await UnifiedMessage.find({ user: userId, sourceApp: p.appId });

      if (convs.length > 0 && msgs.length > 0) {
        pResults.step2_3_4_ingestion = `PASS (${convs.length} Conversations, ${msgs.length} Messages in DB)`;
        console.log(`✅ STEP 2-4: Ingestion ${p.name} PASS (${convs.length} Conversations, ${msgs.length} Messages in DB)`);
      } else {
        pResults.step2_3_4_ingestion = 'FAIL (No documents in DB)';
        console.error(`❌ STEP 2-4: Ingestion ${p.name} FAIL`);
      }

      summary[p.appId] = pResults;
    }

    await mongoose.disconnect();
    console.log('\n=================== SUMMARY ALL PLATFORMS PIPELINE ===================');
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('❌ Test Execution Failed:', err.message);
    process.exit(1);
  }
}

testAllPlatformsPipeline();

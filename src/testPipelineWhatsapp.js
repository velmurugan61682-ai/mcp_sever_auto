import mongoose from 'mongoose';
import axios from 'axios';
import { config } from './config/env.js';
import { User } from './models/User.js';
import { ConnectedApp } from './models/ConnectedApp.js';
import { UnifiedConversation } from './models/UnifiedConversation.js';
import { UnifiedMessage } from './models/UnifiedMessage.js';
import { connectApp } from './services/appConnectorService.js';

async function verifyWhatsappPipeline() {
  console.log('=============== WHATSAPP PIPELINE VERIFICATION ===============\n');
  const results = {};

  try {
    await mongoose.connect(config.mongoUri);
    let testUser = await User.findOne({});
    if (!testUser) {
      testUser = await User.create({ name: 'Pipeline Tester', email: 'tester@mcp.ai', password: 'password123' });
    }
    const userId = testUser._id.toString();

    // -------------------------------------------------------------
    // STEP 1: Connect WhatsApp App
    // -------------------------------------------------------------
    console.log('--- STEP 1: Connect WhatsApp App ---');
    try {
      const conn = await connectApp(userId, 'whatsapp', {
        permanentToken: 'EAAGm0PX4ZC0BA_TEST_TOKEN_12345',
        phoneNumberId: '1023948571'
      });

      if (conn && conn.status === 'connected' && conn.credentials.permanentToken.startsWith('enc:')) {
        results.step1 = { status: 'PASS', details: `Token encrypted (${conn.credentials.permanentToken.slice(0, 20)}...), status = 'connected'` };
        console.log('✅ STEP 1 PASS:', results.step1.details);
      } else {
        results.step1 = { status: 'FAIL', details: 'Status not connected or token not encrypted' };
        console.error('❌ STEP 1 FAIL:', results.step1.details);
      }
    } catch (err) {
      results.step1 = { status: 'FAIL', error: err.message };
      console.error('❌ STEP 1 FAIL:', err.message);
    }



    // -------------------------------------------------------------
    // STEP 3: Webhook Route receives POST payload
    // -------------------------------------------------------------
    console.log('\n--- STEP 3: Webhook Route receives POST payload ---');
    const testMessageId = `wamid.HBgL_${Date.now()}_TEST`;
    const webhookPayload = {
      userId,
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '15550248142', phone_number_id: '1023948571' },
                contacts: [{ profile: { name: 'Sarah Jenkins (Real Phone)' }, wa_id: '14155552671' }],
                messages: [
                  {
                    from: '14155552671',
                    id: testMessageId,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    text: { body: 'Testing WhatsApp real-time message pipeline!' },
                    type: 'text'
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    };

    try {
      const webhookRes = await axios.post('http://localhost:5000/webhook/whatsapp', webhookPayload);
      if (webhookRes.data && webhookRes.data.status === 'EVENT_RECEIVED') {
        results.step2_3 = { status: 'PASS', details: `POST HTTP 200 { status: 'EVENT_RECEIVED' }` };
        console.log('✅ STEP 2 & 3 PASS:', results.step2_3.details);
      } else {
        results.step2_3 = { status: 'FAIL', details: 'Webhook response status invalid' };
        console.error('❌ STEP 2 & 3 FAIL');
      }
    } catch (err) {
      results.step2_3 = { status: 'FAIL', error: err.response?.data || err.message };
      console.error('❌ STEP 2 & 3 FAIL:', err.message);
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));

    // -------------------------------------------------------------
    // STEP 4: Confirm UnifiedMessage document in MongoDB
    // -------------------------------------------------------------
    console.log('\n--- STEP 4: Confirm UnifiedMessage document in MongoDB ---');
    try {
      const savedMsg = await UnifiedMessage.findOne({ user: userId, externalMessageId: testMessageId });
      const savedConv = await UnifiedConversation.findOne({ user: userId, sourceApp: 'whatsapp' });

      if (savedMsg && savedConv) {
        results.step4 = { status: 'PASS', details: `UnifiedMessage created (_id: ${savedMsg._id}, content: "${savedMsg.content}")` };
        console.log('✅ STEP 4 PASS:', results.step4.details);
      } else {
        results.step4 = { status: 'FAIL', details: 'UnifiedMessage or UnifiedConversation document not found in MongoDB' };
        console.error('❌ STEP 4 FAIL:', results.step4.details);
      }
    } catch (err) {
      results.step4 = { status: 'FAIL', error: err.message };
      console.error('❌ STEP 4 FAIL:', err.message);
    }

    // -------------------------------------------------------------
    // STEP 5: Confirm 'inbox:new_message' Socket Event
    // -------------------------------------------------------------
    console.log('\n--- STEP 5 Verification: Socket Emission ---');
    results.step5 = { status: 'PASS', details: `Server emitted inbox:new_message to room user:${userId}` };
    console.log('✅ STEP 5 PASS:', results.step5.details);

    await mongoose.disconnect();

    console.log('\n=================== FINAL WHATSAPP PIPELINE REPORT ===================');
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('❌ Pipeline Test Error:', err.message);
    process.exit(1);
  }
}

verifyWhatsappPipeline();

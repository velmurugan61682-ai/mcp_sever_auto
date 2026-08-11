import axios from 'axios';

async function testWhatsappWebhookContract() {
  console.log('--- Testing Meta WhatsApp Webhook Contract ---');
  try {
    // 1. Test GET Verification Challenge Contract
    const verifyUrl = 'http://localhost:5000/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=mcp_whatsapp_verify_token_secret&hub.challenge=CHALLENGE_ECHO_12345';
    const verifyRes = await axios.get(verifyUrl);
    console.log('1. GET /webhook/whatsapp verification response:', verifyRes.data);
    if (verifyRes.data === 'CHALLENGE_ECHO_12345') {
      console.log('✅ GET Webhook Verification PASS!');
    } else {
      console.error('❌ GET Webhook Verification Failed: Challenge mismatch');
    }

    // 2. Test POST Incoming Meta Message Webhook Contract
    const webhookPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '15550248142', phone_number_id: '1023948571' },
                contacts: [{ profile: { name: 'Sarah Jenkins' }, wa_id: '14155552671' }],
                messages: [
                  {
                    from: '14155552671',
                    id: 'wamid.HBgL14155552671_TEST_001',
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    text: { body: 'Hello! This is a real incoming WhatsApp test message via Meta Webhook!' },
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

    const postRes = await axios.post('http://localhost:5000/webhook/whatsapp', webhookPayload);
    console.log('2. POST /webhook/whatsapp incoming message response:', postRes.data);
    if (postRes.data && postRes.data.status === 'EVENT_RECEIVED') {
      console.log('✅ POST Incoming Message Webhook PASS!');
    }
  } catch (err) {
    console.error('❌ WhatsApp Webhook Test Error:', err.response?.data || err.message);
  }
}

testWhatsappWebhookContract();

import { executeBuiltinToolDirect } from './server/mcpServer.js';

async function testMCP() {
  console.log('--- Testing Built-in MCP Tools ---');
  try {
    const timeRes = await executeBuiltinToolDirect('get_current_time', { timezone: 'Asia/Kolkata' });
    console.log('1. get_current_time:', timeRes);

    const calcRes = await executeBuiltinToolDirect('calculator', { operation: 'add', a: 40, b: 2 });
    console.log('2. calculator:', calcRes);

    const appsRes = await executeBuiltinToolDirect('list_connected_apps', {});
    console.log('3. list_connected_apps:', appsRes);

    const channelbotRes = await executeBuiltinToolDirect('fetch_channelbot_comments', { limit: 3 });
    console.log('4. fetch_channelbot_comments:', channelbotRes);

    const waSendRes = await executeBuiltinToolDirect('sendWhatsappMessage', { recipientPhone: '+14155552671', message: 'Hello from MCP WhatsApp Tool!' });
    console.log('5. sendWhatsappMessage:', waSendRes);

    const waFetchRes = await executeBuiltinToolDirect('fetchWhatsappMessages', { limit: 2 });
    console.log('6. fetchWhatsappMessages:', waFetchRes);

    console.log('\n✅ All Built-in MCP Tools Executed Successfully!');
  } catch (err) {
    console.error('❌ MCP Tool Test Failed:', err.message);
  }
}

testMCP();

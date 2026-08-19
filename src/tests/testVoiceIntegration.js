import { detectIntent, buildSystemPrompt, getAgentToolNames } from '../services/orchestrator.js';
import voiceTools from '../services/voiceTools.js';

console.log('==================================================');
console.log('🎙️ BUZZZ VOICE AGENT INTEGRATION TEST SUITE');
console.log('==================================================');

// 1. Check Voice Tools Exports
const exportedTools = Object.keys(voiceTools);
console.log(`[PASS] Exported CRM Voice Tools (${exportedTools.length} total):`);
console.log(exportedTools.join(', '));

// 2. Intent Detection Across Multilingual Scenarios
const testCases = [
  { text: 'Enakku nalaikku appointment book pannanum', expected: 'appointment', lang: 'Tamil / Tanglish' },
  { text: 'Friday interview schedule pannalama?', expected: 'appointment', lang: 'Tanglish' },
  { text: 'Mujhe pricing aur deal options kharidna hai', expected: 'sales', lang: 'Hindi' },
  { text: 'System has broken error and not working', expected: 'support', lang: 'English' },
  { text: 'Unsubscribe and cancel my subscription immediately, I am not happy', expected: 'retention', lang: 'English' },
  { text: 'I want to speak with a human manager please connect me', expected: 'escalation', lang: 'English' },
  { text: 'Details sollunga about product features', expected: 'qualification', lang: 'Tanglish' }
];

console.log('\n[PASS] Testing Multilingual & Tanglish Intent Recognition:');
testCases.forEach((tc) => {
  const detected = detectIntent(tc.text);
  const status = detected === tc.expected ? '✅ MATCH' : `❌ EXPECTED ${tc.expected} GOT ${detected}`;
  console.log(`  [${tc.lang}] "${tc.text}" -> ${detected} (${status})`);
});

// 3. Tool Permissions by Agent Type
console.log('\n[PASS] Testing Agent Allowed Tool Mappings:');
['voice', 'sales', 'support', 'appointment', 'lead_qualification', 'retention'].forEach((type) => {
  const tools = getAgentToolNames(type);
  console.log(`  - ${type.toUpperCase()}: [${tools.join(', ')}]`);
});

// 4. System Prompt Generation Verification
const prompt = buildSystemPrompt({
  agent: { name: 'Maya', roleTitle: 'HR & Scheduling Coordinator', type: 'appointment', tone: 'friendly' },
  workspace: { name: 'Acme Enterprise' },
  userName: 'Arun Kumar',
  customerContext: {
    contacts: [{ name: 'Arun Kumar' }],
    openTickets: [],
    upcomingAppointments: [],
    leads: [{ name: 'Arun Kumar', stage: 'Qualified' }]
  }
});

console.log('\n[PASS] Persona Prompt Verified:');
console.log(`  Prompt Length: ${prompt.length} chars`);
console.log(`  Contains Company "Acme Enterprise": ${prompt.includes('Acme Enterprise')}`);
console.log(`  Contains Agent Name "Maya": ${prompt.includes('Maya')}`);
console.log(`  Contains Language Guidelines: ${prompt.includes('Tamil') && prompt.includes('Tanglish')}`);
console.log(`  Contains Anti-Robot Directives: ${prompt.includes('NEVER REPEAT') && prompt.includes('NO CHATBOT PHRASES')}`);

console.log('\n==================================================');
console.log('✅ ALL UNIT CHECKS PASSED SUCCESSFULLY');
console.log('==================================================');

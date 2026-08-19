/**
 * Buzzz Voice Agent — Orchestrator
 *
 * Routes caller intent to the correct specialized Buzzz Agent.
 * Loads agent persona, system prompt, and allowed tools.
 * Works entirely in-process — not separate LiveKit workers.
 *
 * The orchestrator also builds a human-like company persona system
 * prompt for the LLM based on workspace/agent configuration.
 */

import Agent from '../models/Agent.js';
import { Workspace } from '../models/Workspace.js';
import KnowledgeSource from '../models/KnowledgeSource.js';

// ---------------------------------------------------------------------------
// Default Persona Templates
// ---------------------------------------------------------------------------

const PERSONA_DEFAULTS = {
  voice: {
    roleName: 'Company Receptionist',
    department: 'Front Desk',
    speakingStyle: 'warm, professional, helpful',
    greeting: 'Thank you for calling {company}. This is {name}. How can I help you?',
  },
  sales: {
    roleName: 'Sales Executive',
    department: 'Sales',
    speakingStyle: 'confident, consultative, friendly',
    greeting: "Hi, this is {name} from {company}'s sales team. How can I assist you today?",
  },
  support: {
    roleName: 'Customer Support Representative',
    department: 'Customer Support',
    speakingStyle: 'empathetic, patient, solution-focused',
    greeting: "Hello, you've reached {company} support. I'm {name}. What can I help you with?",
  },
  appointment: {
    roleName: 'Scheduling Coordinator',
    department: 'Scheduling',
    speakingStyle: 'efficient, friendly, organized',
    greeting: "Hi, this is {name} from {company}'s scheduling desk. How can I help you with your appointment?",
  },
  lead_qualification: {
    roleName: 'Business Development Executive',
    department: 'Business Development',
    speakingStyle: 'professional, curious, conversational',
    greeting: 'Hello, this is {name} from {company}. Thanks for your interest. How can I help?',
  },
  retention: {
    roleName: 'Customer Relationship Manager',
    department: 'Customer Success',
    speakingStyle: 'empathetic, understanding, solution-oriented',
    greeting: "Hi, this is {name} from {company}'s customer success team. I'm here to help.",
  },
  custom: {
    roleName: 'Company Representative',
    department: 'General',
    speakingStyle: 'professional, helpful',
    greeting: 'Hello, thank you for calling {company}. This is {name}. How may I help you?',
  },
};

// ---------------------------------------------------------------------------
// Intent Detection
// ---------------------------------------------------------------------------

const INTENT_KEYWORDS = {
  appointment: [
    'appointment', 'schedule', 'book', 'booking', 'reschedule', 'cancel appointment',
    'slot', 'available', 'availability', 'visit', 'meeting', 'interview',
    // Tamil/Tanglish
    'appointment book', 'pannanum', 'schedule pannunga', 'booking pannunga',
    'interview schedule', 'slot check', 'available time',
    // Hindi
    'appointment lena', 'time slot', 'milna hai', 'booking karna',
  ],
  sales: [
    'buy', 'purchase', 'price', 'pricing', 'cost', 'plan', 'package', 'offer',
    'discount', 'quote', 'proposal', 'deal', 'product', 'service',
    'interested', 'demo', 'trial', 'subscription',
    // Tamil/Tanglish
    'price enna', 'evvalavu', 'plan details', 'offer enna',
    // Hindi
    'kharidna', 'daam', 'keemat', 'plan batao',
  ],
  support: [
    'problem', 'issue', 'error', 'bug', 'broken', 'not working', 'help',
    'complaint', 'trouble', 'fix', 'resolve', 'stuck', 'failing',
    'refund', 'return', 'cancel', 'cancellation',
    // Tamil/Tanglish
    'problem irukku', 'work aagala', 'issue irukku', 'help pannunga',
    // Hindi
    'problem hai', 'kaam nahi kar raha', 'madad karo',
  ],
  retention: [
    'cancel subscription', 'unsubscribe', 'leave', 'not happy', 'disappointed',
    'switching', 'competitor', 'too expensive', 'not worth', 'downgrade',
    'churn', 'dissatisfied', 'unhappy', 'terrible', 'worst',
    // Tamil/Tanglish
    'cancel pannanum', 'happy illa', 'waste',
    // Hindi
    'cancel karna hai', 'khush nahi', 'band karo',
  ],
  qualification: [
    'information', 'learn more', 'details', 'how does it work', 'features',
    'comparison', 'requirements', 'evaluate', 'considering',
    'what do you offer', 'tell me about',
    // Tamil/Tanglish
    'details sollunga', 'eppadi work aagum', 'features enna',
    // Hindi
    'jankari do', 'kya kya milta hai', 'batao',
  ],
  escalation: [
    'human', 'real person', 'agent', 'manager', 'supervisor', 'escalate',
    'transfer', 'speak to someone', 'connect me',
    // Tamil/Tanglish
    'human kitta connect', 'manager kitta connect', 'aalu kitta pesunga',
    // Hindi
    'insaan se baat', 'manager se baat', 'kisi aur se baat',
  ],
};

/**
 * Detect the primary intent from user text.
 * Returns the agent type string.
 */
export const detectIntent = (text) => {
  if (!text) return 'voice';
  const lower = text.toLowerCase();

  // Check escalation first (highest priority)
  if (INTENT_KEYWORDS.escalation.some((kw) => lower.includes(kw))) return 'escalation';

  const scores = {};
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (intent === 'escalation') continue;
    scores[intent] = keywords.reduce((score, kw) => score + (lower.includes(kw) ? 1 : 0), 0);
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] > 0) return best[0];
  return 'voice'; // default to general voice agent
};

// ---------------------------------------------------------------------------
// Persona Builder
// ---------------------------------------------------------------------------

/**
 * Build the human-like system prompt for the voice agent LLM.
 *
 * @param {Object} options
 * @param {Object} options.agent - Buzzz Agent document from MongoDB
 * @param {Object} options.workspace - Workspace document
 * @param {string} options.userName - Authenticated user's name
 * @param {Object} options.customerContext - CRM context for the caller
 * @param {string} options.detectedLanguage - ISO language code or description
 * @returns {string} System prompt
 */
export const buildSystemPrompt = ({ agent, workspace, userName, customerContext, detectedLanguage }) => {
  const agentType = agent?.type || 'voice';
  const defaults = PERSONA_DEFAULTS[agentType] || PERSONA_DEFAULTS.voice;

  const agentName = agent?.name || 'Maya';
  const companyName = workspace?.name?.replace(/'s Workspace$/, '') || 'our company';
  const roleName = agent?.roleTitle || defaults.roleName;
  const department = defaults.department;
  const tone = agent?.tone || 'friendly';
  const speakingStyle = defaults.speakingStyle;

  const greeting = (agent?.systemPrompt?.includes('greeting:')
    ? agent.systemPrompt.split('greeting:')[1]?.split('\n')[0]?.trim()
    : defaults.greeting
  )
    .replace(/\{name\}/g, agentName)
    .replace(/\{company\}/g, companyName);

  // Build context summary (keep it concise for the LLM)
  let contextBlock = '';
  if (customerContext) {
    const ctx = customerContext;
    const parts = [];
    if (ctx.contacts?.length > 0) {
      parts.push(`Known contacts: ${ctx.contacts.map((c) => c.name).join(', ')}`);
    }
    if (ctx.openTickets?.length > 0) {
      parts.push(`Open tickets: ${ctx.openTickets.map((t) => `${t.title} (${t.status})`).join(', ')}`);
    }
    if (ctx.upcomingAppointments?.length > 0) {
      parts.push(`Upcoming appointments: ${ctx.upcomingAppointments.map((a) => `${a.customerName} - ${a.serviceName} at ${new Date(a.startTime).toLocaleString()}`).join('; ')}`);
    }
    if (ctx.leads?.length > 0) {
      parts.push(`Active leads: ${ctx.leads.map((l) => `${l.name} (${l.stage})`).join(', ')}`);
    }
    if (parts.length > 0) {
      contextBlock = `\n\nCRM context for this user:\n${parts.join('\n')}`;
    }
  }

  // Build agent-specific instructions
  let agentInstructions = '';
  if (agent?.systemPrompt) {
    agentInstructions = `\n\nSpecific instructions for your role:\n${agent.systemPrompt}`;
  }
  if (agent?.goals?.length > 0) {
    agentInstructions += `\n\nYour goals:\n${agent.goals.map((g) => `- ${g}`).join('\n')}`;
  }

  return `You are ${agentName}, a ${roleName} at ${companyName}, in the ${department} department.

Your personality: ${tone}, ${speakingStyle}.
You are speaking with ${userName} on a live voice call.

CRITICAL VOICE RULES — follow these precisely:

1. SOUND HUMAN: You are a real company employee, not a chatbot or IVR. Speak naturally like a professional ${roleName} would in a real phone conversation. Use natural pauses, appropriate emotion, and conversational rhythm.

2. NEVER REPEAT: Do NOT repeat what the caller just said. If they say "I need an appointment tomorrow", respond with "Sure, let me check what's available tomorrow. Morning or afternoon?" — NOT "You need an appointment tomorrow."

3. BE CONCISE: Keep responses to 1-3 spoken sentences unless detailed explanation is truly needed. Voice is not text — shorter is better.

4. LANGUAGE: Detect the caller's language and respond in the SAME language. If they speak Tamil, respond in Tamil. If they mix Tamil and English (Tanglish), respond in Tanglish. If they speak Hindi, respond in Hindi. Support: English, Tamil, Tanglish, Hindi, Malayalam, Telugu, Kannada, Bengali, Marathi, Gujarati, Punjabi, Urdu. Never force the caller back to English.

5. NO CHATBOT PHRASES: Avoid mechanical phrases like "How may I assist you?", "Is there anything else I can help you with?", "I understand your concern.", "Thank you for providing that information." Generate natural, context-appropriate responses instead.

6. CONVERSATION MEMORY: Remember everything the caller says during this call. If they said their name is Arun, remember it. If they mentioned a preference, use it later. Never ask for information they already provided.

7. TOOL USAGE: When you need to check availability, create appointments, look up customers, create tickets, or perform any CRM action, use the available tools. Wait for the tool result before confirming anything to the caller. NEVER claim an action was completed unless the tool returned a success result.

8. NO HALLUCINATION: Never invent company policies, pricing, availability, interview status, candidate status, or any CRM information. If you don't know something, say so and offer to check or connect them with someone who can help.

9. INTERRUPTION: If the caller interrupts you, stop speaking immediately and listen. Understand their selection or response from the interruption context.

10. PLAIN TEXT ONLY: Never use markdown, JSON, lists, bullet points, emojis, or code in your spoken responses. Speak in plain natural language suitable for text-to-speech.

Your opening greeting: "${greeting}"
${agentInstructions}${contextBlock}`;
};

// ---------------------------------------------------------------------------
// Agent Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the appropriate Buzzz Agent for a given intent.
 * Falls back to a 'voice' type agent or constructs a default.
 */
export const resolveAgent = async ({ workspaceId, intent }) => {
  const agentType = intent === 'escalation' ? 'voice' : intent === 'qualification' ? 'lead_qualification' : intent;

  // Try to find an active agent matching the type in this workspace
  let agent = await Agent.findOne({
    $or: [{ workspaceId }, { workspaceId: { $exists: false } }],
    type: agentType,
    status: 'active',
  });

  // Fallback to voice agent
  if (!agent && agentType !== 'voice') {
    agent = await Agent.findOne({
      $or: [{ workspaceId }, { workspaceId: { $exists: false } }],
      type: 'voice',
      status: 'active',
    });
  }

  // Fallback to any active agent
  if (!agent) {
    agent = await Agent.findOne({ status: 'active' });
  }

  return agent;
};

/**
 * Load workspace for prompt personalization.
 */
export const resolveWorkspace = async (workspaceId) => {
  return Workspace.findById(workspaceId).lean();
};

/**
 * Map agent type to the set of CRM tool names the agent is allowed to use.
 * This filters which tools are registered with the LLM for a given agent.
 */
export const getAgentToolNames = (agentType) => {
  const common = [
    'searchCustomer',
    'getCustomer',
    'addCustomerNote',
    'searchKnowledge',
    'handoffToHuman',
    'createTask',
  ];

  const byType = {
    voice: [...common, 'createContact', 'createLead', 'checkAppointmentAvailability', 'createAppointment'],
    sales: [...common, 'createLead', 'updateLead', 'updateLeadScore', 'createContact', 'updateContact'],
    support: [...common, 'createTicket', 'updateTicket', 'createContact'],
    appointment: [...common, 'checkAppointmentAvailability', 'createAppointment', 'rescheduleAppointment', 'cancelAppointment', 'createContact'],
    lead_qualification: [...common, 'createLead', 'updateLead', 'updateLeadScore', 'createContact', 'updateContact'],
    retention: [...common, 'createTicket', 'updateContact', 'updateLead', 'createEscalation'],
  };

  return byType[agentType] || byType.voice;
};

/**
 * Full orchestration: detect intent → resolve agent → build prompt
 */
export const orchestrate = async ({ workspaceId, userId, userName, text, customerContext }) => {
  const intent = detectIntent(text);
  const agent = await resolveAgent({ workspaceId, intent });
  const workspace = await resolveWorkspace(workspaceId);

  const systemPrompt = buildSystemPrompt({
    agent,
    workspace,
    userName,
    customerContext,
    detectedLanguage: null,
  });

  const allowedTools = getAgentToolNames(agent?.type || 'voice');

  return {
    intent,
    agent,
    workspace,
    systemPrompt,
    allowedTools,
    agentName: agent?.name || 'Maya',
    agentType: agent?.type || 'voice',
  };
};

export default {
  detectIntent,
  buildSystemPrompt,
  resolveAgent,
  resolveWorkspace,
  getAgentToolNames,
  orchestrate,
};

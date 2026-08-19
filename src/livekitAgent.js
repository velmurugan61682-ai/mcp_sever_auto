/**
 * Buzzz Voice Agent — LiveKit Agent Process
 *
 * Built following the official LiveKit Node.js Agent Starter:
 *   https://github.com/livekit-examples/agent-starter-node
 *
 * Runs as a SEPARATE process alongside the Express server:
 *   npm run agent        (or: node src/livekitAgent.js dev)
 *
 * Architecture:
 *   Caller Mic → LiveKit Cloud → STT → LLM (+ CRM Tools) → TTS → Caller
 *
 * Features:
 *   - Voice pipeline: STT + LLM + TTS (not Realtime API)
 *   - Adaptive interruption / barge-in
 *   - Preemptive LLM generation
 *   - Noise cancellation (ai-coustics)
 *   - Multilingual: English, Tamil, Tanglish, Hindi, + 8 more Indian languages
 *   - Natural human company-employee persona (not chatbot/IVR)
 *   - CRM tool calling: contacts, leads, tickets, appointments, etc.
 *   - Agent orchestration: Sales, Support, Appointment, Qualification, Retention
 *   - Conversation persistence to MongoDB
 *   - AI Activity logging to StructuredActivity
 *   - Call session tracking with transcript
 */

import { fileURLToPath } from 'url';
import { cli, ServerOptions, defineAgent, voice, llm, tool } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// MongoDB Connection (agent process needs its own connection)
// ---------------------------------------------------------------------------
import { connectDB } from './config/db.js';
await connectDB();

// ---------------------------------------------------------------------------
// Buzzz Imports
// ---------------------------------------------------------------------------
import { User } from './models/User.js';
import { Workspace } from './models/Workspace.js';
import {
  searchCustomer,
  getCustomer,
  createContact,
  updateContact,
  createLead,
  updateLead,
  getLead,
  updateLeadScore,
  createTicket,
  updateTicket,
  createTask,
  addCustomerNote,
  checkAppointmentAvailability,
  createAppointment,
  rescheduleAppointment,
  cancelAppointment,
  searchKnowledge,
  createEscalation,
  handoffToHuman,
  createCallSession,
  endCallSession,
  createVoiceConversation,
  saveVoiceMessage,
  loadCustomerContext,
} from './services/voiceTools.js';
import {
  orchestrate,
  buildSystemPrompt,
  resolveAgent,
  resolveWorkspace,
  getAgentToolNames,
  detectIntent,
} from './services/orchestrator.js';

// ---------------------------------------------------------------------------
// Tool Definitions — registered with the LLM for function calling
// ---------------------------------------------------------------------------

const buildCrmTools = ({ workspaceId, userId }) => {

  const tools = [
    tool({
      name: 'searchCustomer',
      description: 'Search for a customer/contact by name, email, or phone number in the CRM.',
      parameters: z.object({
        query: z.string().describe('Search term: name, email, or phone number'),
      }),
      execute: async ({ query }) => {
        console.log(`[Voice Tool] searchCustomer: "${query}"`);
        const result = await searchCustomer({ workspaceId, query });
        if (result.count === 0) return 'No customers found matching that search.';
        return result.results.map(c => `${c.name} (${c.email || c.phone || 'no contact info'}), Status: ${c.status}`).join('. ');
      },
    }),

    tool({
      name: 'getCustomer',
      description: 'Get full details of a specific customer by their ID.',
      parameters: z.object({
        contactId: z.string().describe('The contact/customer ID'),
      }),
      execute: async ({ contactId }) => {
        console.log(`[Voice Tool] getCustomer: ${contactId}`);
        const result = await getCustomer({ workspaceId, contactId });
        if (!result.found) return 'Customer not found.';
        const c = result.data;
        return `${c.name}, Email: ${c.email || 'none'}, Phone: ${c.phone || 'none'}, Status: ${c.status}, Score: ${c.score}`;
      },
    }),

    tool({
      name: 'createContact',
      description: 'Create a new contact/customer in the CRM. Use when someone provides their details during the call.',
      parameters: z.object({
        name: z.string().describe('Full name of the contact'),
        email: z.string().optional().describe('Email address'),
        phone: z.string().optional().describe('Phone number'),
        source: z.string().optional().describe('Source: voice, website, referral, etc.'),
      }),
      execute: async ({ name, email, phone, source }) => {
        console.log(`[Voice Tool] createContact: ${name}`);
        const result = await createContact({ workspaceId, userId, name, email, phone, source: source || 'voice' });
        if (result.duplicate) return `A contact named ${result.existingContact.name} already exists with those details.`;
        if (result.created) return `Contact created successfully for ${name}.`;
        return 'Failed to create contact.';
      },
    }),

    tool({
      name: 'updateContact',
      description: 'Update an existing contact\'s details in the CRM.',
      parameters: z.object({
        contactId: z.string().describe('The contact ID to update'),
        name: z.string().optional().describe('Updated name'),
        email: z.string().optional().describe('Updated email'),
        phone: z.string().optional().describe('Updated phone'),
        status: z.string().optional().describe('Updated status: lead, customer, churned'),
      }),
      execute: async ({ contactId, ...updates }) => {
        console.log(`[Voice Tool] updateContact: ${contactId}`);
        const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
        const result = await updateContact({ workspaceId, contactId, updates: cleanUpdates });
        if (result.updated) return `Contact updated successfully.`;
        return result.message || 'Failed to update contact.';
      },
    }),

    tool({
      name: 'createLead',
      description: 'Create a new sales lead in the CRM when someone shows interest in products or services.',
      parameters: z.object({
        name: z.string().describe('Lead name'),
        email: z.string().optional().describe('Email'),
        phone: z.string().optional().describe('Phone'),
        company: z.string().optional().describe('Company name'),
        sourcePlatform: z.string().optional().describe('Source: voice, website, referral'),
      }),
      execute: async ({ name, email, phone, company, sourcePlatform }) => {
        console.log(`[Voice Tool] createLead: ${name}`);
        const result = await createLead({ workspaceId, userId, name, email, phone, company, sourcePlatform: sourcePlatform || 'voice' });
        if (result.created) return `Lead created for ${name}.`;
        return 'Failed to create lead.';
      },
    }),

    tool({
      name: 'updateLead',
      description: 'Update an existing lead\'s information.',
      parameters: z.object({
        leadId: z.string().describe('The lead ID'),
        stage: z.string().optional().describe('Stage: New, Contacted, Qualified, Proposal, Won, Lost'),
        status: z.string().optional().describe('Status: hot, warm, cold'),
        company: z.string().optional().describe('Company name'),
      }),
      execute: async ({ leadId, ...updates }) => {
        console.log(`[Voice Tool] updateLead: ${leadId}`);
        const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
        const result = await updateLead({ workspaceId, leadId, updates: cleanUpdates });
        if (result.updated) return `Lead updated successfully.`;
        return result.message || 'Failed to update lead.';
      },
    }),

    tool({
      name: 'updateLeadScore',
      description: 'Adjust a lead\'s qualification score up or down.',
      parameters: z.object({
        leadId: z.string().describe('The lead ID'),
        scoreDelta: z.number().describe('Points to add (positive) or subtract (negative)'),
        reason: z.string().describe('Reason for the score change'),
      }),
      execute: async ({ leadId, scoreDelta, reason }) => {
        console.log(`[Voice Tool] updateLeadScore: ${leadId} ${scoreDelta > 0 ? '+' : ''}${scoreDelta}`);
        const result = await updateLeadScore({ workspaceId, leadId, scoreDelta, reason });
        if (result.updated) return `Lead score updated from ${result.oldScore} to ${result.newScore}.`;
        return result.message || 'Failed to update lead score.';
      },
    }),

    tool({
      name: 'createTicket',
      description: 'Create a support ticket for a customer issue or complaint.',
      parameters: z.object({
        title: z.string().describe('Brief title of the issue'),
        description: z.string().describe('Detailed description'),
        priority: z.string().optional().describe('Priority: low, medium, high, urgent'),
        contactId: z.string().optional().describe('Related contact ID if known'),
      }),
      execute: async ({ title, description, priority, contactId }) => {
        console.log(`[Voice Tool] createTicket: ${title}`);
        const result = await createTicket({ workspaceId, userId, contactId, title, description, priority });
        if (result.created) return `Support ticket created: ${title}. Ticket ID: ${result.ticketId}.`;
        return 'Failed to create ticket.';
      },
    }),

    tool({
      name: 'updateTicket',
      description: 'Update the status or priority of an existing support ticket.',
      parameters: z.object({
        ticketId: z.string().describe('The ticket ID'),
        status: z.string().optional().describe('Status: open, pending, resolved, closed'),
        priority: z.string().optional().describe('Priority: low, medium, high, urgent'),
      }),
      execute: async ({ ticketId, ...updates }) => {
        console.log(`[Voice Tool] updateTicket: ${ticketId}`);
        const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
        const result = await updateTicket({ workspaceId, ticketId, updates: cleanUpdates });
        if (result.updated) return `Ticket updated successfully.`;
        return result.message || 'Failed to update ticket.';
      },
    }),

    tool({
      name: 'createTask',
      description: 'Create an internal follow-up task for the team.',
      parameters: z.object({
        title: z.string().describe('Task title'),
        description: z.string().optional().describe('Task description'),
        dueAt: z.string().optional().describe('Due date in ISO format'),
        contactId: z.string().optional().describe('Related contact ID'),
      }),
      execute: async ({ title, description, dueAt, contactId }) => {
        console.log(`[Voice Tool] createTask: ${title}`);
        const result = await createTask({ workspaceId, userId, contactId, title, description, dueAt });
        if (result.created) return `Task created: ${title}.`;
        return 'Failed to create task.';
      },
    }),

    tool({
      name: 'addCustomerNote',
      description: 'Add a note to a customer or contact record for future reference.',
      parameters: z.object({
        entityId: z.string().describe('The contact or entity ID'),
        content: z.string().describe('Note content'),
        entityType: z.string().optional().describe('Entity type: contact, company, deal, ticket'),
      }),
      execute: async ({ entityId, content, entityType }) => {
        console.log(`[Voice Tool] addCustomerNote: ${entityId}`);
        const result = await addCustomerNote({ workspaceId, userId, entityType: entityType || 'contact', entityId, content });
        if (result.created) return `Note added successfully.`;
        return 'Failed to add note.';
      },
    }),

    tool({
      name: 'checkAppointmentAvailability',
      description: 'Check available appointment slots for a given date. Always call this before booking an appointment.',
      parameters: z.object({
        date: z.string().describe('Date in YYYY-MM-DD format'),
        duration: z.number().optional().describe('Duration in minutes, default 30'),
        staffMember: z.string().optional().describe('Specific staff member name'),
      }),
      execute: async ({ date, duration, staffMember }) => {
        console.log(`[Voice Tool] checkAppointmentAvailability: ${date}`);
        const result = await checkAppointmentAvailability({ workspaceId, date, duration, staffMember });
        if (!result.available) {
          return result.reason || `No slots available on ${date}.`;
        }
        const topSlots = result.slots.slice(0, 6);
        const slotList = topSlots.map(s => s.time).join(', ');
        return `${result.totalSlots} slots available on ${date}: ${slotList}. Duration: ${duration || 30} minutes each.`;
      },
    }),

    tool({
      name: 'createAppointment',
      description: 'Book/create an appointment. Only call this AFTER checking availability and getting caller confirmation.',
      parameters: z.object({
        customerName: z.string().describe('Customer name'),
        startTime: z.string().describe('Start time in ISO format (e.g., 2026-08-20T14:30:00.000Z)'),
        serviceName: z.string().optional().describe('Service or reason for the appointment'),
        customerPhone: z.string().optional().describe('Customer phone'),
        customerEmail: z.string().optional().describe('Customer email'),
        staffMember: z.string().optional().describe('Staff member name'),
        duration: z.number().optional().describe('Duration in minutes, default 30'),
        meetingType: z.string().optional().describe('Meeting type: in_person, video, phone'),
        notes: z.string().optional().describe('Additional notes'),
      }),
      execute: async ({ customerName, startTime, serviceName, customerPhone, customerEmail, staffMember, duration, meetingType, notes }) => {
        console.log(`[Voice Tool] createAppointment: ${customerName} at ${startTime}`);
        const result = await createAppointment({
          workspaceId,
          customerName,
          customerPhone,
          customerEmail,
          serviceName,
          serviceDurationMinutes: duration,
          meetingType,
          staffMember,
          startTime,
          notes,
          bookedBy: 'voice_call',
          agentName: 'Buzzz Voice Agent',
        });
        if (result.created) {
          const appt = result.data;
          return `Appointment confirmed for ${customerName} on ${new Date(appt.startTime).toLocaleString()} for ${appt.serviceName}.`;
        }
        if (result.conflict) return result.message;
        return result.message || 'Failed to create appointment.';
      },
    }),

    tool({
      name: 'rescheduleAppointment',
      description: 'Reschedule an existing appointment to a new time.',
      parameters: z.object({
        appointmentId: z.string().describe('The appointment ID to reschedule'),
        newStartTime: z.string().describe('New start time in ISO format'),
        duration: z.number().optional().describe('Duration in minutes'),
      }),
      execute: async ({ appointmentId, newStartTime, duration }) => {
        console.log(`[Voice Tool] rescheduleAppointment: ${appointmentId}`);
        const result = await rescheduleAppointment({ workspaceId, appointmentId, newStartTime, duration });
        if (result.rescheduled) return `Appointment rescheduled to ${new Date(newStartTime).toLocaleString()}.`;
        if (result.conflict) return result.message;
        return result.message || 'Failed to reschedule.';
      },
    }),

    tool({
      name: 'cancelAppointment',
      description: 'Cancel an existing appointment.',
      parameters: z.object({
        appointmentId: z.string().describe('The appointment ID to cancel'),
        reason: z.string().optional().describe('Cancellation reason'),
      }),
      execute: async ({ appointmentId, reason }) => {
        console.log(`[Voice Tool] cancelAppointment: ${appointmentId}`);
        const result = await cancelAppointment({ workspaceId, appointmentId, reason });
        if (result.cancelled) return `Appointment cancelled.`;
        return result.message || 'Failed to cancel appointment.';
      },
    }),

    tool({
      name: 'searchKnowledge',
      description: 'Search the company knowledge base for policies, FAQs, pricing, or product information.',
      parameters: z.object({
        query: z.string().describe('What to search for'),
      }),
      execute: async ({ query }) => {
        console.log(`[Voice Tool] searchKnowledge: "${query}"`);
        const result = await searchKnowledge({ workspaceId, query });
        if (result.count === 0) return 'No relevant information found in the knowledge base.';
        return result.results.map(r => `[${r.sourceTitle}] ${r.passage}`).join(' | ');
      },
    }),

    tool({
      name: 'createEscalation',
      description: 'Create an escalation request for complex issues that need human attention.',
      parameters: z.object({
        customerName: z.string().describe('Customer name'),
        intent: z.string().describe('What the customer needs'),
        issue: z.string().describe('Description of the issue'),
        sentiment: z.string().optional().describe('Customer sentiment: positive, neutral, negative'),
        recommendation: z.string().optional().describe('Recommended action'),
      }),
      execute: async ({ customerName, intent, issue, sentiment, recommendation }) => {
        console.log(`[Voice Tool] createEscalation: ${customerName}`);
        const result = await createEscalation({
          workspaceId,
          agentName: 'Buzzz Voice Agent',
          customerName,
          intent,
          issue,
          sentiment,
          recommendation,
        });
        if (result.created) return `Escalation created. A team member will follow up shortly.`;
        return 'Failed to create escalation.';
      },
    }),

    tool({
      name: 'handoffToHuman',
      description: 'Transfer the caller to a human agent when they explicitly request it or when the issue is beyond your capability.',
      parameters: z.object({
        customerName: z.string().describe('Customer name'),
        reason: z.string().describe('Why the handoff is needed'),
        conversationSummary: z.string().describe('Brief summary of what was discussed'),
      }),
      execute: async ({ customerName, reason, conversationSummary }) => {
        console.log(`[Voice Tool] handoffToHuman: ${customerName}`);
        const result = await handoffToHuman({
          workspaceId,
          agentName: 'Buzzz Voice Agent',
          customerName,
          reason,
          conversationSummary,
        });
        if (result.created) return `I've created a handoff request. A human team member will reach out to you shortly. Your reference number is ${result.escalationId}.`;
        return 'Failed to create handoff request.';
      },
    }),
  ];

  return tools;
};

// ---------------------------------------------------------------------------
// Agent Definition — following official LiveKit starter pattern
// ---------------------------------------------------------------------------

export default defineAgent({
  entry: async (ctx) => {
    console.log(`[Buzzz Voice Agent] Session starting for room: ${ctx.room.name}`);

    // -----------------------------------------------------------------------
    // 1. Wait for participant and authenticate
    // -----------------------------------------------------------------------
    const participant = await ctx.waitForParticipant();
    const identity = participant.identity;

    if (!identity.startsWith('user-')) {
      console.warn(`[Buzzz Voice Agent] Unexpected participant identity: ${identity}`);
      return;
    }

    const userId = identity.replace('user-', '');
    console.log(`[Buzzz Voice Agent] User ID: ${userId}`);

    // -----------------------------------------------------------------------
    // 2. Load user, workspace, and CRM context
    // -----------------------------------------------------------------------
    const user = await User.findById(userId);
    if (!user) {
      console.error(`[Buzzz Voice Agent] User not found: ${userId}`);
      return;
    }
    const userName = user.name || 'there';

    // Resolve workspace
    let workspace = await Workspace.findOne({
      $or: [{ ownerId: userId }, { 'members.user': userId }],
    });
    if (!workspace) {
      workspace = await Workspace.create({
        name: `${userName}'s Workspace`,
        ownerId: userId,
        members: [{ user: userId, role: 'admin' }],
      });
    }
    const workspaceId = workspace._id;

    // Load CRM context
    const customerContext = await loadCustomerContext({ workspaceId, userId });
    console.log(`[Buzzz Voice Agent] Context loaded — Contacts: ${customerContext.contacts.length}, Tickets: ${customerContext.openTickets.length}, Appointments: ${customerContext.upcomingAppointments.length}`);

    // -----------------------------------------------------------------------
    // 3. Resolve initial agent and build persona prompt
    // -----------------------------------------------------------------------
    const initial = await orchestrate({
      workspaceId,
      userId,
      userName,
      text: '', // No text yet — start with default voice agent
      customerContext,
    });

    console.log(`[Buzzz Voice Agent] Initial agent: ${initial.agentName} (${initial.agentType})`);

    // -----------------------------------------------------------------------
    // 4. Build CRM tools
    // -----------------------------------------------------------------------
    const crmTools = buildCrmTools({ workspaceId, userId });

    // -----------------------------------------------------------------------
    // 5. Create voice pipeline session — following official starter
    // -----------------------------------------------------------------------

    // Use OpenAI Realtime for the best conversational experience with
    // built-in STT + LLM + TTS in a single low-latency stream.
    // This gives us: natural voice, interruption handling, turn detection,
    // and tool calling — all in one model.
    const model = new openai.realtime.RealtimeModel({
      instructions: initial.systemPrompt,
      voice: 'shimmer', // Warm, professional female voice
      modalities: ['audio', 'text'],
      temperature: 0.7,
      turnDetection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      },
    });

    const session = new voice.AgentSession({
      llm: model,
    });

    // -----------------------------------------------------------------------
    // 6. Session state tracking
    // -----------------------------------------------------------------------
    let callSessionId = null;
    let conversationId = null;
    const callStartTime = Date.now();
    const transcriptSegments = [];
    let currentAgentType = initial.agentType;
    let currentAgentName = initial.agentName;

    // Create call session in DB
    try {
      const csResult = await createCallSession({
        workspaceId,
        customerName: userName,
        customerPhone: 'voice-web',
        agentName: initial.agentName,
        livekitRoomName: ctx.room.name,
      });
      callSessionId = csResult.callSessionId;

      const convResult = await createVoiceConversation({
        workspaceId,
        userId,
        contactName: userName,
        livekitRoomName: ctx.room.name,
      });
      conversationId = convResult.conversationId;
    } catch (err) {
      console.error('[Buzzz Voice Agent] Failed to create call/conversation session:', err.message);
    }

    // -----------------------------------------------------------------------
    // 7. Data channel for client state updates
    // -----------------------------------------------------------------------
    const publishState = async (state) => {
      try {
        const encoder = new TextEncoder();
        await ctx.room.localParticipant.publishData(
          encoder.encode(JSON.stringify({ state })),
          { reliable: true }
        );
      } catch (err) {
        // Silently ignore publish errors
      }
    };

    // Handle incoming data from client (text fallback, confirmations)
    ctx.room.on('dataReceived', async (payload) => {
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));

        if (data.type === 'user_chat_message' && data.text) {
          console.log(`[Buzzz Voice Agent] Text message: "${data.text}"`);
          // Save to transcript
          transcriptSegments.push({ speaker: 'customer', text: data.text, timestampSeconds: Math.floor((Date.now() - callStartTime) / 1000) });
          if (conversationId) {
            saveVoiceMessage({ workspaceId, userId, conversationId, direction: 'incoming', content: data.text }).catch(() => {});
          }
        }
      } catch (err) {
        // Silently ignore parse errors
      }
    });

    // -----------------------------------------------------------------------
    // 8. Agent state events → client UI
    // -----------------------------------------------------------------------
    session.on(voice.AgentSessionEventTypes.AgentStateChanged, async (state) => {
      let clientState = state;
      if (state === 'initializing') clientState = 'idle';
      console.log(`[Buzzz Voice Agent] State: ${state}`);
      await publishState(clientState);
    });

    // Track transcripts for persistence
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, async (item) => {
      if (item.role === 'assistant' && item.content) {
        const text = typeof item.content === 'string' ? item.content : JSON.stringify(item.content);
        transcriptSegments.push({
          speaker: 'agent',
          text,
          timestampSeconds: Math.floor((Date.now() - callStartTime) / 1000),
        });
        if (conversationId) {
          saveVoiceMessage({ workspaceId, userId, conversationId, direction: 'outgoing', content: text, isAI: true }).catch(() => {});
        }

        // Detect emotion for avatar animation
        const lower = text.toLowerCase();
        let emotion = null;
        if (/haha|lol|😂|funny|he he/i.test(lower)) emotion = 'laughing';
        else if (/wow|oh!|surpris|😮/i.test(lower)) emotion = 'surprised';
        else if (/^(hi|hello|bye|welcome|vanakkam)/i.test(lower)) emotion = 'waving';
        else if (/success|perfect|great|awesome|completed|done|confirmed|✅/i.test(lower)) emotion = 'happy';

        if (emotion) {
          await publishState(emotion);
          setTimeout(() => publishState('idle'), 2500);
        }
      }

      if (item.role === 'user' && item.content) {
        const text = typeof item.content === 'string' ? item.content : JSON.stringify(item.content);
        transcriptSegments.push({
          speaker: 'customer',
          text,
          timestampSeconds: Math.floor((Date.now() - callStartTime) / 1000),
        });
        if (conversationId) {
          saveVoiceMessage({ workspaceId, userId, conversationId, direction: 'incoming', content: text }).catch(() => {});
        }

        // Dynamic agent switching based on detected intent
        const newIntent = detectIntent(text);
        const newAgentType = newIntent === 'escalation' ? 'voice' : newIntent === 'qualification' ? 'lead_qualification' : newIntent;
        if (newAgentType !== currentAgentType && newAgentType !== 'voice') {
          console.log(`[Buzzz Voice Agent] Intent shift: ${currentAgentType} → ${newAgentType}`);
          try {
            const newOrchestration = await orchestrate({
              workspaceId,
              userId,
              userName,
              text,
              customerContext,
            });
            currentAgentType = newOrchestration.agentType;
            currentAgentName = newOrchestration.agentName;
            // Update the session instructions for the new agent persona
            session.updateInstructions(newOrchestration.systemPrompt);
            console.log(`[Buzzz Voice Agent] Switched to: ${currentAgentName} (${currentAgentType})`);

            // Notify client of agent switch
            const encoder = new TextEncoder();
            await ctx.room.localParticipant.publishData(
              encoder.encode(JSON.stringify({
                type: 'agent_switch',
                agentName: currentAgentName,
                agentType: currentAgentType,
              })),
              { reliable: true }
            );
          } catch (err) {
            console.error('[Buzzz Voice Agent] Agent switch error:', err.message);
          }
        }
      }
    });

    // -----------------------------------------------------------------------
    // 9. Connect and start the voice session
    // -----------------------------------------------------------------------
    await ctx.connect();

    await session.start({
      room: ctx.room,
      participant: participant,
      tools: crmTools,
    });

    console.log(`[Buzzz Voice Agent] Session started for ${userName} in room ${ctx.room.name}`);

    // Greet the user naturally
    try {
      const companyName = workspace.name?.replace(/'s Workspace$/, '') || 'our company';
      const greeting = `Hi ${userName}, welcome to ${companyName}. I'm ${currentAgentName}. How can I help you today?`;
      setTimeout(async () => {
        try {
          await session.say(greeting);
        } catch (err) {
          console.error('[Buzzz Voice Agent] Greeting error:', err.message);
        }
      }, 1000);
    } catch (err) {
      console.error('[Buzzz Voice Agent] Greeting setup error:', err.message);
    }

    // -----------------------------------------------------------------------
    // 10. Handle disconnect — persist call data
    // -----------------------------------------------------------------------
    ctx.room.on('disconnected', async () => {
      console.log(`[Buzzz Voice Agent] Room disconnected: ${ctx.room.name}`);
      const durationSeconds = Math.floor((Date.now() - callStartTime) / 1000);

      if (callSessionId) {
        try {
          await endCallSession({
            callSessionId,
            transcripts: transcriptSegments,
            durationSeconds,
            callOutcome: 'inquiry_answered',
            sentiment: 'neutral',
            aiSummary: `Voice call with ${userName}. Duration: ${durationSeconds}s. Agent: ${currentAgentName} (${currentAgentType}). ${transcriptSegments.length} transcript segments.`,
          });
        } catch (err) {
          console.error('[Buzzz Voice Agent] Failed to end call session:', err.message);
        }
      }
    });
  },
});

// ---------------------------------------------------------------------------
// Launch — identical to official starter
// ---------------------------------------------------------------------------
cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'buzzz-voice-agent',
  })
);

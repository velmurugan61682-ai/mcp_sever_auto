/**
 * Buzzz Voice Agent — CRM Tool Functions
 *
 * Each tool is an async function that operates on existing Mongoose models
 * with strict workspace isolation. Every write operation logs to
 * StructuredActivity for the AI Activity audit trail.
 *
 * These functions are registered as LiveKit agent tools so the LLM can
 * invoke them during a voice conversation.
 */

import mongoose from 'mongoose';
import Contact from '../models/Contact.js';
import { CRMLead } from '../models/CRMLead.js';
import Ticket from '../models/Ticket.js';
import Task from '../models/Task.js';
import Note from '../models/Note.js';
import Deal from '../models/Deal.js';
import Appointment from '../models/Appointment.js';
import { CallSession } from '../models/CallSession.js';
import { UnifiedConversation } from '../models/UnifiedConversation.js';
import { UnifiedMessage } from '../models/UnifiedMessage.js';
import StructuredActivity from '../models/StructuredActivity.js';
import ApprovalItem from '../models/ApprovalItem.js';
import KnowledgeSource from '../models/KnowledgeSource.js';
import { calculateAvailableSlots } from './availabilityEngine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const logActivity = async ({
  workspaceId,
  actor = 'Buzzz Voice Agent',
  actorType = 'agent',
  mode = 'autonomous',
  action,
  category = 'calls',
  customerName = '',
  detail = '',
  outcome = 'success',
  linkedEntityId,
}) => {
  try {
    await StructuredActivity.create({
      workspaceId,
      actor,
      actorType,
      mode,
      action,
      category,
      customerName,
      detail,
      outcome,
      linkedEntityId,
    });
  } catch (err) {
    console.error('[VoiceTools] Activity log failed:', err.message);
  }
};

// ---------------------------------------------------------------------------
// Contact Tools
// ---------------------------------------------------------------------------

export const getCustomer = async ({ workspaceId, contactId }) => {
  const contact = await Contact.findOne({ _id: contactId, workspaceId });
  if (!contact) return { found: false, message: 'Customer not found.' };
  return { found: true, data: contact.toObject() };
};

export const searchCustomer = async ({ workspaceId, query }) => {
  const pattern = { $regex: query, $options: 'i' };
  const contacts = await Contact.find({
    workspaceId,
    archivedAt: { $exists: false },
    $or: [{ name: pattern }, { email: pattern }, { phone: pattern }],
  })
    .limit(5)
    .lean();

  return { count: contacts.length, results: contacts };
};

export const createContact = async ({ workspaceId, userId, name, email, phone, source, tags }) => {
  // Duplicate guard
  const existing = await Contact.findOne({
    workspaceId,
    archivedAt: { $exists: false },
    $or: [
      ...(email ? [{ email: email.toLowerCase().trim() }] : []),
      ...(phone ? [{ phone: phone.trim() }] : []),
    ],
  });
  if (existing) {
    return { created: false, duplicate: true, existingContact: existing.toObject(), message: `Contact already exists: ${existing.name}` };
  }

  const contact = await Contact.create({
    workspaceId,
    ownerId: userId,
    name,
    email: email || '',
    phone: phone || '',
    source: source || 'voice',
    tags: tags || [],
    status: 'lead',
  });

  await logActivity({
    workspaceId,
    action: 'Created contact via voice',
    category: 'crm_changes',
    customerName: name,
    detail: `Contact created: ${name} (${email || phone || 'no email/phone'})`,
    linkedEntityId: contact._id.toString(),
  });

  return { created: true, data: contact.toObject() };
};

export const updateContact = async ({ workspaceId, contactId, updates }) => {
  const contact = await Contact.findOne({ _id: contactId, workspaceId });
  if (!contact) return { updated: false, message: 'Contact not found.' };

  const allowed = ['name', 'email', 'phone', 'status', 'tags', 'score'];
  for (const key of allowed) {
    if (updates[key] !== undefined) contact[key] = updates[key];
  }
  contact.lastContactedAt = new Date();
  await contact.save();

  await logActivity({
    workspaceId,
    action: 'Updated contact via voice',
    category: 'crm_changes',
    customerName: contact.name,
    detail: `Fields updated: ${Object.keys(updates).join(', ')}`,
    linkedEntityId: contact._id.toString(),
  });

  return { updated: true, data: contact.toObject() };
};

// ---------------------------------------------------------------------------
// Lead Tools
// ---------------------------------------------------------------------------

export const createLead = async ({ workspaceId, userId, name, email, phone, company, sourcePlatform, tags }) => {
  const lead = await CRMLead.create({
    workspaceId,
    userId,
    name,
    email: email || '',
    phone: phone || '',
    company: company || '',
    sourcePlatform: sourcePlatform || 'voice',
    tags: tags || [],
    stage: 'New',
    status: 'warm',
    leadScore: 50,
  });

  await logActivity({
    workspaceId,
    action: 'Created lead via voice',
    category: 'crm_changes',
    customerName: name,
    detail: `New lead: ${name} from ${sourcePlatform || 'voice call'}`,
    linkedEntityId: lead._id.toString(),
  });

  return { created: true, data: lead.toObject() };
};

export const updateLead = async ({ workspaceId, leadId, updates }) => {
  const lead = await CRMLead.findOne({ _id: leadId, workspaceId });
  if (!lead) return { updated: false, message: 'Lead not found.' };

  const allowed = ['name', 'email', 'phone', 'company', 'status', 'stage', 'leadScore', 'tags'];
  for (const key of allowed) {
    if (updates[key] !== undefined) lead[key] = updates[key];
  }
  lead.lastInteractionAt = new Date();
  await lead.save();

  await logActivity({
    workspaceId,
    action: 'Updated lead via voice',
    category: 'crm_changes',
    customerName: lead.name,
    detail: `Lead updated: ${Object.keys(updates).join(', ')}`,
    linkedEntityId: lead._id.toString(),
  });

  return { updated: true, data: lead.toObject() };
};

export const getLead = async ({ workspaceId, leadId }) => {
  const lead = await CRMLead.findOne({ _id: leadId, workspaceId }).lean();
  if (!lead) return { found: false, message: 'Lead not found.' };
  return { found: true, data: lead };
};

export const updateLeadScore = async ({ workspaceId, leadId, scoreDelta, reason }) => {
  const lead = await CRMLead.findOne({ _id: leadId, workspaceId });
  if (!lead) return { updated: false, message: 'Lead not found.' };

  const oldScore = lead.leadScore;
  lead.leadScore = Math.max(0, Math.min(100, lead.leadScore + scoreDelta));
  lead.lastInteractionAt = new Date();
  await lead.save();

  await logActivity({
    workspaceId,
    action: 'Updated lead score via voice',
    category: 'crm_changes',
    customerName: lead.name,
    detail: `Score ${oldScore} → ${lead.leadScore} (${reason || 'voice interaction'})`,
    linkedEntityId: lead._id.toString(),
  });

  return { updated: true, oldScore, newScore: lead.leadScore };
};

// ---------------------------------------------------------------------------
// Ticket Tools
// ---------------------------------------------------------------------------

export const createTicket = async ({ workspaceId, userId, contactId, title, description, priority }) => {
  const ticket = await Ticket.create({
    workspaceId,
    contactId: contactId || undefined,
    ownerId: userId,
    title,
    description: description || '',
    priority: priority || 'medium',
    status: 'open',
  });

  await logActivity({
    workspaceId,
    action: 'Created support ticket via voice',
    category: 'crm_changes',
    detail: `Ticket: ${title} (${priority || 'medium'} priority)`,
    linkedEntityId: ticket._id.toString(),
  });

  return { created: true, ticketId: ticket._id.toString(), data: ticket.toObject() };
};

export const updateTicket = async ({ workspaceId, ticketId, updates }) => {
  const ticket = await Ticket.findOne({ _id: ticketId, workspaceId });
  if (!ticket) return { updated: false, message: 'Ticket not found.' };

  const allowed = ['status', 'priority', 'description', 'tags'];
  for (const key of allowed) {
    if (updates[key] !== undefined) ticket[key] = updates[key];
  }
  await ticket.save();

  await logActivity({
    workspaceId,
    action: 'Updated ticket via voice',
    category: 'crm_changes',
    detail: `Ticket ${ticket.title}: ${Object.keys(updates).join(', ')} updated`,
    linkedEntityId: ticket._id.toString(),
  });

  return { updated: true, data: ticket.toObject() };
};

// ---------------------------------------------------------------------------
// Task Tools
// ---------------------------------------------------------------------------

export const createTask = async ({ workspaceId, userId, contactId, title, description, dueAt }) => {
  const task = await Task.create({
    workspaceId,
    contactId: contactId || undefined,
    ownerId: userId,
    title,
    description: description || '',
    dueAt: dueAt ? new Date(dueAt) : undefined,
    source: 'ai',
    status: 'open',
  });

  await logActivity({
    workspaceId,
    action: 'Created task via voice',
    category: 'crm_changes',
    detail: `Task: ${title}`,
    linkedEntityId: task._id.toString(),
  });

  return { created: true, data: task.toObject() };
};

// ---------------------------------------------------------------------------
// Note Tools
// ---------------------------------------------------------------------------

export const addCustomerNote = async ({ workspaceId, userId, entityType, entityId, content }) => {
  const note = await Note.create({
    workspaceId,
    entityType: entityType || 'contact',
    entityId,
    content,
    createdBy: userId,
    source: 'ai',
  });

  await logActivity({
    workspaceId,
    action: 'Added note via voice',
    category: 'crm_changes',
    detail: `Note on ${entityType || 'contact'}: ${content.substring(0, 80)}...`,
    linkedEntityId: note._id.toString(),
  });

  return { created: true, data: note.toObject() };
};

// ---------------------------------------------------------------------------
// Appointment Tools
// ---------------------------------------------------------------------------

export const checkAppointmentAvailability = async ({ workspaceId, date, duration, staffMember }) => {
  const activeStatuses = ['awaiting_confirmation', 'confirmed', 'rescheduled'];
  const existing = await Appointment.find({
    workspaceId,
    status: { $in: activeStatuses },
    ...(staffMember ? { staffMember } : {}),
  });

  const result = calculateAvailableSlots({
    dateStr: date,
    serviceDurationMinutes: Number(duration || 30),
    existingBookings: existing,
  });

  return result;
};

export const createAppointment = async ({
  workspaceId,
  customerName,
  customerPhone,
  customerEmail,
  serviceName,
  serviceDurationMinutes,
  meetingType,
  locationName,
  staffMember,
  startTime,
  notes,
  bookedBy,
  agentName,
}) => {
  const session = await mongoose.startSession();
  try {
    const start = new Date(startTime);
    if (isNaN(start.getTime())) {
      return { created: false, message: 'Invalid start time.' };
    }

    const duration = Number(serviceDurationMinutes || 30);
    const end = new Date(start.getTime() + duration * 60000);
    const staff = staffMember || 'Assigned Specialist';
    let appointment;

    await session.withTransaction(async () => {
      appointment = await Appointment.reserveSlotAtomic(
        {
          workspaceId,
          customerName,
          customerPhone: customerPhone || '',
          customerEmail: customerEmail || '',
          serviceName: serviceName || 'General Consultation',
          serviceDurationMinutes: duration,
          meetingType: meetingType || 'in_person',
          locationName: locationName || 'Main Branch',
          staffMember: staff,
          startTime: start,
          endTime: end,
          status: 'awaiting_confirmation',
          bookedBy: bookedBy || 'voice_call',
          agentName: agentName || 'Buzzz Voice Agent',
          notes: notes || '',
          reservationExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
          reservationLockExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
        { session }
      );

      await StructuredActivity.create(
        [
          {
            workspaceId,
            actor: agentName || 'Buzzz Voice Agent',
            actorType: 'agent',
            mode: 'autonomous',
            action: 'Booked appointment via voice',
            category: 'appointments',
            customerName,
            detail: `${serviceName || 'Consultation'} at ${start.toISOString()} with ${staff}`,
            outcome: 'success',
            linkedEntityId: appointment._id.toString(),
          },
        ],
        { session }
      );
    });

    return { created: true, data: appointment.toObject() };
  } catch (error) {
    if (error.message?.startsWith('Slot conflict')) {
      return { created: false, conflict: true, message: error.message };
    }
    return { created: false, message: error.message };
  } finally {
    session.endSession();
  }
};

export const rescheduleAppointment = async ({ workspaceId, appointmentId, newStartTime, duration }) => {
  const appointment = await Appointment.findOne({ _id: appointmentId, workspaceId });
  if (!appointment) return { rescheduled: false, message: 'Appointment not found.' };

  const start = new Date(newStartTime);
  if (isNaN(start.getTime())) return { rescheduled: false, message: 'Invalid start time.' };

  const dur = Number(duration || appointment.serviceDurationMinutes || 30);
  const end = new Date(start.getTime() + dur * 60000);

  // Check overlap (excluding this appointment)
  const conflict = await Appointment.findOverlappingActive({
    workspaceId,
    staffMember: appointment.staffMember,
    startTime: start,
    endTime: end,
    excludeId: appointment._id,
  });

  if (conflict) {
    return { rescheduled: false, conflict: true, message: `Slot conflict with existing booking at ${new Date(conflict.startTime).toLocaleTimeString()}.` };
  }

  appointment.startTime = start;
  appointment.endTime = end;
  appointment.status = 'rescheduled';
  await appointment.save();

  await logActivity({
    workspaceId,
    action: 'Rescheduled appointment via voice',
    category: 'appointments',
    customerName: appointment.customerName,
    detail: `Moved to ${start.toISOString()}`,
    linkedEntityId: appointment._id.toString(),
  });

  return { rescheduled: true, data: appointment.toObject() };
};

export const cancelAppointment = async ({ workspaceId, appointmentId, reason }) => {
  const appointment = await Appointment.findOne({ _id: appointmentId, workspaceId });
  if (!appointment) return { cancelled: false, message: 'Appointment not found.' };

  appointment.status = 'cancelled';
  appointment.notes = `${appointment.notes}\nCancelled via voice: ${reason || 'Customer request'}`.trim();
  await appointment.save();

  await logActivity({
    workspaceId,
    action: 'Cancelled appointment via voice',
    category: 'appointments',
    customerName: appointment.customerName,
    detail: `Reason: ${reason || 'Customer request'}`,
    linkedEntityId: appointment._id.toString(),
  });

  return { cancelled: true, data: appointment.toObject() };
};

// ---------------------------------------------------------------------------
// Conversation / Inbox Tools
// ---------------------------------------------------------------------------

export const getConversationHistory = async ({ workspaceId, userId, limit }) => {
  const conversations = await UnifiedConversation.find({
    workspaceId: workspaceId.toString(),
    user: userId,
    sourceApp: 'Buzzz Voice',
  })
    .sort({ lastMessageAt: -1 })
    .limit(limit || 5)
    .lean();

  return { count: conversations.length, conversations };
};

export const createVoiceConversation = async ({ workspaceId, userId, contactName, livekitRoomName }) => {
  const conversation = await UnifiedConversation.create({
    workspaceId: workspaceId.toString(),
    user: userId,
    sourceApp: 'Buzzz Voice',
    sourceAppIcon: 'Phone',
    contactName: contactName || 'Voice Caller',
    externalConversationId: livekitRoomName,
    lastMessage: 'Voice call started',
    lastMessageAt: new Date(),
    status: 'active',
  });

  return { created: true, conversationId: conversation._id.toString() };
};

export const saveVoiceMessage = async ({ workspaceId, userId, conversationId, direction, content, isAI }) => {
  const message = await UnifiedMessage.create({
    workspaceId: workspaceId.toString(),
    conversationId,
    user: userId,
    sourceApp: 'Buzzz Voice',
    direction,
    content,
    isAIReply: isAI || false,
    aiModel: isAI ? 'voice-agent' : '',
    messageType: 'text',
    deliveryStatus: 'delivered',
    externalMessageId: `voice-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
  });

  // Update conversation last message
  await UnifiedConversation.findByIdAndUpdate(conversationId, {
    lastMessage: content.substring(0, 200),
    lastMessageAt: new Date(),
  });

  return { saved: true, messageId: message._id.toString() };
};

// ---------------------------------------------------------------------------
// Knowledge Base Tools
// ---------------------------------------------------------------------------

export const searchKnowledge = async ({ workspaceId, query }) => {
  const sources = await KnowledgeSource.find({ status: 'indexed' });
  const qLower = (query || '').toLowerCase();
  const matches = [];

  for (const src of sources) {
    for (const chunk of src.chunks) {
      const cLower = chunk.content.toLowerCase();
      const words = qLower.split(/\s+/).filter((w) => w.length > 2);
      let matchScore = 0;
      for (const word of words) {
        if (cLower.includes(word)) matchScore += 1;
      }
      const confidence = words.length > 0 ? matchScore / words.length : 0;
      if (confidence >= 0.3) {
        matches.push({
          sourceTitle: src.title,
          heading: chunk.heading,
          passage: chunk.content,
          confidence: Math.round(confidence * 100),
        });
      }
    }
  }

  matches.sort((a, b) => b.confidence - a.confidence);
  return { count: matches.length, results: matches.slice(0, 3) };
};

// ---------------------------------------------------------------------------
// Escalation / Human Handoff Tools
// ---------------------------------------------------------------------------

export const createEscalation = async ({
  workspaceId,
  agentName,
  customerName,
  contactId,
  intent,
  issue,
  sentiment,
  history,
  actionsAttempted,
  recommendation,
}) => {
  const summary = [
    `Customer: ${customerName || 'Unknown'}`,
    `Intent: ${intent || 'Not determined'}`,
    `Issue: ${issue || 'Not specified'}`,
    `Sentiment: ${sentiment || 'neutral'}`,
    `History: ${history || 'None'}`,
    `Actions attempted: ${actionsAttempted || 'None'}`,
    `Recommendation: ${recommendation || 'Human review needed'}`,
  ].join('\n');

  const approval = await ApprovalItem.create({
    workspaceId,
    actionType: 'human_escalation',
    riskLevel: 'medium',
    requiredRole: 'manager',
    requestedByAgent: agentName || 'Buzzz Voice Agent',
    customerName: customerName || 'Voice Caller',
    contactId: contactId || undefined,
    channel: 'voice',
    proposedContent: summary,
    reasonForApproval: `Voice caller requested human assistance. ${issue || ''}`,
    status: 'pending',
    slaDueAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  await logActivity({
    workspaceId,
    action: 'Human escalation created via voice',
    category: 'approvals',
    customerName: customerName || 'Voice Caller',
    detail: `Escalation: ${issue || intent || 'Customer requested human agent'}`,
    outcome: 'pending_approval',
    linkedEntityId: approval._id.toString(),
  });

  return { created: true, escalationId: approval._id.toString(), summary };
};

export const handoffToHuman = async ({ workspaceId, agentName, customerName, contactId, reason, conversationSummary }) => {
  return createEscalation({
    workspaceId,
    agentName,
    customerName,
    contactId,
    intent: 'human_handoff',
    issue: reason || 'Customer requested to speak with a human',
    sentiment: 'neutral',
    actionsAttempted: conversationSummary || 'Voice conversation in progress',
    recommendation: 'Transfer to available human agent immediately',
  });
};

// ---------------------------------------------------------------------------
// Call Session Tools
// ---------------------------------------------------------------------------

export const createCallSession = async ({ workspaceId, customerName, customerPhone, contactId, agentName, livekitRoomName }) => {
  const session = await CallSession.create({
    workspaceId,
    providerCallId: livekitRoomName,
    direction: 'inbound',
    customerPhone: customerPhone || 'voice-web',
    customerName: customerName || 'Web Caller',
    contactId: contactId || undefined,
    agentName: agentName || 'Buzzz Voice Agent',
    status: 'answered',
  });

  await logActivity({
    workspaceId,
    action: 'Voice call started',
    category: 'calls',
    customerName: customerName || 'Web Caller',
    detail: `Voice session started in room ${livekitRoomName}`,
    linkedEntityId: session._id.toString(),
  });

  return { created: true, callSessionId: session._id.toString() };
};

export const endCallSession = async ({ callSessionId, transcripts, aiSummary, sentiment, callOutcome, durationSeconds }) => {
  const session = await CallSession.findById(callSessionId);
  if (!session) return { updated: false, message: 'Call session not found.' };

  session.status = 'ended';
  session.endedAt = new Date();
  session.durationSeconds = durationSeconds || 0;
  session.transcripts = transcripts || [];
  session.aiSummary = aiSummary || '';
  session.sentiment = sentiment || 'neutral';
  session.callOutcome = callOutcome || 'inquiry_answered';
  await session.save();

  await logActivity({
    workspaceId: session.workspaceId,
    action: 'Voice call ended',
    category: 'calls',
    customerName: session.customerName,
    detail: `Duration: ${durationSeconds || 0}s. Outcome: ${callOutcome || 'inquiry_answered'}. ${aiSummary || ''}`.substring(0, 300),
    linkedEntityId: session._id.toString(),
  });

  return { updated: true };
};

// ---------------------------------------------------------------------------
// Customer Context Loader
// ---------------------------------------------------------------------------

export const loadCustomerContext = async ({ workspaceId, userId }) => {
  const activeStatuses = ['awaiting_confirmation', 'confirmed', 'rescheduled'];

  const [contacts, leads, openTickets, upcomingAppointments, recentConversations] = await Promise.all([
    Contact.find({ workspaceId, ownerId: userId, archivedAt: { $exists: false } }).limit(5).lean(),
    CRMLead.find({ workspaceId, userId }).sort({ lastInteractionAt: -1 }).limit(5).lean(),
    Ticket.find({ workspaceId, status: { $in: ['open', 'pending'] } }).limit(5).lean(),
    Appointment.find({ workspaceId, status: { $in: activeStatuses }, startTime: { $gte: new Date() } })
      .sort({ startTime: 1 })
      .limit(5)
      .lean(),
    UnifiedConversation.find({ workspaceId: workspaceId.toString(), user: userId, sourceApp: 'Buzzz Voice' })
      .sort({ lastMessageAt: -1 })
      .limit(3)
      .lean(),
  ]);

  return {
    contacts,
    leads,
    openTickets,
    upcomingAppointments,
    recentConversations,
  };
};

export default {
  getCustomer,
  searchCustomer,
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
  getConversationHistory,
  createVoiceConversation,
  saveVoiceMessage,
  searchKnowledge,
  createEscalation,
  handoffToHuman,
  createCallSession,
  endCallSession,
  loadCustomerContext,
};

import CallSession from '../models/CallSession.js';
import Appointment from '../models/Appointment.js';
import StructuredActivity from '../models/StructuredActivity.js';
import MrAssistantVoiceConnector from '../services/connectors/mrassistant.js';

const voiceConnector = new MrAssistantVoiceConnector(process.env.MRASSISTANT_API_KEY, process.env.MRASSISTANT_WEBHOOK_SECRET);

export const getCallSessions = async (req, res) => {
  try {
    let calls = await CallSession.find().sort({ createdAt: -1 });

    if (calls.length === 0) {
      const seeded = [
        {
          providerCallId: 'mra_call_98124',
          direction: 'inbound',
          customerPhone: '+91 98407 22110',
          customerName: 'Arun Kumar',
          status: 'ended',
          durationSeconds: 142,
          recordingUrl: 'https://cdn.mrassistant.ai/recordings/demo_call_01.mp3',
          aiSummary: 'Customer inquired about enterprise SLA, pricing tiers, and booked a follow-up consultation with Dr. Emily Vance.',
          sentiment: 'positive',
          leadScoreChange: 25,
          callOutcome: 'appointment_booked',
          transcripts: [
            { speaker: 'agent', text: 'Thank you for calling Buzzz Enterprise. How may I direct your inquiry today?', timestampSeconds: 2 },
            { speaker: 'customer', text: 'Hi, I wanted to understand your multi-channel CRM pricing and book a consultation.', timestampSeconds: 6 },
            { speaker: 'agent', text: 'I would be delighted to assist! Our Growth tier starts at $129/mo with full WhatsApp integration. Would tomorrow at 11:00 AM suit you for a consultation?', timestampSeconds: 14 },
            { speaker: 'customer', text: 'Yes, 11 AM works perfectly for me.', timestampSeconds: 20 },
            { speaker: 'agent', text: 'Excellent, I have reserved that slot and dispatched your WhatsApp confirmation via GoWhats!', timestampSeconds: 26 },
          ],
        },
        {
          providerCallId: 'mra_call_98125',
          direction: 'outbound',
          customerPhone: '+1 415 892 1190',
          customerName: 'Sarah Tan',
          status: 'ended',
          durationSeconds: 88,
          aiSummary: 'Outbound qualification call regarding salon spa package. Customer requested WhatsApp price catalogue.',
          sentiment: 'positive',
          leadScoreChange: 15,
          callOutcome: 'lead_qualified',
          transcripts: [
            { speaker: 'agent', text: 'Hi Sarah, this is Voz from Vertex Wellness following up on your treatment request.', timestampSeconds: 2 },
            { speaker: 'customer', text: 'Hi! Could you send me the full package brochure on WhatsApp?', timestampSeconds: 8 },
            { speaker: 'agent', text: 'Certainly! Dispatched via GoWhats to this number right away.', timestampSeconds: 14 },
          ],
        },
      ];
      calls = await CallSession.insertMany(seeded);
    }

    res.json({ success: true, count: calls.length, data: calls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const placeOutboundCall = async (req, res) => {
  try {
    const { toPhone, customerName, context } = req.body;
    const result = await voiceConnector.placeOutboundCall({
      toPhone,
      customerName: customerName || 'Valued Lead',
      context,
    });

    const callSession = new CallSession({
      providerCallId: result.callId,
      direction: 'outbound',
      customerPhone: toPhone,
      customerName: customerName || 'Valued Lead',
      status: 'initiated',
      durationSeconds: 0,
      aiSummary: `Outbound AI call placed by MrAssistant.ai to ${customerName || toPhone}.`,
    });

    await callSession.save();

    await StructuredActivity.create({
      actor: 'Voz (Voice AI - MrAssistant.ai)',
      actorType: 'agent',
      mode: 'autonomous',
      action: 'Initiated Outbound Voice Call',
      category: 'calls',
      customerName: customerName || toPhone,
      detail: `Outbound call dialed to ${toPhone} via MrAssistant.ai voice connector.`,
      outcome: 'success',
      linkedEntityId: callSession._id.toString(),
    });

    res.json({ success: true, data: callSession });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const handleMrAssistantWebhook = async (req, res) => {
  try {
    const parsed = voiceConnector.parseCallCompletion(req.body);

    const callSession = await CallSession.findOneAndUpdate(
      { providerCallId: parsed.providerCallId },
      parsed,
      { upsert: true, new: true }
    );

    // If proposed action is appointment.book, auto-create appointment
    if (parsed.callOutcome === 'appointment_booked') {
      const appt = new Appointment({
        customerName: parsed.customerPhone,
        customerPhone: parsed.customerPhone,
        serviceName: 'Consultation',
        serviceDurationMinutes: 30,
        meetingType: 'in_person',
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 86400000 + 1800000),
        status: 'awaiting_confirmation',
        bookedBy: 'voice_call',
        agentName: 'Voz (Voice AI - MrAssistant.ai)',
      });
      await appt.save();
    }

    res.json({ success: true, message: 'MrAssistant.ai webhook processed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

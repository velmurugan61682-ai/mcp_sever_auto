import mongoose from 'mongoose';

const transcriptSegmentSchema = new mongoose.Schema({
  speaker: {
    type: String,
    enum: ['agent', 'customer', 'system'],
    default: 'agent',
  },
  text: {
    type: String,
    required: true,
  },
  timestampSeconds: {
    type: Number,
    default: 0,
  },
});

const callSessionSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
    },
    providerCallId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      default: 'inbound',
    },
    customerPhone: {
      type: String,
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      default: 'Unknown Caller',
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CRMLead',
    },
    agentName: {
      type: String,
      default: 'Voz (Voice AI - MrAssistant.ai)',
    },
    status: {
      type: String,
      enum: ['initiated', 'ringing', 'answered', 'ended', 'missed', 'failed'],
      default: 'initiated',
      index: true,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    recordingUrl: {
      type: String,
      default: '',
    },
    transcripts: [transcriptSegmentSchema],
    aiSummary: {
      type: String,
      default: '',
    },
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative', 'mixed'],
      default: 'neutral',
    },
    leadScoreChange: {
      type: Number,
      default: 0,
    },
    callOutcome: {
      type: String,
      enum: [
        'appointment_booked',
        'lead_qualified',
        'sale_completed',
        'followup_requested',
        'inquiry_answered',
        'escalated_to_human',
        'no_answer',
      ],
      default: 'inquiry_answered',
    },
    proposedActions: [
      {
        actionType: String,
        payload: mongoose.Schema.Types.Mixed,
        executed: { type: Boolean, default: false },
      },
    ],
    endedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export const CallSession = mongoose.model('CallSession', callSessionSchema);
export default CallSession;

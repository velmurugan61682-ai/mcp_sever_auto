import mongoose from 'mongoose';

const campaignRecipientSchema = new mongoose.Schema({
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CRMLead',
  },
  name: String,
  destination: String, // phone or email or social handle
  channel: String,
  status: {
    type: String,
    enum: ['queued', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'converted', 'failed', 'suppressed'],
    default: 'queued',
  },
  attemptCount: { type: Number, default: 0 },
  sentAt: Date,
  deliveredAt: Date,
  repliedAt: Date,
  failureReason: String,
});

const campaignSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['messaging', 'social', 'hybrid'],
      default: 'messaging',
    },
    channel: {
      type: String,
      enum: ['whatsapp', 'instagram', 'email', 'sms', 'telegram', 'multi'],
      default: 'whatsapp',
    },
    segmentTarget: {
      type: String,
      default: 'all_leads', // 'all_leads', 'qualified_leads', 'customers', 'requested_quote', 'custom'
    },
    messageTemplate: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'running', 'paused', 'completed', 'failed', 'cancelled'],
      default: 'draft',
      index: true,
      required: true,
    },
    scheduledFor: {
      type: Date,
    },
    sendRatePerMinute: {
      type: Number,
      default: 60,
    },
    enableFollowupSequence: {
      type: Boolean,
      default: true,
    },
    followupHours: {
      type: Number,
      default: 24,
    },
    recipients: [campaignRecipientSchema],
    metrics: {
      totalRecipients: { type: Number, default: 0 },
      sentCount: { type: Number, default: 0 },
      deliveredCount: { type: Number, default: 0 },
      repliedCount: { type: Number, default: 0 },
      convertedCount: { type: Number, default: 0 },
      failedCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export const Campaign = mongoose.model('Campaign', campaignSchema);
export default Campaign;


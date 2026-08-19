import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CRMLead',
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    customerEmail: {
      type: String,
      trim: true,
    },
    serviceName: {
      type: String,
      required: true,
      trim: true,
    },
    serviceDurationMinutes: {
      type: Number,
      default: 30,
    },
    servicePrice: {
      type: Number,
      default: 0,
    },
    meetingType: {
      type: String,
      enum: ['in_person', 'video', 'phone'],
      default: 'in_person',
    },
    locationName: {
      type: String,
      default: 'Main Branch',
    },
    locationAddress: {
      type: String,
      default: '',
    },
    roomName: {
      type: String,
      default: '',
    },
    staffMember: {
      type: String,
      default: 'Assigned Specialist',
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['awaiting_confirmation', 'confirmed', 'completed', 'rescheduled', 'cancelled', 'no_show'],
      default: 'awaiting_confirmation',
      index: true,
    },
    bookedBy: {
      type: String,
      enum: ['ai_agent', 'manual', 'voice_call', 'website', 'whatsapp'],
      default: 'ai_agent',
    },
    agentName: {
      type: String,
      default: 'Ana (Appointment Agent)',
    },
    confirmationChannel: {
      type: String,
      enum: ['whatsapp', 'sms', 'email', 'instagram'],
      default: 'whatsapp',
    },
    confirmationSentAt: Date,
    confirmationQueuedAt: Date,
    confirmationJobId: String,
    confirmationDeliveryStatus: {
      type: String,
      enum: ['pending', 'queued', 'sent', 'delivered', 'read', 'failed'],
      default: 'pending',
    },
    notes: {
      type: String,
      default: '',
    },
    sourceCallId: {
      type: String,
      default: null,
    },
    sourceConversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UnifiedConversation',
    },
    reservationExpiresAt: Date,
    reservationLockExpiresAt: Date,
  },
  { timestamps: true }
);

appointmentSchema.index({ workspaceId: 1, staffMember: 1, startTime: 1, status: 1 });
appointmentSchema.index({ workspaceId: 1, staffMember: 1, startTime: 1, endTime: 1 });
appointmentSchema.index({ workspaceId: 1, status: 1, startTime: 1 });

const activeStatuses = ['awaiting_confirmation', 'confirmed', 'rescheduled'];

appointmentSchema.statics.findOverlappingActive = function ({ workspaceId, staffMember, startTime, endTime, excludeId, session }) {
  const query = {
    workspaceId,
    staffMember,
    status: { $in: activeStatuses },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime }
  };

  if (excludeId) query._id = { $ne: excludeId };

  return this.findOne(query).session(session || null);
};

appointmentSchema.statics.reserveSlotAtomic = async function (appointmentData, options = {}) {
  const { workspaceId, staffMember, startTime, endTime } = appointmentData;
  const session = options.session || null;

  const existingConflict = await this.findOverlappingActive({ workspaceId, staffMember, startTime, endTime, session });

  if (existingConflict) {
    throw new Error(`Slot conflict: ${staffMember} is already booked from ${new Date(existingConflict.startTime).toLocaleTimeString()} to ${new Date(existingConflict.endTime).toLocaleTimeString()}.`);
  }

  const docs = await this.create([appointmentData], { session });
  return docs[0];
};

export const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;

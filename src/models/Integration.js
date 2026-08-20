import mongoose from 'mongoose';

const integrationSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true
    },
    provider: {
      type: String,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true
    },
    category: {
      type: String,
      default: 'general'
    },
    status: {
      type: String,
      enum: ['connected', 'not_connected', 'error', 'syncing', 'token_expired'],
      default: 'not_connected',
      index: true
    },
    credentials: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    cipherText: { type: String, default: '' },
    tag: { type: String, default: '' },
    iv: { type: String, default: '' },
    hint: { type: String, default: '' },
    lastConnected: Date,
    lastHealthCheck: Date,
    healthReason: String
  },
  { timestamps: true }
);

integrationSchema.index({ workspaceId: 1, provider: 1 }, { unique: true });

export const Integration = mongoose.models.Integration || mongoose.model('Integration', integrationSchema);
export default Integration;

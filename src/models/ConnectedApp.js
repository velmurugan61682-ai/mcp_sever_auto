import mongoose from 'mongoose';

const connectedAppSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    workspaceId: {
      type: String,
      default: 'default-workspace'
    },
    appId: {
      type: String,
      required: true
    },
    appName: {
      type: String,
      required: true
    },
    appIcon: {
      type: String,
      default: 'Globe'
    },
    provider: {
      type: String,
      default: 'custom'
    },
    connectionType: {
      type: String,
      enum: ['oauth', 'api_key', 'mcp', 'native'],
      default: 'api_key'
    },
    status: {
      type: String,
      enum: ['connected', 'disconnected', 'expired', 'error', 'configuration_required'],
      default: 'disconnected'
    },
    credentials: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    encryptedCredentials: {
      type: mongoose.Schema.Types.Mixed,
      select: false
    },
    scopes: [{ type: String }],
    unreadCount: {
      type: Number,
      default: 0
    },
    lastSyncAt: Date,
    lastError: String,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    isEnabled: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

connectedAppSchema.index({ userId: 1, appId: 1 }, { unique: true });

connectedAppSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.encryptedCredentials;
  return obj;
};

export const ConnectedApp = mongoose.models.ConnectedApp || mongoose.model('ConnectedApp', connectedAppSchema);

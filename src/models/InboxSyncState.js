import mongoose from 'mongoose';

const inboxSyncStateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    connectionId: {
      type: String,
      required: true,
      index: true
    },
    platform: {
      type: String,
      required: true,
      index: true
    },
    cursor: {
      type: String,
      default: ''
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now
    },
    lastEventId: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['idle', 'syncing', 'success', 'error'],
      default: 'idle'
    },
    lastError: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

inboxSyncStateSchema.index({ user: 1, platform: 1, connectionId: 1 }, { unique: true });

export const InboxSyncState = mongoose.models.InboxSyncState || mongoose.model('InboxSyncState', inboxSyncStateSchema);

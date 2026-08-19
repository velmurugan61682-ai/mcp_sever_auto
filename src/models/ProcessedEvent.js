import mongoose from 'mongoose';

const processedEventSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: String,
      required: true,
      index: true
    },
    appConnectionId: {
      type: String,
      required: true,
      index: true
    },
    externalEventId: {
      type: String,
      required: true,
      index: true
    },
    processedAt: {
      type: Date,
      default: Date.now,
      expires: '7d' // Automatically clean up entries after 7 days
    }
  },
  { timestamps: true }
);

// Unique compound key to prevent duplicates at DB level
processedEventSchema.index(
  { workspaceId: 1, appConnectionId: 1, externalEventId: 1 },
  { unique: true }
);

export const ProcessedEvent = mongoose.models.ProcessedEvent || mongoose.model('ProcessedEvent', processedEventSchema);

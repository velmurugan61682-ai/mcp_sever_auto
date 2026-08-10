import mongoose from 'mongoose';

const toolExecutionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation'
    },
    serverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MCPServer'
    },
    serverName: String,
    toolName: {
      type: String,
      required: true
    },
    args: mongoose.Schema.Types.Mixed,
    result: mongoose.Schema.Types.Mixed,
    status: {
      type: String,
      enum: ['success', 'error'],
      required: true
    },
    durationMs: Number,
    error: String
  },
  { timestamps: true }
);

export const ToolExecution = mongoose.model('ToolExecution', toolExecutionSchema);

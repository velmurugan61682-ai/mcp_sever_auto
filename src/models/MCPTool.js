import mongoose from 'mongoose';

const mcpToolSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    serverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MCPServer',
      required: true
    },
    serverName: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    inputSchema: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    requiredParams: [{ type: String }],
    enabled: {
      type: Boolean,
      default: true
    },
    executionCount: {
      type: Number,
      default: 0
    },
    successCount: {
      type: Number,
      default: 0
    },
    successRate: {
      type: Number,
      default: 100
    },
    lastUsedAt: Date
  },
  { timestamps: true }
);

mcpToolSchema.index({ userId: 1, serverId: 1, name: 1 }, { unique: true });

export const MCPTool = mongoose.model('MCPTool', mcpToolSchema);

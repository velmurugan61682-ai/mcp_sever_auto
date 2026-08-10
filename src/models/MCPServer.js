import mongoose from 'mongoose';

const mcpServerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    transportType: {
      type: String,
      enum: ['http', 'sse', 'stdio', 'rest'],
      default: 'http'
    },
    url: {
      type: String,
      default: ''
    },
    command: {
      type: String,
      default: ''
    },
    args: [{ type: String }],
    env: { type: mongoose.Schema.Types.Mixed, default: {} },
    headers: { type: mongoose.Schema.Types.Mixed, default: {} },
    enabled: {
      type: Boolean,
      default: true
    },
    autoReconnect: {
      type: Boolean,
      default: true
    },
    isBuiltin: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['connected', 'disconnected', 'error', 'connecting'],
      default: 'disconnected'
    },
    lastConnected: Date,
    lastError: String,
    tools: [
      {
        name: String,
        description: String,
        inputSchema: mongoose.Schema.Types.Mixed
      }
    ],
    resources: [
      {
        uri: String,
        name: String,
        description: String,
        mimeType: String
      }
    ],
    prompts: [
      {
        name: String,
        description: String,
        arguments: [mongoose.Schema.Types.Mixed]
      }
    ]
  },
  { timestamps: true }
);

export const MCPServer = mongoose.model('MCPServer', mcpServerSchema);

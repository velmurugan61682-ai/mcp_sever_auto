import mongoose from 'mongoose';

const mcpResourceSchema = new mongoose.Schema(
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
    uri: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      default: 'text/plain'
    },
    description: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

export const MCPResource = mongoose.model('MCPResource', mcpResourceSchema);

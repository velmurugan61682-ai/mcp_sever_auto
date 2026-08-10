import mongoose from 'mongoose';

const toolCallSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    args: mongoose.Schema.Types.Mixed,
    result: mongoose.Schema.Types.Mixed,
    status: {
      type: String,
      enum: ['pending', 'executing', 'success', 'error'],
      default: 'pending'
    },
    durationMs: Number,
    error: String
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system', 'tool'],
      required: true
    },
    content: {
      type: String,
      default: ''
    },
    toolCalls: [toolCallSchema],
    toolCallId: String,
    toolName: String,
    isError: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

export const Message = mongoose.model('Message', messageSchema);

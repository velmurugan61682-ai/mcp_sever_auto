import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      default: 'New Conversation'
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    systemPrompt: {
      type: String,
      default: ''
    },
    pinned: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

export const Conversation = mongoose.model('Conversation', conversationSchema);

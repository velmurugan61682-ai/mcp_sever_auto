import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema({
  heading: { type: String, default: 'General' },
  content: { type: String, required: true },
  page: { type: Number, default: 1 },
  tokenCount: { type: Number, default: 0 },
});

const knowledgeSourceSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['pdf', 'document', 'faq', 'website', 'catalog'],
      default: 'document',
    },
    rawContent: {
      type: String,
      default: '',
    },
    sourceUrl: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['queued', 'parsing', 'chunking', 'embedding', 'indexing', 'indexed', 'failed', 'stale'],
      default: 'indexed',
      index: true,
    },
    chunks: [chunkSchema],
    chunkCount: {
      type: Number,
      default: 0,
    },
    allowedAgentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agent',
      },
    ],
    authorityLevel: {
      type: Number,
      default: 1, // 1 to 5
    },
    lastIndexedAt: {
      type: Date,
      default: Date.now,
    },
    errorMessage: {
      type: String,
    },
  },
  { timestamps: true }
);

export const KnowledgeSource = mongoose.model('KnowledgeSource', knowledgeSourceSchema);
export default KnowledgeSource;

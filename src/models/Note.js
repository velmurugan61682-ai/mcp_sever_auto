import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    entityType: { type: String, enum: ['contact', 'company', 'deal', 'ticket', 'task'], required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    content: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    source: { type: String, enum: ['human', 'ai', 'workflow'], default: 'human' }
  },
  { timestamps: true }
);

noteSchema.index({ workspaceId: 1, entityType: 1, entityId: 1 });
noteSchema.index({ content: 'text' });

export const Note = mongoose.models.Note || mongoose.model('Note', noteSchema);
export default Note;

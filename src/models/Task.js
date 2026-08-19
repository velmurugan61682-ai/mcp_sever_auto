import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact', index: true },
    dealId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['open', 'done', 'cancelled', 'archived'], default: 'open', index: true },
    dueAt: Date,
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    source: { type: String, enum: ['human', 'ai', 'workflow'], default: 'human' },
    archivedAt: Date,
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

taskSchema.index({ workspaceId: 1, ownerId: 1, dueAt: 1 });
taskSchema.index({ workspaceId: 1, status: 1 });

export const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);
export default Task;

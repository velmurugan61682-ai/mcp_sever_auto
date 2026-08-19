import mongoose from 'mongoose';

const customFieldSchema = new mongoose.Schema({}, { _id: false, strict: false });

const contactSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    source: { type: String, trim: true, default: 'manual' },
    status: { type: String, enum: ['lead', 'customer', 'churned', 'archived'], default: 'lead', index: true },
    score: { type: Number, default: 0 },
    tags: [{ type: String, trim: true }],
    customFields: { type: customFieldSchema, default: {} },
    lastContactedAt: Date,
    archivedAt: Date,
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

contactSchema.index({ workspaceId: 1, email: 1 });
contactSchema.index({ workspaceId: 1, phone: 1 });
contactSchema.index({ workspaceId: 1, status: 1, ownerId: 1 });
contactSchema.index({ name: 'text', email: 'text', phone: 'text', tags: 'text' });

export const Contact = mongoose.models.Contact || mongoose.model('Contact', contactSchema);
export default Contact;

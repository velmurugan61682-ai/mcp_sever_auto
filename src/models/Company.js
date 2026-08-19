import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, required: true, trim: true },
    domain: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    industry: { type: String, trim: true, default: '' },
    size: { type: String, trim: true, default: '' },
    tags: [{ type: String, trim: true }],
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    archivedAt: Date,
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

companySchema.index({ workspaceId: 1, name: 1 });
companySchema.index({ workspaceId: 1, domain: 1 });

export const Company = mongoose.models.Company || mongoose.model('Company', companySchema);
export default Company;

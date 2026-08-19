import mongoose from 'mongoose';

const socialPostSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
    },
    caption: {
      type: String,
      required: true,
    },
    mediaUrls: [
      {
        type: String,
      },
    ],
    aiGeneratedImagePrompt: {
      type: String,
      default: '',
    },
    platforms: [
      {
        type: String,
        enum: ['instagram', 'facebook', 'linkedin', 'twitter', 'youtube', 'google_business', 'tiktok'],
      },
    ],
    platformVersions: {
      instagram: String,
      facebook: String,
      linkedin: String,
      twitter: String,
      youtube: String,
      google_business: String,
      tiktok: String,
    },
    contentPillar: {
      type: String,
      default: 'Product Spotlight',
    },
    status: {
      type: String,
      enum: ['draft', 'needs_approval', 'scheduled', 'publishing', 'published', 'failed'],
      default: 'draft',
      index: true,
    },
    scheduledFor: {
      type: Date,
      index: true,
    },
    publishedAt: {
      type: Date,
    },
    createdByAgent: {
      type: String,
      default: 'Sky (Social Media AI)',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectionReason: {
      type: String,
    },
    metrics: {
      reach: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      leadsCaptured: { type: Number, default: 0 },
    },
    campaignTag: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

export const SocialPost = mongoose.model('SocialPost', socialPostSchema);
export default SocialPost;

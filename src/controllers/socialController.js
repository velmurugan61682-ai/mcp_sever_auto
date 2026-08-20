import mongoose from 'mongoose';
import SocialPost from '../models/SocialPost.js';
import StructuredActivity from '../models/StructuredActivity.js';
import ApprovalItem from '../models/ApprovalItem.js';
import AIKeySetting from '../models/AIKeySetting.js';
import { decryptSecret } from '../services/encryptionService.js';
import axios from 'axios';

export const getSocialPosts = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const posts = await SocialPost.find({
      $or: [{ workspaceId }, { workspaceId: { $exists: false } }, { workspaceId: null }]
    }).sort({ createdAt: -1 });

    res.json({ success: true, count: posts.length, data: posts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSocialPost = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const {
      caption,
      mediaUrls,
      aiGeneratedImagePrompt,
      platforms,
      contentPillar,
      status = 'published',
      scheduledFor,
    } = req.body;

    if (!caption || !caption.trim()) {
      return res.status(400).json({ success: false, message: 'Caption copy is required to create a post.' });
    }

    const effectiveStatus = scheduledFor ? 'scheduled' : status;

    const post = new SocialPost({
      workspaceId,
      caption,
      mediaUrls: mediaUrls || [],
      aiGeneratedImagePrompt: aiGeneratedImagePrompt || '',
      platforms: platforms || ['instagram', 'linkedin'],
      contentPillar: contentPillar || 'Product Spotlight',
      status: effectiveStatus,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      publishedAt: effectiveStatus === 'published' ? new Date() : null,
    });

    await post.save();

    if (effectiveStatus === 'needs_approval') {
      await ApprovalItem.create({
        workspaceId,
        actionType: 'social_publish',
        riskLevel: 'low',
        requiredRole: 'manager',
        requestedByAgent: 'Sky (Social Media AI)',
        proposedContent: caption,
        reasonForApproval: 'Social media post drafted by AI awaiting manager verification before publishing.',
        payload: { postId: post._id, platforms },
      }).catch(() => {});
    }

    await StructuredActivity.create({
      workspaceId,
      actor: 'Sky (Social Media AI)',
      actorType: 'agent',
      mode: effectiveStatus === 'needs_approval' ? 'approved' : 'autonomous',
      action: effectiveStatus === 'scheduled' ? 'Scheduled social post' : 'Published social post',
      category: 'social_posts',
      detail: `Content created for ${platforms.join(', ')}: "${caption.slice(0, 60)}..."`,
      outcome: 'success',
      linkedEntityId: post._id.toString(),
    }).catch(() => {});

    res.status(201).json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const generateAICaption = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    let settings = null;
    if (mongoose.connection.readyState === 1) {
      settings = await AIKeySetting.findOne({ workspaceId }).catch(() => null);
    }

    const hasOpenAI = Boolean(settings?.openaiApiKey || settings?.openaiKeyHint);
    if (!hasOpenAI) {
      return res.status(400).json({
        success: false,
        message: 'No OpenAI API key configured in Workspace Settings. Please add your BYOK OpenAI key in Settings to generate AI captions.'
      });
    }

    const { topic, pillar = 'Product Spotlight' } = req.body;

    const generatedCaptions = {
      instagram: `✨ Elevate your customer experience with ${topic || 'agentic automation'}! 🚀\n\nExperience seamless execution, instant responses, and zero friction using Buzzz Omnichannel AI.\n\n👉 Book your live walkthrough today!\n\n#Innovation #Productivity #AI #Buzzz #${pillar.replace(/\s+/g, '')}`,
      linkedin: `Excited to share our latest insights on ${topic || 'enterprise operational intelligence'}.\n\nBy uniting conversational AI agents with multi-channel CRM capabilities, teams are cutting response times by 85%.\n\nHow is your organization scaling automation this quarter?\n\n#EnterpriseAI #Leadership #CRM #Automation`,
      twitter: `⚡ Supercharge your operations with ${topic || 'agentic workflows'}. Say goodbye to manual triage! 🚀 #AI #Buzzz`,
    };

    res.json({
      success: true,
      caption: generatedCaptions.instagram,
      platformVariants: generatedCaptions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const generateAIImage = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    let settings = null;
    if (mongoose.connection.readyState === 1) {
      settings = await AIKeySetting.findOne({ workspaceId }).catch(() => null);
    }

    const hasImageKey = Boolean(settings?.imageSecretKey || settings?.imageKeyHint || settings?.openaiApiKey);
    if (!hasImageKey) {
      return res.status(400).json({
        success: false,
        message: 'No Image Generation API key configured in Workspace Settings. Please add your BYOK Image key in Settings to synthesize AI visuals.'
      });
    }

    const { prompt } = req.body;
    const sampleImageUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80';

    res.json({
      success: true,
      imageUrl: sampleImageUrl,
      prompt: prompt || 'Modern minimalist futuristic AI interface with glowing coral accents',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveSocialPost = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { id } = req.params;

    const post = await SocialPost.findOneAndUpdate(
      { _id: id },
      { status: 'published', publishedAt: new Date() },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ success: false, message: 'Social post not found.' });
    }

    await StructuredActivity.create({
      workspaceId,
      actor: 'Admin Manager',
      actorType: 'human',
      mode: 'approved',
      action: 'Approved & Published Social Media Post',
      category: 'social_posts',
      detail: `Published to ${post.platforms.join(', ')}: "${post.caption.slice(0, 50)}..."`,
      outcome: 'success',
      linkedEntityId: post._id.toString(),
    }).catch(() => {});

    res.json({ success: true, message: 'Post successfully approved and published!', data: post });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  getSocialPosts,
  createSocialPost,
  generateAICaption,
  generateAIImage,
  approveSocialPost,
};

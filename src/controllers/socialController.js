import SocialPost from '../models/SocialPost.js';
import StructuredActivity from '../models/StructuredActivity.js';
import ApprovalItem from '../models/ApprovalItem.js';

export const getSocialPosts = async (req, res) => {
  try {
    const posts = await SocialPost.find().sort({ createdAt: -1 });
    res.json({ success: true, count: posts.length, data: posts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSocialPost = async (req, res) => {
  try {
    const {
      caption,
      mediaUrls,
      aiGeneratedImagePrompt,
      platforms,
      contentPillar,
      status = 'draft',
      scheduledFor,
    } = req.body;

    const post = new SocialPost({
      caption,
      mediaUrls: mediaUrls || [],
      aiGeneratedImagePrompt,
      platforms: platforms || ['instagram', 'linkedin'],
      contentPillar: contentPillar || 'Product Spotlight',
      status,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    });

    await post.save();

    if (status === 'needs_approval') {
      await ApprovalItem.create({
        actionType: 'social_publish',
        riskLevel: 'low',
        requiredRole: 'manager',
        requestedByAgent: 'Sky (Social Media AI)',
        proposedContent: caption,
        reasonForApproval: 'Social media post drafted by AI awaiting manager verification before publishing.',
        payload: { postId: post._id, platforms },
      });
    }

    await StructuredActivity.create({
      actor: 'Sky (Social Media AI)',
      actorType: 'agent',
      mode: status === 'needs_approval' ? 'approved' : 'autonomous',
      action: status === 'scheduled' ? 'Scheduled social post' : 'Drafted social content',
      category: 'social_posts',
      detail: `Content created for ${platforms.join(', ')}: "${caption.slice(0, 60)}..."`,
      outcome: 'success',
      linkedEntityId: post._id.toString(),
    });

    res.status(201).json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const generateAICaption = async (req, res) => {
  try {
    const { topic, pillar = 'Product Spotlight', tone = 'engaging' } = req.body;

    const generatedCaptions = {
      instagram: `✨ Elevate your everyday workflow with our latest breakthrough in ${topic || 'intelligent automation'}! 🚀\n\nExperience seamless execution, instant AI responses, and zero friction.\n\n👉 Tap the link in bio to book your live walkthrough!\n\n#Innovation #Productivity #AI #Buzzz #Growth`,
      linkedin: `Excited to announce our latest milestone in ${topic || 'enterprise operational intelligence'}.\n\nBy uniting conversational agents with multi-channel CRM capabilities, businesses are cutting response times by 85% while boosting customer satisfaction.\n\nHow is your organization approaching agentic workflows this quarter? Let's discuss in the comments below.\n\n#EnterpriseAI #Leadership #CRM #Automation`,
      twitter: `⚡ Supercharge your operations with ${topic || 'agentic automation'}. Say goodbye to manual triage and hello to instant customer resolution. 🚀 #AI #Buzzz`,
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
    const { prompt } = req.body;
    // Return high quality curated SVG / URL asset representation
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
    const { id } = req.params;
    const post = await SocialPost.findByIdAndUpdate(
      id,
      { status: 'published', publishedAt: new Date() },
      { new: true }
    );

    await StructuredActivity.create({
      actor: 'Admin Manager',
      actorType: 'human',
      mode: 'approved',
      action: 'Approved & Published Social Media Post',
      category: 'social_posts',
      detail: `Published to ${post.platforms.join(', ')}: "${post.caption.slice(0, 50)}..."`,
      outcome: 'success',
      linkedEntityId: post._id.toString(),
    });

    res.json({ success: true, message: 'Post successfully approved and published!', data: post });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

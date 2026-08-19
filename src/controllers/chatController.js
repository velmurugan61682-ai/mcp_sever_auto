import { UnifiedConversation } from '../models/UnifiedConversation.js';
import { UnifiedMessage } from '../models/UnifiedMessage.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { ConnectedApp } from '../models/ConnectedApp.js';
import { AuditLog } from '../models/AuditLog.js';
import { processChatMessageWithDeepSeek } from '../services/deepseekService.js';
import { asyncWrapper } from '../utils/asyncWrapper.js';

const createLocalExternalId = (type, userId) =>
  `local-${type}-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// Initial seed conversations for genuine connected platforms only
const SEED_CONVERSATIONS = [
  {
    sourceApp: 'WhatsApp',
    sourceAppIcon: 'MessageCircle',
    contactName: 'Arun Kumar',
    contactAvatar: '',
    lastMessage: 'Hey! Is the MCP server connection ready for our team demo today?',
    readOnly: false,
    online: true,
    initialMessages: [
      { direction: 'incoming', senderExternalId: 'arun', content: 'Hi there! We are evaluating MCP.ai for our sales workflow.' },
      { direction: 'incoming', senderExternalId: 'arun', content: 'Hey! Is the MCP server connection ready for our team demo today?' }
    ]
  },
  {
    sourceApp: 'Gmail',
    sourceAppIcon: 'Mail',
    contactName: 'Dhanush',
    contactAvatar: '',
    lastMessage: 'Weekly sync summary attached. Let us know if you need additional access.',
    readOnly: true,
    online: false,
    initialMessages: [
      { direction: 'incoming', senderExternalId: 'dhanush', content: 'Weekly sync summary attached. Let us know if you need additional access.' }
    ]
  },
  {
    sourceApp: 'Slack',
    sourceAppIcon: 'MessageSquare',
    contactName: 'MCP Development Team',
    contactAvatar: '',
    lastMessage: 'Can you trigger the MongoDB tool execution for client accounts?',
    readOnly: false,
    online: true,
    initialMessages: [
      { direction: 'incoming', senderExternalId: 'slack-team', content: 'Can you trigger the MongoDB tool execution for client accounts?' }
    ]
  },
  {
    sourceApp: 'channelbot.in',
    sourceAppIcon: 'Globe',
    contactName: 'ChannelBot Lead #42',
    contactAvatar: '',
    lastMessage: 'New lead response received via ChannelBot REST API webhook.',
    readOnly: false,
    online: true,
    initialMessages: [
      { direction: 'incoming', senderExternalId: 'channelbot-lead', content: 'New lead response received via ChannelBot REST API webhook.' }
    ]
  },
  {
    sourceApp: 'YouTube',
    sourceAppIcon: 'Video',
    contactName: 'TechViewer (YouTube Comment)',
    contactAvatar: '',
    lastMessage: 'Awesome video! How do I connect ChannelBot API with YouTube auto comments?',
    readOnly: false,
    online: true,
    initialMessages: [
      { direction: 'incoming', senderExternalId: 'youtube-viewer', content: 'Hey! Loved the video demonstration on MCP AI!' },
      { direction: 'incoming', senderExternalId: 'youtube-viewer', content: 'Awesome video! How do I connect ChannelBot API with YouTube auto comments?' }
    ]
  }
];

// Helper to seed initial conversations for user if empty or missing platform threads
const ensureUserConversationsSeeded = async (userId) => {
  // Clean up any existing MCP.ai Assistant items from conversation list
  await UnifiedConversation.deleteMany({
    user: userId,
    $or: [{ sourceApp: 'MCP.ai Assistant' }, { contactName: 'MCP.ai Assistant' }]
  });

  for (const seed of SEED_CONVERSATIONS) {
    const existing = await UnifiedConversation.findOne({ user: userId, sourceApp: seed.sourceApp });
    if (!existing) {
      const conv = await UnifiedConversation.create({
        workspaceId: 'default-workspace',
        user: userId,
        sourceApp: seed.sourceApp,
        sourceAppIcon: seed.sourceAppIcon,
        contactName: seed.contactName,
        contactAvatar: seed.contactAvatar,
        lastMessage: seed.lastMessage,
        readOnly: seed.readOnly,
        online: seed.online,
        unreadCount: seed.sourceApp === 'WhatsApp' || seed.sourceApp === 'channelbot.in' ? 1 : 0,
        lastMessageAt: new Date()
      });

      for (const m of seed.initialMessages) {
        await UnifiedMessage.create({
          workspaceId: 'default-workspace',
          conversationId: conv._id,
          user: userId,
          sourceApp: seed.sourceApp,
          direction: m.direction,
          senderExternalId: m.senderExternalId,
          content: m.content,
          sentAt: new Date(),
          deliveryStatus: 'delivered'
        });
      }
    }
  }
};

// GET /api/conversations (or /api/chat/conversations)
export const getConversations = asyncWrapper(async (req, res) => {
  await ensureUserConversationsSeeded(req.user._id);

  const conversations = await UnifiedConversation.find({
    user: req.user._id,
    sourceApp: { $ne: 'MCP.ai Assistant' },
    contactName: { $ne: 'MCP.ai Assistant' }
  }).sort({ lastMessageAt: -1, updatedAt: -1 });

  res.status(200).json({ success: true, count: conversations.length, conversations });
});

// POST /api/conversations
export const createConversation = asyncWrapper(async (req, res) => {
  const { title, sourceApp, contactName } = req.body;

  const conversation = await UnifiedConversation.create({
    workspaceId: 'default-workspace',
    user: req.user._id,
    sourceApp: sourceApp || 'WhatsApp',
    sourceAppIcon: 'MessageCircle',
    contactName: contactName || title || 'New Contact',
    externalConversationId: createLocalExternalId('conversation', req.user._id),
    lastMessage: 'Conversation started',
    lastMessageAt: new Date()
  });

  res.status(201).json({ success: true, conversation });
});

// GET /api/conversations/:id
export const getConversationById = asyncWrapper(async (req, res) => {
  const conversation = await UnifiedConversation.findOne({ _id: req.params.id, user: req.user._id });
  if (!conversation) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }

  // Reset unread count on view
  if (conversation.unreadCount > 0) {
    conversation.unreadCount = 0;
    await conversation.save();
  }

  const messages = await UnifiedMessage.find({ conversationId: req.params.id }).sort({ createdAt: 1 });

  res.status(200).json({
    success: true,
    conversation,
    messages
  });
});

// PATCH /api/conversations/:id
export const updateConversation = asyncWrapper(async (req, res) => {
  const { title, contactName, isAutoReplyEnabled, status } = req.body;

  const updateData = {};
  if (title || contactName) updateData.contactName = contactName || title;
  if (isAutoReplyEnabled !== undefined) updateData.isAutoReplyEnabled = isAutoReplyEnabled;
  if (status !== undefined) updateData.status = status;

  const conversation = await UnifiedConversation.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    updateData,
    { new: true }
  );

  if (!conversation) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }

  res.status(200).json({ success: true, conversation });
});

// DELETE /api/conversations/:id
export const deleteConversation = asyncWrapper(async (req, res) => {
  const conversation = await UnifiedConversation.findOneAndDelete({ _id: req.params.id, user: req.user._id });

  if (!conversation) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }

  await UnifiedMessage.deleteMany({ conversationId: req.params.id });

  res.status(200).json({ success: true, message: 'Conversation deleted successfully' });
});

// POST /api/chat/message
export const sendMessage = asyncWrapper(async (req, res) => {
  const { conversationId, content, isAIReply, aiModel } = req.body;

  if (!conversationId || !content) {
    return res.status(400).json({ success: false, message: 'Conversation ID and message content are required' });
  }

  const conversation = await UnifiedConversation.findOne({ _id: conversationId, user: req.user._id });
  if (!conversation) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }

  // Validate read-only status
  if (conversation.readOnly) {
    return res.status(400).json({
      success: false,
      message: 'This connected app currently supports read-only messaging.'
    });
  }

  // Create outgoing message
  const outgoingMessage = await UnifiedMessage.create({
    workspaceId: 'default-workspace',
    conversationId,
    user: req.user._id,
    sourceApp: conversation.sourceApp,
    direction: 'outgoing',
    content: content.trim(),
    externalMessageId: createLocalExternalId('message', req.user._id),
    isAIReply: !!isAIReply,
    aiModel: aiModel || '',
    sentAt: new Date(),
    deliveryStatus: 'delivered'
  });

  // Update conversation lastMessage & move to top
  conversation.lastMessage = content.trim();
  conversation.lastMessageAt = new Date();
  await conversation.save();

  // Log Audit
  await AuditLog.create({
    userId: req.user._id,
    workspaceId: req.auth?.workspaceId,
    action: isAIReply ? 'AI_REPLY_SENT' : 'MANUAL_MESSAGE_SENT',
    category: 'app_connection',
    details: { conversationId, sourceApp: conversation.sourceApp, isAIReply: !!isAIReply }
  });

  res.status(200).json({
    success: true,
    message: outgoingMessage
  });
});

// POST /api/chat/generate-reply (AI Draft Reply Generator)
export const generateAIReply = asyncWrapper(async (req, res) => {
  const { conversationId } = req.body;

  if (!conversationId) {
    return res.status(400).json({ success: false, message: 'Conversation ID required' });
  }

  const conversation = await UnifiedConversation.findOne({ _id: conversationId, user: req.user._id });
  if (!conversation) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }

  const recentMessages = await UnifiedMessage.find({ conversationId }).sort({ createdAt: -1 }).limit(5);
  const lastIncoming = recentMessages.find((m) => m.direction === 'incoming');

  const incomingText = lastIncoming ? lastIncoming.content : conversation.lastMessage;
  const lower = incomingText.toLowerCase();

  let draftReply = 'Thank you for reaching out! I will review this and get back to you shortly.';
  let suggestions = [
    'Thank you! I will check and get back to you.',
    'Yes, that is available.',
    'Could you please share more details?'
  ];

  if (lower.includes('demo') || lower.includes('ready')) {
    draftReply = 'Yes, our team demo is ready. I can share the connection parameters with you now!';
    suggestions = [
      'Yes, our team demo is ready.',
      'Can we reschedule to 3 PM?',
      'Let me send over the documentation.'
    ];
  } else if (lower.includes('mongodb') || lower.includes('tool')) {
    draftReply = 'I can trigger the MongoDB MCP tool execution for client accounts right away.';
    suggestions = [
      'Triggering the tool now.',
      'Please confirm client account ID.',
      'Here are the tool logs.'
    ];
  }

  res.status(200).json({
    success: true,
    draftReply,
    suggestions
  });
});

// POST /api/chat/regenerate
export const regenerateMessage = asyncWrapper(async (req, res) => {
  const { conversationId, conversationMode } = req.body;

  if (!conversationId) {
    return res.status(400).json({ success: false, message: 'Conversation ID required' });
  }

  const lastUserMsg = await UnifiedMessage.findOne({ conversationId, direction: 'outgoing' }).sort({ createdAt: -1 });

  if (!lastUserMsg) {
    return res.status(400).json({ success: false, message: 'No prior user message to regenerate' });
  }

  let legacyConv = await Conversation.findOne({ user: req.user._id });
  if (!legacyConv) {
    legacyConv = await Conversation.create({ user: req.user._id, title: 'AI Assistant' });
  }

  const assistantMessage = await processChatMessageWithDeepSeek({
    userId: req.user._id,
    conversationId: legacyConv._id,
    userMessageText: lastUserMsg.content,
    additionalSystemPrompt:
      conversationMode === 'natural-voice'
        ? 'This is a natural voice conversation. Reply in the same language, script, and natural language mix as the user. Keep most replies to one to three warm, conversational sentences. Never echo the user unless they explicitly ask you to repeat something. Ask one short clarification question when needed. Do not claim an MCP action succeeded until a real tool result confirms it.'
        : ''
  });

  await UnifiedMessage.create({
    workspaceId: 'default-workspace',
    conversationId,
    user: req.user._id,
    sourceApp: 'WhatsApp',
    direction: 'incoming',
    content: assistantMessage.content,
    isAIReply: true,
    aiModel: 'deepseek-chat',
    toolCalls: assistantMessage.toolCalls || [],
    sentAt: new Date(),
    deliveryStatus: 'delivered'
  });

  res.status(200).json({
    success: true,
    message: assistantMessage
  });
});


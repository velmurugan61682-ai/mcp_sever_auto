export const APP_REGISTRY = [
  {
    appId: 'gmail',
    appName: 'Gmail',
    provider: 'google',
    connectionType: 'oauth',
    appIcon: 'Mail',
    description: 'Read email threads, draft replies, search messages, and manage inbox label filters.',
    requiredPermissions: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
    requiresConfig: true,
    configFields: [
      { name: 'clientId', label: 'OAuth Client ID', type: 'text', required: true },
      { name: 'clientSecret', label: 'OAuth Client Secret', type: 'password', required: true }
    ]
  },
  {
    appId: 'slack',
    appName: 'Slack',
    provider: 'slack',
    connectionType: 'oauth',
    appIcon: 'MessageCircle',
    description: 'Interact with channels, send messages, inspect thread replies, and monitor webhooks.',
    requiredPermissions: ['channels:read', 'chat:write', 'users:read'],
    requiresConfig: true,
    configFields: [
      { name: 'botToken', label: 'Slack Bot User Token (xoxb-...)', type: 'password', required: true }
    ]
  },
  {
    appId: 'github',
    appName: 'GitHub',
    provider: 'github',
    connectionType: 'oauth',
    appIcon: 'GitBranch',
    description: 'Inspect repositories, query issues, review pull requests, and automate commit workflows.',
    requiredPermissions: ['repo', 'read:user', 'workflow'],
    requiresConfig: true,
    configFields: [
      { name: 'personalAccessToken', label: 'Personal Access Token', type: 'password', required: true }
    ]
  },
  {
    appId: 'linkedin',
    appName: 'LinkedIn',
    provider: 'linkedin',
    connectionType: 'oauth',
    appIcon: 'Share2',
    description: 'Fetch channel statistics, draft professional posts, and monitor company page engagement.',
    requiredPermissions: ['w_member_social', 'r_liteprofile'],
    requiresConfig: true,
    configFields: [
      { name: 'accessToken', label: 'LinkedIn Access Token', type: 'password', required: true }
    ]
  },
  {
    appId: 'whatsapp',
    appName: 'WhatsApp',
    provider: 'meta',
    connectionType: 'api_key',
    appIcon: 'MessageSquare',
    description: 'Automate WhatsApp conversations, broadcast campaigns, and omnichannel bot messaging via API.',
    requiredPermissions: ['whatsapp_business_messaging'],
    requiresConfig: true,
    configFields: [
      { name: 'permanentToken', label: 'Meta WhatsApp Business Token', type: 'password', required: true }
    ]
  },
  {
    appId: 'channelbot.in',
    appName: 'channelbot.in',
    provider: 'channelbot',
    connectionType: 'webhook_api',
    appIcon: 'channelbot',
    logoUrl: '/channelbot-logo.png',
    description: 'AI-powered YouTube comment automation, channel moderation, and omnichannel lead bot.',
    requiredPermissions: ['read_comments', 'auto_reply', 'webhook_receive', 'channel_analytics'],
    requiresConfig: true,
    configFields: [
      { name: 'apiKey', label: 'ChannelBot API Key / Webhook Secret', type: 'password', required: true },
      { name: 'channelId', label: 'YouTube Channel ID', type: 'text', required: false }
    ]
  },
  {
    appId: 'instagram',
    appName: 'Instagram',
    provider: 'meta',
    connectionType: 'oauth',
    appIcon: 'Camera',
    description: 'Inspect media metrics, read post comments, draft captions, and view audience insights.',
    requiredPermissions: ['instagram_basic', 'instagram_manage_comments'],
    requiresConfig: true,
    configFields: [
      { name: 'accessToken', label: 'Instagram Graph Token', type: 'password', required: true }
    ]
  },
  {
    appId: 'custom_rest',
    appName: 'Custom REST API',
    provider: 'rest',
    connectionType: 'api_key',
    appIcon: 'Globe',
    description: 'Connect any external REST API endpoint with custom authorization headers and JSON schemas.',
    requiredPermissions: ['http_request', 'custom_headers'],
    requiresConfig: true,
    configFields: [
      { name: 'endpointUrl', label: 'Base API URL', type: 'url', required: true },
      { name: 'apiKey', label: 'Authorization Token / API Key', type: 'password', required: false }
    ]
  },
  {
    appId: 'custom_mcp',
    appName: 'Custom MCP Server',
    provider: 'mcp',
    connectionType: 'mcp',
    appIcon: 'Cpu',
    description: 'Built-in Model Context Protocol server exposing real-time tools, resources, and prompt templates.',
    requiredPermissions: ['list_tools', 'call_tools', 'read_resources'],
    requiresConfig: false,
    configFields: []
  }
];

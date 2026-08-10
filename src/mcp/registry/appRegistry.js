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
    appId: 'gcalendar',
    appName: 'Google Calendar',
    provider: 'google',
    connectionType: 'oauth',
    appIcon: 'Calendar',
    description: 'Schedule events, inspect availability, set reminders, and query upcoming meetings.',
    requiredPermissions: ['https://www.googleapis.com/auth/calendar.events'],
    requiresConfig: true,
    configFields: [
      { name: 'clientId', label: 'OAuth Client ID', type: 'text', required: true }
    ]
  },
  {
    appId: 'gdrive',
    appName: 'Google Drive',
    provider: 'google',
    connectionType: 'oauth',
    appIcon: 'HardDrive',
    description: 'Search documents, read spreadsheets, list folder contents, and analyze cloud files.',
    requiredPermissions: ['https://www.googleapis.com/auth/drive.readonly'],
    requiresConfig: true,
    configFields: [
      { name: 'clientId', label: 'OAuth Client ID', type: 'text', required: true }
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
    appId: 'notion',
    appName: 'Notion',
    provider: 'notion',
    connectionType: 'api_key',
    appIcon: 'FileText',
    description: 'Query database tables, create documents, inspect page hierarchies, and update tasks.',
    requiredPermissions: ['read_content', 'write_content'],
    requiresConfig: true,
    configFields: [
      { name: 'integrationToken', label: 'Notion Internal Integration Token', type: 'password', required: true }
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
    appId: 'youtube',
    appName: 'YouTube',
    provider: 'google',
    connectionType: 'oauth',
    appIcon: 'Youtube',
    description: 'Fetch video analytics, list playlists, moderate comments, and track channel metrics.',
    requiredPermissions: ['https://www.googleapis.com/auth/youtube.readonly'],
    requiresConfig: true,
    configFields: [
      { name: 'apiKey', label: 'YouTube Data API Key', type: 'password', required: true }
    ]
  },
  {
    appId: 'tiktok',
    appName: 'TikTok',
    provider: 'tiktok',
    connectionType: 'oauth',
    appIcon: 'Video',
    description: 'Fetch channel analytics, published video statistics, comments, and publish video captions.',
    requiredPermissions: ['user.info.basic', 'video.list'],
    requiresConfig: true,
    configFields: [
      { name: 'accessToken', label: 'TikTok Access Token', type: 'password', required: true }
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
    appId: 'facebook',
    appName: 'Facebook',
    provider: 'meta',
    connectionType: 'oauth',
    appIcon: 'Facebook',
    description: 'Manage Facebook Page posts, inspect feed comments, and query advertising insights.',
    requiredPermissions: ['pages_read_engagement', 'pages_manage_posts'],
    requiresConfig: true,
    configFields: [
      { name: 'pageAccessToken', label: 'Page Access Token', type: 'password', required: true }
    ]
  },
  {
    appId: 'twitter',
    appName: 'X/Twitter',
    provider: 'twitter',
    connectionType: 'oauth',
    appIcon: 'Twitter',
    description: 'Monitor mentions, search tweets, draft posts, and track follower analytics via Twitter API v2.',
    requiredPermissions: ['tweet.read', 'tweet.write', 'users.read'],
    requiresConfig: true,
    configFields: [
      { name: 'bearerToken', label: 'Twitter API v2 Bearer Token', type: 'password', required: true }
    ]
  },
  {
    appId: 'channelbot.in',
    appName: 'channelbot.in',
    provider: 'channelbot',
    connectionType: 'api_key',
    appIcon: 'Bot',
    description: 'WhatsApp & Omnichannel Bot Platform Connector for customer broadcasts and bot triggers.',
    requiredPermissions: ['read_messages', 'send_broadcasts'],
    requiresConfig: true,
    configFields: [
      { name: 'apiKey', label: 'ChannelBot API Key', type: 'password', required: true }
    ]
  },
  {
    appId: 'mongoose',
    appName: 'MongoDB',
    provider: 'mongodb',
    connectionType: 'native',
    appIcon: 'Database',
    description: 'Direct MongoDB database inspector & query engine for notes, tool executions, and data schemas.',
    requiredPermissions: ['read_schema', 'query_collections', 'write_documents'],
    requiresConfig: false,
    configFields: []
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

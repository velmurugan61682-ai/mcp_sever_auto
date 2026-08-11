export const APP_REGISTRY = [
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

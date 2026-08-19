import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  clientUrl: process.env.CLIENT_URL || 'https://mcp-client-auto.vercel.app',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mcp_ai',
  jwtSecret: process.env.JWT_SECRET || 'mcp_ai_super_secret_jwt_key_2026_change_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  redisUrl: process.env.REDIS_URL || '',
  encryptionMasterKey: process.env.ENCRYPTION_MASTER_KEY || '',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  mcpServerUrl: process.env.MCP_SERVER_URL || 'http://localhost:5000/mcp',
  nodeEnv: process.env.NODE_ENV || 'development',
  livekitUrl: process.env.LIVEKIT_URL || '',
  livekitApiKey: process.env.LIVEKIT_API_KEY || '',
  livekitApiSecret: process.env.LIVEKIT_API_SECRET || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  gowhatsApiUrl: process.env.GOWHATS_API_URL || '',
  gowhatsApiKey: process.env.GOWHATS_API_KEY || '',
  gowhatsWebhookSecret: process.env.GOWHATS_WEBHOOK_SECRET || '',
  instaxbotApiUrl: process.env.INSTAXBOT_API_URL || '',
  instaxbotApiKey: process.env.INSTAXBOT_API_KEY || '',
  instaxbotWebhookSecret: process.env.INSTAXBOT_WEBHOOK_SECRET || '',
  mrassistantApiUrl: process.env.MRASSISTANT_API_URL || '',
  mrassistantApiKey: process.env.MRASSISTANT_API_KEY || '',
  mrassistantWebhookSecret: process.env.MRASSISTANT_WEBHOOK_SECRET || ''
};

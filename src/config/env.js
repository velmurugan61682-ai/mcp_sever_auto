import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mcp_ai',
  jwtSecret: process.env.JWT_SECRET || 'mcp_ai_super_secret_jwt_key_2026_change_in_production',
  jwtExpiresIn: '7d',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  mcpServerUrl: process.env.MCP_SERVER_URL || 'http://localhost:5000/mcp',
  nodeEnv: process.env.NODE_ENV || 'development'
};

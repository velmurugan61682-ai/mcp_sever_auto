import axios from 'axios';
import { User } from '../models/User.js';
import { ConnectedApp } from '../models/ConnectedApp.js';
const AppConnection = ConnectedApp;
import { AuditLog } from '../models/AuditLog.js';

// Get or test ChannelBot users
export const getChannelBotUsers = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Check if channelbot key exists in user settings or app connection
    let apiKey = process.env.CHANNELBOT_API_KEY;
    const authHeaderName = process.env.CHANNELBOT_AUTH_HEADER || 'x-api-key';
    const baseUrl = process.env.CHANNELBOT_API_BASE_URL || 'https://server-youtube-auto.onrender.com';

    // Try finding AppConnection credentials
    const conn = await AppConnection.findOne({ userId, appId: 'channelbot' }).select('+encryptedCredentials');
    if (conn && conn.encryptedCredentials?.apiKey) {
      apiKey = conn.encryptedCredentials.apiKey;
    }

    // Override with request headers/query if provided during test connection
    const customKey = req.headers['x-channelbot-key'] || req.query.apiKey;
    if (customKey) {
      apiKey = customKey;
    }

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'ChannelBot API Key is missing. Please configure it in Settings or Apps Connector.'
      });
    }

    const headers = {
      [authHeaderName]: apiKey,
      'Content-Type': 'application/json'
    };

    const targetUrl = `${baseUrl.replace(/\/$/, '')}/api/external/users`;

    const response = await axios.get(targetUrl, {
      headers,
      timeout: 10000
    });

    // Log audit
    await AuditLog.create({
      userId,
      action: 'CHANNELBOT_FETCH_USERS',
      category: 'app_connection',
      details: { count: Array.isArray(response.data) ? response.data.length : 1 }
    });

    return res.status(200).json({
      success: true,
      data: response.data,
      count: Array.isArray(response.data) ? response.data.length : 1
    });
  } catch (error) {
    const statusCode = error.response?.status || 500;
    let message = 'Failed to fetch ChannelBot users.';

    if (statusCode === 401) {
      message = 'Invalid API key (401 Unauthorized). Please check your ChannelBot API Key.';
    } else if (statusCode === 403) {
      message = 'Access forbidden (403 Forbidden). You do not have permission to access ChannelBot external API.';
    } else if (statusCode === 404) {
      message = 'Endpoint not found (404 Not Found). ChannelBot endpoint /api/external/users does not exist.';
    } else if (statusCode === 429) {
      message = 'Rate limit exceeded (429 Too Many Requests). Please try again later.';
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      message = 'ChannelBot API request timed out. Render instance may be sleeping or unreachable.';
    } else if (error.response?.data?.message) {
      message = error.response.data.message;
    }

    return res.status(statusCode).json({
      success: false,
      message,
      status: statusCode,
      errorDetails: error.message
    });
  }
};

// Save ChannelBot Credentials
export const saveChannelBotConfig = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { apiKey, baseUrl } = req.body;

    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'API Key is required.' });
    }

    let conn = await AppConnection.findOne({ userId, appId: 'channelbot' });
    if (!conn) {
      conn = new AppConnection({
        userId,
        appId: 'channelbot',
        appName: 'ChannelBot',
        appIcon: 'Bot',
        provider: 'channelbot',
        connectionType: 'api_key',
        status: 'connected',
        encryptedCredentials: { apiKey, baseUrl },
        lastSyncAt: new Date()
      });
    } else {
      conn.encryptedCredentials = { apiKey, baseUrl };
      conn.status = 'connected';
      conn.lastSyncAt = new Date();
    }

    await conn.save();

    await AuditLog.create({
      userId,
      action: 'CHANNELBOT_CONFIG_SAVED',
      category: 'app_connection'
    });

    return res.status(200).json({
      success: true,
      message: 'ChannelBot API credentials saved securely.'
    });
  } catch (error) {
    next(error);
  }
};

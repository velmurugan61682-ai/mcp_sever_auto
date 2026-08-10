import axios from 'axios';

export const channelbotToolDefinition = {
  name: 'get_channelbot_users',
  description: 'Fetch latest users from ChannelBot external API endpoint',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of users to retrieve (default: 10)'
      }
    }
  }
};

export const executeChannelbotTool = async (args, userId) => {
  const apiKey = process.env.CHANNELBOT_API_KEY;
  const baseUrl = process.env.CHANNELBOT_API_BASE_URL || 'https://server-youtube-auto.onrender.com';
  const authHeader = process.env.CHANNELBOT_AUTH_HEADER || 'x-api-key';

  if (!apiKey) {
    return {
      success: false,
      message: 'ChannelBot API key is not configured. Please set CHANNELBOT_API_KEY in environment or Settings.'
    };
  }

  try {
    const response = await axios.get(`${baseUrl.replace(/\/$/, '')}/api/external/users`, {
      headers: { [authHeader]: apiKey },
      timeout: 8000
    });

    const data = response.data;
    const limit = args?.limit || 10;

    if (Array.isArray(data)) {
      return {
        success: true,
        count: data.length,
        users: data.slice(0, limit)
      };
    }

    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 500,
      message: error.response?.data?.message || error.message || 'Error connecting to ChannelBot API'
    };
  }
};

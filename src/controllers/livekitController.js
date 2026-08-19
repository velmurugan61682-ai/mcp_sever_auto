import { AccessToken } from 'livekit-server-sdk';
import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';
import { Workspace } from '../models/Workspace.js';

// Specific rate limiter for token generation
export const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  message: {
    success: false,
    message: 'Too many token requests. Please try again later.'
  }
});

/**
 * Generates a short-lived LiveKit participant token
 * Enforces strict workspace-level user isolation
 */
export const generateLiveKitToken = async (req, res) => {
  try {
    const userId = req.user._id;
    const userName = req.user.name || 'User';

    // 1. Resolve workspace for the current user
    let workspace = await Workspace.findOne({
      $or: [
        { ownerId: userId },
        { 'members.user': userId }
      ]
    });

    // Create a default workspace if the user doesn't have one
    if (!workspace) {
      workspace = await Workspace.create({
        name: `${userName}'s Workspace`,
        ownerId: userId,
        members: [{ user: userId, role: 'admin' }]
      });
    }

    const workspaceId = workspace._id.toString();

    // 2. Room and participant configuration
    const roomName = `room-${workspaceId}`;
    const participantIdentity = `user-${userId}`;

    const apiKey = config.livekitApiKey;
    const apiSecret = config.livekitApiSecret;
    const wsUrl = config.livekitUrl;

    if (!apiKey || !apiSecret || !wsUrl) {
      return res.status(500).json({
        success: false,
        message: 'LiveKit server credentials are not fully configured on the backend.'
      });
    }

    // 3. Create AccessToken
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      ttl: '1h' // Short lived: 1 hour expiration
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    // 4. Generate JWT token
    const token = await at.toJwt();

    return res.status(200).json({
      success: true,
      token,
      roomName,
      livekitUrl: wsUrl
    });
  } catch (err) {
    console.error('[LiveKit Token Controller] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'An internal error occurred while generating the call token.'
    });
  }
};

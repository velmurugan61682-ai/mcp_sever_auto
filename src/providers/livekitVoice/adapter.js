import { RoomServiceClient, AccessToken } from 'livekit-server-sdk';
import { ProviderAdapter } from '../ProviderAdapter.js';
import { CallSession } from '../../models/CallSession.js';
import { config } from '../../config/env.js';

export class LiveKitVoiceAdapter extends ProviderAdapter {
  constructor(options = {}) {
    super({ name: 'LiveKit Voice', workspaceId: options.workspaceId, credentials: options });
    this.apiKey = options.apiKey !== undefined ? options.apiKey : (config.livekitApiKey || process.env.LIVEKIT_API_KEY);
    this.apiSecret = options.apiSecret !== undefined ? options.apiSecret : (config.livekitApiSecret || process.env.LIVEKIT_API_SECRET);
    this.wsUrl = options.wsUrl !== undefined ? options.wsUrl : (config.livekitUrl || process.env.LIVEKIT_URL);

    if (this.apiKey && this.apiSecret && this.wsUrl) {
      this.roomClient = new RoomServiceClient(this.wsUrl, this.apiKey, this.apiSecret);
      this.status = 'connected';
    } else {
      this.status = 'not_connected';
    }
  }

  async healthCheck() {
    if (!this.apiKey || !this.apiSecret || !this.wsUrl) {
      this.status = 'not_connected';
      return { status: 'not_connected', reason: 'Missing LiveKit API credentials' };
    }
    try {
      await this.roomClient.listRooms();
      this.status = 'connected';
      return { status: 'connected', wsUrl: this.wsUrl };
    } catch (err) {
      this.status = 'error';
      return { status: 'error', reason: err.message };
    }
  }

  async createRoom({ roomName, metadata = {} }) {
    if (this.status !== 'connected') {
      const health = await this.healthCheck();
      if (health.status !== 'connected') {
        throw new Error(`LiveKit connection error: ${health.reason || 'Not connected'}`);
      }
    }
    return await this.roomClient.createRoom({
      name: roomName,
      emptyTimeout: 300,
      maxParticipants: 10,
      metadata: JSON.stringify(metadata)
    });
  }

  async issueParticipantToken({ roomName, identity, name, metadata = {} }) {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('LiveKit credentials missing, cannot issue participant token');
    }
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      name,
      metadata: JSON.stringify(metadata)
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true
    });

    return await token.toJwt();
  }

  async startAgentSession({ roomName, agentId, workspaceId, toPhone }) {
    const callRecord = await CallSession.create({
      workspaceId,
      agentId,
      toPhone,
      status: 'initiating',
      startTime: new Date(),
      roomName
    });

    try {
      if (this.status === 'connected') {
        await this.createRoom({ roomName, metadata: { callId: callRecord._id, workspaceId, agentId } });
      }
      const token = await this.issueParticipantToken({
        roomName,
        identity: `agent-${agentId}`,
        name: 'Buzzz Voice AI',
        metadata: { role: 'agent', callId: callRecord._id }
      });

      return {
        success: true,
        callId: callRecord._id,
        roomName,
        token,
        wsUrl: this.wsUrl
      };
    } catch (err) {
      callRecord.status = 'failed';
      callRecord.endTime = new Date();
      await callRecord.save();
      throw err;
    }
  }

  async endSession({ roomName }) {
    if (this.status === 'connected' && this.roomClient) {
      await this.roomClient.deleteRoom(roomName).catch(() => {});
    }
    await CallSession.updateOne({ roomName }, { status: 'ended', endTime: new Date() });
    return { success: true, roomName };
  }

  async getRecording({ roomName }) {
    const call = await CallSession.findOne({ roomName });
    return { recordingUrl: call?.recordingUrl || null };
  }

  async getTranscript({ roomName }) {
    const call = await CallSession.findOne({ roomName });
    return { transcript: call?.transcript || [], summary: call?.summary || '' };
  }
}

export default LiveKitVoiceAdapter;

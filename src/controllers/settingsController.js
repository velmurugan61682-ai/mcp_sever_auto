import axios from 'axios';
import { AIKeySetting } from '../models/AIKeySetting.js';
import { Workspace } from '../models/Workspace.js';
import { StructuredActivity } from '../models/StructuredActivity.js';
import { encryptSecret } from '../services/encryptionService.js';

export const validateOpenAIKey = async (apiKey) => {
  if (!apiKey || !apiKey.trim()) return false;
  try {
    const res = await axios.get('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      timeout: 5000
    });
    return res.status === 200;
  } catch (err) {
    if (err.response && err.response.status === 401) {
      throw new Error('Invalid OpenAI API key: Provider returned 401 Unauthorized.');
    }
    // Network or other provider issue
    return true; // Fallback to accepting key if network check unavailable but non-401
  }
};

export const getSettings = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    let settings = await AIKeySetting.findOne({ workspaceId });
    if (!settings) {
      settings = await AIKeySetting.create({
        workspaceId,
        openaiApiKey: '',
        openaiKeyHint: '',
        imageSecretKey: '',
        imageKeyHint: '',
        workspaceAutonomyCeiling: 4,
        activeIndustryPack: 'clinics_hospitals',
        customTerminology: { customerLabel: 'Patient', bookingLabel: 'Appointment' }
      });
    }

    res.json({
      success: true,
      data: {
        hasOpenAIKey: Boolean(settings.openaiApiKey || settings.openaiKeyHint),
        openaiKeyHint: settings.openaiKeyHint || '',
        hasImageKey: Boolean(settings.imageSecretKey || settings.imageKeyHint),
        imageKeyHint: settings.imageKeyHint || '',
        workspaceAutonomyCeiling: settings.workspaceAutonomyCeiling ?? 4,
        activeIndustryPack: settings.activeIndustryPack || 'clinics_hospitals',
        customTerminology: settings.customTerminology || { customerLabel: 'Patient', bookingLabel: 'Appointment' }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateAIKeys = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { openaiApiKey, imageSecretKey } = req.body;

    let settings = await AIKeySetting.findOne({ workspaceId });
    if (!settings) {
      settings = new AIKeySetting({ workspaceId });
    }

    if (openaiApiKey && openaiApiKey.trim()) {
      await validateOpenAIKey(openaiApiKey.trim());
      const enc = encryptSecret(openaiApiKey.trim());
      settings.openaiApiKey = enc.cipherText;
      settings.openaiKeyHint = enc.hint;
    }

    if (imageSecretKey && imageSecretKey.trim()) {
      const enc = encryptSecret(imageSecretKey.trim());
      settings.imageSecretKey = enc.cipherText;
      settings.imageKeyHint = enc.hint;
    }

    await settings.save();

    await StructuredActivity.create({
      workspaceId,
      actorType: 'user',
      actorId: req.user?._id,
      action: 'UPDATE_BYOK_KEYS',
      outcome: 'success',
      details: { hasOpenAIKey: Boolean(settings.openaiApiKey), hasImageKey: Boolean(settings.imageSecretKey) }
    }).catch(() => {});

    res.json({
      success: true,
      message: 'AI Keys validated and securely stored.',
      data: {
        hasOpenAIKey: Boolean(settings.openaiApiKey || settings.openaiKeyHint),
        openaiKeyHint: settings.openaiKeyHint,
        hasImageKey: Boolean(settings.imageSecretKey || settings.imageKeyHint),
        imageKeyHint: settings.imageKeyHint
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const clearAIKey = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { type } = req.params;

    let settings = await AIKeySetting.findOne({ workspaceId });
    if (settings) {
      if (type === 'openai') {
        settings.openaiApiKey = '';
        settings.openaiKeyHint = '';
      } else if (type === 'image') {
        settings.imageSecretKey = '';
        settings.imageKeyHint = '';
      }
      await settings.save();
    }

    await StructuredActivity.create({
      workspaceId,
      actorType: 'user',
      actorId: req.user?._id,
      action: `CLEAR_BYOK_KEY_${type.toUpperCase()}`,
      outcome: 'success',
      details: { clearedKey: type }
    }).catch(() => {});

    res.json({ success: true, message: `Key ${type} cleared successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateAutonomyCeiling = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { ceiling } = req.body;

    const numCeiling = Number(ceiling);
    if (isNaN(numCeiling) || numCeiling < 0 || numCeiling > 4) {
      return res.status(400).json({ success: false, message: 'Autonomy ceiling must be a number between 0 and 4.' });
    }

    await AIKeySetting.findOneAndUpdate(
      { workspaceId },
      { workspaceAutonomyCeiling: numCeiling },
      { upsert: true }
    );

    await Workspace.findByIdAndUpdate(workspaceId, { workspaceAutonomyCeiling: numCeiling });

    await StructuredActivity.create({
      workspaceId,
      actorType: 'user',
      actorId: req.user?._id,
      action: 'UPDATE_AUTONOMY_CEILING',
      outcome: 'success',
      details: { ceiling: numCeiling }
    }).catch(() => {});

    res.json({ success: true, ceiling: numCeiling, message: `Workspace autonomy ceiling updated to Level ${numCeiling}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const applyIndustryPack = async (req, res) => {
  try {
    const workspaceId = req.workspaceId;
    const { industryPackId } = req.body;

    const packTerminologyMap = {
      clinics_hospitals: { customerLabel: 'Patient', bookingLabel: 'Consultation' },
      salons_spas: { customerLabel: 'Client', bookingLabel: 'Session' },
      real_estate: { customerLabel: 'Buyer', bookingLabel: 'Site Viewing' },
      ecommerce_retail: { customerLabel: 'Customer', bookingLabel: 'Order' },
      education: { customerLabel: 'Student', bookingLabel: 'Class' },
      restaurants_hotels: { customerLabel: 'Guest', bookingLabel: 'Reservation' }
    };

    const terminology = packTerminologyMap[industryPackId] || { customerLabel: 'Customer', bookingLabel: 'Appointment' };

    const settings = await AIKeySetting.findOneAndUpdate(
      { workspaceId },
      { activeIndustryPack: industryPackId, customTerminology: terminology },
      { upsert: true, new: true }
    );

    await StructuredActivity.create({
      workspaceId,
      actorType: 'user',
      actorId: req.user?._id,
      action: 'APPLY_INDUSTRY_PACK',
      outcome: 'success',
      details: { industryPackId, terminology }
    }).catch(() => {});

    res.json({
      success: true,
      message: `Industry pack '${industryPackId}' applied idempotently.`,
      activeIndustryPack: settings.activeIndustryPack,
      customTerminology: settings.customTerminology
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getSettings,
  updateAIKeys,
  clearAIKey,
  updateAutonomyCeiling,
  applyIndustryPack
};

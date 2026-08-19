import AIKeySetting from '../models/AIKeySetting.js';

export const getAIKeySettings = async (req, res) => {
  try {
    let settings = await AIKeySetting.findOne();
    if (!settings) {
      settings = await AIKeySetting.create({
        openaiApiKey: '',
        openaiKeyHint: 'sk-proj-••••••••••••••••3a9b',
        imagePublicKey: '',
        imageSecretKey: '',
        imageKeyHint: 'img_live_••••••••••••881c',
        workspaceAutonomyCeiling: 4,
        activeIndustryPack: 'clinics_hospitals',
        customTerminology: { customerLabel: 'Patient', bookingLabel: 'Appointment' },
      });
    }

    res.json({
      success: true,
      data: {
        hasOpenAIKey: Boolean(settings.openaiApiKey || settings.openaiKeyHint),
        openaiKeyHint: settings.openaiKeyHint || (settings.openaiApiKey ? `sk-••••${settings.openaiApiKey.slice(-4)}` : ''),
        hasImageKey: Boolean(settings.imageSecretKey || settings.imageKeyHint),
        imageKeyHint: settings.imageKeyHint || (settings.imageSecretKey ? `key-••••${settings.imageSecretKey.slice(-4)}` : ''),
        workspaceAutonomyCeiling: settings.workspaceAutonomyCeiling ?? 4,
        activeIndustryPack: settings.activeIndustryPack || 'clinics_hospitals',
        customTerminology: settings.customTerminology || { customerLabel: 'Patient', bookingLabel: 'Appointment' },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAIKeySettings = async (req, res) => {
  try {
    const {
      openaiApiKey,
      imagePublicKey,
      imageSecretKey,
      workspaceAutonomyCeiling,
      activeIndustryPack,
      customTerminology,
    } = req.body;

    let settings = await AIKeySetting.findOne();
    if (!settings) {
      settings = new AIKeySetting({});
    }

    if (openaiApiKey) {
      settings.openaiApiKey = openaiApiKey;
      settings.openaiKeyHint = `sk-••••${openaiApiKey.slice(-4)}`;
    }
    if (imagePublicKey) settings.imagePublicKey = imagePublicKey;
    if (imageSecretKey) {
      settings.imageSecretKey = imageSecretKey;
      settings.imageKeyHint = `img_••••${imageSecretKey.slice(-4)}`;
    }
    if (workspaceAutonomyCeiling !== undefined) {
      settings.workspaceAutonomyCeiling = workspaceAutonomyCeiling;
    }
    if (activeIndustryPack) {
      settings.activeIndustryPack = activeIndustryPack;
      // Auto-set industry labels
      if (activeIndustryPack === 'clinics_hospitals') {
        settings.customTerminology = { customerLabel: 'Patient', bookingLabel: 'Appointment' };
      } else if (activeIndustryPack === 'salons_spas') {
        settings.customTerminology = { customerLabel: 'Client', bookingLabel: 'Session' };
      } else if (activeIndustryPack === 'real_estate') {
        settings.customTerminology = { customerLabel: 'Buyer', bookingLabel: 'Site Viewing' };
      } else if (activeIndustryPack === 'education') {
        settings.customTerminology = { customerLabel: 'Student', bookingLabel: 'Class' };
      } else if (activeIndustryPack === 'restaurants_hotels') {
        settings.customTerminology = { customerLabel: 'Guest', bookingLabel: 'Reservation' };
      } else {
        settings.customTerminology = { customerLabel: 'Customer', bookingLabel: 'Appointment' };
      }
    }
    if (customTerminology) {
      settings.customTerminology = customTerminology;
    }

    await settings.save();

    res.json({
      success: true,
      message: 'Settings updated successfully!',
      data: settings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

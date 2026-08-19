import mongoose from 'mongoose';

const aiKeySettingSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      unique: true,
      index: true,
    },
    openaiApiKey: {
      type: String, // Stored encrypted or masked
      default: '',
    },
    openaiKeyHint: {
      type: String,
      default: '',
    },
    imagePublicKey: {
      type: String,
      default: '',
    },
    imageSecretKey: {
      type: String,
      default: '',
    },
    imageKeyHint: {
      type: String,
      default: '',
    },
    anthropicApiKey: {
      type: String,
      default: '',
    },
    workspaceAutonomyCeiling: {
      type: Number,
      min: 0,
      max: 4,
      default: 4,
    },
    activeIndustryPack: {
      type: String,
      default: 'clinics_hospitals',
    },
    customTerminology: {
      customerLabel: { type: String, default: 'Customer' }, // 'Patient', 'Client', 'Guest', 'Buyer', 'Student'
      bookingLabel: { type: String, default: 'Appointment' }, // 'Consultation', 'Session', 'Viewing', 'Class'
    },
  },
  { timestamps: true }
);

export const AIKeySetting = mongoose.model('AIKeySetting', aiKeySettingSchema);
export default AIKeySetting;

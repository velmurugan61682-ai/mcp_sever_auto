import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY
  ? Buffer.from(process.env.ENCRYPTION_MASTER_KEY, 'hex')
  : crypto.scryptSync(process.env.JWT_SECRET || 'buzzz-production-secret-key-32b', 'buzzz_salt', 32);

/**
 * Encrypt sensitive BYOK credential using AES-256-GCM
 */
export const encryptSecret = (plainText) => {
  if (!plainText) return { cipherText: '', tag: '', iv: '', hint: '' };

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  // Generate masked hint (e.g. sk-••••••••3a9b)
  const prefix = plainText.slice(0, 3);
  const suffix = plainText.slice(-4);
  const hint = `${prefix}-••••••••${suffix}`;

  return {
    cipherText: encrypted,
    tag,
    iv: iv.toString('hex'),
    hint,
  };
};

/**
 * Decrypt sensitive BYOK credential
 */
export const decryptSecret = ({ cipherText, tag, iv }) => {
  if (!cipherText || !tag || !iv) return '';

  const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  let decrypted = decipher.update(cipherText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

export default {
  encryptSecret,
  decryptSecret,
};

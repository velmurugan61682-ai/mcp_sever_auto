/**
 * Cross-channel contact identity resolver engine.
 * Merges signals from phone, email, WhatsApp ID, Instagram handle.
 */
export const resolveIdentity = (contacts = [], identifier = {}) => {
  const { email, phone, whatsappId, instagramHandle } = identifier;

  const normalizedEmail = email ? email.toLowerCase().trim() : null;
  const normalizedPhone = phone ? phone.replace(/\D/g, '') : null;

  return contacts.find((contact) => {
    if (normalizedEmail && contact.email && contact.email.toLowerCase().trim() === normalizedEmail) {
      return true;
    }
    if (normalizedPhone && contact.phone && contact.phone.replace(/\D/g, '') === normalizedPhone) {
      return true;
    }
    if (whatsappId && contact.whatsappId === whatsappId) {
      return true;
    }
    if (instagramHandle && contact.instagramHandle === instagramHandle) {
      return true;
    }
    return false;
  }) || null;
};

export default { resolveIdentity };

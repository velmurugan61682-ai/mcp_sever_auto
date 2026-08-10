import { URL } from 'url';

export const validateServerUrl = (urlString) => {
  if (!urlString) return { valid: true };

  try {
    const parsed = new URL(urlString);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, message: 'Invalid URL protocol. Only http: and https: are allowed.' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check SSRF private IP ranges in production
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    const isPrivateIP =
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

    const allowLocal = process.env.ALLOW_LOCAL_MCP === 'true' || process.env.NODE_ENV !== 'production';

    if ((isLocalhost || isPrivateIP) && !allowLocal) {
      return {
        valid: false,
        message: 'Security Policy Error: Localhost and private network URLs are blocked to prevent SSRF in production.'
      };
    }

    return { valid: true, parsedUrl: parsed.href };
  } catch (err) {
    return { valid: false, message: 'Invalid server URL format. Must be a valid HTTP or HTTPS address.' };
  }
};

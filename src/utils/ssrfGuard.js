import url from 'url';

const BLOCKED_HOSTNAMES = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', 'metadata.google.internal'];

const PRIVATE_IP_REGEX = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})|(192\.168\.\d{1,3}\.\d{1,3})|(127\.\d{1,3}\.\d{1,3}\.\d{1,3})|(169\.254\.\d{1,3}\.\d{1,3})$/;

/**
 * SSRF Guard: Validates outbound workflow API destination URLs
 */
export const validateWorkflowApiUrl = (targetUrl) => {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { valid: false, reason: 'Destination URL is required.' };
  }

  try {
    const parsed = new URL(targetUrl);

    // Protocol check
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, reason: `Unsupported protocol ${parsed.protocol}. Only HTTP and HTTPS are permitted.` };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Blocked hostname check
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      return { valid: false, reason: `Access to internal host "${hostname}" is forbidden by security policy.` };
    }

    // Private IP check
    if (PRIVATE_IP_REGEX.test(hostname)) {
      return { valid: false, reason: `Access to private IP space "${hostname}" is forbidden by SSRF protection policy.` };
    }

    return { valid: true, parsedUrl: parsed.href };
  } catch (err) {
    return { valid: false, reason: `Malformed destination URL: ${err.message}` };
  }
};

export default {
  validateWorkflowApiUrl,
};

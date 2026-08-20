import { URL } from 'node:url';

const BLOCKED_IPS_AND_RANGES = [
  '127.0.0.1',
  '0.0.0.0',
  'localhost',
  '169.254.169.254', // AWS Metadata IP
  '::1'
];

export const isPrivateOrBlockedUrl = (targetUrl) => {
  try {
    const parsed = new URL(targetUrl);
    const hostname = parsed.hostname.toLowerCase();

    if (BLOCKED_IPS_AND_RANGES.includes(hostname)) return true;

    // Check IPv4 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const [, p1, p2] = ipv4Match.map(Number);
      if (p1 === 10) return true; // 10.0.0.0/8
      if (p1 === 172 && p2 >= 16 && p2 <= 31) return true; // 172.16.0.0/12
      if (p1 === 192 && p2 === 168) return true; // 192.168.0.0/16
      if (p1 === 127) return true; // 127.0.0.0/8 loopback
      if (p1 === 169 && p2 === 254) return true; // 169.254.0.0/16 link-local
    }

    return false;
  } catch {
    return true; // Block unparseable or malformed URLs by default
  }
};

export const validateEgressUrl = (targetUrl) => {
  if (isPrivateOrBlockedUrl(targetUrl)) {
    throw new Error(`Security Violation: Outbound request to private/internal network '${targetUrl}' is prohibited.`);
  }
  return true;
};

export default { isPrivateOrBlockedUrl, validateEgressUrl };

import crypto from 'node:crypto';

const extractDeviceFingerprint = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0]?.trim())
    || req.ip
    || req.socket?.remoteAddress
    || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const terminalHash = crypto.createHash('md5').update(ip).digest('hex').slice(0, 8);

  return {
    ip,
    userAgent,
    mockTerminalId: `TERM-${terminalHash}`,
  };
};

export default extractDeviceFingerprint;
export { extractDeviceFingerprint };

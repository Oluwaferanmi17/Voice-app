import { redis } from '../../lib/redis';

const OTP_TTL_SECONDS = 5 * 60;
const COOLDOWN_SECONDS = 60;

export const otpStore = {
  async savePinId(phoneNumber: string, pinId: string) {
    await redis.set(`otp:pinid:${phoneNumber}`, pinId, 'EX', OTP_TTL_SECONDS);
  },

  async getPinId(phoneNumber: string): Promise<string | null> {
    return redis.get(`otp:pinid:${phoneNumber}`);
  },

  async clearPinId(phoneNumber: string) {
    await redis.del(`otp:pinid:${phoneNumber}`);
  },

  async canRequestOTP(phoneNumber: string): Promise<boolean> {
    const key = `otp:cooldown:${phoneNumber}`;
    const exists = await redis.get(key);
    if (exists) return false;
    await redis.set(key, '1', 'EX', COOLDOWN_SECONDS);
    return true;
  },
};
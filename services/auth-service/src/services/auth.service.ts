import { prisma } from '@silent-voice/db';
import crypto from 'crypto';
import { jwtService } from './jwt.service';
import { createOTPProvider } from './otp/otp-provider.factory';
import { otpStore } from './otp/otp-store';

const otpProvider = createOTPProvider();

export const authService = {
  async requestOTP(phoneNumber: string) {
    const allowed = await otpStore.canRequestOTP(phoneNumber);
    if (!allowed) {
      throw new Error('Please wait before requesting another code');
    }

    const result = await otpProvider.sendOTP(phoneNumber);
    if (!result.success || !result.messageId) {
      throw new Error('Failed to send verification code');
    }

    await otpStore.savePinId(phoneNumber, result.messageId);
    return { sent: true };
  },

  async verifyOTPAndLogin(phoneNumber: string, code: string, deviceId: string, deviceName?: string) {
    const pinId = await otpStore.getPinId(phoneNumber);
    if (!pinId) {
      throw new Error('Code expired or was never requested');
    }

    const result = await otpProvider.verifyOTP(phoneNumber, code, pinId);
    if (!result.verified) {
      throw new Error(result.reason || 'Invalid code');
    }

    await otpStore.clearPinId(phoneNumber);

    // Find or create the user
    let user = await prisma.user.findUnique({ where: { phoneNumber } });
    const isNewUser = !user;

    if (!user) {
      user = await prisma.user.create({
        data: { phoneNumber, displayName: '' }, // filled in during profile-setup
      });
    }

    // Track this device/session
    await prisma.userSession.upsert({
      where: {
        userId_deviceId: { userId: user.id, deviceId },
      },
      update: { lastActive: new Date() },
      create: { userId: user.id, deviceId, deviceName },
    });

    const accessToken = jwtService.signAccessToken({ userId: user.id, deviceId });
    const refreshToken = jwtService.signRefreshToken({ userId: user.id, deviceId });

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        deviceId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return { user, accessToken, refreshToken, isNewUser };
  },

  async refreshAccessToken(refreshToken: string) {
    const payload = jwtService.verifyRefreshToken(refreshToken);

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new Error('Refresh token invalid or expired');
    }

    const accessToken = jwtService.signAccessToken({
      userId: payload.userId,
      deviceId: payload.deviceId,
    });

    return { accessToken };
  },

  async logout(refreshToken: string) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revoked: true },
    });
  },
};

// Helper used above — generates a stable session id for upsert by (userId, deviceId)
function sessionId(userId: string, deviceId: string) {
  return crypto.createHash('sha256').update(`${userId}:${deviceId}`).digest('hex');
}
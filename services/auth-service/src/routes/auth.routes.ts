import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';

export const authRoutes = Router();

const phoneSchema = z.object({ phoneNumber: z.string().min(8) });
const verifySchema = z.object({
  phoneNumber: z.string().min(8),
  code: z.string().length(6),
  deviceId: z.string(),
  deviceName: z.string().optional(),
});

authRoutes.post('/request-otp', async (req, res) => {
  const parsed = phoneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid phone number' });

  try {
    const result = await authService.requestOTP(parsed.data.phoneNumber);
    res.json(result);
  } catch (err) {
    res.status(429).json({ error: (err as Error).message });
  }
});

authRoutes.post('/verify-otp', async (req, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });

  try {
    const { phoneNumber, code, deviceId, deviceName } = parsed.data;
    const result = await authService.verifyOTPAndLogin(phoneNumber, code, deviceId, deviceName);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: (err as Error).message });
  }
});

authRoutes.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Missing refresh token' });

  try {
    const result = await authService.refreshAccessToken(refreshToken);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: (err as Error).message });
  }
});

authRoutes.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) await authService.logout(refreshToken);
  res.json({ loggedOut: true });
});
import { prisma } from '@silent-voice/db';
import { AuthedRequest, requireAuth } from '@silent-voice/utils';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { userService } from '../services/user.service';

export const userRoutes = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(200).optional(),
  statusMessage: z.string().max(100).optional(),
});

userRoutes.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const profile = await userService.getProfile(req.userId!);
    res.json(profile);
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

userRoutes.patch('/me', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid profile data' });

  const updated = await userService.updateProfile(req.userId!, parsed.data);
  res.json(updated);
});

userRoutes.post(
  '/me/profile-picture',
  requireAuth,
  upload.single('image') as any,
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image provided' });

    const updated = await userService.updateProfilePicture(req.userId!, req.file.buffer);
    res.json(updated);
  }
);

userRoutes.get('/search', requireAuth, async (req: AuthedRequest, res) => {
  const query = (req.query.q as string) || '';
  if (query.length < 2) return res.status(400).json({ error: 'Query too short' });

  const results = await userService.searchUsers(query, req.userId!);
  res.json(results);
});

userRoutes.delete('/me', requireAuth, async (req: AuthedRequest, res) => {
  await userService.deleteAccount(req.userId!);
  res.json({ deleted: true });
});

const pushTokenSchema = z.object({ expoPushToken: z.string() });

userRoutes.post('/me/push-token', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = pushTokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid token' });

  await prisma.user.update({
    where: { id: req.userId! },
    data: { expoPushToken: parsed.data.expoPushToken },
  });
  res.json({ saved: true });
});
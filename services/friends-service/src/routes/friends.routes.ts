import { AuthedRequest, requireAuth } from '@silent-voice/utils';
import { Router } from 'express';
import { z } from 'zod';
import { friendsService } from '../services/friends.service';

export const friendsRoutes = Router();

const targetUserSchema = z.object({ targetUserId: z.string().uuid() });

friendsRoutes.post('/requests', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = targetUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid target user' });

  try {
    const result = await friendsService.sendRequest(req.userId!, parsed.data.targetUserId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

friendsRoutes.post('/requests/:id/accept', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const result = await friendsService.acceptRequest(req.params.id, req.userId!);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

friendsRoutes.post('/requests/:id/decline', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const result = await friendsService.declineRequest(req.params.id, req.userId!);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

friendsRoutes.post('/requests/:id/cancel', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const result = await friendsService.cancelRequest(req.params.id, req.userId!);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

friendsRoutes.get('/requests', requireAuth, async (req: AuthedRequest, res) => {
  const result = await friendsService.listPendingRequests(req.userId!);
  res.json(result);
});

friendsRoutes.delete('/:userId', requireAuth, async (req: AuthedRequest, res) => {
  try {
    await friendsService.removeFriend(req.userId!, req.params.userId);
    res.json({ removed: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

friendsRoutes.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const result = await friendsService.listFriends(req.userId!);
  res.json(result);
});
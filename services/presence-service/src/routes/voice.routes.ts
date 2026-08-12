import { AuthedRequest, requireAuth } from '@silent-voice/utils';
import { Router } from 'express';
import { z } from 'zod';
import { speechService } from '../services/speech.service';

export const voiceRoutes = Router();

voiceRoutes.get('/preference', requireAuth, async (req: AuthedRequest, res) => {
  const pref = await speechService.getVoicePreference(req.userId!);
  res.json(pref);
});

const updateSchema = z.object({
  voiceId: z.string().optional(),
  speed: z.number().min(0.5).max(2.0).optional(),
  language: z.string().optional(),
});

voiceRoutes.patch('/preference', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid preference data' });

  const updated = await speechService.setVoicePreference(req.userId!, parsed.data);
  res.json(updated);
});
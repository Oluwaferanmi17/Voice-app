import { prisma } from '@silent-voice/db';
import { AuthedRequest, requireAuth } from '@silent-voice/utils';
import { Router } from 'express';
import { callService } from '../services/call.service';

export const callRoutes = Router();

// GET /calls/history — list call history for the logged-in user
callRoutes.get('/history', requireAuth, async (req: AuthedRequest, res) => {
  const limit = Number(req.query.limit) || 50;
  const history = await callService.getCallHistory(req.userId!, limit);
  res.json(history);
});

// DELETE /calls/history/:callId — delete a single history record
callRoutes.delete('/history/:callId', requireAuth, async (req: AuthedRequest, res) => {
  const call = await prisma.call.findUnique({ where: { id: req.params.callId } });
  if (!call) return res.status(404).json({ error: 'Call record not found' });

  const userId = req.userId!;
  if (call.callerId !== userId && call.calleeId !== userId) {
    return res.status(403).json({ error: 'Not authorized to delete this record' });
  }

  await prisma.call.delete({ where: { id: req.params.callId } });
  res.json({ deleted: true });
});

// DELETE /calls/history — clear all call history for the logged-in user
callRoutes.delete('/history', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  await prisma.call.deleteMany({
    where: { OR: [{ callerId: userId }, { calleeId: userId }] },
  });
  res.json({ cleared: true });
});
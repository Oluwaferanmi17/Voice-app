import { prisma } from '@silent-voice/db';
import { AuthedRequest, requireAuth } from '@silent-voice/utils';
import { Router } from 'express';
import { messageService } from '../services/message.service';

export const messageRoutes = Router();

// GET /calls/:callId/messages — fetch message history for a call
messageRoutes.get('/:callId/messages', requireAuth, async (req: AuthedRequest, res) => {
  const { callId } = req.params;
  const userId = req.userId!;

  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call) return res.status(404).json({ error: 'Call not found' });

  // Only participants of the call can read its messages — same
  // authorization rule as the socket gateway's assertCanMessage,
  // but without the CONNECTED-only restriction, since reading past
  // history should work even after the call has ended.
  if (call.callerId !== userId && call.calleeId !== userId) {
    return res.status(403).json({ error: 'Not authorized to view these messages' });
  }

  const messages = await messageService.getMessagesForCall(callId);
  res.json(messages);
});
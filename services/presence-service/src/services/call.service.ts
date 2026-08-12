import { CallStatus } from '@prisma/client';
import { prisma } from '@silent-voice/db';
import { redis } from '../lib/redis';
import { assertValidTransition } from './call-state-machine';

const CALL_TIMEOUT_SECONDS = 30;
const ACTIVE_CALL_PREFIX = 'call:active_user:'; // maps userId -> callId, for busy-check

export const callService = {
  async startCall(callerId: string, calleeId: string) {
    if (callerId === calleeId) throw new Error('Cannot call yourself');

    // Busy check — is either party already in a call?
    const [callerBusy, calleeBusy] = await Promise.all([
      redis.get(`${ACTIVE_CALL_PREFIX}${callerId}`),
      redis.get(`${ACTIVE_CALL_PREFIX}${calleeId}`),
    ]);

    if (callerBusy) throw new Error('You are already in a call');
    if (calleeBusy) {
      // Create the record straight as BUSY so it still shows in history
      const call = await prisma.call.create({
        data: { callerId, calleeId, status: 'BUSY' },
      });
      return { call, busy: true };
    }

    const call = await prisma.call.create({
      data: { callerId, calleeId, status: 'CALLING' },
    });

    // Mark both users as tentatively "in this call" so simultaneous
    // incoming calls to either party are rejected as busy
    await redis.set(`${ACTIVE_CALL_PREFIX}${callerId}`, call.id, 'EX', CALL_TIMEOUT_SECONDS + 60);
    await redis.set(`${ACTIVE_CALL_PREFIX}${calleeId}`, call.id, 'EX', CALL_TIMEOUT_SECONDS + 60);

    // Redis TTL doubles as the timeout fallback if the service restarts;
    // the in-memory timer (registered by the gateway) is the primary mechanism
    return { call, busy: false };
  },

  async transitionCall(callId: string, toStatus: CallStatus) {
    const call = await prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new Error('Call not found');

    assertValidTransition(call.status, toStatus);

    const updateData: Record<string, unknown> = { status: toStatus };
    if (toStatus === 'CONNECTED') updateData.connectedAt = new Date();
    if (['ENDED', 'REJECTED', 'MISSED', 'BUSY'].includes(toStatus)) {
      updateData.endedAt = new Date();
      if (call.connectedAt) {
        updateData.duration = Math.floor((Date.now() - call.connectedAt.getTime()) / 1000);
      }
    }

    const updated = await prisma.call.update({ where: { id: callId }, data: updateData });

    // Clear the busy-lock once the call reaches a terminal state
    if (VALID_TERMINAL_STATES.includes(toStatus)) {
      await redis.del(`${ACTIVE_CALL_PREFIX}${call.callerId}`);
      await redis.del(`${ACTIVE_CALL_PREFIX}${call.calleeId}`);
    }

    return updated;
  },

  async getActiveCallForUser(userId: string): Promise<string | null> {
    return redis.get(`${ACTIVE_CALL_PREFIX}${userId}`);
  },

  async getCallHistory(userId: string, limit = 50) {
    return prisma.call.findMany({
      where: { OR: [{ callerId: userId }, { calleeId: userId }] },
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        caller: { select: { id: true, displayName: true, profilePicUrl: true } },
        callee: { select: { id: true, displayName: true, profilePicUrl: true } },
      },
    });
  },
};

const VALID_TERMINAL_STATES: CallStatus[] = ['ENDED', 'REJECTED', 'MISSED', 'BUSY'];
import { prisma } from '@silent-voice/db';
import { Server, Socket } from 'socket.io';
import { callService } from '../services/call.service';
import { sendPushNotification } from '../services/push.service';
import { getUserSocket, registerUserSocket, unregisterUserSocket } from './socket-registry';

// Maps userId -> their currently connected socket, so we can push
// call events directly to a specific user regardless of which
// socket.io room abstraction we use

interface AuthedSocket extends Socket {
  userId?: string;
}

// Tracks the timeout timer per call, so we can cancel it if answered in time
const callTimers = new Map<string, NodeJS.Timeout>();

const CALL_TIMEOUT_MS = 30_000;

export function registerCallGateway(io: Server, socket: AuthedSocket) {
  const userId = socket.userId!;
  registerUserSocket(userId, socket);

  socket.on('disconnect', () => {
    unregisterUserSocket(userId, socket);
  });

  socket.on('call:start', async ({ calleeId }: { calleeId: string }) => {
    try {
      const { call, busy } = await callService.startCall(userId, calleeId);

      if (busy) {
        socket.emit('call:busy', { callId: call.id });
        return;
      }

      // Notify the callee — via socket if connected, push notification if not
      const calleeSocket = getUserSocket(calleeId);
      const caller = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true, profilePicUrl: true },
      });

      if (calleeSocket) {
        await callService.transitionCall(call.id, 'RINGING');
        calleeSocket.emit('call:incoming', { callId: call.id, caller });
      } else {
        // Callee's app is backgrounded/closed — push notification instead
        const calleeUser = await prisma.user.findUnique({
          where: { id: calleeId },
          select: { expoPushToken: true },
        });
        if (calleeUser?.expoPushToken) {
          await sendPushNotification(calleeUser.expoPushToken, {
            title: `Incoming call`,
            body: `${caller?.displayName} is calling you`,
            data: { type: 'incoming_call', callId: call.id, callerId: userId },
          });
        }
        // Still mark RINGING even without live socket — push may reconnect them in time
        await callService.transitionCall(call.id, 'RINGING');
      }

      socket.emit('call:ringing', { callId: call.id });

      // Start the 30s timeout timer
      const timer = setTimeout(async () => {
        try {
          const updated = await callService.transitionCall(call.id, 'MISSED');
          socket.emit('call:timeout', { callId: call.id });
          getUserSocket(calleeId)?.emit('call:timeout', { callId: call.id });
        } catch {
          // Already transitioned (e.g. answered right at the boundary) — ignore
        } finally {
          callTimers.delete(call.id);
        }
      }, CALL_TIMEOUT_MS);

      callTimers.set(call.id, timer);
    } catch (err) {
      socket.emit('call:error', { message: (err as Error).message });
    }
  });

  socket.on('call:accept', async ({ callId }: { callId: string }) => {
    try {
      const call = await prisma.call.findUnique({ where: { id: callId } });
      if (!call) throw new Error('Call not found');
      if (call.calleeId !== userId) throw new Error('Not authorized to accept this call');

      clearCallTimer(callId);
      const updated = await callService.transitionCall(callId, 'CONNECTED');

      socket.emit('call:connected', { callId });
      getUserSocket(call.callerId)?.emit('call:connected', { callId });
    } catch (err) {
      socket.emit('call:error', { message: (err as Error).message });
    }
  });

  socket.on('call:reject', async ({ callId }: { callId: string }) => {
    try {
      const call = await prisma.call.findUnique({ where: { id: callId } });
      if (!call) throw new Error('Call not found');
      if (call.calleeId !== userId) throw new Error('Not authorized to reject this call');

      clearCallTimer(callId);
      await callService.transitionCall(callId, 'REJECTED');

      socket.emit('call:rejected', { callId });
      getUserSocket(call.callerId)?.emit('call:rejected', { callId });
    } catch (err) {
      socket.emit('call:error', { message: (err as Error).message });
    }
  });

  socket.on('call:end', async ({ callId }: { callId: string }) => {
    try {
      const call = await prisma.call.findUnique({ where: { id: callId } });
      if (!call) throw new Error('Call not found');
      if (call.callerId !== userId && call.calleeId !== userId) {
        throw new Error('Not authorized to end this call');
      }

      clearCallTimer(callId);
      await callService.transitionCall(callId, 'ENDED');

      const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;
      socket.emit('call:ended', { callId });
      getUserSocket(otherUserId)?.emit('call:ended', { callId });
    } catch (err) {
      socket.emit('call:error', { message: (err as Error).message });
    }
  });

  socket.on('call:cancel', async ({ callId }: { callId: string }) => {
    // Caller cancels before the callee answers
    try {
      const call = await prisma.call.findUnique({ where: { id: callId } });
      if (!call) throw new Error('Call not found');
      if (call.callerId !== userId) throw new Error('Not authorized to cancel this call');

      clearCallTimer(callId);
      await callService.transitionCall(callId, 'ENDED');

      socket.emit('call:ended', { callId });
      getUserSocket(call.calleeId)?.emit('call:ended', { callId });
    } catch (err) {
      socket.emit('call:error', { message: (err as Error).message });
    }
  });
}

function clearCallTimer(callId: string) {
  const timer = callTimers.get(callId);
  if (timer) {
    clearTimeout(timer);
    callTimers.delete(callId);
  }
}
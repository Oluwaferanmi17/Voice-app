import { Server, Socket } from 'socket.io';
import { messageService } from '../services/message.service';
import { speechService } from '../services/speech.service';

// Same userSockets map pattern as call.gateway — in a real setup this
// would be a shared module rather than duplicated per gateway file.
// For now, import it from call.gateway to avoid two separate maps
// going out of sync about who's connected.
import { speechQueueService } from '../services/speech-queue.service';
import { getUserSocket } from './socket-registry';

interface AuthedSocket extends Socket {
  userId?: string;
}

// Tracks typing timeout per (callId, userId) so "stop typing" fires
// automatically if the client never explicitly sends it (e.g. app backgrounds)
const typingTimers = new Map<string, NodeJS.Timeout>();
const TYPING_TIMEOUT_MS = 5000;

export function registerMessageGateway(io: Server, socket: AuthedSocket) {
  const userId = socket.userId!;

  socket.on('message:send', async ({ callId, content, clientMessageId }: {
    callId: string;
    content: string;
    clientMessageId: string; // client-generated id, used to reconcile with local retry queue
  }) => {
    try {
      const call = await messageService.assertCanMessage(callId, userId);
      const message = await messageService.createMessage(callId, userId, content);

      // Ack back to sender immediately with the real DB id, mapped to their local id
      socket.emit('message:ack', { clientMessageId, messageId: message.id, status: 'SENDING' });
      const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;

      await speechService.handleIncomingMessage({
        messageId: message.id,
        callId,
        senderId: userId,
        recipientId: otherUserId,
        text: content,
      });
      const otherSocket = getUserSocket(otherUserId);

      if (otherSocket) {
        otherSocket.emit('message:receive', {
          messageId: message.id,
          callId,
          senderId: userId,
          content,
          createdAt: message.createdAt,
        });

        // Wait for the recipient to explicitly ack receipt (see message:delivered below)
        // rather than assuming delivery just because the socket emit succeeded —
        // emit() doesn't guarantee the client actually processed it.
      } else {
        // Recipient has no live socket even though the call shows CONNECTED —
        // unusual (their app likely crashed or lost connection mid-call).
        await messageService.markFailed(message.id);
        socket.emit('message:status', { messageId: message.id, status: 'FAILED' });
      }
    } catch (err) {
      socket.emit('message:error', {
        clientMessageId,
        message: (err as Error).message,
      });
    }
  });

  // Recipient's client calls this once it has actually rendered/received the message
  socket.on('message:delivered', async ({ messageId, senderId }: { messageId: string; senderId: string }) => {
    try {
      await messageService.markDelivered(messageId);
      const senderSocket = getUserSocket(senderId);
      senderSocket?.emit('message:status', { messageId, status: 'DELIVERED' });
    } catch {
      // Message already in a terminal state or not found — safe to ignore
    }
  });

  socket.on('message:typing:start', ({ callId }: { callId: string }) => {
    broadcastTyping(callId, userId, true);
    resetTypingTimer(callId, userId);
  });

  socket.on('message:typing:stop', ({ callId }: { callId: string }) => {
    broadcastTyping(callId, userId, false);
    clearTypingTimer(callId, userId);
  });

  socket.on('disconnect', () => {
    // Clean up any typing timers this user had active
    for (const key of typingTimers.keys()) {
      if (key.endsWith(`:${userId}`)) {
        clearTimeout(typingTimers.get(key)!);
        typingTimers.delete(key);
      }
    }
  });
  socket.on('speech:cancel', ({ messageId }: { messageId: string }) => {
  speechQueueService.cancelMessage(messageId);
});

  async function broadcastTyping(callId: string, fromUserId: string, isTyping: boolean) {
    try {
      const call = await messageService.assertCanMessage(callId, fromUserId);
      const otherUserId = call.callerId === fromUserId ? call.calleeId : call.callerId;
      getUserSocket(otherUserId)?.emit('message:typing', { callId, userId: fromUserId, isTyping });
    } catch {
      // Call not active or user not a participant — silently drop typing events
    }
  }

  function resetTypingTimer(callId: string, forUserId: string) {
    const key = `${callId}:${forUserId}`;
    clearTypingTimer(callId, forUserId);
    const timer = setTimeout(() => {
      broadcastTyping(callId, forUserId, false);
      typingTimers.delete(key);
    }, TYPING_TIMEOUT_MS);
    typingTimers.set(key, timer);
  }

  function clearTypingTimer(callId: string, forUserId: string) {
    const key = `${callId}:${forUserId}`;
    const timer = typingTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      typingTimers.delete(key);
    }
  }
}


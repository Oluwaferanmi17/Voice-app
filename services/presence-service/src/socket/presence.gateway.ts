import { prisma } from '@silent-voice/db';
import jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { presenceService } from '../services/presence.service';
import { registerCallGateway } from './call.gateway';
import { registerMessageGateway } from './message.gateway';

interface AuthedSocket extends Socket {
  userId?: string;
}

// Track how many sockets a user has open, so closing one tab/device
// doesn't mark them offline while another is still connected
const connectionCounts = new Map<string, number>();

export function registerPresenceGateway(io: Server) {
  io.use((socket: AuthedSocket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Missing auth token'));

    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as { userId: string };
      socket.userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', async (socket: AuthedSocket) => {
    const userId = socket.userId!;
    const count = (connectionCounts.get(userId) || 0) + 1;
    connectionCounts.set(userId, count);
    registerCallGateway(io, socket);
    registerMessageGateway(io, socket);

    if (count === 1) {
      await presenceService.markOnline(userId);
      socket.broadcast.emit('presence:update', { userId, isOnline: true });
    }

    // Let the client know its own connection succeeded
    socket.emit('presence:connected', { userId });

    socket.on('disconnect', async () => {
      const remaining = (connectionCounts.get(userId) || 1) - 1;
      connectionCounts.set(userId, remaining);

      if (remaining <= 0) {
        connectionCounts.delete(userId);
        await presenceService.markOffline(userId);
        await prisma.user.update({
          where: { id: userId },
          data: { isOnline: false, lastSeenAt: new Date() },
        });
        socket.broadcast.emit('presence:update', { userId, isOnline: false, lastSeenAt: new Date() });
      }
    });
  });
}
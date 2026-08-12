import { Socket } from 'socket.io';

interface AuthedSocket extends Socket {
  userId?: string;
}

const userSockets = new Map<string, AuthedSocket>();

export function registerUserSocket(userId: string, socket: AuthedSocket) {
  userSockets.set(userId, socket);
}

export function unregisterUserSocket(userId: string, socket: AuthedSocket) {
  if (userSockets.get(userId) === socket) userSockets.delete(userId);
}

export function getUserSocket(userId: string): AuthedSocket | undefined {
  return userSockets.get(userId);
}
import * as SecureStore from 'expo-secure-store';
import { io, Socket } from 'socket.io-client';

const PRESENCE_SERVICE_URL = process.env.EXPO_PUBLIC_PRESENCE_SERVICE_URL || 'http://localhost:4004';

let socket: Socket | null = null;
type Listener = (...args: any[]) => void;
const listeners = new Map<string, Set<Listener>>();

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await SecureStore.getItemAsync('sv_access_token');
  socket = io(PRESENCE_SERVICE_URL, { auth: { token } });

  // Re-broadcast every socket event to our own subscriber map, so multiple
  // hooks/components across the app can each listen without fighting over
  // socket.on/off directly on the same shared socket instance.
  const knownEvents = [
    'call:incoming', 'call:ringing', 'call:connected', 'call:rejected',
    'call:busy', 'call:ended', 'call:timeout', 'call:error',
    'message:receive', 'message:status', 'message:ack', 'message:typing',
    'speech:chunk', 'speech:complete', 'speech:error',
    'presence:update',
  ];
  knownEvents.forEach((event) => {
    socket!.on(event, (...args: any[]) => emit(event, ...args));
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function on(event: string, listener: Listener) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(listener);
  return () => listeners.get(event)?.delete(listener);
}

function emit(event: string, ...args: any[]) {
  listeners.get(event)?.forEach((l) => l(...args));
}

export function emitToServer(event: string, payload: unknown) {
  socket?.emit(event, payload);
}
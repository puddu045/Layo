import { io, type Socket } from 'socket.io-client';
import { supabase } from './supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3333/api/v1';
// Socket.IO attaches to the same HTTP server as the REST API, but the REST
// routes are under the 'api/v1' global prefix while the socket engine listens
// at the server's own default path — so we connect to the bare origin.
const SOCKET_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

let socket: Socket | null = null;

/** Lazily creates (or reuses) the authenticated messaging socket. */
export async function getSocket(): Promise<Socket> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (socket) {
    socket.auth = { token: session?.access_token };
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(SOCKET_ORIGIN, {
    auth: { token: session?.access_token },
    transports: ['websocket'],
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

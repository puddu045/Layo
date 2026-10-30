import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { loadApiEnv } from '@layo/config';
import { SupabaseService } from '../common/supabase/supabase.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { computeUserRoomAccessWindows } from '../airport-rooms/room-eligibility';
import { findActiveWindow } from '../airport-rooms/room-access.util';

/**
 * Push-only transport for both private messaging and airport-room chat:
 * clients never write over the socket, only REST does (`MessagingService`,
 * `AirportRoomsService`), which then calls `emitToUser` / `emitToRoom` here
 * to notify whoever's currently connected. This keeps validation/business
 * logic in one place instead of duplicating it between REST and WS handlers.
 *
 * Each authenticated socket joins a room named `user:<userId>` for private
 * messages. For airport rooms, a socket must explicitly `room:join` with an
 * airport code — re-checked server-side against the same eligibility windows
 * the REST endpoints enforce, so a socket can't receive live room traffic for
 * an airport the user isn't actually eligible for right now.
 *
 * Auth runs as an `io.use()` middleware rather than in `handleConnection`:
 * Socket.IO guarantees a middleware finishes (including the `await` inside
 * it) before any event from that socket is delivered to a handler, whereas
 * `handleConnection` is just a lifecycle hook — a client that emits
 * `room:join` immediately after `connect` could otherwise race ahead of the
 * async Supabase token verification and be handled with no `userId` yet set.
 */
@WebSocketGateway({
  cors: { origin: loadApiEnv().CORS_ORIGINS, credentials: true },
})
export class RealtimeGateway implements OnGatewayInit {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    server.use(async (socket: Socket, next: (err?: Error) => void) => {
      const token = this.extractToken(socket);
      if (!token) return next(new Error('Missing auth token'));

      const identity = await this.supabase.verifyAccessToken(token);
      if (!identity) return next(new Error('Invalid or expired session'));

      socket.data.userId = identity.id;
      next();
    });
  }

  handleConnection(client: Socket) {
    // Auth already ran and set client.data.userId in the io.use() middleware above.
    client.join(`user:${client.data.userId}`);
  }

  @SubscribeMessage('room:join')
  async handleRoomJoin(@ConnectedSocket() client: Socket, @MessageBody() payload: { airportIata?: string }) {
    const userId = client.data.userId as string | undefined;
    const airportIata = payload?.airportIata?.toUpperCase();
    if (!userId || !airportIata) return { ok: false, reason: 'Missing airport code' };

    const windows = await computeUserRoomAccessWindows(this.prisma, userId);
    const active = findActiveWindow(windows, airportIata, new Date());
    if (!active) return { ok: false, reason: 'You are not currently eligible for this room' };

    await client.join(`airport-room:${airportIata}`);
    return { ok: true };
  }

  @SubscribeMessage('room:leave')
  async handleRoomLeave(@ConnectedSocket() client: Socket, @MessageBody() payload: { airportIata?: string }) {
    const airportIata = payload?.airportIata?.toUpperCase();
    if (airportIata) await client.leave(`airport-room:${airportIata}`);
    return { ok: true };
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitToRoom(airportIata: string, event: string, payload: unknown) {
    this.server.to(`airport-room:${airportIata}`).emit(event, payload);
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string') return queryToken;
    return undefined;
  }
}

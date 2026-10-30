import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { loadApiEnv } from '@layo/config';
import { SupabaseService } from '../common/supabase/supabase.service';

/**
 * Push-only transport: clients never send writes over the socket. Messages
 * are created via REST (`MessagingService`), which then calls `emitToUser`
 * here to notify whichever participants are currently connected. This keeps
 * validation/business logic in one place instead of duplicating it between
 * REST and WS handlers.
 *
 * Each authenticated socket joins a room named `user:<userId>`, so a user
 * with multiple open devices/tabs all receive the same event without the
 * server needing to track individual socket ids per conversation.
 */
@WebSocketGateway({
  cors: { origin: loadApiEnv().CORS_ORIGINS, credentials: true },
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessagingGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly supabase: SupabaseService) {}

  async handleConnection(client: Socket) {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`Socket ${client.id} connected without a token; disconnecting`);
      client.disconnect(true);
      return;
    }

    const identity = await this.supabase.verifyAccessToken(token);
    if (!identity) {
      this.logger.warn(`Socket ${client.id} failed token verification; disconnecting`);
      client.disconnect(true);
      return;
    }

    client.data.userId = identity.id;
    await client.join(`user:${identity.id}`);
  }

  handleDisconnect(_client: Socket) {
    // Socket.IO handles room cleanup automatically on disconnect.
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string') return queryToken;
    return undefined;
  }
}

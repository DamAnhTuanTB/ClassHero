import { Inject, Logger } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import {
  lessonRealtimeSubscriptionSchema,
  realtimeSocketEvents,
  type BackgroundJobStatusChangedEvent,
  type LessonRealtimeSubscriptionAck,
} from "@learning-path/shared";
import type { Namespace, Socket } from "socket.io";

import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { AccessTokenIdentityService } from "#api/modules/auth/services/access-token-identity.service";
import { REALTIME_SOCKET_NAMESPACE } from "#api/modules/realtime/realtime.constants";
import {
  realtimeLessonRoom,
  realtimeUserRoom,
} from "#api/modules/realtime/utils/realtime-rooms";

type AuthenticatedSocket = Socket & {
  data: {
    authenticatedUser?: AuthenticatedUser;
  };
};

@WebSocketGateway({
  namespace: REALTIME_SOCKET_NAMESPACE,
  transports: ["websocket"],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server!: Namespace;

  constructor(
    @Inject(AccessTokenIdentityService)
    private readonly accessTokenIdentity: AccessTokenIdentityService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    const token = readHandshakeToken(client);
    const user = token ? await this.accessTokenIdentity.resolve(token) : null;
    if (!user) {
      client.disconnect(true);
      return;
    }

    client.data.authenticatedUser = user;
    await client.join(realtimeUserRoom(user.id));
  }

  handleDisconnect(client: AuthenticatedSocket) {
    client.data.authenticatedUser = undefined;
  }

  @SubscribeMessage(realtimeSocketEvents.lessonSubscribe)
  async subscribeLesson(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<LessonRealtimeSubscriptionAck> {
    const payload = lessonRealtimeSubscriptionSchema.safeParse(rawPayload);
    if (!payload.success) {
      return subscriptionError("INVALID_PAYLOAD", "Lesson subscription không hợp lệ");
    }

    const user = client.data.authenticatedUser;
    if (!user || user.role !== UserRole.ADMIN) {
      return subscriptionError("FORBIDDEN", "Bạn không có quyền theo dõi lesson này");
    }

    const lesson = await this.prisma.lesson.findFirst({
      where: { id: payload.data.lessonId, deletedAt: null },
      select: { id: true },
    });
    if (!lesson) {
      return subscriptionError("NOT_FOUND", "Không tìm thấy lesson");
    }

    await client.join(realtimeLessonRoom(lesson.id));
    return {
      ok: true,
      lessonId: lesson.id,
      subscribedAt: new Date().toISOString(),
    };
  }

  @SubscribeMessage(realtimeSocketEvents.lessonUnsubscribe)
  async unsubscribeLesson(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() rawPayload: unknown,
  ): Promise<LessonRealtimeSubscriptionAck> {
    const payload = lessonRealtimeSubscriptionSchema.safeParse(rawPayload);
    if (!payload.success) {
      return subscriptionError("INVALID_PAYLOAD", "Lesson subscription không hợp lệ");
    }

    await client.leave(realtimeLessonRoom(payload.data.lessonId));
    return {
      ok: true,
      lessonId: payload.data.lessonId,
      subscribedAt: new Date().toISOString(),
    };
  }

  emitBackgroundJobStatus(event: BackgroundJobStatusChangedEvent) {
    const rooms = [
      event.ownerUserId ? realtimeUserRoom(event.ownerUserId) : null,
      event.lessonId ? realtimeLessonRoom(event.lessonId) : null,
    ].filter((room): room is string => Boolean(room));
    if (rooms.length === 0) return;

    this.server.to(rooms).emit(realtimeSocketEvents.backgroundJobStatusChanged, event);
  }
}

function readHandshakeToken(client: Socket) {
  const token = client.handshake.auth?.token;
  return typeof token === "string" && token.length > 0 ? token : null;
}

function subscriptionError(
  code: "INVALID_PAYLOAD" | "FORBIDDEN" | "NOT_FOUND",
  message: string,
): LessonRealtimeSubscriptionAck {
  return { ok: false, code, message };
}

import { UserRole } from "@prisma/client";
import {
  backgroundJobStatusChangedEventSchema,
  realtimeSocketEvents,
} from "@learning-path/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "#api/common/prisma/prisma.service";
import type { AccessTokenIdentityService } from "#api/modules/auth/services/access-token-identity.service";
import { RealtimeGateway } from "#api/modules/realtime/gateways/realtime.gateway";

const LESSON_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_ID = "22222222-2222-4222-8222-222222222222";
const JOB_ID = "33333333-3333-4333-8333-333333333333";
const EVENT_ID = "44444444-4444-4444-8444-444444444444";

describe("M9.33 realtime background-job status", () => {
  it("keeps the public event minimal and rejects accidental private fields", () => {
    const event = createEvent();

    expect(backgroundJobStatusChangedEventSchema.parse(event)).toEqual(event);
    expect(
      backgroundJobStatusChangedEventSchema.safeParse({
        ...event,
        errorMessage: "provider-secret",
      }).success,
    ).toBe(false);
  });

  it("authenticates the socket and joins only its private user room", async () => {
    const accessTokenIdentity = {
      resolve: vi.fn(async () => ({ id: ADMIN_ID, role: UserRole.ADMIN })),
    };
    const gateway = createGateway(accessTokenIdentity);
    const client = createClient("access-token");

    await gateway.handleConnection(client.socket);

    expect(accessTokenIdentity.resolve).toHaveBeenCalledWith("access-token");
    expect(client.join).toHaveBeenCalledWith(`user:${ADMIN_ID}`);
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it("disconnects an unauthenticated socket before room subscription", async () => {
    const gateway = createGateway({ resolve: vi.fn(async () => null) });
    const client = createClient();

    await gateway.handleConnection(client.socket);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it("allows an admin to subscribe to an existing lesson room", async () => {
    const findFirst = vi.fn(async () => ({ id: LESSON_ID }));
    const gateway = createGateway(undefined, findFirst);
    const client = createClient();
    client.socket.data.authenticatedUser = {
      id: ADMIN_ID,
      role: UserRole.ADMIN,
    };

    const ack = await gateway.subscribeLesson(client.socket, {
      schemaVersion: 1,
      lessonId: LESSON_ID,
    });

    expect(ack).toMatchObject({ ok: true, lessonId: LESSON_ID });
    expect(client.join).toHaveBeenCalledWith(`lesson:${LESSON_ID}`);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: LESSON_ID, deletedAt: null },
      select: { id: true },
    });
  });

  it("rejects non-admin and malformed lesson subscriptions", async () => {
    const findFirst = vi.fn();
    const gateway = createGateway(undefined, findFirst);
    const client = createClient();
    client.socket.data.authenticatedUser = {
      id: ADMIN_ID,
      role: UserRole.STUDENT,
    };

    await expect(
      gateway.subscribeLesson(client.socket, {
        schemaVersion: 1,
        lessonId: LESSON_ID,
      }),
    ).resolves.toMatchObject({ ok: false, code: "FORBIDDEN" });
    await expect(
      gateway.subscribeLesson(client.socket, {
        schemaVersion: 1,
        lessonId: "not-a-uuid",
      }),
    ).resolves.toMatchObject({ ok: false, code: "INVALID_PAYLOAD" });
    expect(findFirst).not.toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it("fans out one validated event to the owner and lesson rooms", () => {
    const gateway = createGateway();
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    Object.defineProperty(gateway, "server", { value: { to } });
    const event = backgroundJobStatusChangedEventSchema.parse(createEvent());

    gateway.emitBackgroundJobStatus(event);

    expect(to).toHaveBeenCalledWith([`user:${ADMIN_ID}`, `lesson:${LESSON_ID}`]);
    expect(emit).toHaveBeenCalledWith(
      realtimeSocketEvents.backgroundJobStatusChanged,
      event,
    );
  });
});

function createGateway(
  accessTokenIdentity: Pick<AccessTokenIdentityService, "resolve"> = {
    resolve: vi.fn(async () => null),
  },
  lessonFindFirst = vi.fn(async () => ({ id: LESSON_ID })),
) {
  const prisma = {
    lesson: { findFirst: lessonFindFirst },
  } as unknown as PrismaService;
  return new RealtimeGateway(accessTokenIdentity as AccessTokenIdentityService, prisma);
}

function createClient(token?: string) {
  const join = vi.fn(async () => undefined);
  const leave = vi.fn(async () => undefined);
  const disconnect = vi.fn();
  const socket = {
    handshake: { auth: token ? { token } : {} },
    data: {},
    join,
    leave,
    disconnect,
  } as unknown as Parameters<RealtimeGateway["handleConnection"]>[0];

  return { socket, join, leave, disconnect };
}

function createEvent() {
  return {
    schemaVersion: 1 as const,
    eventId: EVENT_ID,
    eventType: "background_job.status_changed" as const,
    occurredAt: "2026-09-11T12:00:00.000Z",
    jobId: JOB_ID,
    lessonId: LESSON_ID,
    ownerUserId: ADMIN_ID,
    queue: "AI_GENERATION" as const,
    status: "RUNNING" as const,
    attempts: 1,
    resourceType: "LESSON_SUMMARY",
    resourceId: null,
    updatedAt: "2026-09-11T12:00:00.000Z",
  };
}

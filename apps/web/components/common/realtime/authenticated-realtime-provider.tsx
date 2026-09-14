"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { useAuthSessionStore } from "@/features/auth/session/auth-session";

export type RealtimeConnectionStatus =
  "disabled" | "disconnected" | "connecting" | "connected";

type RealtimeContextValue = {
  socket: Socket | null;
  status: RealtimeConnectionStatus;
};

const realtimeEnabled = process.env.NEXT_PUBLIC_REALTIME_JOB_EVENTS_ENABLED !== "false";

const RealtimeContext = createContext<RealtimeContextValue>({
  socket: null,
  status: realtimeEnabled ? "disconnected" : "disabled",
});

export function AuthenticatedRealtimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = useAuthSessionStore((state) => state.session);
  const isHydrated = useAuthSessionStore((state) => state.isHydrated);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<RealtimeConnectionStatus>(
    realtimeEnabled ? "disconnected" : "disabled",
  );

  useEffect(() => {
    if (!realtimeEnabled || !isHydrated || !session?.accessToken) {
      setSocket(null);
      setStatus(realtimeEnabled ? "disconnected" : "disabled");
      return;
    }

    const connection = io(`${getRealtimeOrigin()}/realtime`, {
      auth: { token: session.accessToken },
      path: process.env.NEXT_PUBLIC_SOCKET_IO_PATH ?? "/socket.io",
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      randomizationFactor: 0.4,
    });

    setSocket(connection);
    setStatus("connecting");
    const handleConnect = () => setStatus("connected");
    const handleDisconnect = () => setStatus("disconnected");
    const handleConnectError = () => setStatus("disconnected");
    connection.on("connect", handleConnect);
    connection.on("disconnect", handleDisconnect);
    connection.on("connect_error", handleConnectError);

    return () => {
      connection.off("connect", handleConnect);
      connection.off("disconnect", handleDisconnect);
      connection.off("connect_error", handleConnectError);
      connection.close();
      setSocket(null);
      setStatus("disconnected");
    };
  }, [isHydrated, session?.accessToken]);

  const value = useMemo(() => ({ socket, status }), [socket, status]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useAuthenticatedRealtime() {
  return useContext(RealtimeContext);
}

function getRealtimeOrigin() {
  const explicitUrl = process.env.NEXT_PUBLIC_REALTIME_URL;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  let origin = explicitUrl ? new URL(explicitUrl).origin : new URL(apiUrl).origin;

  if (
    typeof window !== "undefined" &&
    origin.includes("localhost") &&
    window.location.hostname !== "localhost"
  ) {
    origin = origin.replace("localhost", window.location.hostname);
  }
  return origin;
}

import type { ConnectionOptions } from "bullmq";

export function parseRedisConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);

  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use redis:// or rediss://");
  }

  const db = parseRedisDatabase(url.pathname);

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db,
    tls: url.protocol === "rediss:" ? {} : undefined,
  };
}

function parseRedisDatabase(pathname: string): number | undefined {
  const rawDatabase = pathname.replace("/", "");

  if (!rawDatabase) {
    return undefined;
  }

  const database = Number(rawDatabase);

  if (!Number.isInteger(database) || database < 0) {
    throw new Error("REDIS_URL database index must be a non-negative integer");
  }

  return database;
}

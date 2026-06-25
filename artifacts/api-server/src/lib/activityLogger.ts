import { db, activityLogs } from "@workspace/db";
import type { Request } from "express";

interface LogEvent {
  event: string;
  userId?: string | null;
  meta?: Record<string, unknown>;
  statusCode?: number;
  durationMs?: number;
  req?: Request;
}

/**
 * Fire-and-forget activity logger. Never throws — errors are swallowed so a
 * logging failure never affects the request path.
 */
export function logActivity({ event, userId, meta, statusCode, durationMs, req }: LogEvent): void {
  const ip = req?.ip ?? null;

  db.insert(activityLogs)
    .values({
      event,
      userId: userId ?? null,
      meta: meta ?? null,
      ip,
      statusCode: statusCode ?? null,
      durationMs: durationMs ?? null,
    })
    .then(() => {})
    .catch(() => {});
}

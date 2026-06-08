import type { Request, Response, NextFunction } from "express";

/**
 * Rejects the request with 401 unless an authenticated session exists.
 * Shared by the resumes, stripe, and ai routers so the auth check lives
 * in exactly one place.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

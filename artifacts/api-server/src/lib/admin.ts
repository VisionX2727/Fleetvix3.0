import type { NextFunction, Request, Response } from "express";

export const ADMIN_EMAILS = new Set([
  "venomx2424@gmail.com",
  "visionx2425@gmail.com",
]);

export function isAdminEmail(email: string | undefined) {
  return Boolean(email && ADMIN_EMAILS.has(email.trim().toLowerCase()));
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isAdminEmail(req.authUserEmail)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
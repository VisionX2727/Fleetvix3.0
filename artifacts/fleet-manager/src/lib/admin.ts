export const ADMIN_EMAILS = new Set([
  "venomx2424@gmail.com",
  "visionx2425@gmail.com",
]);

export function isAdminEmail(email: string | undefined) {
  return Boolean(email && ADMIN_EMAILS.has(email.trim().toLowerCase()));
}
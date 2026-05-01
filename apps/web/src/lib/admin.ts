export function isAdminEmail(email: string | null | undefined): boolean {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!email) return false;
  if (list.length === 0) return false;
  return list.includes(email.trim().toLowerCase());
}


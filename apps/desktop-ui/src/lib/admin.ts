export function isAdminEmail(email: string | null | undefined): boolean {
  const raw = String((import.meta as any).env?.VITE_ADMIN_EMAILS || "").trim();
  const set = new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  if (!email) return false;
  if (!set.size) return false;
  return set.has(String(email).trim().toLowerCase());
}

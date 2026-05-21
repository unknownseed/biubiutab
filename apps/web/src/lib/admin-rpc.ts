import { isAdminEmail } from "@/lib/admin";

export async function isAdmin(sb: any, userId: string, email: string | null | undefined): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc("is_admin");
    if (error) throw error;
    if (data) return true;
  } catch {
    if (isAdminEmail(email)) return true;
  }
  return false;
}

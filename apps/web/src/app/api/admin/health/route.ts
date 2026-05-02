import { isAdminEmail } from "@/lib/admin";
import { requireEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!isAdminEmail(user.email)) {
    const configured = (process.env.ADMIN_EMAILS || "").trim().length > 0;
    return Response.json(
      {
        ok: false,
        error: "Forbidden",
        email: user.email || null,
        adminEmailsConfigured: configured,
      },
      { status: 403, headers: { "cache-control": "no-store" } }
    );
  }

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "AI_BASE_URL",
    "AI_SERVICE_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_ACCESS_KEY_ID",
    "CLOUDFLARE_SECRET_ACCESS_KEY",
    "CLOUDFLARE_BUCKET_NAME",
    "CLOUDFLARE_PUBLIC_DOMAIN",
    "NEXT_PUBLIC_SITE_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ];

  const missing: string[] = [];
  for (const k of required) {
    try {
      requireEnv(k);
    } catch {
      missing.push(k);
    }
  }

  return Response.json({ ok: missing.length === 0, missing }, { status: 200, headers: { "cache-control": "no-store" } });
}

import { NextResponse } from "next/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getUserSubscriptionInfoForClient } from "@/lib/subscriptions";

export const runtime = "nodejs";

function getBearerToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : "";
}

async function getAuthedSupabaseClient(req: Request) {
  const token = getBearerToken(req);
  if (token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const sb = createSbClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) return { error: "Unauthorized", status: 401 as const };
    return { sb, userId: data.user.id } as const;
  }

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 as const };
  return { sb, userId: user.id } as const;
}

export async function GET(req: Request) {
  const auth = await getAuthedSupabaseClient(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const info = await getUserSubscriptionInfoForClient(auth.sb as any, auth.userId);
  return NextResponse.json({ userId: auth.userId, ...info }, { headers: { "cache-control": "no-store" } });
}


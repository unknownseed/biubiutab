import { NextRequest, NextResponse } from "next/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getBearerToken(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : "";
}

async function getAuthedUser(req: NextRequest) {
  const token = getBearerToken(req);
  if (token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const sb = createSbClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  }

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = await createClient();

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "12", 10) || 12));
  const search = (url.searchParams.get("search") || "").trim();
  const sort = url.searchParams.get("sort") || "created_at_desc";

  let col = "created_at";
  let ascending = false;
  if (sort === "created_at_asc") { ascending = true; }
  if (sort === "title_asc") { col = "title"; ascending = true; }
  if (sort === "title_desc") { col = "title"; ascending = false; }

  let query = sb
    .from("ai_jobs")
    .select("id,title,status,progress,created_at", { count: "exact" })
    .eq("user_id", user.id)
    .eq("status", "succeeded")
    .order(col, { ascending })
    .range((page - 1) * limit, page * limit - 1);

  if (search) {
    query = query.ilike("title", `%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    jobs: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
  });
}

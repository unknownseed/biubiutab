import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";

export async function GET() {
  return new Response(
    `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><title>Admin Setup</title></head><body style="font-family:monospace;padding:2rem;max-width:720px;margin:0 auto;line-height:1.7">
<h2>Admin Setup</h2>
<p>請點擊下方按鈕執行初始化：</p>
<form method="post"><button type="submit" style="padding:0.6rem 2rem;font-size:1rem;cursor:pointer">執行 Setup</button></form>
</body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function POST() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminByEmail = isAdminEmail(user.email);
  const results: string[] = [];

  let rpcWorks = false;
  try {
    const { data, error } = await sb.rpc("is_admin");
    rpcWorks = !error && data === true;
    if (rpcWorks) results.push("is_admin() RPC 已將你識別為管理員");
    else if (!error) results.push("is_admin() RPC 存在但你尚未被加入 admin_users 表");
  } catch {
    results.push("is_admin() RPC 不存在或無法呼叫");
  }

  if (!rpcWorks && adminByEmail) {
    try {
      const { error: insertErr } = await sb.from("admin_users").upsert({
        user_id: user.id,
        created_at: new Date().toISOString(),
      }).select("user_id").single();

      if (insertErr) {
        const codeOrMsg = (insertErr as any)?.code || insertErr.message || "";
        if (codeOrMsg === "42P01" || String(codeOrMsg).includes("does not exist")) {
          results.push("admin_users 表不存在");
        } else {
          results.push(`寫入 admin_users 失敗: ${insertErr.message}`);
        }
        return NextResponse.json({
          ok: false,
          detail: "資料庫缺少 admin_users 表與 is_admin() 函式。請在 Supabase SQL Editor 執行以下 SQL（已放在 supabase_teaching_admin_users.sql）：",
          sql: [
            "create table if not exists public.admin_users (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());",
            "create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.admin_users au where au.user_id = auth.uid()); $$;",
            "grant execute on function public.is_admin() to anon, authenticated;",
            `insert into public.admin_users(user_id) values('${user.id}') on conflict do nothing;`,
          ],
          steps: results,
        }, { status: 200 });
      }

      results.push(`已將 ${user.email || user.id} 加入 admin_users`);
      return NextResponse.json({ ok: true, steps: results, userId: user.id, email: user.email });
    } catch (e: any) {
      results.push(`操作異常: ${e instanceof Error ? e.message : String(e)}`);
      return NextResponse.json({
        ok: false,
        detail: "無法自動完成初始化。請在 Supabase SQL Editor 執行 supabase_teaching_admin_users.sql。",
        sql: [
          "create table if not exists public.admin_users (user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz not null default now());",
          "create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.admin_users au where au.user_id = auth.uid()); $$;",
          "grant execute on function public.is_admin() to anon, authenticated;",
          `insert into public.admin_users(user_id) values('${user.id}') on conflict do nothing;`,
        ],
        steps: results,
      }, { status: 200 });
    }
  }

  if (!rpcWorks && !adminByEmail) {
    return NextResponse.json({
      ok: false,
      detail: `你的 email (${user.email || "未知"}) 不在 ADMIN_EMAILS 白名單中，且 is_admin() RPC 也無法使用。`,
      steps: results,
    }, { status: 403 });
  }

  return NextResponse.json({ ok: rpcWorks, steps: results, userId: user.id, email: user.email });
}

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
      const { error: rpcErr } = await sb.rpc("admin_setup", { target_user_id: user.id });

      if (rpcErr) {
        const codeOrMsg = (rpcErr as any)?.code || rpcErr.message || "";
        if (codeOrMsg === "42883" || codeOrMsg.includes("does not exist") || codeOrMsg.includes("function") && codeOrMsg.includes("admin_setup")) {
          results.push("admin_setup RPC 不存在");
          return NextResponse.json({
            ok: false,
            detail: "資料庫缺少 admin_setup RPC 函式。請使用更新後的 supabase_teaching_admin_users.sql（含 admin_setup RPC）。",
            sql: [
              "create or replace function public.admin_setup(target_user_id uuid) returns boolean language sql security definer set search_path = public as $$ insert into public.admin_users(user_id) values(target_user_id) on conflict do nothing; select true; $$;",
              "grant execute on function public.admin_setup to authenticated;",
            ],
            steps: results,
          }, { status: 200 });
        }
        results.push(`寫入 admin_users 失敗: ${rpcErr.message}`);
        return NextResponse.json({
          ok: false,
          detail: "無法透過 RPC 將你加入 admin_users。",
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

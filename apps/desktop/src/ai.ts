import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { access } from "node:fs/promises";

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function pythonCmd() {
  const forced = (process.env.AI_PYTHON || "").trim();
  if (forced) return forced;
  return process.platform === "win32" ? "python" : "python3";
}

export async function resolveAiCwd(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), "../../services/ai"),
    path.resolve(process.cwd(), "../services/ai"),
    path.resolve(process.cwd(), "services/ai"),
  ];
  for (const c of candidates) {
    if (await exists(path.join(c, "main.py"))) return c;
  }
  throw new Error(`services/ai not found. Tried: ${candidates.join(", ")}`);
}

export type AiHandle = {
  proc: ChildProcessWithoutNullStreams;
  stop: () => void;
  getLastLogs: () => string;
};

async function waitForHealth(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  const url = "http://127.0.0.1:8001/health";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { cache: "no-store" as any });
      if (res.ok) {
        const text = await res.text().catch(() => "");
        if ((text || "").includes('"ok"') || (text || "").includes("ok")) return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("AI health check timeout");
}

export async function startAiServer(): Promise<AiHandle> {
  const cwd = await resolveAiCwd();
  const cmd = pythonCmd();
  const env: Record<string, string> = {
    ...process.env,
    AI_MAX_CONCURRENCY: process.env.AI_MAX_CONCURRENCY || "1",
    PYTHONUNBUFFERED: "1",
  } as any;

  const args = ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8001"];

  const proc = spawn(cmd, args, { cwd, env, stdio: "pipe" });
  let logBuf = "";
  const append = (chunk: Buffer) => {
    const s = chunk.toString("utf-8");
    logBuf = (logBuf + s).slice(-6000);
  };
  proc.stdout.on("data", append);
  proc.stderr.on("data", append);
  const stop = () => {
    if (proc.killed) return;
    proc.kill("SIGTERM");
  };

  await new Promise<void>((resolve, reject) => {
    proc.once("error", (e) => reject(e));
    setTimeout(() => resolve(), 0);
  });

  try {
    await waitForHealth(Number(process.env.AI_STARTUP_TIMEOUT_MS || "20000"));
  } catch (e) {
    stop();
    const tail = logBuf.trim();
    const hint = [
      "AI 服务启动失败。",
      `命令：${cmd} ${args.join(" ")}`,
      `目录：${cwd}`,
      "常见修复：进入 services/ai 后执行 python -m pip install -r requirements.txt",
      tail ? `日志：\n${tail}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    throw new Error(hint);
  }

  return { proc, stop, getLastLogs: () => logBuf };
}

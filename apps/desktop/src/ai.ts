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
  return candidates[0];
}

export type AiHandle = {
  proc: ChildProcessWithoutNullStreams;
  stop: () => void;
};

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
  const stop = () => {
    if (proc.killed) return;
    proc.kill("SIGTERM");
  };
  return { proc, stop };
}


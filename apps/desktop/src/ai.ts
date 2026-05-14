import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { access } from "node:fs/promises";
import { readFile, writeFile } from "node:fs/promises";

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

async function runCmdCapture(cmd: string, args: string[], opts: { cwd: string; env: Record<string, string> }) {
  return await new Promise<{ code: number | null; signal: NodeJS.Signals | null; output: string }>((resolve) => {
    const p = spawn(cmd, args, { cwd: opts.cwd, env: opts.env, stdio: "pipe" });
    let out = "";
    const append = (chunk: Buffer) => {
      out = (out + chunk.toString("utf-8")).slice(-12000);
    };
    p.stdout.on("data", append);
    p.stderr.on("data", append);
    p.on("close", (code, signal) => resolve({ code, signal, output: out }));
    p.on("error", () => resolve({ code: -1, signal: null, output: out }));
  });
}

async function ensureVenvReady(aiCwd: string, env: Record<string, string>) {
  const auto = (process.env.AI_AUTO_SETUP || "1").trim();
  if (auto !== "1" && auto.toLowerCase() !== "true") return;

  const venvPy = path.join(aiCwd, ".venv", "bin", "python");
  const sysPy = (process.env.AI_SYS_PYTHON || "").trim() || "python3";

  if (!(await exists(venvPy))) {
    const r = await runCmdCapture(sysPy, ["-m", "venv", ".venv"], { cwd: aiCwd, env });
    if (r.code !== 0) {
      throw new Error(`创建 venv 失败。\n命令：${sysPy} -m venv .venv\n输出：\n${r.output}`.trim());
    }
  }

  const pipUp = await runCmdCapture(venvPy, ["-m", "pip", "install", "-U", "pip"], { cwd: aiCwd, env });
  if (pipUp.code !== 0) {
    throw new Error(`升级 pip 失败。\n输出：\n${pipUp.output}`.trim());
  }

  const reqPath = path.join(aiCwd, "requirements.txt");
  const reqRaw = await readFile(reqPath, "utf-8");
  const installMadmom = (process.env.AI_INSTALL_MADMOM || "").trim().toLowerCase() === "1";
  const filtered = reqRaw
    .split(/\r?\n/)
    .filter((l) => (installMadmom ? true : !/^madmom(\s|=|<|>|~|$)/i.test(l.trim())))
    .join("\n");
  const tmpReq = path.join(aiCwd, "requirements.local.txt");
  await writeFile(tmpReq, filtered, "utf-8");

  const check = await runCmdCapture(venvPy, ["-m", "uvicorn", "--version"], { cwd: aiCwd, env });
  if (check.code === 0) {
    const sanity = await runCmdCapture(
      venvPy,
      ["-c", "import fastapi, uvicorn, pydantic; import supabase; import realtime"],
      { cwd: aiCwd, env }
    );
    if (sanity.code === 0) return;
  }

  const timeout = String(Number(process.env.AI_SETUP_TIMEOUT_MS || "0") || 0);
  const installArgs = ["-m", "pip", "install", "-r", tmpReq];
  const installed = await runCmdCapture(venvPy, installArgs, { cwd: aiCwd, env: { ...env, PIP_DEFAULT_TIMEOUT: timeout } });
  if (installed.code !== 0) {
    throw new Error(`安装 AI 依赖失败。\n命令：${venvPy} ${installArgs.join(" ")}\n输出：\n${installed.output}`.trim());
  }
}

export async function startAiServer(): Promise<AiHandle> {
  const cwd = await resolveAiCwd();
  let cmd = pythonCmd();
  if (!(process.env.AI_PYTHON || "").trim()) {
    const venvPy = path.join(cwd, ".venv", "bin", "python");
    if (await exists(venvPy)) cmd = venvPy;
  }
  const env: Record<string, string> = {
    ...process.env,
    AI_SERVICE_TOKEN: "",
    AI_STRICT_ENV: "",
    AI_MAX_CONCURRENCY: process.env.AI_MAX_CONCURRENCY || "1",
    PYTHONUNBUFFERED: "1",
  } as any;

  await ensureVenvReady(cwd, env);
  if (!(process.env.AI_PYTHON || "").trim()) {
    const venvPy = path.join(cwd, ".venv", "bin", "python");
    if (await exists(venvPy)) cmd = venvPy;
  }

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
    const timeoutMs = Number(process.env.AI_STARTUP_TIMEOUT_MS || "20000");
    const exitPromise = new Promise<never>((_, reject) => {
      proc.once("exit", (code, signal) => {
        reject(new Error(`AI process exited (code=${code ?? "null"}, signal=${signal ?? "null"})`));
      });
    });
    await Promise.race([waitForHealth(timeoutMs), exitPromise]);
  } catch (e) {
    stop();
    const tail = logBuf.trim();
    const hint = [
      "AI 服务启动失败。",
      `命令：${cmd} ${args.join(" ")}`,
      `目录：${cwd}`,
      e instanceof Error ? `原因：${e.message}` : "",
      "常见修复：进入 services/ai 后执行 python -m pip install -r requirements.txt",
      tail ? `日志：\n${tail}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    throw new Error(hint);
  }

  return { proc, stop, getLastLogs: () => logBuf };
}

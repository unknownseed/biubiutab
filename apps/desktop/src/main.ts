import "dotenv/config";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { mkdir, readFile, writeFile, copyFile, access, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { startAiServer, type AiHandle, resolveAiCwd } from "./ai";
import { startStaticServer } from "./static";

let win: BrowserWindow | null = null;
let ai: AiHandle | null = null;
let staticServer: { url: string; close: () => void } | null = null;
let aiEnsureTimer: NodeJS.Timeout | null = null;
let aiStarting = false;

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function teachingRoot() {
  return path.join(app.getPath("userData"), "teaching");
}

function teachingSongsDir() {
  return path.join(teachingRoot(), "songs");
}

function teachingPublicDir() {
  return path.join(teachingRoot(), "public");
}

async function ensureTeachingDirs() {
  await mkdir(teachingSongsDir(), { recursive: true });
  await mkdir(path.join(teachingPublicDir(), "gp5"), { recursive: true });
  await mkdir(path.join(teachingPublicDir(), "media"), { recursive: true });
}

function safeJoin(root: string, relPath: string) {
  const cleaned = String(relPath || "").replaceAll("\\", "/").replaceAll(/^\//g, "");
  const out = path.resolve(root, cleaned);
  const rootResolved = path.resolve(root);
  if (!out.startsWith(rootResolved + path.sep) && out !== rootResolved) {
    throw new Error("path escape");
  }
  return out;
}

function webBaseUrl() {
  return String(process.env.WEB_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
}

function ensureWebBaseUrl() {
  const base = webBaseUrl();
  if (!base) throw new Error("Missing env: WEB_BASE_URL");
  return base;
}

function toAbsoluteUrl(urlPath: string) {
  const base = ensureWebBaseUrl();
  if (!urlPath.startsWith("/")) throw new Error("invalid urlPath");
  return base + urlPath;
}

async function resolvePythonForAi(aiCwd: string) {
  const forced = (process.env.AI_PYTHON || "").trim();
  if (forced) return forced;
  const venvPy = path.join(aiCwd, ".venv", "bin", "python");
  if (await exists(venvPy)) return venvPy;
  return process.platform === "win32" ? "python" : "python3";
}

async function runGenerateLessons(slug: string) {
  await ensureTeachingDirs();
  const aiCwd = await resolveAiCwd();
  const py = await resolvePythonForAi(aiCwd);
  const scriptPath = path.join(aiCwd, "generate_lessons.py");
  const env: Record<string, string> = {
    ...(process.env as any),
    BIUBIU_TEACHING_SONGS_DIR: teachingSongsDir(),
    BIUBIU_TEACHING_PUBLIC_DIR: teachingPublicDir(),
    PYTHONUNBUFFERED: "1",
  };

  return await new Promise<{ ok: boolean; output: string }>((resolve) => {
    const p = spawn(py, [scriptPath, slug], { cwd: aiCwd, env, stdio: "pipe" });
    let out = "";
    const append = (b: Buffer) => {
      out = (out + b.toString("utf-8")).slice(-20000);
    };
    p.stdout.on("data", append);
    p.stderr.on("data", append);
    p.on("close", (code) => resolve({ ok: code === 0, output: out }));
    p.on("error", () => resolve({ ok: false, output: out }));
  });
}

async function isAiRunning(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:8001/health", { cache: "no-store" as any });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureAiRunning() {
  if (aiStarting) return;
  const online = await isAiRunning();
  if (online) return;
  if (ai?.proc && !ai.proc.killed) return;
  aiStarting = true;
  try {
    ai = await startAiServer();
    ai.proc.on("exit", async () => {
      if (!app.isQuitting) {
        await dialog.showMessageBox({
          type: "error",
          message: "本地 AI 服务已退出",
          detail: "请重启应用或检查本地依赖是否可用。",
        });
      }
    });
  } catch (e) {
    await dialog.showMessageBox({
      type: "error",
      message: "无法启动本地 AI 服务",
      detail: e instanceof Error ? e.message : "unknown error",
    });
    try {
      console.error(e instanceof Error ? e.message : e);
    } catch {}
  } finally {
    aiStarting = false;
  }
}

async function createMainWindow(url: string) {
  const preloadPath = path.resolve(process.cwd(), "dist/preload.cjs");
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: preloadPath,
    },
  });

  await win.loadURL(url);
}

async function start() {
  ipcMain.handle("pick-audio-file", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "Audio", extensions: ["mp3", "wav", "m4a", "aac", "flac", "ogg"] }],
    });
    const p = result.filePaths?.[0];
    if (!p) return null;
    return { path: p, name: path.basename(p) };
  });

  ipcMain.handle("pick-teaching-file", async (_e, args: { kind: "gp5" | "audio" | "video" }) => {
    const kind = args?.kind;
    const filters =
      kind === "gp5"
        ? [{ name: "GP5", extensions: ["gp5", "gp"] }]
        : kind === "audio"
          ? [{ name: "Audio", extensions: ["mp3", "wav", "m4a", "aac", "flac", "ogg"] }]
          : [{ name: "Video", extensions: ["mp4", "mov", "mkv", "webm"] }];
    const result = await dialog.showOpenDialog({ properties: ["openFile"], filters });
    const p = result.filePaths?.[0];
    if (!p) return null;
    return { path: p, name: path.basename(p) };
  });

  ipcMain.handle("teaching-get-paths", async () => {
    await ensureTeachingDirs();
    return { root: teachingRoot(), songsDir: teachingSongsDir(), publicDir: teachingPublicDir() };
  });

  ipcMain.handle("teaching-write-manifest", async (_e, args: { slug: string; text: string }) => {
    const slug = String(args?.slug || "").trim();
    if (!slug) throw new Error("missing slug");
    await ensureTeachingDirs();
    const songDir = safeJoin(teachingSongsDir(), slug);
    await mkdir(songDir, { recursive: true });
    const manifestPath = safeJoin(songDir, "manifest.json");
    await writeFile(manifestPath, String(args?.text || ""), "utf-8");
    return { manifestPath };
  });

  ipcMain.handle("teaching-save-asset", async (_e, args: { slug: string; kind: "base_gp5" | "demo_audio" | "demo_video"; sourcePath: string }) => {
    const slug = String(args?.slug || "").trim();
    if (!slug) throw new Error("missing slug");
    const src = String(args?.sourcePath || "").trim();
    if (!src) throw new Error("missing source");
    await ensureTeachingDirs();

    if (args.kind === "base_gp5") {
      const songDir = safeJoin(teachingSongsDir(), slug);
      await mkdir(songDir, { recursive: true });
      const dest = safeJoin(songDir, "base.gp5");
      await copyFile(src, dest);
      return { savedPath: dest, baseGp5Name: "base.gp5" };
    }

    const ext = path.extname(src) || (args.kind === "demo_audio" ? ".mp3" : ".mp4");
    const mediaDir = safeJoin(path.join(teachingPublicDir(), "media"), slug);
    await mkdir(mediaDir, { recursive: true });
    const filename = args.kind === "demo_audio" ? `demo_audio${ext}` : `demo_video${ext}`;
    const dest = safeJoin(mediaDir, filename);
    await copyFile(src, dest);
    return { savedPath: dest, publicUrl: `/media/${slug}/${filename}` };
  });

  ipcMain.handle("teaching-read-text", async (_e, args: { relPath: string }) => {
    await ensureTeachingDirs();
    const p = safeJoin(teachingRoot(), String(args?.relPath || ""));
    try {
      return await readFile(p, "utf-8");
    } catch (e: any) {
      if (e && (e.code === "ENOENT" || String(e.message || "").includes("ENOENT"))) return "";
      throw e;
    }
  });

  ipcMain.handle("teaching-read-public-bytes", async (_e, args: { urlPath: string }) => {
    await ensureTeachingDirs();
    const urlPath = String(args?.urlPath || "");
    if (!urlPath.startsWith("/")) throw new Error("invalid urlPath");
    const rel = path.join("public", urlPath.replaceAll("\\", "/").replaceAll(/^\//, ""));
    const p = safeJoin(teachingRoot(), rel);
    const buf = await readFile(p);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  });

  ipcMain.handle("cloud-get-text", async (_e, args: { urlPath: string }) => {
    const urlPath = String(args?.urlPath || "");
    const url = toAbsoluteUrl(urlPath);
    const res = await fetch(url, { cache: "no-store" as any });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(t || `http ${res.status}`);
    }
    return await res.text();
  });

  ipcMain.handle("cloud-get-bytes", async (_e, args: { urlPath: string }) => {
    const urlPath = String(args?.urlPath || "");
    const url = toAbsoluteUrl(urlPath);
    const res = await fetch(url, { cache: "no-store" as any });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(t || `http ${res.status}`);
    }
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  });

  ipcMain.handle("cloud-post-json", async (_e, args: { urlPath: string; body: unknown; headers?: Record<string, string> }) => {
    const urlPath = String(args?.urlPath || "");
    const url = toAbsoluteUrl(urlPath);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(args.headers || {}),
    };
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(args.body ?? {}) });
    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, text };
  });

  ipcMain.handle(
    "cloud-teaching-save",
    async (
      _e,
      args: {
        songId: string;
        accessToken: string;
        title: string;
        artist: string;
        slug: string;
        status: string;
        manifest: string;
        baseGp5Path?: string | null;
        demoAudioPath?: string | null;
        demoVideoPath?: string | null;
      }
    ) => {
      const songId = String(args?.songId || "new");
      const token = String(args?.accessToken || "").trim();
      if (!token) throw new Error("missing accessToken");
      const urlPath = `/api/desktop/admin/teaching/songs/${encodeURIComponent(songId)}/save`;
      const url = toAbsoluteUrl(urlPath);
      const fd = new FormData();
      fd.set("title", String(args?.title || ""));
      fd.set("artist", String(args?.artist || ""));
      fd.set("slug", String(args?.slug || ""));
      fd.set("status", String(args?.status || "draft"));
      fd.set("manifest", String(args?.manifest || "{}"));

      const addFile = async (field: string, p: string | null | undefined) => {
        const fp = String(p || "").trim();
        if (!fp) return;
        const buf = await readFile(fp);
        const name = path.basename(fp);
        const blob = new Blob([buf]);
        (fd as any).set(field, blob, name);
      };

      await addFile("base_gp5", args?.baseGp5Path || null);
      await addFile("demo_audio", args?.demoAudioPath || null);
      await addFile("demo_video", args?.demoVideoPath || null);

      const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd as any });
      const text = await res.text().catch(() => "");
      return { ok: res.ok, status: res.status, text };
    }
  );

  ipcMain.handle("cloud-teaching-generate", async (_e, args: { songId: string; accessToken: string }) => {
    const songId = String(args?.songId || "").trim();
    const token = String(args?.accessToken || "").trim();
    if (!songId) throw new Error("missing songId");
    if (!token) throw new Error("missing accessToken");
    const url = toAbsoluteUrl(`/api/desktop/admin/teaching/generate/${encodeURIComponent(songId)}`);
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, text };
  });

  ipcMain.handle("teaching-generate-lessons", async (_e, args: { slug: string }) => {
    const slug = String(args?.slug || "").trim();
    if (!slug) throw new Error("missing slug");
    return await runGenerateLessons(slug);
  });

  ipcMain.handle("teaching-delete-song", async (_e, args: { slug: string }) => {
    const slug = String(args?.slug || "").trim();
    if (!slug) throw new Error("missing slug");
    await ensureTeachingDirs();
    const songDir = safeJoin(teachingSongsDir(), slug);
    const gp5Dir = safeJoin(path.join(teachingPublicDir(), "gp5"), slug);
    const mediaDir = safeJoin(path.join(teachingPublicDir(), "media"), slug);
    await rm(songDir, { recursive: true, force: true }).catch(() => {});
    await rm(gp5Dir, { recursive: true, force: true }).catch(() => {});
    await rm(mediaDir, { recursive: true, force: true }).catch(() => {});
    return { ok: true };
  });

  await ensureAiRunning();
  if (aiEnsureTimer) clearInterval(aiEnsureTimer);
  aiEnsureTimer = setInterval(() => void ensureAiRunning(), 5000);

  const isDev = !app.isPackaged;
  if (isDev) {
    const port = Number(process.env.DESKTOP_UI_PORT || "5174");
    await createMainWindow(`http://127.0.0.1:${port}`);
    return;
  }

  const uiDist = path.resolve(app.getAppPath(), "../desktop-ui/dist");
  staticServer = await startStaticServer(uiDist);
  await createMainWindow(staticServer.url);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  (app as any).isQuitting = true;
  try {
    if (aiEnsureTimer) clearInterval(aiEnsureTimer);
  } catch {}
  try {
    staticServer?.close();
  } catch {}
  try {
    ai?.stop();
  } catch {}
});

app.whenReady().then(() => void start());

import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { startAiServer, type AiHandle } from "./ai";
import { startStaticServer } from "./static";

let win: BrowserWindow | null = null;
let ai: AiHandle | null = null;
let staticServer: { url: string; close: () => void } | null = null;

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
  }

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
    staticServer?.close();
  } catch {}
  try {
    ai?.stop();
  } catch {}
});

app.whenReady().then(() => void start());

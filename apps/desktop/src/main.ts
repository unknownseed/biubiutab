import { app, BrowserWindow, dialog } from "electron";
import path from "node:path";
import { startAiServer, type AiHandle } from "./ai";
import { startStaticServer } from "./static";

let win: BrowserWindow | null = null;
let ai: AiHandle | null = null;
let staticServer: { url: string; close: () => void } | null = null;

async function createMainWindow(url: string) {
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  await win.loadURL(url);
}

async function start() {
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

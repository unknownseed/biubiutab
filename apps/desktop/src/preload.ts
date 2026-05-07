import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  pickAudioFile: async () => {
    return (await ipcRenderer.invoke("pick-audio-file")) as { path: string; name: string } | null;
  },
});


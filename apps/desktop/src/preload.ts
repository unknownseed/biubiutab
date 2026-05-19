import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  pickAudioFile: async () => {
    return (await ipcRenderer.invoke("pick-audio-file")) as { path: string; name: string } | null;
  },
  pickTeachingFile: async (kind: "gp5" | "audio" | "video") => {
    return (await ipcRenderer.invoke("pick-teaching-file", { kind })) as { path: string; name: string } | null;
  },
  teachingGetPaths: async () => {
    return (await ipcRenderer.invoke("teaching-get-paths")) as { root: string; songsDir: string; publicDir: string };
  },
  teachingWriteManifest: async (slug: string, text: string) => {
    return (await ipcRenderer.invoke("teaching-write-manifest", { slug, text })) as { manifestPath: string };
  },
  teachingSaveAsset: async (slug: string, kind: "base_gp5" | "demo_audio" | "demo_video", sourcePath: string) => {
    return (await ipcRenderer.invoke("teaching-save-asset", { slug, kind, sourcePath })) as { savedPath: string; publicUrl?: string; baseGp5Name?: string };
  },
  teachingReadText: async (relPath: string) => {
    return (await ipcRenderer.invoke("teaching-read-text", { relPath })) as string;
  },
  teachingReadPublicBytes: async (urlPath: string) => {
    return (await ipcRenderer.invoke("teaching-read-public-bytes", { urlPath })) as Uint8Array;
  },
  teachingGenerateLessons: async (slug: string) => {
    return (await ipcRenderer.invoke("teaching-generate-lessons", { slug })) as { ok: boolean; output: string };
  },
  teachingDeleteSong: async (slug: string) => {
    return (await ipcRenderer.invoke("teaching-delete-song", { slug })) as { ok: boolean };
  },
  cloudGetText: async (urlPath: string) => {
    return (await ipcRenderer.invoke("cloud-get-text", { urlPath })) as string;
  },
  cloudGetBytes: async (urlPath: string) => {
    return (await ipcRenderer.invoke("cloud-get-bytes", { urlPath })) as Uint8Array;
  },
  cloudPostJson: async (urlPath: string, body: unknown, headers?: Record<string, string>) => {
    return (await ipcRenderer.invoke("cloud-post-json", { urlPath, body, headers })) as { ok: boolean; status: number; text: string };
  },
  cloudTeachingSave: async (args: {
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
  }) => {
    return (await ipcRenderer.invoke("cloud-teaching-save", args)) as { ok: boolean; status: number; text: string };
  },
  cloudTeachingGenerate: async (songId: string, accessToken: string) => {
    return (await ipcRenderer.invoke("cloud-teaching-generate", { songId, accessToken })) as { ok: boolean; status: number; text: string };
  },
});

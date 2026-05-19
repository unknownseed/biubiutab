export {};

declare global {
  interface Window {
    desktop?: {
      pickAudioFile: () => Promise<{ path: string; name: string } | null>;
      pickTeachingFile: (kind: "gp5" | "audio" | "video") => Promise<{ path: string; name: string } | null>;
      teachingGetPaths: () => Promise<{ root: string; songsDir: string; publicDir: string }>;
      teachingWriteManifest: (slug: string, text: string) => Promise<{ manifestPath: string }>;
      teachingSaveAsset: (
        slug: string,
        kind: "base_gp5" | "demo_audio" | "demo_video",
        sourcePath: string
      ) => Promise<{ savedPath: string; publicUrl?: string; baseGp5Name?: string }>;
      teachingReadText: (relPath: string) => Promise<string>;
      teachingReadPublicBytes: (urlPath: string) => Promise<Uint8Array>;
      teachingGenerateLessons: (slug: string) => Promise<{ ok: boolean; output: string }>;
      teachingDeleteSong: (slug: string) => Promise<{ ok: boolean }>;
    };
  }
}

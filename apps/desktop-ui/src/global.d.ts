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
      cloudGetText: (urlPath: string) => Promise<string>;
      cloudGetBytes: (urlPath: string) => Promise<Uint8Array>;
      cloudPostJson: (urlPath: string, body: unknown, headers?: Record<string, string>) => Promise<{ ok: boolean; status: number; text: string }>;
      cloudTeachingSave: (args: {
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
      }) => Promise<{ ok: boolean; status: number; text: string }>;
      cloudTeachingGenerate: (songId: string, accessToken: string) => Promise<{ ok: boolean; status: number; text: string }>;
    };
  }
}

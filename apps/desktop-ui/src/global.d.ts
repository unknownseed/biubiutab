export {};

declare global {
  interface Window {
    desktop?: {
      pickAudioFile: () => Promise<{ path: string; name: string } | null>;
    };
  }
}


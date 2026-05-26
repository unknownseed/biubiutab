import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type PlaybackState = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  audioSource: "midi" | "original" | "no_vocals";
  transpose: number;
  currentKey: string;
  bpm: number;
  loopA: number | null;
  loopB: number | null;
  isPlayerReady: boolean;
  isInitializing: boolean;
  playerError: string | null;
  tracks: { name: string; index: number; isSolo: boolean }[];
  activeTrackIndex: number;
  countdown: number | null;
};

type PracticeActions = {
  setPlaying: (v: boolean) => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setPlaybackRate: (r: number) => void;
  setAudioSource: (s: "midi" | "original" | "no_vocals") => void;
  setTranspose: (s: number) => void;
  setCurrentKey: (k: string) => void;
  setBpm: (b: number) => void;
  setLoopA: (t: number | null) => void;
  setLoopB: (t: number | null) => void;
  setPlayerReady: (v: boolean) => void;
  setInitializing: (v: boolean) => void;
  setPlayerError: (e: string | null) => void;
  setTracks: (t: { name: string; index: number; isSolo: boolean }[]) => void;
  setActiveTrackIndex: (i: number) => void;
  setCountdown: (c: number | null) => void;
  seekTo: (t: number) => void;
  setLoop: (type: "A" | "B" | "clear") => void;
};

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const PracticeContext = createContext<PlaybackState & PracticeActions | null>(null);

function keyFromTranspose(semitones: number): string {
  return KEYS[((semitones % 12) + 12) % 12];
}

export function PracticeProvider({ children }: { children: ReactNode }) {
  const [isPlaying, unsafeSetPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioSource, setAudioSource] = useState<"midi" | "original" | "no_vocals">("midi");
  const [transpose, unsafeSetTranspose] = useState(0);
  const [currentKey, setCurrentKey] = useState("C");
  const [bpm, setBpm] = useState(120);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [isPlayerReady, setPlayerReady] = useState(false);
  const [isInitializing, setInitializing] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<{ name: string; index: number; isSolo: boolean }[]>([]);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  const setTranspose = useCallback((s: number) => {
    unsafeSetTranspose(s);
    setCurrentKey(keyFromTranspose(s));
  }, []);

  const setPlaying = useCallback((v: boolean) => {
    unsafeSetPlaying(v);
  }, []);

  const seekTo = useCallback((t: number) => {
    setCurrentTime(t);
  }, []);

  const setLoop = useCallback((type: "A" | "B" | "clear") => {
    if (type === "clear") { setLoopA(null); setLoopB(null); }
    else if (type === "A") { setLoopA(currentTime); }
    else { setLoopB(currentTime); }
  }, [currentTime]);

  const state: PlaybackState = {
    isPlaying, currentTime, duration, playbackRate, audioSource,
    transpose, currentKey, bpm, loopA, loopB,
    isPlayerReady, isInitializing, playerError,
    tracks, activeTrackIndex, countdown,
  };

  const actions: PracticeActions = {
    setPlaying, setCurrentTime, setDuration, setPlaybackRate,
    setAudioSource, setTranspose, setCurrentKey, setBpm,
    setLoopA, setLoopB, setPlayerReady, setInitializing, setPlayerError,
    setTracks, setActiveTrackIndex, setCountdown,
    seekTo, setLoop,
  };

  return (
    <PracticeContext.Provider value={{ ...state, ...actions }}>
      {children}
    </PracticeContext.Provider>
  );
}

export function usePractice() {
  const ctx = useContext(PracticeContext);
  if (!ctx) throw new Error("usePractice must be used within PracticeProvider");
  return ctx;
}

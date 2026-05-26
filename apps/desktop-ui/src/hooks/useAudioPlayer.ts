import { useCallback, useEffect, useRef, useState } from "react";
import { aiBaseUrl } from "../lib/ai";

export function useAudioPlayer(jobId: string | null, userId: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [source, setSource] = useState<"no_vocals" | "original">("no_vocals");
  const [loaded, setLoaded] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId || !userId) return;
    const audio = new Audio();
    audioRef.current = audio;
    audio.crossOrigin = "anonymous";

    const url = `${aiBaseUrl()}/jobs/${jobId}/audio?type=${source}`;
    setLoaded(false);
    setAudioError(null);

    const onMeta = () => {
      setDuration(audio.duration || 0);
      setLoaded(true);
    };
    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onEnd = () => setIsPlaying(false);
    const onErr = () => setAudioError("音频加载失败");

    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("error", onErr);

    void fetch(url, { headers: { "x-user-id": userId } })
      .then((res) => {
        if (!res.ok) throw new Error("http " + res.status);
        return res.blob();
      })
      .then((blob) => {
        audio.src = URL.createObjectURL(blob);
        audio.load();
      })
      .catch((e) => setAudioError(e.message || "音频加载失败"));

    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("error", onErr);
      audio.pause();
      if (audio.src) URL.revokeObjectURL(audio.src);
      audioRef.current = null;
    };
  }, [jobId, userId, source]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const play = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const seek = useCallback((t: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = t;
      setCurrentTime(t);
    }
  }, []);

  return {
    isPlaying, currentTime, duration, playbackRate, source, loaded, audioError,
    setPlaybackRate, setSource, play, pause, seek,
  };
}

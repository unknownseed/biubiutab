import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PanelId } from "../panels/Sidebar";
import Sidebar from "../panels/Sidebar";
import MainStage from "../panels/MainStage";
import TransportBar from "../panels/TransportBar";

export default function DawLayout() {
  const navigate = useNavigate();
  const [activePanel, setActivePanel] = useState<PanelId>("tabs");

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(180);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioSource, setAudioSource] = useState<"midi" | "original" | "no_vocals">("midi");
  const [transpose, setTranspose] = useState(0);
  const [currentKey, setCurrentKey] = useState("C");
  const [bpm, setBpm] = useState(120);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleSeek = (t: number) => setCurrentTime(t);
  const handleRateChange = (r: number) => setPlaybackRate(r);
  const handleSourceChange = (s: "midi" | "original" | "no_vocals") => setAudioSource(s);
  const handleTransposeChange = (s: number) => {
    setTranspose(s);
    const keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    setCurrentKey(keys[((s % 12) + 12) % 12]);
  };
  const handleLoopSet = (type: "A" | "B" | "clear") => {
    if (type === "clear") { setLoopA(null); setLoopB(null); }
    else if (type === "A") { setLoopA(currentTime); }
    else { setLoopB(currentTime); }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden select-none">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activePanel={activePanel} onPanelChange={setActivePanel} />

        <div className="flex flex-1 flex-col min-w-0 relative">
          <button
            type="button"
            className="absolute top-2 right-2 z-20 px-3 py-1 text-[10px] tracking-wider rounded border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 bg-zinc-900/80 backdrop-blur"
            onClick={() => navigate("/")}
          >
            ← 旧版
          </button>
          <div className="flex-1 flex overflow-hidden">
            {activePanel !== "tabs" && (
              <div className="w-[280px] bg-zinc-900 border-r border-zinc-800 shrink-0 flex flex-col">
                <div className="h-10 border-b border-zinc-800 flex items-center px-4">
                  <span className="text-xs tracking-widest text-zinc-400 font-mono uppercase">
                    {activePanel === "learn" ? "Learn" : activePanel === "ai" ? "AI" : "Admin"}
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-zinc-600 text-xs tracking-widest font-mono">
                    {activePanel === "learn" ? "教学曲目列表" : activePanel === "ai" ? "AI 制谱入口" : "管理功能"}
                  </p>
                </div>
              </div>
            )}

            <div className="flex-1 flex flex-col min-w-0">
              <MainStage />
            </div>
          </div>

          <TransportBar
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            playbackRate={playbackRate}
            audioSource={audioSource}
            transpose={transpose}
            currentKey={currentKey}
            bpm={bpm}
            loopA={loopA}
            loopB={loopB}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
            onRateChange={handleRateChange}
            onSourceChange={handleSourceChange}
            onTransposeChange={handleTransposeChange}
            onLoopSet={handleLoopSet}
          />
        </div>
      </div>
    </div>
  );
}

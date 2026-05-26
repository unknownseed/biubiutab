import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { PanelId } from "../panels/Sidebar";
import Sidebar from "../panels/Sidebar";
import MainStage from "../panels/MainStage";
import TransportBar from "../panels/TransportBar";
import TabsPanel from "../panels/TabsPanel";
import LearnPanel from "../panels/LearnPanel";
import { PracticeProvider, usePractice } from "../hooks/usePractice";

function DawLayoutInner() {
  const navigate = useNavigate();
  const [activePanel, setActivePanel] = useState<PanelId>("tabs");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);

  const practice = usePractice();

  const handleSelectTab = useCallback((jobId: string) => {
    setSelectedJobId(jobId);
    setSelectedLesson(null);
  }, []);

  const handleSelectSong = useCallback((slug: string) => {
    setSelectedLesson(slug);
    setSelectedJobId(null);
  }, []);

  const renderSidePanel = () => {
    if (activePanel === "tabs") return null;
    return (
      <div className="w-[280px] bg-zinc-900 border-r border-zinc-800 shrink-0 flex flex-col">
        <div className="h-10 border-b border-zinc-800 flex items-center px-4 shrink-0">
          <span className="text-xs tracking-widest text-zinc-400 font-mono uppercase">
            {activePanel === "learn" ? "Teaching" : activePanel === "ai" ? "AI Generate" : "Admin"}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          {activePanel === "learn" && <LearnPanel onSelectSong={handleSelectSong} />}
          {activePanel === "ai" && (
            <div className="flex items-center justify-center h-full">
              <p className="text-zinc-600 text-xs tracking-widest font-mono">AI 制谱入口（即将开放）</p>
            </div>
          )}
          {activePanel === "admin" && (
            <div className="flex items-center justify-center h-full">
              <p className="text-zinc-600 text-xs tracking-widest font-mono">管理功能（即将开放）</p>
            </div>
          )}
        </div>
      </div>
    );
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
          <div className="flex flex-1 overflow-hidden">
            {activePanel === "tabs" ? (
              <div className="w-[280px] bg-zinc-900 border-r border-zinc-800 shrink-0 flex flex-col">
                <div className="h-10 border-b border-zinc-800 flex items-center px-4 shrink-0">
                  <span className="text-xs tracking-widest text-zinc-400 font-mono uppercase">Tabs</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <TabsPanel onSelectTab={handleSelectTab} />
                </div>
              </div>
            ) : (
              renderSidePanel()
            )}

            <div className="flex-1 flex flex-col min-w-0">
              <MainStage jobId={selectedJobId} lessonSlug={selectedLesson} />
            </div>
          </div>

          <TransportBar
            isPlaying={practice.isPlaying}
            currentTime={practice.currentTime}
            duration={practice.duration}
            playbackRate={practice.playbackRate}
            audioSource={practice.audioSource}
            transpose={practice.transpose}
            currentKey={practice.currentKey}
            bpm={practice.bpm}
            loopA={practice.loopA}
            loopB={practice.loopB}
            onPlay={() => practice.setPlaying(true)}
            onPause={() => practice.setPlaying(false)}
            onSeek={practice.seekTo}
            onRateChange={practice.setPlaybackRate}
            onSourceChange={practice.setAudioSource}
            onTransposeChange={practice.setTranspose}
            onLoopSet={practice.setLoop}
          />
        </div>
      </div>
    </div>
  );
}

export default function DawLayout() {
  return (
    <PracticeProvider>
      <DawLayoutInner />
    </PracticeProvider>
  );
}

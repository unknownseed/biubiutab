import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import type { PanelId } from "../panels/Sidebar";
import Sidebar from "../panels/Sidebar";
import MainStage from "../panels/MainStage";
import TransportBar from "../panels/TransportBar";
import TabsPanel from "../panels/TabsPanel";
import LearnPanel from "../panels/LearnPanel";
import AiPanel from "../panels/AiPanel";
import AdminPanel from "../panels/AdminPanel";
import { PracticeProvider, usePractice } from "../hooks/usePractice";
import { useAudioPlayer } from "../hooks/useAudioPlayer";

function DawLayoutInner() {
  const sb = useMemo(() => supabase(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<PanelId>("ai");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [tabsKey, setTabsKey] = useState(0);

  const practice = usePractice();
  const audio = useAudioPlayer(selectedJobId, userId);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const { data } = await sb.auth.getUser();
      if (cancelled) return;
      setUserId(data.user?.id ?? null);
    };
    void init();
    return () => { cancelled = true; };
  }, [sb]);

  useEffect(() => {
    practice.setCurrentTime(audio.currentTime);
  }, [audio.currentTime, practice]);

  useEffect(() => {
    practice.setDuration(audio.duration);
  }, [audio.duration, practice]);

  const handleSelectTab = useCallback((jobId: string) => {
    setSelectedJobId(jobId);
    setSelectedLesson(null);
  }, []);

  const handleSelectSong = useCallback((slug: string) => {
    setSelectedLesson(slug);
    setSelectedJobId(null);
  }, []);

  const handleJobCreated = useCallback((jobId: string) => {
    setSelectedJobId(jobId);
    setSelectedLesson(null);
    setTabsKey((k) => k + 1);
    setActivePanel("tabs");
  }, []);

  const renderSidePanel = () => {
    if (activePanel === "tabs") return null;
    const label = activePanel === "learn" ? "Teaching" : activePanel === "ai" ? "AI Generate" : "Admin";
    return (
      <div className="w-[280px] bg-zinc-900 border-r border-zinc-800 shrink-0 flex flex-col">
        <div className="h-10 border-b border-zinc-800 flex items-center px-4 shrink-0">
          <span className="text-xs tracking-widest text-zinc-400 font-mono uppercase">{label}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          {activePanel === "learn" && <LearnPanel onSelectSong={handleSelectSong} />}
          {activePanel === "ai" && <AiPanel onJobCreated={handleJobCreated} />}
          {activePanel === "admin" && <AdminPanel />}
        </div>
      </div>
    );
  };

  const audioSourceLabel = audio.source === "original" ? "original" : "no_vocals";

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden select-none">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activePanel={activePanel} onPanelChange={setActivePanel} />

        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex flex-1 overflow-hidden">
            {activePanel === "tabs" ? (
              <div className="w-[280px] bg-zinc-900 border-r border-zinc-800 shrink-0 flex flex-col">
                <div className="h-10 border-b border-zinc-800 flex items-center px-4 shrink-0">
                  <span className="text-xs tracking-widest text-zinc-400 font-mono uppercase">Tabs</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <TabsPanel key={tabsKey} onSelectTab={handleSelectTab} />
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
            isPlaying={audio.isPlaying}
            currentTime={audio.currentTime}
            duration={audio.duration}
            playbackRate={audio.playbackRate}
            audioSource={audioSourceLabel as "midi" | "original" | "no_vocals"}
            transpose={practice.transpose}
            currentKey={practice.currentKey}
            bpm={practice.bpm}
            loopA={practice.loopA}
            loopB={practice.loopB}
            onPlay={audio.play}
            onPause={audio.pause}
            onSeek={audio.seek}
            onRateChange={audio.setPlaybackRate}
            onSourceChange={(s) => {
              if (s === "midi") return;
              audio.setSource(s as "no_vocals" | "original");
            }}
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

'use client';

import { useState, useEffect } from 'react';
import PracticeMode from '@/components/PracticeMode';

interface PracticeBlockProps {
  title: string;
  gp5Url?: string;
  loopBars?: number[];
  defaultTempo?: number;
  tips?: string;
  videoUrl?: string;
}

export default function PracticeBlock({ title, gp5Url, loopBars, defaultTempo, tips, videoUrl }: PracticeBlockProps) {
  const [gp5Data, setGp5Data] = useState<Uint8Array | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Mock PracticeData. 
  // In a real scenario, you'd generate or fetch chordBlocks and metadata specific to this block.
  const practiceData = {
    metadata: { 
      durationSec: 60,
      tempo: defaultTempo || 80,
      title: title
    },
    chordBlocks: [
      { chord: "C", startTime: 0, endTime: 4, section: title, startBeat: 0, endBeat: 16 },
      { chord: "G", startTime: 4, endTime: 8, section: title, startBeat: 16, endBeat: 32 }
    ],
    lyrics: []
  };

  const handlePlay = async () => {
    if (gp5Data) {
      setIsPlaying(true);
      return;
    }
    
    if (!gp5Url) return;
    
    setIsLoading(true);
    try {
      // 兼容可能遗漏前导斜杠的情况
      const fetchUrl = gp5Url.startsWith('/') ? gp5Url : `/${gp5Url}`;
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`Failed to fetch GP5: ${res.status} ${res.statusText}`);
      const buf = await res.arrayBuffer();
      setGp5Data(new Uint8Array(buf));
      setIsPlaying(true);
    } catch (e) {
      console.error(e);
      alert('无法加载 GP5 谱例，请确保服务器已生成该文件。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <div className="flex gap-2">
          {loopBars && (
            <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-md text-gray-600 font-mono">
              小节: {loopBars[0]}-{loopBars[1]}
            </span>
          )}
          {defaultTempo && (
            <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-md text-gray-600 font-mono">
              BPM: {defaultTempo}
            </span>
          )}
        </div>
      </div>
      
      <div className="p-6">
        {!isPlaying ? (
          <div 
            onClick={handlePlay}
            className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center relative group cursor-pointer overflow-hidden"
          >
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <button className="bg-blue-600 text-white rounded-full p-4 transform scale-90 group-hover:scale-100 transition-all shadow-lg flex items-center gap-2">
                {isLoading ? (
                  <span className="text-sm px-2">加载中...</span>
                ) : (
                  <>
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                    <span className="pr-2 font-medium">加载并练习</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-gray-400 font-mono text-sm absolute top-4 left-4">点击加载 AlphaTab 播放器</p>
            <p className="text-gray-500 font-mono text-xs absolute bottom-4 right-4">{gp5Url}</p>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden border border-gray-200">
            {gp5Data && (
              <PracticeMode 
                practiceData={practiceData} 
                gp5Data={gp5Data} 
                songTitle={title} 
              />
            )}
          </div>
        )}
        
        {videoUrl && (
          <div className="mt-6 rounded-lg overflow-hidden border border-gray-200">
            <video 
              src={videoUrl} 
              controls 
              className="w-full aspect-video bg-black"
              preload="metadata"
            />
          </div>
        )}
        
        {tips && (
          <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4 flex gap-3">
            <div className="text-blue-600 flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-blue-900 leading-relaxed">{tips}</p>
          </div>
        )}
      </div>
    </div>
  );
}

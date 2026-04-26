interface FretboardHighlightProps {
  scale: string;
  chordTones: Record<string, string[]>;
}

export default function FretboardHighlight({ scale, chordTones }: FretboardHighlightProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">指板高亮 ({scale})</h3>
        <div className="flex gap-2">
          {Object.keys(chordTones).map(chord => (
            <span key={chord} className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-md text-gray-600 font-mono">
              {chord}
            </span>
          ))}
        </div>
      </div>
      <div className="p-6 overflow-x-auto">
        {/* Placeholder for fretboard SVG or canvas */}
        <div className="min-w-[600px] h-48 bg-amber-50 rounded-lg border-2 border-amber-900/10 flex flex-col justify-between py-2 relative">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-px bg-gray-400 w-full shadow-sm" />
          ))}
          {/* Vertical frets */}
          <div className="absolute inset-0 flex justify-between px-12 opacity-30">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="w-1 bg-gray-600 h-full" />
            ))}
          </div>
          {/* Note markers placeholder */}
          <div className="absolute top-1/2 left-1/4 w-4 h-4 bg-blue-500 rounded-full shadow-md border border-white" />
          <div className="absolute top-1/4 left-1/3 w-4 h-4 bg-green-500 rounded-full shadow-md border border-white" />
          <div className="absolute top-3/4 left-1/2 w-4 h-4 bg-red-500 rounded-full shadow-md border border-white" />
          <p className="absolute inset-0 flex items-center justify-center text-amber-900/40 font-mono text-sm font-bold">Fretboard Highlight Placeholder</p>
        </div>
      </div>
    </div>
  );
}

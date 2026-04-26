interface SongHeaderProps {
  title: string;
  artist: string;
  songKey: string;
  bpm: number;
  difficulty: string;
}

export default function SongHeader({ title, artist, songKey, bpm, difficulty }: SongHeaderProps) {
  const difficultyLabels: Record<string, string> = {
    beginner: '初级',
    intermediate: '中级',
    advanced: '高级'
  };

  const difficultyColors: Record<string, string> = {
    beginner: 'bg-green-100 text-green-800 border-green-200',
    intermediate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    advanced: 'bg-red-100 text-red-800 border-red-200'
  };

  return (
    <div className="bg-white border-b border-gray-200 py-6 px-4 shadow-sm">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">{artist}</p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium bg-gray-50 border-gray-200">
            调性: <span className="ml-1 font-bold">{songKey}</span>
          </span>
          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium bg-gray-50 border-gray-200">
            BPM: <span className="ml-1 font-bold">{bpm}</span>
          </span>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-medium ${difficultyColors[difficulty] || difficultyColors.beginner}`}>
            {difficultyLabels[difficulty] || difficulty}
          </span>
        </div>
      </div>
    </div>
  );
}

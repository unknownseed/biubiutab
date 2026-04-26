import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function TeachingLibraryPage() {
  const supabase = await createClient();
  const { data: songs, error } = await supabase
    .from('teaching_songs')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching teaching songs:', error);
  }

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
    <div className="max-w-7xl mx-auto p-4 md:p-8 pt-24 md:pt-32">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">教学库</h1>
        <p className="text-gray-500 mt-2 text-lg">从零基础到自由创作，完整的吉他学习路径。</p>
      </div>

      {!songs || songs.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-gray-500">目前还没有发布的教学曲目，敬请期待！</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {songs.map((song) => {
            const manifest = song.manifest;
            const diff = manifest.difficulty?.overall || 'beginner';
            return (
              <Link 
                key={song.id} 
                href={`/learn/${song.slug}/warmup`}
                className="block group"
              >
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 h-full flex flex-col">
                  {/* Card Cover placeholder */}
                  <div className="h-40 bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-100 flex items-center justify-center p-6 relative">
                    <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/5 transition-colors" />
                    <svg className="w-16 h-16 text-blue-200" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 18V5l12-2v13M9 9l12-2M9 13l12-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  </div>
                  
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2 gap-4">
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {manifest.title}
                      </h3>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${difficultyColors[diff] || difficultyColors.beginner}`}>
                        {difficultyLabels[diff] || diff}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-500 mb-4">{manifest.artist}</p>
                    
                    <div className="flex flex-wrap gap-2 mt-auto">
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 border-transparent">
                        {manifest.key} 调
                      </span>
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 border-transparent">
                        {manifest.bpm} BPM
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

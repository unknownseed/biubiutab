import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import SongHeader from '../_components/SongHeader';
import LessonNav from '../_components/LessonNav';
import LessonProgress from '../_components/LessonProgress';

export default async function SongLessonLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: any;
}) {
  const supabase = await createClient();
  const { slug } = await params;

  // Fetch the song from the database
  const { data: song, error } = await supabase
    .from('teaching_songs')
    .select('manifest')
    .eq('slug', slug)
    // .eq('status', 'published') // Allow drafting to be viewable if we want, or restrict
    .single();

  if (error || !song) {
    notFound();
  }

  const manifest = song.manifest;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20 pt-16">
      {/* 顶部：歌曲信息（所有模块共享）*/}
      <SongHeader
        title={manifest.title}
        artist={manifest.artist}
        songKey={manifest.key}
        bpm={manifest.bpm}
        difficulty={manifest.difficulty?.overall || 'beginner'}
      />

      {/* 中部：模块导航（所有模块共享）*/}
      <LessonNav slug={slug} />

      {/* 内容区：每个模块各自渲染 */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 lg:p-8">
        {children}
      </main>

      {/* 底部：进度提示（所有模块共享）*/}
      <LessonProgress slug={slug} />
    </div>
  );
}

import { notFound } from 'next/navigation';
import Link from 'next/link';
import LessonTemplate from '../../_components/LessonTemplate';
import PracticeBlock from '../../_components/PracticeBlock';
import { getModuleData } from '../../_lib/queries';
import { createClient } from '@/lib/supabase/server';
import { getUserSubscriptionInfo } from '@/lib/subscriptions';

export default async function AdvancedPage({
  params,
}: {
  params: any;
}) {
  const { slug } = await params;
  const data = await getModuleData(slug, 'advanced');

  if (!data) {
    notFound();
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const subInfo = await getUserSubscriptionInfo(user?.id);

  if (!subInfo.isPro) {
    return (
      <LessonTemplate title="进阶技巧" description={data.description}>
        <div className="bg-paper-100 border border-wood-400/20 p-8 md:p-12 text-center rounded-xl shadow-sm">
          <div className="w-16 h-16 bg-retro-green/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-retro-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-2xl font-serif text-ink-900 mb-4 tracking-widest">进阶内容已锁定</h3>
          <p className="text-ink-700/70 mb-8 max-w-md mx-auto leading-relaxed">
            进阶练习模块包含全曲原速跟弹与难点专项突破，并配备高清演示视频。升级 BiuBiu Pro 即可解锁全部高阶教学内容。
          </p>
          <Link 
            href="/pricing" 
            className="inline-block bg-retro-green text-paper-50 px-8 py-3 font-medium tracking-widest hover:bg-wood-500 hover:text-ink-950 transition-colors duration-300 shadow-sm"
          >
            了解 Pro 特权
          </Link>
        </div>
      </LessonTemplate>
    );
  }

  return (
    <LessonTemplate title="进阶技巧" description={data.description}>
      <div className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-800 border-b pb-2">全曲原速练习</h3>
          <PracticeBlock
            title="完整全曲"
            gp5Url={data.full_song?.gp5_url}
            defaultTempo={data.full_song?.tempo}
            tips="全速演奏时注意手腕放松，保持节奏稳定。"
            videoUrl={data.full_song?.demo_video}
          />
        </div>

        {Array.isArray(data.challenges) && data.challenges.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800 border-b pb-2">难点专项突破</h3>
            {data.challenges.map((challenge: any, idx: number) => (
              <PracticeBlock
                key={idx}
                title={challenge.title}
                gp5Url={challenge.gp5_url}
                loopBars={challenge.loop_bars}
                defaultTempo={challenge.tempo}
                tips={challenge.tips}
                videoUrl={challenge.demo_video}
              />
            ))}
          </div>
        )}
      </div>
    </LessonTemplate>
  );
}

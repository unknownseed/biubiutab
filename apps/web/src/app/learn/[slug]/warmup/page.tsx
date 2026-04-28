import { notFound } from 'next/navigation';
import LessonTemplate from '../../_components/LessonTemplate';
import PracticeBlock from '../../_components/PracticeBlock';
import { getModuleData } from '../../_lib/queries';
import { createClient } from '@/lib/supabase/server';
import { getUserSubscriptionInfo } from '@/lib/subscriptions';

export default async function WarmupPage({
  params,
}: {
  params: any;
}) {
  const { slug } = await params;
  const data = await getModuleData(slug, 'warmup');

  if (!data) {
    notFound();
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const subInfo = await getUserSubscriptionInfo(user?.id);

  return (
    <LessonTemplate title="预习模块" description={data.description}>
      <div className="space-y-12">
        
        {Array.isArray(data.chord_switches) && data.chord_switches.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800 border-b pb-2">和弦预习</h3>
            {data.chord_switches.map((item: any, idx: number) => (
              <PracticeBlock
                key={idx}
                title={item.title}
                gp5Url={item.gp5_url}
                loopBars={item.loop_bars}
                defaultTempo={item.tempo}
                tips={item.tips}
                videoUrl={subInfo.isPro ? item.demo_video : undefined}
              />
            ))}
          </div>
        )}

        {Array.isArray(data.rhythm_patterns) && data.rhythm_patterns.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800 border-b pb-2">节奏预习</h3>
            {data.rhythm_patterns.map((item: any, idx: number) => (
              <PracticeBlock
                key={idx}
                title={item.name}
                gp5Url={item.gp5_url}
                defaultTempo={item.tempo}
                tips={item.tips}
                videoUrl={subInfo.isPro ? item.demo_video : undefined}
              />
            ))}
          </div>
        )}

        {Array.isArray(data.challenges) && data.challenges.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-yellow-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              难点预告
            </h3>
            <ul className="space-y-2">
              {data.challenges.map((challenge: any, idx: number) => (
                <li key={idx} className="flex gap-2 text-yellow-900 text-sm">
                  <span className="font-bold shrink-0">{challenge.section}段:</span>
                  <span>{challenge.title} - {challenge.description}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-yellow-700">这部分将在进阶模块进行专项训练，预习阶段先了解即可。</p>
          </div>
        )}

      </div>
    </LessonTemplate>
  );
}

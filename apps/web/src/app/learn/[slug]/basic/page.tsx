import { notFound } from 'next/navigation';
import LessonTemplate from '../../_components/LessonTemplate';
import PracticeBlock from '../../_components/PracticeBlock';
import { getModuleData } from '../../_lib/queries';
import { createClient } from '@/lib/supabase/server';
import { getUserSubscriptionInfo } from '@/lib/subscriptions';

export default async function BasicPage({
  params,
}: {
  params: any;
}) {
  const { slug } = await params;
  const data = await getModuleData(slug, 'basic');

  if (!data) {
    notFound();
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const subInfo = await getUserSubscriptionInfo(user?.id);

  return (
    <LessonTemplate title="基础跟弹" description={data.description}>
      <div className="space-y-6">
        {Array.isArray(data.sections) && data.sections.map((section: any, idx: number) => (
          <PracticeBlock
            key={idx}
            title={section.label}
            gp5Url={section.gp5_url}
            loopBars={section.loop_bars}
            defaultTempo={section.tempo}
            tips={section.tips}
            videoUrl={subInfo.isPro ? section.demo_video : undefined}
          />
        ))}
      </div>
    </LessonTemplate>
  );
}

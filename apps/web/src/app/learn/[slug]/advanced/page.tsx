import { notFound } from 'next/navigation';
import LessonTemplate from '../../_components/LessonTemplate';
import PracticeBlock from '../../_components/PracticeBlock';
import { getModuleData } from '../../_lib/queries';

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

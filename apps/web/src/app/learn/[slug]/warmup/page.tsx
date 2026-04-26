import { notFound } from 'next/navigation';
import LessonTemplate from '../../_components/LessonTemplate';
import PracticeBlock from '../../_components/PracticeBlock';
import { getModuleData } from '../../_lib/queries';

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

  return (
    <LessonTemplate title="预习模块" description={data.description}>
      <div className="space-y-8">
        {Array.isArray(data.chord_switches) && data.chord_switches.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-800 border-b pb-2">和弦预习</h3>
            {data.chord_switches.map((item: any, idx: number) => (
              <PracticeBlock
                key={idx}
                title={item.title}
                gp5Url={item.gp5_url}
                defaultTempo={item.tempo}
                loopBars={item.loop_bars}
                tips="慢速按和弦切换（1 拍 1 个和弦）。"
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
                tips="在单个和弦上练习分解或扫弦节奏。"
              />
            ))}
          </div>
        )}

        {Array.isArray(data.challenges) && data.challenges.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-yellow-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              难点预告
            </h3>
            <ul className="space-y-2">
              {data.challenges.map((challenge: any, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-yellow-700">
                  <span className="font-bold mt-0.5">•</span>
                  <span>
                    <span className="font-bold">{challenge.title}</span> (小节 {challenge.bar_range[0]}-{challenge.bar_range[1]})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </LessonTemplate>
  );
}

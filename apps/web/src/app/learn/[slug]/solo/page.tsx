import { notFound } from 'next/navigation';
import Link from 'next/link';
import LessonTemplate from '../../_components/LessonTemplate';
import PracticeBlock from '../../_components/PracticeBlock';
import ScaleChart from '../../_components/ScaleChart';
import FretboardHighlight from '../../_components/FretboardHighlight';
import { getModuleData } from '../../_lib/queries';
import { createClient } from '@/lib/supabase/server';
import { getUserSubscriptionInfo } from '@/lib/subscriptions';

export default async function SoloPage({
  params,
}: {
  params: any;
}) {
  const { slug } = await params;
  const data = await getModuleData(slug, 'solo');

  if (!data) {
    notFound();
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const subInfo = await getUserSubscriptionInfo(user?.id);

  if (!subInfo.isPro) {
    return (
      <LessonTemplate title="Solo 练习" description={data.description}>
        <div className="bg-paper-100 border border-wood-400/20 p-8 md:p-12 text-center rounded-xl shadow-sm">
          <div className="w-16 h-16 bg-retro-green/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-retro-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-2xl font-serif text-ink-900 mb-4 tracking-widest">Solo 创作模块已锁定</h3>
          <p className="text-ink-700/70 mb-8 max-w-md mx-auto leading-relaxed">
            Solo 模块包含完整伴奏练习与指板音阶高亮指导功能，助您轻松即兴创作。升级 BiuBiu Pro 即可解锁无限制的高级功能。
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

  // Temporary mock data for scale notes
  const scaleNotes = ['A', 'C', 'D', 'E', 'G'];
  
  // Convert core chords array to mock chord tones if needed
  const chordTones: Record<string, string[]> = {};
  if (Array.isArray(data.chord_tones)) {
    data.chord_tones.forEach((chord: string) => {
      chordTones[chord] = ['A', 'C', 'E']; // mock
    });
  }

  return (
    <LessonTemplate title="Solo 练习" description={data.description}>
      <div className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-800 border-b pb-2">Solo Room</h3>
          <PracticeBlock
            title="伴奏练习 (Backing Track)"
            gp5Url={data.backing?.gp5_url}
            loopBars={data.backing?.loop_bars}
            defaultTempo={data.backing?.bpm}
            tips="在伴奏中自由发挥，尝试运用下方推荐的音阶。"
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-bold text-gray-800 border-b pb-2">推荐音阶</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ScaleChart
              scaleName={data.scales.primary || 'A minor pentatonic'}
              notes={scaleNotes}
            />
            {data.scales.advanced && (
              <ScaleChart
                scaleName={data.scales.advanced}
                notes={['A', 'B', 'C', 'D', 'E', 'F', 'G']}
              />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <FretboardHighlight
            scale={data.scales.primary || 'A minor pentatonic'}
            chordTones={chordTones}
          />
        </div>
      </div>
    </LessonTemplate>
  );
}

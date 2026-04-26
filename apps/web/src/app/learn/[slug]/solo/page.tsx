import { notFound } from 'next/navigation';
import LessonTemplate from '../../_components/LessonTemplate';
import PracticeBlock from '../../_components/PracticeBlock';
import ScaleChart from '../../_components/ScaleChart';
import FretboardHighlight from '../../_components/FretboardHighlight';
import { getModuleData } from '../../_lib/queries';

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

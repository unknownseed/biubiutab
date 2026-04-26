import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// In Phase 4, this spawns a Python process to parse the GP5 file
export async function POST(
  request: Request,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    const supabase = await createClient();
    const { songId } = await params;

    // 1. Fetch current song manifest
    const { data: song, error: fetchError } = await supabase
      .from('teaching_songs')
      .select('manifest, status, slug')
      .eq('id', songId)
      .single();

    if (fetchError || !song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    const slug = song.slug;
    if (!slug) {
      return NextResponse.json({ error: 'Song has no slug' }, { status: 400 });
    }

    // 2. Call Python generator script
    console.log(`[Generator] Spawning python process for slug: ${slug}`);
    
    // Construct path to the Python script (assuming it's in services/ai)
    const pythonScriptPath = path.resolve(process.cwd(), '../../services/ai/generate_lessons.py');
    const songsDir = path.resolve(process.cwd(), 'songs', slug);
    
    // We need to ensure the songs directory exists and manifest is written there
    // before calling Python, as Python expects it to be there.
    const fs = require('fs');
    if (!fs.existsSync(songsDir)) {
      fs.mkdirSync(songsDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(songsDir, 'manifest.json'), 
      JSON.stringify(song.manifest, null, 2)
    );

    // Execute Python script
    try {
      const { stdout, stderr } = await execAsync(`python3 ${pythonScriptPath} ${slug}`);
      console.log('Python Output:', stdout);
      if (stderr) console.error('Python Error:', stderr);
    } catch (pyError: any) {
      console.error('Failed to execute python script:', pyError);
      return NextResponse.json({ error: `Python execution failed: ${pyError.message}` }, { status: 500 });
    }
    
    // 3. Update the status to published
    const { error: updateError } = await supabase
      .from('teaching_songs')
      .update({ status: 'published' })
      .eq('id', songId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ 
      message: '教学模块生成成功',
      status: 'published' 
    });

  } catch (error: any) {
    console.error('Error in generator:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

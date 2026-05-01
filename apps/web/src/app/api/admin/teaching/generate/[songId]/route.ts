import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

// In Phase 4, this spawns a Python process to parse the GP5 file
export async function POST(
  request: Request,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    const supabase = await createClient();
    const { songId } = await params;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
    
    // 把 manifest 写入文件时，确保把最新的 slug 也合并进去
    const manifestToWrite = { ...song.manifest, slug };
    fs.writeFileSync(
      path.join(songsDir, 'manifest.json'), 
      JSON.stringify(manifestToWrite, null, 2)
    );

    // Execute Python script
    try {
      const repoRoot = path.resolve(process.cwd(), '../..');
      const { stdout, stderr } = await execFileAsync(
        'python3',
        [pythonScriptPath, slug],
        { cwd: repoRoot }
      );
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

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';

// Phase 4: Read actual generated JSON modules from the disk
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; module: string }> }
) {
  try {
    const supabase = await createClient();
    const { slug, module } = await params;

    // 1. Check if the song exists and is published
    const { data: song, error } = await supabase
      .from('teaching_songs')
      .select('manifest')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (error || !song) {
      return NextResponse.json(
        { error: 'Song not found or not published' },
        { status: 404 }
      );
    }

    // 2. Read the generated JSON file from disk
    const modulePath = path.resolve(process.cwd(), 'songs', slug, `${module}.json`);
    
    if (!fs.existsSync(modulePath)) {
      return NextResponse.json(
        { error: `Generated module file not found: ${module}.json` },
        { status: 404 }
      );
    }

    const moduleData = JSON.parse(fs.readFileSync(modulePath, 'utf8'));

    return NextResponse.json(moduleData);
  } catch (err) {
    console.error(`Error fetching module data:`, err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

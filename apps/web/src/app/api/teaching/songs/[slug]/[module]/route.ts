import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';
import { getTeachingModuleJson } from '@/lib/teaching-r2';

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

    const r2Data = await getTeachingModuleJson(slug, module as any);
    if (r2Data) return NextResponse.json(r2Data);

    const modulePath = path.resolve(process.cwd(), 'songs', slug, `${module}.json`);
    if (!fs.existsSync(modulePath)) {
      return NextResponse.json({ error: `Generated module file not found: ${module}.json` }, { status: 404 });
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

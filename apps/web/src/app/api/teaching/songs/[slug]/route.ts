import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createClient();
    const { slug } = await params;

    const { data: song, error } = await supabase
      .from('teaching_songs')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published') // Only fetch published songs for the frontend
      .single();

    if (error || !song) {
      return NextResponse.json(
        { error: 'Song not found or not published' },
        { status: 404 }
      );
    }

    return NextResponse.json(song);
  } catch (err) {
    console.error('Error fetching teaching song:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

import { createClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';

export async function getSongManifest(slug: string) {
  const supabase = await createClient();
  const { data: song, error } = await supabase
    .from('teaching_songs')
    .select('manifest')
    .eq('slug', slug)
    // .eq('status', 'published') // Depending on requirement
    .single();

  if (error || !song) return null;
  return song.manifest;
}

export async function getModuleData(slug: string, module: string) {
  // Check if published
  const manifest = await getSongManifest(slug);
  if (!manifest) return null;

  const modulePath = path.resolve(process.cwd(), 'songs', slug, `${module}.json`);
  if (!fs.existsSync(modulePath)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(modulePath, 'utf8'));
    return data;
  } catch (e) {
    console.error('Error reading module data', e);
    return null;
  }
}

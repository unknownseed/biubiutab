import { createClient } from '@/lib/supabase/server';
import fs from 'fs';
import path from 'path';
import { getTeachingModuleJson } from '@/lib/teaching-r2';

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

  const r2Data = await getTeachingModuleJson(slug, module as any);
  if (r2Data) return r2Data;

  const modulePath = path.resolve(process.cwd(), 'songs', slug, `${module}.json`);
  if (!fs.existsSync(modulePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(modulePath, 'utf8'));
    return data;
  } catch (e) {
    console.error('Error reading module data', e);
    return null;
  }
}

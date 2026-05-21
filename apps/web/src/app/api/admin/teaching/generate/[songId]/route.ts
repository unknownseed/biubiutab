import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'node:os';
import fs from 'node:fs';
import { repoRoot } from '@/lib/paths';
import { r2Enabled, r2GetObjectBuffer, r2PutObject } from '@/lib/r2';
import {
  TeachingModuleName,
  putTeachingModuleJson,
  teachingR2KeyGp5,
  teachingR2KeyPrefix,
  teachingR2KeySourceBaseGp5,
} from '@/lib/teaching-r2';

const execFileAsync = promisify(execFile);

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

    const root = repoRoot();
    const pythonScriptPath = path.resolve(root, 'services/ai/generate_lessons.py');
    const enabled = r2Enabled();
    const tmpRoot = path.join(os.tmpdir(), 'biubiutab-teaching', `${slug}-${Date.now()}`);
    const songsRoot = path.join(tmpRoot, 'songs');
    const publicRoot = path.join(tmpRoot, 'public');
    const songDir = path.join(songsRoot, slug);

    if (enabled) {
      fs.mkdirSync(songDir, { recursive: true });
      fs.mkdirSync(publicRoot, { recursive: true });
      const baseBuf = await r2GetObjectBuffer(teachingR2KeySourceBaseGp5(slug)).catch(() => null);
      if (!baseBuf) return NextResponse.json({ error: 'Missing base.gp5 in R2, please upload it first.' }, { status: 400 });
      fs.writeFileSync(path.join(songDir, 'base.gp5'), baseBuf);
      const manifestToWrite = { ...(song.manifest || {}), slug };
      fs.writeFileSync(path.join(songDir, 'manifest.json'), JSON.stringify(manifestToWrite, null, 2));
    } else {
      const legacySongsDir = path.resolve(process.cwd(), 'songs', slug);
      if (!fs.existsSync(legacySongsDir)) fs.mkdirSync(legacySongsDir, { recursive: true });
      const manifestToWrite = { ...(song.manifest || {}), slug };
      fs.writeFileSync(path.join(legacySongsDir, 'manifest.json'), JSON.stringify(manifestToWrite, null, 2));
    }

    let stdout = '';
    let stderr = '';
    try {
      const r = await execFileAsync('python3', [pythonScriptPath, slug], {
        cwd: root,
        env: enabled
          ? { ...process.env, BIUBIU_TEACHING_SONGS_DIR: songsRoot, BIUBIU_TEACHING_PUBLIC_DIR: publicRoot }
          : process.env,
      });
      stdout = String(r.stdout || '');
      stderr = String(r.stderr || '');
    } catch (pyError: any) {
      const msg = pyError instanceof Error ? pyError.message : String(pyError);
      return NextResponse.json({ error: `Python execution failed: ${msg}` }, { status: 500 });
    }

    try {
      if (enabled) {
        const mods: TeachingModuleName[] = ['warmup', 'basic', 'advanced', 'solo'];
        for (const mod of mods) {
          const jsonPath = path.join(songDir, `${mod}.json`);
          if (!fs.existsSync(jsonPath)) return NextResponse.json({ error: `Generated module missing: ${mod}.json` }, { status: 500 });
          const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          await putTeachingModuleJson(slug, mod, parsed);
        }

        for (const mod of ['warmup', 'basic', 'advanced', 'solo'] as const) {
          const filename = `${mod}.gp5`;
          const gp5Path = path.join(publicRoot, 'gp5', slug, filename);
          if (!fs.existsSync(gp5Path)) return NextResponse.json({ error: `Generated gp5 missing: ${filename}` }, { status: 500 });
          const bytes = fs.readFileSync(gp5Path);
          await r2PutObject(teachingR2KeyGp5(slug, filename), bytes, 'application/octet-stream');
        }

        const manifestKey = `${teachingR2KeyPrefix(slug)}/manifest.json`;
        const manifestToWrite = { ...(song.manifest || {}), slug };
        await r2PutObject(manifestKey, Buffer.from(JSON.stringify(manifestToWrite), 'utf8'), 'application/json; charset=utf-8');
      }
    } finally {
      if (enabled) {
        try {
          fs.rmSync(tmpRoot, { recursive: true, force: true });
        } catch {}
      }
    }
    
    const { error: updateError } = await supabase
      .from('teaching_songs')
      .update({ status: 'published' })
      .eq('id', songId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ message: '教学模块生成成功', status: 'published', stdout, stderr });

  } catch (error: any) {
    console.error('Error in generator:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

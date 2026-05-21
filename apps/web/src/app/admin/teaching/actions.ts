'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import fs from 'fs'
import path from 'path'
import { r2Enabled, r2PutObject } from '@/lib/r2'
import { teachingR2KeyMedia, teachingR2KeySourceBaseGp5 } from '@/lib/teaching-r2'

export async function saveTeachingSongAction(songId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('未授权，请先登录')
  }

  const title = formData.get('title') as string
  const artist = formData.get('artist') as string
  const slug = formData.get('slug') as string
  const status = formData.get('status') as 'draft' | 'published'
  const manifestRaw = formData.get('manifest') as string
  const gp5File = formData.get('gp5File') as File | null
  const videoFile = formData.get('videoFile') as File | null
  const audioFile = formData.get('audioFile') as File | null

  if (!title || !slug) {
    throw new Error('标题和 Slug 不能为空')
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    throw new Error('Slug 只能包含字母、数字、下划线或短横线')
  }

  let manifest: any = null
  try {
    if (manifestRaw) {
      manifest = JSON.parse(manifestRaw)
    }
  } catch (e) {
    throw new Error('Manifest 格式不正确，必须是有效的 JSON')
  }

  const isNew = songId === 'new'

  if (!manifest || typeof manifest !== 'object') manifest = {}
  if (!manifest.source_files || typeof manifest.source_files !== 'object') manifest.source_files = {}
  manifest.slug = slug
  manifest.title = title
  if (artist) manifest.artist = artist
  const enabled = r2Enabled()

  if (gp5File && gp5File.size > 0) {
    const fileBuffer = Buffer.from(await gp5File.arrayBuffer())
    if (enabled) {
      await r2PutObject(teachingR2KeySourceBaseGp5(slug), fileBuffer, gp5File.type || 'application/octet-stream')
    } else {
      const songsDir = path.resolve(process.cwd(), 'songs', slug)
      if (!fs.existsSync(songsDir)) fs.mkdirSync(songsDir, { recursive: true })
      fs.writeFileSync(path.join(songsDir, 'base.gp5'), fileBuffer)
    }
    manifest.source_files.base_gp5 = 'base.gp5'
  } else if (!manifest.source_files.base_gp5) {
    manifest.source_files.base_gp5 = 'base.gp5'
  }

  if (videoFile && videoFile.size > 0) {
    const fileBuffer = Buffer.from(await videoFile.arrayBuffer())
    const ext = videoFile.name.split('.').pop() || 'mp4'
    const fileName = `demo_video.${ext}`
    if (enabled) {
      await r2PutObject(teachingR2KeyMedia(slug, fileName), fileBuffer, videoFile.type || 'video/mp4')
      manifest.source_files.full_video = `/api/teaching/media/${slug}/${fileName}`
    } else {
      const publicMediaDir = path.resolve(process.cwd(), 'public', 'media', slug)
      if (!fs.existsSync(publicMediaDir)) fs.mkdirSync(publicMediaDir, { recursive: true })
      fs.writeFileSync(path.join(publicMediaDir, fileName), fileBuffer)
      manifest.source_files.full_video = `/media/${slug}/${fileName}`
    }
  }

  if (audioFile && audioFile.size > 0) {
    const fileBuffer = Buffer.from(await audioFile.arrayBuffer())
    const ext = audioFile.name.split('.').pop() || 'mp3'
    const fileName = `demo_audio.${ext}`
    if (enabled) {
      await r2PutObject(teachingR2KeyMedia(slug, fileName), fileBuffer, audioFile.type || 'audio/mpeg')
      manifest.source_files.full_audio = `/api/teaching/media/${slug}/${fileName}`
    } else {
      const publicMediaDir = path.resolve(process.cwd(), 'public', 'media', slug)
      if (!fs.existsSync(publicMediaDir)) fs.mkdirSync(publicMediaDir, { recursive: true })
      fs.writeFileSync(path.join(publicMediaDir, fileName), fileBuffer)
      manifest.source_files.full_audio = `/media/${slug}/${fileName}`
    }
  }

  const payload = {
    title,
    artist,
    slug,
    status,
    manifest,
    user_id: user.id
  }

  if (isNew) {
    const { error, data } = await supabase
      .from('teaching_songs')
      .insert([payload])
      .select('id')
      .single()

    if (error) {
      throw new Error('创建失败: ' + error.message)
    }
    
    revalidatePath('/admin/teaching')
    // 新增成功后重定向到编辑页，防止直接重定向到列表页导致的上下文丢失
    return redirect(`/admin/teaching/${data.id}`)
  } else {
    const { error } = await supabase
      .from('teaching_songs')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', songId)
      .eq('user_id', user.id)

    if (error) {
      throw new Error('更新失败: ' + error.message)
    }
    
    revalidatePath('/admin/teaching')
    // 强制它停留在编辑页，不要跳走，因为要点“生成”按钮
    return redirect(`/admin/teaching/${songId}`)
  }
}

export async function deleteTeachingSongAction(songId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('未授权，请先登录')
  }

  // 先查询出 slug，以便删除本地文件
  const { data: song, error: fetchError } = await supabase
    .from('teaching_songs')
    .select('slug')
    .eq('id', songId)
    .single()

  if (fetchError || !song) {
    throw new Error('找不到要删除的曲目')
  }

  const { error } = await supabase
    .from('teaching_songs')
    .delete()
    .eq('id', songId)
    .eq('user_id', user.id)

  if (error) {
    throw new Error('删除失败: ' + error.message)
  }

  // 删除本地生成的文件和目录
  const slug = song.slug
  if (slug) {
    const songsDir = path.resolve(process.cwd(), 'songs', slug)
    const publicGp5Dir = path.resolve(process.cwd(), 'public', 'gp5', slug)
    const publicMediaDir = path.resolve(process.cwd(), 'public', 'media', slug)

    if (fs.existsSync(songsDir)) {
      fs.rmSync(songsDir, { recursive: true, force: true })
    }
    if (fs.existsSync(publicGp5Dir)) {
      fs.rmSync(publicGp5Dir, { recursive: true, force: true })
    }
    if (fs.existsSync(publicMediaDir)) {
      fs.rmSync(publicMediaDir, { recursive: true, force: true })
    }
  }

  revalidatePath('/admin/teaching')
}

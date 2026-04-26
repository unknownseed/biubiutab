'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import fs from 'fs'
import path from 'path'

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

  let manifest: any = null
  try {
    if (manifestRaw) {
      manifest = JSON.parse(manifestRaw)
    }
  } catch (e) {
    throw new Error('Manifest 格式不正确，必须是有效的 JSON')
  }

  const isNew = songId === 'new'

  // 处理 GP5 文件上传
  if (gp5File && gp5File.size > 0) {
    const songsDir = path.resolve(process.cwd(), 'songs', slug)
    if (!fs.existsSync(songsDir)) {
      fs.mkdirSync(songsDir, { recursive: true })
    }
    
    const fileBuffer = Buffer.from(await gp5File.arrayBuffer())
    const filePath = path.join(songsDir, 'base.gp5')
    fs.writeFileSync(filePath, fileBuffer)

    // 确保 manifest 中包含 source_files 记录
    if (!manifest.source_files) {
      manifest.source_files = {}
    }
    manifest.source_files.base_gp5 = 'base.gp5'
  }

  // 处理视频文件上传
  if (videoFile && videoFile.size > 0) {
    const publicMediaDir = path.resolve(process.cwd(), 'public', 'media', slug)
    if (!fs.existsSync(publicMediaDir)) {
      fs.mkdirSync(publicMediaDir, { recursive: true })
    }
    
    const fileBuffer = Buffer.from(await videoFile.arrayBuffer())
    // Keep original extension or fallback to .mp4
    const ext = videoFile.name.split('.').pop() || 'mp4'
    const fileName = `demo_video.${ext}`
    const filePath = path.join(publicMediaDir, fileName)
    fs.writeFileSync(filePath, fileBuffer)

    if (!manifest.source_files) manifest.source_files = {}
    // 保存可访问的 public URL
    manifest.source_files.full_video = `/media/${slug}/${fileName}`
  }

  // 处理音频文件上传
  if (audioFile && audioFile.size > 0) {
    const publicMediaDir = path.resolve(process.cwd(), 'public', 'media', slug)
    if (!fs.existsSync(publicMediaDir)) {
      fs.mkdirSync(publicMediaDir, { recursive: true })
    }
    
    const fileBuffer = Buffer.from(await audioFile.arrayBuffer())
    const ext = audioFile.name.split('.').pop() || 'mp3'
    const fileName = `demo_audio.${ext}`
    const filePath = path.join(publicMediaDir, fileName)
    fs.writeFileSync(filePath, fileBuffer)

    if (!manifest.source_files) manifest.source_files = {}
    manifest.source_files.full_audio = `/media/${slug}/${fileName}`
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
    const { error } = await supabase
      .from('teaching_songs')
      .insert([payload])

    if (error) {
      throw new Error('创建失败: ' + error.message)
    }
  } else {
    const { error } = await supabase
      .from('teaching_songs')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', songId)
      .eq('user_id', user.id)

    if (error) {
      throw new Error('更新失败: ' + error.message)
    }
  }

  revalidatePath('/admin/teaching')
  redirect('/admin/teaching')
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

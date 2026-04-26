'use client'

import { useState } from 'react'
import { saveTeachingSongAction } from '../actions'

export function TeachingSongForm({ initialData, songId }: { initialData: any, songId: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const defaultManifest = {
    "id": "new_song",
    "slug": "new-song",
    "title": "New Song",
    "artist": "Artist",
    "copyright_status": "public_domain",
    "difficulty": {
      "overall": "beginner",
      "left_hand": [],
      "right_hand": []
    },
    "key": "C",
    "bpm": 100,
    "time_signature": "4/4",
    "capo": 0,
    "core_chords": ["C", "G", "Am", "F"],
    "structure": [
      {
        "name": "intro",
        "start_bar": 1,
        "end_bar": 4,
        "demo_video": "",
        "demo_audio": ""
      }
    ],
    "learning_goals": [],
    "scale_suggestions": {
      "primary": "C major"
    },
    "challenges": [
      {
        "title": "示例难点",
        "section": "intro",
        "bar_range": [1, 2],
        "demo_video": "",
        "demo_audio": ""
      }
    ],
    "source_files": {
      "base_gp5": "",
      "full_video": "",
      "full_audio": ""
    },
    "status": "draft"
  }

  const [manifestText, setManifestText] = useState(
    initialData?.manifest 
      ? JSON.stringify(initialData.manifest, null, 2)
      : JSON.stringify(defaultManifest, null, 2)
  )

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    
    try {
      const formData = new FormData(e.currentTarget)
      await saveTeachingSongAction(songId, formData)
    } catch (err: any) {
      setError(err.message)
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-sm tracking-widest border border-red-100 font-light">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-2">
          <label htmlFor="title" className="block text-sm font-medium text-ink-800 tracking-widest">
            曲目标题 (Title)
          </label>
          <input
            type="text"
            id="title"
            name="title"
            defaultValue={initialData?.title || ''}
            required
            className="w-full bg-paper-100 border border-wood-400/30 px-4 py-2.5 text-ink-800 focus:outline-none focus:border-wood-400 focus:ring-1 focus:ring-wood-400 transition-shadow font-sans text-sm"
            placeholder="例如: House of the Rising Sun"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="artist" className="block text-sm font-medium text-ink-800 tracking-widest">
            艺术家 (Artist)
          </label>
          <input
            type="text"
            id="artist"
            name="artist"
            defaultValue={initialData?.artist || ''}
            required
            className="w-full bg-paper-100 border border-wood-400/30 px-4 py-2.5 text-ink-800 focus:outline-none focus:border-wood-400 focus:ring-1 focus:ring-wood-400 transition-shadow font-sans text-sm"
            placeholder="例如: Traditional"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="slug" className="block text-sm font-medium text-ink-800 tracking-widest">
            标识符 (Slug)
          </label>
          <input
            type="text"
            id="slug"
            name="slug"
            defaultValue={initialData?.slug || ''}
            required
            className="w-full bg-paper-100 border border-wood-400/30 px-4 py-2.5 text-ink-800 focus:outline-none focus:border-wood-400 focus:ring-1 focus:ring-wood-400 transition-shadow font-mono text-sm"
            placeholder="例如: house-of-the-rising-sun"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="status" className="block text-sm font-medium text-ink-800 tracking-widest">
            状态 (Status)
          </label>
          <select
            id="status"
            name="status"
            defaultValue={initialData?.status || 'draft'}
            className="w-full bg-paper-100 border border-wood-400/30 px-4 py-2.5 text-ink-800 focus:outline-none focus:border-wood-400 focus:ring-1 focus:ring-wood-400 transition-shadow font-sans text-sm appearance-none"
          >
            <option value="draft">草稿 (Draft)</option>
            <option value="published">已发布 (Published)</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="gp5File" className="block text-sm font-medium text-ink-800 tracking-widest">
            基础 GP5 文件 (Base GP5)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="file"
              id="gp5File"
              name="gp5File"
              accept=".gp5"
              className="block w-full text-sm text-ink-800 file:mr-4 file:py-2.5 file:px-4 file:rounded-none file:border-0 file:text-sm file:font-medium file:bg-wood-400/10 file:text-wood-600 hover:file:bg-wood-400/20"
            />
            {initialData?.manifest?.source_files?.base_gp5 && (
              <span className="text-xs text-retro-green whitespace-nowrap bg-retro-green/10 px-3 py-1.5 border border-retro-green/20">
                已存在文件
              </span>
            )}
          </div>
          <p className="text-xs text-ink-700/50 mt-1 font-light tracking-widest">
            {initialData?.manifest?.source_files?.base_gp5 
              ? '重新上传将覆盖原有谱例文件。' 
              : '请上传此歌曲的原始 .gp5 文件，它将作为切分各个教学模块的基础。'}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="videoFile" className="block text-sm font-medium text-ink-800 tracking-widest">
            全曲视频演示 (Demo Video)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="file"
              id="videoFile"
              name="videoFile"
              accept="video/*"
              className="block w-full text-sm text-ink-800 file:mr-4 file:py-2.5 file:px-4 file:rounded-none file:border-0 file:text-sm file:font-medium file:bg-wood-400/10 file:text-wood-600 hover:file:bg-wood-400/20"
            />
            {initialData?.manifest?.source_files?.full_video && (
              <span className="text-xs text-retro-green whitespace-nowrap bg-retro-green/10 px-3 py-1.5 border border-retro-green/20">
                已存在视频
              </span>
            )}
          </div>
          <p className="text-xs text-ink-700/50 mt-1 font-light tracking-widest">
            上传 MP4 等视频文件，保存后会在 JSON 中自动生成 URL
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="audioFile" className="block text-sm font-medium text-ink-800 tracking-widest">
            全曲音频演示 (Demo Audio)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="file"
              id="audioFile"
              name="audioFile"
              accept="audio/*"
              className="block w-full text-sm text-ink-800 file:mr-4 file:py-2.5 file:px-4 file:rounded-none file:border-0 file:text-sm file:font-medium file:bg-wood-400/10 file:text-wood-600 hover:file:bg-wood-400/20"
            />
            {initialData?.manifest?.source_files?.full_audio && (
              <span className="text-xs text-retro-green whitespace-nowrap bg-retro-green/10 px-3 py-1.5 border border-retro-green/20">
                已存在音频
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="manifest" className="block text-sm font-medium text-ink-800 tracking-widest">
            核心配置 (Manifest JSON)
          </label>
          <button 
            type="button"
            className="text-xs text-retro-green hover:text-wood-500 tracking-widest transition-colors font-medium"
            onClick={() => {
              try {
                const parsed = JSON.parse(manifestText)
                setManifestText(JSON.stringify(parsed, null, 2))
              } catch(e) {
                alert('JSON 格式有误，无法格式化')
              }
            }}
          >
            格式化 JSON
          </button>
        </div>
        <textarea
          id="manifest"
          name="manifest"
          value={manifestText}
          onChange={(e) => setManifestText(e.target.value)}
          required
          spellCheck={false}
          rows={26}
          className="w-full bg-paper-100 border border-wood-400/30 px-4 py-4 text-ink-800 focus:outline-none focus:border-wood-400 focus:ring-1 focus:ring-wood-400 transition-shadow font-mono text-sm leading-relaxed resize-y"
        />
        <p className="text-xs text-ink-700/50 mt-2 tracking-widest font-light">
          请确保此处填写的 JSON 符合 TeachingSongManifest 接口定义。你可以直接在里面配置段落和难点的 demo_video 链接。
        </p>
      </div>

      <div className="pt-8 border-t border-wood-400/10 flex justify-end gap-4">
        {songId !== 'new' && (
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await fetch(`/api/admin/teaching/generate/${songId}`, { method: 'POST' });
                if (!res.ok) throw new Error('生成失败');
                alert('教学模块生成成功！(当前为Mock，可以直接去前端预览)');
                window.location.reload();
              } catch(e: any) {
                alert(e.message);
              }
            }}
            className="bg-retro-green text-white font-medium px-8 py-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out tracking-widest text-sm"
          >
            一键生成教学模块
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary text-ink-950 font-medium px-10 py-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out tracking-widest text-sm disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
        >
          {isSubmitting ? '保存中...' : '保存配置'}
        </button>
      </div>
    </form>
  )
}

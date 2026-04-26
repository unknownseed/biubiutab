import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TeachingSongForm } from './TeachingSongForm'

export default async function TeachingSongEditPage({
  params
}: {
  params: Promise<{ songId: string }>
}) {
  const { songId } = await params
  
  let initialData = null
  
  if (songId !== 'new') {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('teaching_songs')
      .select('*')
      .eq('id', songId)
      .single()
      
    if (error || !data) {
      notFound()
    }
    initialData = data
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 pt-24 md:pt-32">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink-900 tracking-tight">
            {songId === 'new' ? '新增教学曲目' : '编辑教学曲目'}
          </h1>
          <p className="text-ink-600 mt-2 text-sm tracking-widest">
            {songId === 'new' ? '创建一个新的曲目并填写基础信息' : '编辑曲目的 JSON Manifest 及其状态'}
          </p>
        </div>
        {songId !== 'new' && (
          <a
            href={`/learn/${initialData?.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
          >
            去前端预览
          </a>
        )}
      </div>

      <div className="bg-white border border-wood-400/20 p-6 md:p-8 shadow-sm">
        <TeachingSongForm initialData={initialData} songId={songId} />
      </div>
    </div>
  )
}

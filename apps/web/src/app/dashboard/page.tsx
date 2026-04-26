import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DeleteButton } from './DeleteButton'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 获取用户已完成的曲目，按创建时间降序
  const { data: jobs, error } = await supabase
    .from('ai_jobs')
    .select('id, title, status, progress, created_at')
    .eq('user_id', user.id)
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-paper-100 p-8 lg:p-16">
      <div className="max-w-5xl mx-auto">
        <div className="mb-12">
          <h1 className="text-3xl font-serif font-bold text-retro-green">我的曲谱库</h1>
          <p className="text-ink-700/60 mt-2 font-light tracking-widest">
            这里存放着您所有生成过的吉他谱
          </p>
        </div>

        {error ? (
          <div className="p-4 bg-red-50 text-red-600 border border-red-100 rounded-lg">
            无法加载您的曲谱列表，请稍后重试。
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 border border-dashed border-wood-400/30 bg-paper-50">
            <div className="text-wood-400/50 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>
            </div>
            <p className="text-lg font-serif text-ink-800 tracking-widest">空空如也</p>
            <p className="text-sm text-ink-700/50 mt-2 tracking-widest">您还没有生成过任何吉他谱</p>
            <Link 
              href="/" 
              className="mt-6 bg-retro-green text-paper-50 px-8 py-3 text-sm tracking-widest hover:bg-wood-400 transition-colors"
            >
              去制作一首
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <div key={job.id} className="bg-paper-50 border border-wood-400/20 p-6 flex flex-col group transition-colors hover:border-wood-400/50">
                <div className="flex-1">
                  <h3 className="text-lg font-serif font-bold text-ink-800 line-clamp-1" title={job.title || '未命名曲目'}>
                    {job.title || '未命名曲目'}
                  </h3>
                  <div className="mt-4 flex items-center justify-between text-xs tracking-widest font-light">
                    <span className="text-wood-600">已完成</span>
                    <span className="text-ink-700/40">
                      {new Date(job.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="mt-6 border-t border-wood-400/10 pt-4 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Link 
                      href={`/editor/${job.id}`}
                      className="text-sm font-sans tracking-widest text-retro-green group-hover:text-wood-500 transition-colors inline-flex items-center gap-2"
                    >
                      <span>跟弹模式</span>
                      <span>→</span>
                    </Link>
                  </div>
                  
                  <DeleteButton jobId={job.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

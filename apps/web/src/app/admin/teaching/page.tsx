import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TeachingSong } from '@/types/teaching'
import { DeleteSongButton } from './DeleteSongButton'

export const dynamic = 'force-dynamic'

export default async function AdminTeachingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: songs, error } = await supabase
    .from('teaching_songs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen bg-paper-100 p-8 lg:p-16 pt-24 lg:pt-32">
      <div className="max-w-5xl mx-auto animate-fade-in-up">
        <div className="mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-serif font-bold text-retro-green">教学曲谱库</h1>
            <p className="text-ink-700/60 mt-3 font-light tracking-widest">
              管理与配置公版教学吉他曲目
            </p>
          </div>
          <Link 
            href="/admin/teaching/new"
            className="inline-flex items-center justify-center bg-primary text-ink-950 font-medium px-6 py-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out tracking-widest text-sm"
          >
            + 新增教学曲目
          </Link>
        </div>

        {error ? (
          <div className="p-6 bg-red-50 text-red-600 border border-red-100 font-light tracking-widest">
            无法加载曲目列表：{error.message}
          </div>
        ) : (!songs || songs.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-24 border border-dashed border-wood-400/30 bg-paper-50 transition-colors hover:border-wood-400/50">
            <div className="text-wood-400/30 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>
            </div>
            <p className="text-xl font-serif text-ink-800 tracking-widest">暂无教学曲目</p>
            <p className="text-sm text-ink-700/50 mt-3 tracking-widest font-light">点击右上角按钮开始创建</p>
          </div>
        ) : (
          <div className="bg-paper-50 border border-wood-400/20 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-paper-200/50 border-b border-wood-400/20 text-ink-700">
                  <tr>
                    <th className="px-8 py-5 font-medium tracking-widest">曲目信息</th>
                    <th className="px-6 py-5 font-medium tracking-widest">难度</th>
                    <th className="px-6 py-5 font-medium tracking-widest">状态</th>
                    <th className="px-6 py-5 font-medium tracking-widest">更新时间</th>
                    <th className="px-8 py-5 font-medium tracking-widest text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wood-400/10">
                  {songs.map((song: TeachingSong) => (
                    <tr key={song.id} className="hover:bg-paper-200/30 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="font-serif font-bold text-ink-800 text-base">{song.title}</div>
                        <div className="text-ink-700/60 mt-1 font-light tracking-wider text-xs">{song.artist}</div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center px-2.5 py-1 bg-wood-400/10 text-wood-600 text-xs font-medium tracking-widest">
                          {song.manifest?.difficulty?.overall || '未设置'}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium tracking-widest ${
                          song.status === 'published' 
                            ? 'bg-section-verse/10 text-section-verse' 
                            : 'bg-ink-700/5 text-ink-700/60'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-2 ${song.status === 'published' ? 'bg-section-verse' : 'bg-ink-700/40'}`}></span>
                          {song.status === 'published' ? '已发布' : '草稿'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-ink-700/50 font-mono text-xs">
                        {new Date(song.updated_at || song.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-6">
                          <Link 
                            href={`/admin/teaching/${song.id}`}
                            className="inline-flex items-center text-retro-green hover:text-wood-500 font-medium tracking-widest transition-colors text-sm"
                          >
                            编辑配置 <span className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-4px] group-hover:translate-x-0">→</span>
                          </Link>
                          <DeleteSongButton songId={song.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

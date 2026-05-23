'use client'

import { createClient } from '@/lib/supabase/client'
import { getUserSubscriptionInfo } from '@/lib/subscriptions'
import Link from 'next/link'
import { DeleteButton } from './DeleteButton'
import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'

type JobRow = {
  id: string
  title: string | null
  status: string
  progress: number | null
  created_at: string
}

type SubInfo = {
  isPro: boolean
  planType: string
  status: string | null
  currentPeriodEnd: string | null
  usedQuota: number
  totalQuota: number
}

type DashboardResponse = {
  jobs: JobRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const PAGE_SIZE = 12

export default function DashboardClient({ user, subInfo: initialSubInfo }: { user: User; subInfo: SubInfo }) {
  const supabase = createClient()
  const [subInfo] = useState(initialSubInfo)
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sort, setSort] = useState<'created_at_desc' | 'created_at_asc' | 'title_asc' | 'title_desc'>('created_at_desc')
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)

  const remainingQuota = Math.max(0, subInfo.totalQuota - subInfo.usedQuota)
  const quotaPercent = subInfo.totalQuota > 0 ? Math.min(100, Math.round((subInfo.usedQuota / subInfo.totalQuota) * 100)) : 0
  const periodEndText = subInfo.currentPeriodEnd
    ? new Date(subInfo.currentPeriodEnd).toLocaleDateString()
    : subInfo.isPro ? '长期有效' : '—'

  const load = useCallback(async (p: number, s: string, so: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE), sort: so })
      if (s) params.set('search', s)
      const res = await fetch(`/api/dashboard/jobs?${params.toString()}`)
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login'
          return
        }
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || '加载失败')
      }
      const data: DashboardResponse = await res.json()
      setJobs(data.jobs)
      setTotalPages(data.totalPages)
      setTotal(data.total)
      setPage(data.page)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(page, search, sort)
  }, [page, search, sort, load])

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (searchTimeout) clearTimeout(searchTimeout)
    const t = setTimeout(() => {
      setSearch(value.trim())
      setPage(1)
    }, 400)
    setSearchTimeout(t)
  }

  const handleSortChange = (newSort: typeof sort) => {
    setSort(newSort)
    setPage(1)
  }

  const sortLabel = (s: typeof sort) => {
    switch (s) {
      case 'created_at_desc': return '最新'
      case 'created_at_asc': return '最早'
      case 'title_asc': return 'A-Z'
      case 'title_desc': return 'Z-A'
    }
  }

  return (
    <main className="min-h-screen bg-paper-100 p-8 lg:p-16">
      <div className="max-w-5xl mx-auto">
        <div className="mb-12">
          <h1 className="text-3xl font-serif font-bold text-retro-green">我的曲谱库</h1>
          <p className="text-ink-700/60 mt-2 font-light tracking-widest">
            这里存放着您所有生成过的吉他谱
          </p>
        </div>

        <div className="mb-10 bg-paper-50 border border-wood-400/20 p-6 lg:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="text-xs tracking-widest text-ink-700/50">会员状态</div>
              <div className="text-2xl font-serif font-bold text-ink-900">
                {subInfo.isPro ? 'BiuBiu Pro' : '体验版'}
              </div>
              <div className="text-sm tracking-widest text-ink-700/60">
                {subInfo.isPro ? `到期时间：${periodEndText}` : '升级 Pro 解锁更多次数与高级教学内容'}
              </div>
            </div>

            <div className="w-full md:max-w-sm">
              <div className="flex items-center justify-between text-xs tracking-widest text-ink-700/60">
                <span>本月制谱额度</span>
                <span className="text-ink-900">
                  {subInfo.usedQuota}/{subInfo.totalQuota}（剩余 {remainingQuota}）
                </span>
              </div>
              <div className="mt-3 h-2 bg-paper-200/60 border border-wood-400/10">
                <div className="h-full bg-retro-green" style={{ width: `${quotaPercent}%` }} />
              </div>
              {!subInfo.isPro && (
                <div className="mt-4">
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center bg-retro-green text-paper-50 px-6 py-2.5 text-sm tracking-widest hover:bg-wood-400 transition-colors"
                  >
                    升级 Pro
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="搜索曲谱标题..."
              className="w-full rounded-lg border border-paper-300 bg-white px-4 py-2.5 pl-10 text-sm text-ink-900 tracking-wider placeholder:text-ink-700/40 focus:outline-none focus:border-retro-green/50"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-700/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-700/50 tracking-widest mr-1">排序：</span>
            {(['created_at_desc', 'created_at_asc', 'title_asc', 'title_desc'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSortChange(s)}
                className={`px-3 py-1.5 text-xs tracking-widest rounded-lg border transition-colors ${
                  sort === s
                    ? 'bg-retro-green text-paper-50 border-retro-green'
                    : 'border-paper-300 bg-white text-ink-700 hover:border-retro-green/30'
                }`}
              >
                {sortLabel(s)}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="p-4 bg-red-50 text-red-600 border border-red-100 rounded-lg">
            {error}
          </div>
        ) : loading && jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 border border-dashed border-wood-400/30 bg-paper-50">
            <p className="text-sm text-ink-700/50 tracking-widest">加载中…</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 border border-dashed border-wood-400/30 bg-paper-50">
            <div className="text-wood-400/50 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>
            </div>
            <p className="text-lg font-serif text-ink-800 tracking-widest">{search ? '未找到匹配曲谱' : '空空如也'}</p>
            <p className="text-sm text-ink-700/50 mt-2 tracking-widest">
              {search ? '试试其他关键词？' : '您还没有生成过任何吉他谱'}
            </p>
            {!search && (
              <Link
                href="/play"
                className="mt-6 bg-retro-green text-paper-50 px-8 py-3 text-sm tracking-widest hover:bg-wood-400 transition-colors"
              >
                去制作一首
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {jobs.map((job) => (
                <div key={job.id} className="bg-paper-50 border border-wood-400/20 p-6 flex flex-col group transition-colors hover:border-wood-400/50">
                  <div className="flex-1">
                    <h3 className="text-lg font-serif font-bold text-ink-800 line-clamp-1" title={job.title || '未命名曲目'}>
                      {job.title || '未命名曲目'}
                    </h3>
                    <div className="mt-4 flex items-center justify-between text-xs tracking-widest font-light">
                      <span className="text-wood-600">{job.status}</span>
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

            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-4 py-2 text-sm tracking-widest rounded-lg border border-paper-300 bg-white text-ink-700 disabled:opacity-30 hover:border-retro-green/30 transition-colors"
                >
                  上一页
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`w-10 h-10 text-sm tracking-widest rounded-lg border transition-colors ${
                      p === page
                        ? 'bg-retro-green text-paper-50 border-retro-green'
                        : 'border-paper-300 bg-white text-ink-700 hover:border-retro-green/30'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-4 py-2 text-sm tracking-widest rounded-lg border border-paper-300 bg-white text-ink-700 disabled:opacity-30 hover:border-retro-green/30 transition-colors"
                >
                  下一页
                </button>
              </div>
            )}

            <div className="mt-4 text-center text-xs text-ink-700/40 tracking-wider">
              共 {total} 首曲谱，第 {page}/{totalPages} 页
            </div>
          </>
        )}
      </div>
    </main>
  )
}

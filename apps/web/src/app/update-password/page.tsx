'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/toast-provider'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()
  const toast = useToast()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致")
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError("密码长度至少为 6 个字符")
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password })
    
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
    } else {
      toast.push({
        title: "密码修改成功",
        description: "您的账号密码已更新",
        variant: "success"
      })
      router.push('/')
      router.refresh()
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-paper-100 p-4">
      <div className="w-full max-w-md bg-paper-50 rounded-2xl shadow-xl border border-wood-400/20 p-8">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-retro-green text-paper-50 font-serif font-bold text-2xl mb-4 hover:bg-wood-400 transition-colors">
            B
          </Link>
          <h1 className="text-2xl font-serif font-bold text-retro-green">
            修改密码
          </h1>
          <p className="text-sm text-ink-700/60 mt-2">
            请输入您的新密码
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-retro-green mb-1" htmlFor="password">
              新密码
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border border-wood-400/30 bg-white text-ink-800 placeholder:text-ink-700/30 focus:outline-none focus:border-wood-400 focus:ring-1 focus:ring-wood-400 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-retro-green mb-1" htmlFor="confirmPassword">
              确认新密码
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border border-wood-400/30 bg-white text-ink-800 placeholder:text-ink-700/30 focus:outline-none focus:border-wood-400 focus:ring-1 focus:ring-wood-400 transition-all"
            />
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-retro-green hover:bg-wood-400 text-paper-50 font-sans tracking-widest rounded-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '请稍候...' : '确认修改'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-ink-700/70">
          <Link
            href="/"
            className="text-wood-600 hover:text-wood-400 font-medium transition-colors"
          >
            返回首页
          </Link>
        </div>
      </div>
    </main>
  )
}

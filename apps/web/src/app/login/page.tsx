'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { login, signup } from './actions'
import Link from 'next/link'
import { Suspense } from 'react'

function LoginContent() {
  const searchParams = useSearchParams()
  const [isLogin, setIsLogin] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get('mode') === 'signup') {
      setIsLogin(false)
    }
  }, [searchParams])

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    
    const action = isLogin ? login : signup
    const result = await action(formData)
    
    if (result?.error) {
      setError(result.error)
      setLoading(false)
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
            {isLogin ? '欢迎回到 BiuBiu Tab' : '加入 BiuBiu Tab'}
          </h1>
          <p className="text-sm text-ink-700/60 mt-2">
            {isLogin ? '登录以继续你的音乐之旅' : '创建一个免费账号开始制作吉他谱'}
          </p>
        </div>

        <form action={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-retro-green mb-1" htmlFor="email">
              邮箱地址
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-lg border border-wood-400/30 bg-white text-ink-800 placeholder:text-ink-700/30 focus:outline-none focus:border-wood-400 focus:ring-1 focus:ring-wood-400 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-retro-green mb-1" htmlFor="password">
              密码
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
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
            {loading ? '请稍候...' : (isLogin ? '登录' : '注册')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-ink-700/70">
          {isLogin ? '还没有账号？' : '已经有账号了？'}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin)
              setError(null)
            }}
            className="ml-2 text-wood-600 hover:text-wood-400 font-medium transition-colors"
          >
            {isLogin ? '立即注册' : '直接登录'}
          </button>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-paper-100 p-4">
        <div className="w-full max-w-md bg-paper-50 rounded-2xl shadow-xl border border-wood-400/20 p-8 text-center text-ink-700/50">
          加载中...
        </div>
      </main>
    }>
      <LoginContent />
    </Suspense>
  )
}

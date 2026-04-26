import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 必须调用 getUser() 以防 token 伪造，它会主动向服务器验证
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // 需要保护的页面和 API 路由
  const protectedPrefixes = [
    '/dashboard',
    '/play', 
    '/editor',
    '/update-password',
    '/api/jobs', 
    '/api/upload-url'
  ]

  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix))

  if (isProtected && !user) {
    // 拦截 API 请求，返回 401 阻止白嫖计算资源
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized: 请先登录后再执行此操作' },
        { status: 401 }
      )
    }

    // 拦截页面请求，重定向到登录页
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 已经登录的用户如果访问 /login，重定向回首页
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

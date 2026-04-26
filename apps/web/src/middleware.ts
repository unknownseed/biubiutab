import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，但排除以下：
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (站点图标)
     * - 已知的静态资源扩展名
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteJobAction(jobId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('未授权，请先登录')
  }

  // 增加 user_id 校验，确保用户只能删除自己的曲谱
  const { error } = await supabase
    .from('ai_jobs')
    .delete()
    .eq('id', jobId)
    .eq('user_id', user.id)

  if (error) {
    throw new Error('删除失败: ' + error.message)
  }

  // 删除成功后，触发 /dashboard 页面的重新渲染
  revalidatePath('/dashboard')
}

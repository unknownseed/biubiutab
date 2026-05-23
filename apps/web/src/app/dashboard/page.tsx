import { createClient } from '@/lib/supabase/server'
import { getUserSubscriptionInfo } from '@/lib/subscriptions'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const subInfo = await getUserSubscriptionInfo(user.id)

  return <DashboardClient user={user} subInfo={subInfo} />
}

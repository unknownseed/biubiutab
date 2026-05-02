'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function friendlyAuthError(message: string, mode: 'login' | 'signup') {
  const m = (message || '').toLowerCase()
  if (m.includes('invalid login credentials')) {
    return '邮箱或密码不正确，或该邮箱尚未注册。'
  }
  if (m.includes('email not confirmed')) {
    return '邮箱尚未验证，请先去邮箱点击验证链接。'
  }
  if (m.includes('user already registered') || m.includes('user already exists')) {
    return mode === 'signup' ? '该邮箱已注册，请直接登录。' : '该邮箱已注册，请直接登录。'
  }
  if (m.includes('password should be at least') || m.includes('password')) {
    return '密码不符合要求，请尝试更长或更复杂的密码。'
  }
  return message || '登录失败，请稍后重试。'
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: friendlyAuthError(error.message, 'login') }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  // Next.js App Router default auth flow:
  // Usually email confirm is enabled. If disabled, it just logs in.
  const { data: res, error } = await supabase.auth.signUp(data)

  if (error) {
    return { error: friendlyAuthError(error.message, 'signup') }
  }

  if (!res.session) {
    return { message: '已发送验证邮件，请去邮箱完成验证后再登录。' }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

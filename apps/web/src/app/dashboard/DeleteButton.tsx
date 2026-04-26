'use client'

import { useTransition } from 'react'
import { deleteJobAction } from './actions'

export function DeleteButton({ jobId }: { jobId: string }) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (window.confirm('确定要删除这首曲谱吗？此操作无法恢复。')) {
      startTransition(async () => {
        try {
          await deleteJobAction(jobId)
        } catch (error) {
          alert('删除失败，请重试')
        }
      })
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-sm font-sans tracking-widest text-red-400 hover:text-red-600 transition-colors disabled:opacity-50"
    >
      {isPending ? '删除中...' : '删除'}
    </button>
  )
}

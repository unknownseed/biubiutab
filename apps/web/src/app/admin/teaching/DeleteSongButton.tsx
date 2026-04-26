'use client'

import { useState } from 'react'
import { deleteTeachingSongAction } from './actions'

export function DeleteSongButton({ songId }: { songId: string }) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm('确定要删除这首教学曲目吗？此操作无法恢复。')) {
      return
    }

    try {
      setIsDeleting(true)
      await deleteTeachingSongAction(songId)
    } catch (error: any) {
      alert(error.message)
      setIsDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-red-800/60 hover:text-red-600 font-medium tracking-widest transition-colors text-sm disabled:opacity-50"
    >
      {isDeleting ? '删除中...' : '删除'}
    </button>
  )
}

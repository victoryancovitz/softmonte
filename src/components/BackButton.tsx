'use client'
import { useRouter } from 'next/navigation'

export default function BackButton({ fallback }: { fallback?: string }) {
  const router = useRouter()

  return (
    <button
      onClick={() => {
        if (window.history.length > 2) {
          router.back()
        } else if (fallback) {
          router.push(fallback)
        } else {
          router.push('/dashboard')
        }
      }}
      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 flex-shrink-0"
      title="Voltar"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}

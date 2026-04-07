'use client'
import { useEffect } from 'react'

export default function DocumentViewer({
  url,
  fileName,
  onClose,
}: {
  url: string
  fileName: string
  onClose: () => void
}) {
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const ext = (fileName.split('.').pop() ?? '').toLowerCase()
  const isPdf = ext === 'pdf'
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col">
      {/* Header */}
      <div className="bg-[#0f1e2e] flex items-center justify-between px-4 h-14 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[#c8960c] flex-shrink-0">
            <path d="M3 2h8l4 4v11a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            <path d="M11 2v4h4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          </svg>
          <span className="text-white text-sm font-medium truncate">{fileName}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={url}
            download={fileName}
            target="_blank"
            rel="noopener"
            className="px-3 py-1.5 bg-[#c8960c] text-white rounded-lg text-xs font-bold hover:opacity-90 flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v7M3 5l3 3 3-3M2 11h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Baixar
          </a>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg text-white hover:bg-white/10 flex items-center justify-center"
            title="Fechar (ESC)"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {isPdf ? (
          <iframe src={url} className="w-full h-full bg-white rounded-lg" title={fileName} />
        ) : isImage ? (
          <img src={url} alt={fileName} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        ) : (
          <div className="bg-white rounded-2xl p-8 max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-gray-400">
                <path d="M5 3h10l4 4v13a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
            <p className="text-sm text-gray-700 font-medium mb-1">Pré-visualização não disponível</p>
            <p className="text-xs text-gray-400 mb-4">Formato .{ext} não suportado para visualização inline</p>
            <a
              href={url}
              download={fileName}
              target="_blank"
              rel="noopener"
              className="inline-block px-5 py-2 bg-[#0f1e2e] text-white rounded-xl text-sm font-medium hover:bg-[#0f1e2e]/90"
            >
              Baixar arquivo
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'
import { useEffect } from 'react'

export default function PrintTrigger({ filename }: { filename: string }) {
  useEffect(() => {
    document.title = filename
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [filename])

  return (
    <div className="no-print" style={{ background: '#0F3757', color: 'white', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, position: 'sticky', top: 0, zIndex: 10 }}>
      <span style={{ fontWeight: 700 }}>Pré-visualização de impressão</span>
      <span style={{ opacity: 0.7, fontSize: 13 }}>Pressione Ctrl+P (ou Cmd+P) → "Salvar como PDF" se o diálogo não abrir automaticamente.</span>
      <button
        onClick={() => window.print()}
        style={{ marginLeft: 'auto', background: '#C9A269', color: '#0F3757', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
        🖨 Imprimir / Salvar PDF
      </button>
    </div>
  )
}

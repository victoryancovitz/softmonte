'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { FileText, Download } from 'lucide-react'

export default function PortalDocumentosPage() {
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: func } = await supabase.from('funcionarios').select('id').eq('user_id', user.id).maybeSingle()
      if (!func) { setLoading(false); return }
      const { data } = await supabase.from('documentos').select('*').eq('funcionario_id', func.id).is('deleted_at', null).order('created_at', { ascending: false })
      setDocs(data || [])
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/portal" />
        <Link href="/portal" className="text-gray-400 hover:text-gray-600">Portal</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Meus documentos</span>
      </div>

      <h1 className="text-xl font-bold font-display text-brand mb-1">Meus documentos</h1>
      <p className="text-sm text-gray-500 mb-6">Acesso aos seus documentos cadastrados no RH.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {docs.length > 0 ? docs.map(d => {
          const venc = d.vencimento ? new Date(d.vencimento + 'T12:00') : null
          const venceEm = venc ? Math.ceil((venc.getTime() - Date.now()) / 86400000) : null
          const vencColor = venceEm === null ? 'text-blue-600' : venceEm < 0 ? 'text-red-700' : venceEm <= 30 ? 'text-amber-700' : 'text-gray-500'
          return (
            <div key={d.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm truncate">{d.tipo}</div>
                  <div className="text-xs text-gray-500 truncate">{d.nome || d.arquivo_nome || '—'}</div>
                  <div className={`text-[11px] mt-0.5 ${vencColor}`}>
                    {venc ? `Vence ${venc.toLocaleDateString('pt-BR')}` : '∞ Não vence'}
                  </div>
                </div>
                {d.arquivo_url && (
                  <a href={d.arquivo_url} target="_blank" rel="noreferrer"
                    className="text-brand hover:text-brand-dark" title="Baixar">
                    <Download className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          )
        }) : (
          <div className="col-span-2 bg-white rounded-xl border border-gray-100 p-10 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Nenhum documento cadastrado.</p>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import DocumentViewer from '@/components/DocumentViewer'

const TIPOS = ['ASO','NR-10','NR-35','NR-33','NR-12','CIPA','outro'] as const

export default function FuncionarioDocumentos({
  funcionarioId,
  documentos,
}: {
  funcionarioId: string
  documentos: any[]
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(null)
  const [form, setForm] = useState({ tipo: 'ASO', emissao: '', vencimento: '' })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const toast = useToast()

  // Group docs by type
  const grouped: Record<string, any[]> = {}
  documentos.forEach(d => {
    const t = d.tipo ?? 'outro'
    if (!grouped[t]) grouped[t] = []
    grouped[t].push(d)
  })

  function statusOf(d: any) {
    if (!d.vencimento) return { label: 'Sem venc.', cls: 'bg-gray-100 text-gray-500' }
    const dias = Math.ceil((new Date(d.vencimento + 'T12:00').getTime() - Date.now()) / 86400000)
    if (dias < 0) return { label: 'Vencido', cls: 'bg-red-100 text-red-700' }
    if (dias <= 30) return { label: `Vence em ${dias}d`, cls: 'bg-amber-100 text-amber-700' }
    return { label: 'Válido', cls: 'bg-green-100 text-green-700' }
  }

  async function handleSave() {
    if (!form.vencimento) {
      toast.error('Data de vencimento é obrigatória')
      return
    }
    setSaving(true)

    let arquivo_url: string | null = null
    let arquivo_nome: string | null = null

    if (file) {
      const ext = file.name.split('.').pop()
      const path = `${funcionarioId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('documentos').upload(path, file)
      if (upErr) {
        toast.error('Erro no upload: ' + upErr.message)
        setSaving(false)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path)
      arquivo_url = publicUrl
      arquivo_nome = file.name
    }

    const { error } = await supabase.from('documentos').insert({
      funcionario_id: funcionarioId,
      tipo: form.tipo,
      emissao: form.emissao || null,
      vencimento: form.vencimento,
      arquivo_url,
      arquivo_nome,
    })

    if (error) {
      toast.error('Erro: ' + error.message)
      setSaving(false)
      return
    }

    toast.success('Documento adicionado!')
    setShowAdd(false)
    setForm({ tipo: 'ASO', emissao: '', vencimento: '' })
    setFile(null)
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-brand font-display">Documentos</h2>
        <button onClick={() => setShowAdd(true)}
          className="text-xs text-brand hover:underline font-medium">+ Adicionar documento</button>
      </div>

      {documentos.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhum documento cadastrado.</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([tipo, docs]) => (
            <div key={tipo}>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{tipo}</div>
              <div className="space-y-1.5">
                {docs.map(d => {
                  const st = statusOf(d)
                  return (
                    <div key={d.id} className="flex items-center justify-between py-2 px-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-3 min-w-0">
                        {d.arquivo_url ? (
                          <button onClick={() => setViewer({ url: d.arquivo_url, name: d.arquivo_nome ?? `${tipo}.pdf` })}
                            className="text-sm text-brand font-medium hover:underline truncate max-w-[200px]">
                            {d.arquivo_nome ?? `${tipo}.pdf`}
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Sem arquivo</span>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {d.emissao && <span>Emissão: {new Date(d.emissao+'T12:00').toLocaleDateString('pt-BR')}</span>}
                          {d.vencimento && <span>Vence: {new Date(d.vencimento+'T12:00').toLocaleDateString('pt-BR')}</span>}
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${st.cls}`}>{st.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-brand mb-4">Adicionar documento</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo *</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Data de emissão</label>
                <input type="date" value={form.emissao} onChange={e => setForm(f => ({ ...f, emissao: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Data de vencimento *</label>
                <input type="date" value={form.vencimento} onChange={e => setForm(f => ({ ...f, vencimento: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Arquivo</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs text-gray-500 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-gray-200 file:bg-white file:text-xs file:font-medium" />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setShowAdd(false)} disabled={saving}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewer && <DocumentViewer url={viewer.url} fileName={viewer.name} onClose={() => setViewer(null)} />}
    </div>
  )
}

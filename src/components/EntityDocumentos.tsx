'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import DocumentViewer from '@/components/DocumentViewer'

interface EntityDoc {
  id: string
  tipo: string
  titulo: string
  descricao?: string | null
  arquivo_url: string | null
  arquivo_nome: string | null
  data_documento: string | null
  numero: string | null
  valor?: number | null
  created_at: string
}

export default function EntityDocumentos({
  table,             // 'obra_documentos' | 'bm_documentos'
  fkColumn,          // 'obra_id' | 'boletim_id'
  fkValue,
  storagePath,       // 'obras' | 'bms'
  tiposPermitidos,
  showValor = false,
  title = 'Documentos',
}: {
  table: 'obra_documentos' | 'bm_documentos'
  fkColumn: 'obra_id' | 'boletim_id'
  fkValue: string
  storagePath: string
  tiposPermitidos: { value: string; label: string }[]
  showValor?: boolean
  title?: string
}) {
  const [docs, setDocs] = useState<EntityDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<EntityDoc | null>(null)
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState<any>({ tipo: tiposPermitidos[0]?.value ?? 'outro', titulo: '', descricao: '', data_documento: '', numero: '', valor: '' })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const supabase = createClient()
  const router = useRouter()
  const toast = useToast()

  useEffect(() => { load() }, [fkValue])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from(table)
      .select('*')
      .eq(fkColumn, fkValue)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setDocs((data as any) ?? [])
    setLoading(false)
  }

  function resetForm() {
    setForm({ tipo: tiposPermitidos[0]?.value ?? 'outro', titulo: '', descricao: '', data_documento: '', numero: '', valor: '' })
    setFile(null)
  }

  function openAdd() {
    resetForm()
    setShowAdd(true)
  }

  function openEdit(doc: EntityDoc) {
    setEditing(doc)
    setForm({
      tipo: doc.tipo,
      titulo: doc.titulo,
      descricao: doc.descricao ?? '',
      data_documento: doc.data_documento ?? '',
      numero: doc.numero ?? '',
      valor: doc.valor != null ? String(doc.valor) : '',
    })
    setFile(null)
  }

  async function uploadFile(f: File): Promise<{ url: string; name: string } | null> {
    const filePath = `${storagePath}/${fkValue}/${form.tipo}/${Date.now()}_${f.name}`
    const { error: upErr } = await supabase.storage.from('documentos').upload(filePath, f, { upsert: true })
    if (upErr) {
      toast.error('Erro no upload: ' + upErr.message)
      return null
    }
    const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(filePath)
    return { url: publicUrl, name: f.name }
  }

  async function handleSave() {
    if (!form.titulo.trim()) {
      toast.error('Título é obrigatório')
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const payload: any = {
      tipo: form.tipo,
      titulo: form.titulo.trim(),
      descricao: form.descricao || null,
      data_documento: form.data_documento || null,
      numero: form.numero || null,
    }
    if (showValor) payload.valor = form.valor ? Number(form.valor) : null

    if (file) {
      const uploaded = await uploadFile(file)
      if (!uploaded) { setSaving(false); return }
      payload.arquivo_url = uploaded.url
      payload.arquivo_nome = uploaded.name
    }

    let error
    if (editing) {
      ({ error } = await supabase.from(table).update(payload).eq('id', editing.id))
    } else {
      payload[fkColumn] = fkValue
      payload.created_by = user?.id ?? null
      ;({ error } = await supabase.from(table).insert(payload))
    }

    if (error) {
      toast.error('Erro: ' + error.message)
      setSaving(false)
      return
    }

    toast.success(editing ? 'Documento atualizado!' : 'Documento adicionado!')
    setShowAdd(false)
    setEditing(null)
    resetForm()
    setSaving(false)
    await load()
    router.refresh()
  }

  async function handleDelete(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from(table)
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
      .eq('id', id)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Documento excluído')
    setDeleteConfirm(null)
    await load()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-brand font-display">{title}</h2>
        <button onClick={openAdd} className="text-xs text-brand hover:underline font-medium">+ Adicionar documento</button>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">Carregando...</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhum documento cadastrado.</p>
      ) : (
        <div className="space-y-1.5">
          {docs.map(d => {
            const tipoLabel = tiposPermitidos.find(t => t.value === d.tipo)?.label ?? d.tipo
            return (
              <div key={d.id} className="flex items-center justify-between py-2 px-3 border border-gray-100 rounded-lg hover:bg-gray-50 group">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-[10px] font-bold bg-brand/10 text-brand px-2 py-0.5 rounded flex-shrink-0 uppercase">{tipoLabel}</span>
                  <div className="min-w-0 flex-1">
                    {d.arquivo_url ? (
                      <button onClick={() => setViewer({ url: d.arquivo_url!, name: d.arquivo_nome ?? d.titulo })}
                        className="text-sm text-brand font-medium hover:underline truncate text-left">
                        {d.titulo}
                      </button>
                    ) : (
                      <span className="text-sm text-gray-700 font-medium">{d.titulo}</span>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      {d.numero && <span>Nº {d.numero}</span>}
                      {d.data_documento && <span>{new Date(d.data_documento+'T12:00').toLocaleDateString('pt-BR')}</span>}
                      {showValor && d.valor != null && <span>R$ {Number(d.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(d)} title="Editar" className="text-gray-400 hover:text-brand p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-9 9H2v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                  </button>
                  <button onClick={() => setDeleteConfirm(d.id)} title="Excluir" className="text-gray-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M5 4V2h6v2M5 4l1 10h4l1-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(showAdd || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-brand mb-4">{editing ? 'Editar documento' : 'Adicionar documento'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo *</label>
                <select value={form.tipo} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                  {tiposPermitidos.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Título *</label>
                <input type="text" value={form.titulo} onChange={e => setForm((f: any) => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Contrato principal Cesari"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Número</label>
                  <input type="text" value={form.numero} onChange={e => setForm((f: any) => ({ ...f, numero: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Data</label>
                  <input type="date" value={form.data_documento} onChange={e => setForm((f: any) => ({ ...f, data_documento: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
              </div>
              {showValor && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Valor (R$)</label>
                  <input type="number" step="0.01" value={form.valor} onChange={e => setForm((f: any) => ({ ...f, valor: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm((f: any) => ({ ...f, descricao: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Arquivo</label>
                {editing?.arquivo_nome && !file && (
                  <p className="text-xs text-gray-500 mb-1">Atual: <span className="font-medium">{editing.arquivo_nome}</span></p>
                )}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={e => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-xs text-gray-500 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-gray-200 file:bg-white file:text-xs file:font-medium" />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => { setShowAdd(false); setEditing(null); resetForm() }} disabled={saving}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">Excluir documento?</h3>
            <p className="text-sm text-gray-600 mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {viewer && <DocumentViewer url={viewer.url} fileName={viewer.name} onClose={() => setViewer(null)} />}
    </div>
  )
}

'use client'
import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import DocumentViewer from '@/components/DocumentViewer'

const TIPOS = ['ASO','NR-01','NR-06','NR-10','NR-12','NR-18','NR-20','NR-33','NR-35','NR','CIPA','EPI','RG','CPF','PIS','CTPS','contrato','admissao','esocial','comprovante','atestado','holerite','ponto','declaracao','termo','outro'] as const

export default function FuncionarioDocumentos({
  funcionarioId,
  documentos,
}: {
  funcionarioId: string
  documentos: any[]
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(null)
  const [form, setForm] = useState<any>({ tipo: 'ASO', emissao: '', vencimento: '', sem_vencimento: false, observacao: '' })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Filters
  const [filterTipo, setFilterTipo] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSort, setFilterSort] = useState('vencimento_asc')
  const [searchInput, setSearchInput] = useState('')
  const [searchQ, setSearchQ] = useState('')

  const supabase = createClient()
  const router = useRouter()
  const toast = useToast()

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchQ(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  function statusOf(d: any) {
    if (!d.vencimento) return { label: '∞ Não vence', cls: 'bg-blue-50 text-blue-700', code: 'sem' }
    const dias = Math.ceil((new Date(d.vencimento + 'T12:00').getTime() - Date.now()) / 86400000)
    if (dias < 0) return { label: 'Vencido', cls: 'bg-red-100 text-red-700', code: 'vencido' }
    if (dias <= 30) return { label: `Vence em ${dias}d`, cls: 'bg-amber-100 text-amber-700', code: 'vencendo' }
    return { label: 'Válido', cls: 'bg-green-100 text-green-700', code: 'valido' }
  }

  // Filter and sort
  const filtered = useMemo(() => {
    let result = documentos
    if (filterTipo) result = result.filter(d => d.tipo === filterTipo)
    if (filterStatus) result = result.filter(d => statusOf(d).code === filterStatus)
    if (searchQ) {
      const q = searchQ.toLowerCase()
      result = result.filter(d => (d.arquivo_nome ?? '').toLowerCase().includes(q))
    }
    const sorted = [...result]
    if (filterSort === 'vencimento_asc') sorted.sort((a, b) => (a.vencimento ?? '').localeCompare(b.vencimento ?? ''))
    if (filterSort === 'vencimento_desc') sorted.sort((a, b) => (b.vencimento ?? '').localeCompare(a.vencimento ?? ''))
    if (filterSort === 'tipo_asc') sorted.sort((a, b) => (a.tipo ?? '').localeCompare(b.tipo ?? ''))
    if (filterSort === 'emissao_asc') sorted.sort((a, b) => (a.emissao ?? '').localeCompare(b.emissao ?? ''))
    return sorted
  }, [documentos, filterTipo, filterStatus, filterSort, searchQ])

  const hasFilter = filterTipo || filterStatus || searchQ

  function clearFilters() {
    setFilterTipo(''); setFilterStatus(''); setSearchInput(''); setSearchQ('')
  }

  function openEdit(doc: any) {
    setEditing(doc)
    setForm({
      tipo: doc.tipo,
      emissao: doc.emissao ?? '',
      vencimento: doc.vencimento ?? '',
      sem_vencimento: !doc.vencimento,
      observacao: doc.observacao ?? '',
    })
    setFile(null)
  }

  async function uploadFile(f: File, tipo: string): Promise<{ url: string; name: string } | null> {
    const filePath = `${funcionarioId}/${tipo}/${Date.now()}_${f.name}`
    const { error: upErr } = await supabase.storage.from('documentos').upload(filePath, f, { upsert: true })
    if (upErr) {
      toast.error('Erro no upload: ' + upErr.message)
      return null
    }
    const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(filePath)
    return { url: publicUrl, name: f.name }
  }

  async function handleSaveAdd() {
    if (!form.sem_vencimento && !form.vencimento) { toast.error('Informe a data de vencimento ou marque "Não vence"'); return }
    setSaving(true)

    let arquivo_url: string | null = null
    let arquivo_nome: string | null = null
    if (file) {
      const uploaded = await uploadFile(file, form.tipo)
      if (!uploaded) { setSaving(false); return }
      arquivo_url = uploaded.url
      arquivo_nome = uploaded.name
    }

    const { error } = await supabase.from('documentos').insert({
      funcionario_id: funcionarioId,
      tipo: form.tipo,
      emissao: form.emissao || null,
      vencimento: form.sem_vencimento ? null : form.vencimento,
      observacao: form.observacao || null,
      arquivo_url,
      arquivo_nome,
    })

    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
    toast.success('Documento adicionado!')
    setShowAdd(false)
    setForm({ tipo: 'ASO', emissao: '', vencimento: '', sem_vencimento: false, observacao: '' })
    setFile(null)
    setSaving(false)
    router.refresh()
  }

  async function handleSaveEdit() {
    if (!editing) return
    if (!form.sem_vencimento && !form.vencimento) { toast.error('Informe a data de vencimento ou marque "Não vence"'); return }
    setSaving(true)

    const updates: any = {
      tipo: form.tipo,
      emissao: form.emissao || null,
      vencimento: form.sem_vencimento ? null : form.vencimento,
      observacao: form.observacao || null,
    }

    if (file) {
      const uploaded = await uploadFile(file, form.tipo)
      if (!uploaded) { setSaving(false); return }
      updates.arquivo_url = uploaded.url
      updates.arquivo_nome = uploaded.name
    }

    const { error } = await supabase.from('documentos').update(updates).eq('id', editing.id)
    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }

    toast.success('Documento atualizado!')
    setEditing(null)
    setFile(null)
    setSaving(false)
    router.refresh()
  }

  async function handleDelete(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('documentos')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
      .eq('id', id)
    if (error) { toast.error('Erro: ' + error.message); return }
    toast.success('Documento excluído')
    setDeleteConfirm(null)
    router.refresh()
  }

  return (
    <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-brand font-display">Documentos</h2>
        <button onClick={() => { setShowAdd(true); setForm({ tipo: 'ASO', emissao: '', vencimento: '', sem_vencimento: false, observacao: '' }); setFile(null) }}
          className="text-xs text-brand hover:underline font-medium">+ Adicionar documento</button>
      </div>

      {/* Filters bar */}
      {documentos.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 items-center">
          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">Todos os tipos</option>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="">Todos os status</option>
            <option value="valido">Válido</option>
            <option value="vencendo">Vencendo em 30d</option>
            <option value="vencido">Vencido</option>
          </select>
          <select value={filterSort} onChange={e => setFilterSort(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="vencimento_asc">Vencimento ↑</option>
            <option value="vencimento_desc">Vencimento ↓</option>
            <option value="tipo_asc">Tipo A-Z</option>
            <option value="emissao_asc">Emissão ↑</option>
          </select>
          <div className="relative flex-1 min-w-[150px]">
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Buscar arquivo..."
              className="w-full px-2.5 py-1.5 pr-7 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand" />
            {searchInput && (
              <button onClick={() => setSearchInput('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
            )}
          </div>
          {hasFilter && (
            <button onClick={clearFilters} className="text-xs text-red-600 hover:underline font-medium">
              Limpar
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400">{documentos.length === 0 ? 'Nenhum documento cadastrado.' : 'Nenhum documento encontrado com os filtros aplicados.'}</p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(d => {
            const st = statusOf(d)
            return (
              <div key={d.id} className="flex items-center justify-between py-2 px-3 border border-gray-100 rounded-lg hover:bg-gray-50 group">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-[10px] font-bold bg-brand/10 text-brand px-2 py-0.5 rounded flex-shrink-0">{d.tipo}</span>
                  {d.arquivo_url ? (
                    <button onClick={() => setViewer({ url: d.arquivo_url, name: d.arquivo_nome ?? `${d.tipo}.pdf` })}
                      className="text-sm text-brand font-medium hover:underline truncate min-w-0">
                      {d.arquivo_nome ?? `${d.tipo}.pdf`}
                    </button>
                  ) : (
                    <span className="text-sm text-gray-400 italic">Sem arquivo</span>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500 flex-shrink-0">
                    {d.emissao && <span>Emissão: {new Date(d.emissao+'T12:00').toLocaleDateString('pt-BR')}</span>}
                    {d.vencimento && <span>Vence: {new Date(d.vencimento+'T12:00').toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${st.cls}`}>{st.label}</span>
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

      {/* Add modal */}
      {showAdd && (
        <DocModal
          title="Adicionar documento"
          form={form} setForm={setForm}
          file={file} setFile={setFile}
          saving={saving}
          onSave={handleSaveAdd}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <DocModal
          title="Editar documento"
          form={form} setForm={setForm}
          file={file} setFile={setFile}
          saving={saving}
          currentFileName={editing.arquivo_nome}
          onSave={handleSaveEdit}
          onClose={() => { setEditing(null); setFile(null) }}
        />
      )}

      {/* Delete confirm */}
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

function DocModal({
  title, form, setForm, file, setFile, saving, currentFileName, onSave, onClose,
}: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <h3 className="text-base font-bold text-brand mb-4">{title}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo *</label>
            <select value={form.tipo} onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data de emissão</label>
            <input type="date" value={form.emissao} onChange={e => setForm((f: any) => ({ ...f, emissao: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data de vencimento *</label>
            <input type="date" value={form.vencimento} disabled={form.sem_vencimento}
              onChange={e => setForm((f: any) => ({ ...f, vencimento: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand disabled:bg-gray-100 disabled:text-gray-400" />
            <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
              <input type="checkbox" checked={!!form.sem_vencimento}
                onChange={e => setForm((f: any) => ({ ...f, sem_vencimento: e.target.checked, vencimento: e.target.checked ? '' : f.vencimento }))}
                className="w-4 h-4 rounded text-brand focus:ring-brand" />
              <span className="text-xs text-gray-700">Documento não vence <span className="text-gray-400">(RG, CPF, diploma, etc)</span></span>
            </label>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Observação</label>
            <textarea value={form.observacao} onChange={e => setForm((f: any) => ({ ...f, observacao: e.target.value }))}
              rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Arquivo</label>
            {currentFileName && !file && (
              <p className="text-xs text-gray-500 mb-1">Atual: <span className="font-medium">{currentFileName}</span></p>
            )}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs text-gray-500 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-gray-200 file:bg-white file:text-xs file:font-medium" />
            {currentFileName && <p className="text-[10px] text-gray-400 mt-1">Selecionar novo arquivo substitui o atual</p>}
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button onClick={onSave} disabled={saving}
            className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

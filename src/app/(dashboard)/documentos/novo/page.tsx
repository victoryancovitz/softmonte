'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'

const TIPOS = ['ASO','NR-01','NR-06','NR-10','NR-12','NR-18','NR-20','NR-33','NR-35','NR','CIPA','EPI','RG','CPF','PIS','CTPS','contrato','admissao','esocial','comprovante','atestado','holerite','ponto','declaracao','termo','outro']

export default function NovoDocumentoPage() {
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [form, setForm] = useState({ funcionario_id: '', tipo: 'ASO', vencimento: '', emissao: '', observacao: '' })
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    ;(async () => {
      try {
        const { data, error: qErr } = await supabase.from('funcionarios').select('id,nome,cargo').is('deleted_at', null).order('nome')
        if (qErr) throw qErr
        setFuncionarios(data ?? [])
      } catch (e: any) {
        setError('Erro ao carregar funcionários: ' + (e?.message || 'desconhecido'))
      }
    })()
    const fp = params.get('funcionario')
    const tp = params.get('tipo')
    if (fp || tp) setForm(f => ({ ...f, ...(fp ? { funcionario_id: fp } : {}), ...(tp ? { tipo: tp } : {}) }))
  }, [])

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    let arquivo_url = null
    let arquivo_nome = null

    if (file) {
      const ext = file.name.split('.').pop()
      const path = `documentos/${form.funcionario_id}/${form.tipo}_${Date.now()}.${ext}`
      const { data: upload, error: uploadErr } = await supabase.storage.from('softmonte').upload(path, file)
      if (uploadErr) { setError('Erro ao fazer upload: ' + uploadErr.message); setLoading(false); return }
      const { data: urlData } = supabase.storage.from('softmonte').getPublicUrl(path)
      arquivo_url = urlData.publicUrl
      arquivo_nome = file.name
    }

    const { error } = await supabase.from('documentos').insert({
      funcionario_id: form.funcionario_id,
      tipo: form.tipo,
      vencimento: form.vencimento || null,
      emissao: form.emissao || null,
      observacao: form.observacao || null,
      arquivo_url,
      arquivo_nome,
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/documentos')
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/documentos" />
        <Link href="/documentos" className="text-gray-400 hover:text-gray-600">Documentos</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Novo documento</span>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-lg font-bold font-display text-brand mb-6">Novo documento</h1>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Funcionário *</label>
            <select required value={form.funcionario_id} onChange={e => set('funcionario_id', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Selecione...</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tipo *</label>
              <select required value={form.tipo} onChange={e => set('tipo', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Emissão</label>
              <input type="date" value={form.emissao} onChange={e => set('emissao', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"/>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Vencimento</label>
            <input type="date" value={form.vencimento} onChange={e => set('vencimento', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"/>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Arquivo (PDF, imagem)</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand file:text-white hover:file:bg-brand-dark"/>
            <p className="text-xs text-gray-400 mt-1">PDF ou imagem do documento (ASO, NR, etc.)</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Observação</label>
            <textarea value={form.observacao} onChange={e => set('observacao', e.target.value)} rows={2}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"/>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar documento'}
            </button>
            <Link href="/documentos" className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  )
}

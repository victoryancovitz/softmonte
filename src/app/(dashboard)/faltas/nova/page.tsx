'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BackButton from '@/components/BackButton'

export default function NovaFaltaPage() {
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [obras, setObras] = useState<any[]>([])
  const [form, setForm] = useState<any>({
    funcionario_id: '',
    obra_id: '',
    data: (() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    })(),
    tipo: 'falta_injustificada',
    observacao: '',
    dias_descontados: 1.0,
    cid: '',
    medico: '',
    crm: '',
    arquivo_nome: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('funcionarios').select('id,nome,cargo').order('nome')
      .then(({ data }) => setFuncionarios(data ?? []))
    supabase.from('obras').select('id,nome').eq('status', 'ativo').order('nome')
      .then(({ data }) => setObras(data ?? []))
  }, [])

  function set(field: string, value: any) {
    setForm((f: any) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.funcionario_id) { setError('Selecione um funcionário'); return }
    if (!form.data) { setError('Informe a data'); return }

    setLoading(true)
    setError('')

    const payload: any = {
      funcionario_id: form.funcionario_id,
      obra_id: form.obra_id || null,
      data: form.data,
      tipo: form.tipo,
      observacao: form.observacao.trim() || null,
      dias_descontados: parseFloat(form.dias_descontados) || 1.0,
    }

    if ((form.tipo === 'atestado_medico' || form.tipo === 'atestado_acidente')) {
      payload.cid = form.cid.trim() || null
      payload.medico = form.medico.trim() || null
      payload.crm = form.crm.trim() || null
    }

    if (form.arquivo_nome) {
      payload.arquivo_url = form.arquivo_nome
    }

    const { error: err } = await supabase.from('faltas').insert(payload)
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/faltas')
  }

  const inp = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
  const lbl = "block text-xs font-semibold text-gray-600 mb-1"

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/faltas" />
        <Link href="/faltas" className="text-gray-400 hover:text-gray-600">Faltas &amp; Atestados</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Registrar</span>
      </div>

      <h1 className="text-xl font-bold font-display text-brand mb-6">Registrar Falta / Atestado</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Funcionário */}
          <div>
            <label className={lbl}>Funcionário *</label>
            <select value={form.funcionario_id} onChange={e => set('funcionario_id', e.target.value)} className={inp}>
              <option value="">Selecione...</option>
              {funcionarios.map(f => (
                <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>
              ))}
            </select>
          </div>

          {/* Obra */}
          <div>
            <label className={lbl}>Obra</label>
            <select value={form.obra_id} onChange={e => set('obra_id', e.target.value)} className={inp}>
              <option value="">Nenhuma</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>

          {/* Data */}
          <div>
            <label className={lbl}>Data *</label>
            <input type="date" value={form.data} onChange={e => set('data', e.target.value)} className={inp} />
          </div>

          {/* Tipo */}
          <div>
            <label className={lbl}>Tipo *</label>
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={inp}>
              <option value="falta_injustificada">Falta Injustificada</option>
              <option value="falta_justificada">Falta Justificada</option>
              <option value="atestado_medico">Atestado Médico</option>
              <option value="atestado_acidente">Atestado Acidente</option>
              <option value="licenca_maternidade">Licença Maternidade</option>
              <option value="licenca_paternidade">Licença Paternidade</option>
              <option value="folga_compensatoria">Folga Compensatória</option>
              <option value="feriado">Feriado</option>
              <option value="suspensao">Suspensão</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          {/* Dias descontados */}
          <div>
            <label className={lbl}>Dias descontados</label>
            <input type="number" step="0.5" min="0" value={form.dias_descontados}
              onChange={e => set('dias_descontados', e.target.value)} className={inp} />
          </div>

          {/* Arquivo */}
          <div>
            <label className={lbl}>Arquivo</label>
            <input type="file" onChange={e => set('arquivo_nome', e.target.files?.[0]?.name ?? '')}
              className={inp + ' py-2'} />
            {form.arquivo_nome && (
              <p className="text-xs text-gray-400 mt-1">{form.arquivo_nome}</p>
            )}
          </div>
        </div>

        {/* Campos condicionais: atestado médico */}
        {(form.tipo === 'atestado_medico' || form.tipo === 'atestado_acidente') && (
          <div className="border-t border-gray-100 pt-5">
            <p className="text-xs font-semibold text-blue-600 mb-3 uppercase tracking-wide">Dados do Atestado</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className={lbl}>CID</label>
                <input type="text" value={form.cid} onChange={e => set('cid', e.target.value)}
                  placeholder="Ex: J11" className={inp} />
              </div>
              <div>
                <label className={lbl}>Médico</label>
                <input type="text" value={form.medico} onChange={e => set('medico', e.target.value)}
                  placeholder="Nome do médico" className={inp} />
              </div>
              <div>
                <label className={lbl}>CRM</label>
                <input type="text" value={form.crm} onChange={e => set('crm', e.target.value)}
                  placeholder="CRM do médico" className={inp} />
              </div>
            </div>
          </div>
        )}

        {/* Observação */}
        <div>
          <label className={lbl}>Observação</label>
          <textarea value={form.observacao} onChange={e => set('observacao', e.target.value)}
            rows={3} placeholder="Observações adicionais..." className={inp} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
            {loading ? 'Salvando...' : 'Registrar'}
          </button>
          <Link href="/faltas" className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}

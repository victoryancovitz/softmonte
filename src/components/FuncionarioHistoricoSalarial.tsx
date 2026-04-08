'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Calendar, Plus, X, Loader2 } from 'lucide-react'
import { useToast } from '@/components/Toast'

const MOTIVO_LABEL: Record<string, string> = {
  admissao: 'Admissão',
  acordo_coletivo: 'Acordo coletivo',
  dissidio: 'Dissídio',
  merito: 'Mérito',
  promocao: 'Promoção',
  correcao: 'Correção',
  reenquadramento: 'Reenquadramento',
  piso: 'Ajuste ao piso',
  outro: 'Outro',
}

const MOTIVO_COLOR: Record<string, string> = {
  admissao: 'bg-blue-100 text-blue-700 border-blue-200',
  acordo_coletivo: 'bg-violet-100 text-violet-700 border-violet-200',
  dissidio: 'bg-violet-100 text-violet-700 border-violet-200',
  merito: 'bg-green-100 text-green-700 border-green-200',
  promocao: 'bg-green-100 text-green-700 border-green-200',
  correcao: 'bg-amber-100 text-amber-700 border-amber-200',
  piso: 'bg-amber-100 text-amber-700 border-amber-200',
  reenquadramento: 'bg-gray-100 text-gray-700 border-gray-200',
  outro: 'bg-gray-100 text-gray-700 border-gray-200',
}

export default function FuncionarioHistoricoSalarial({ funcionarioId }: { funcionarioId: string }) {
  const [historico, setHistorico] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    motivo: 'merito',
    data_efetivo: new Date().toISOString().slice(0, 10),
    novo_salario: '',
    observacao: '',
  })
  const [salarioAtual, setSalarioAtual] = useState<number | null>(null)
  const supabase = createClient()
  const toast = useToast()

  async function load() {
    const [{ data: h }, { data: f }] = await Promise.all([
      supabase.from('funcionario_historico_salarial')
        .select('*, correcoes_salariais(id, titulo)')
        .eq('funcionario_id', funcionarioId)
        .order('data_efetivo', { ascending: false }),
      supabase.from('funcionarios').select('salario_base').eq('id', funcionarioId).maybeSingle(),
    ])
    setHistorico(h || [])
    setSalarioAtual(f?.salario_base != null ? Number(f.salario_base) : null)
    setLoading(false)
  }

  useEffect(() => { load() }, [funcionarioId])

  async function aplicarCorrecao() {
    const novo = parseFloat(form.novo_salario)
    if (!isFinite(novo) || novo <= 0) { toast.error('Novo salário inválido'); return }
    setSaving(true)
    try {
      // Atualiza salário (o trigger trg_funcionarios_log_salary vai gerar histórico,
      // mas precisamos passar motivo via session var)
      const { data: { user } } = await supabase.auth.getUser()
      // Insere manualmente no histórico com motivo escolhido (evita dependência de session vars)
      await supabase.from('funcionarios').update({ salario_base: novo }).eq('id', funcionarioId)
      // Remove o registro auto-gerado pelo trigger (último) se o motivo default não bater
      await supabase.from('funcionario_historico_salarial')
        .delete()
        .eq('funcionario_id', funcionarioId)
        .eq('motivo', 'correcao')
        .gte('created_at', new Date(Date.now() - 5000).toISOString())
      // Insere registro com motivo correto
      await supabase.from('funcionario_historico_salarial').insert({
        funcionario_id: funcionarioId,
        data_efetivo: form.data_efetivo,
        salario_anterior: salarioAtual,
        salario_novo: novo,
        motivo: form.motivo,
        observacao: form.observacao || null,
        created_by: user?.id ?? null,
      })
      toast.success('Correção aplicada')
      setShowForm(false)
      setForm({ ...form, novo_salario: '', observacao: '' })
      await load()
    } catch (e: any) {
      toast.error('Erro: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const fmt = (v: any) => v != null ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

  if (loading) return <div className="text-xs text-gray-400 py-3">Carregando histórico...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-[11px] text-gray-400">
          {historico.length === 0 ? 'Nenhum registro' : `${historico.length} registro(s)`}
          {salarioAtual != null && ` · Salário atual: ${fmt(salarioAtual)}`}
        </p>
        <button onClick={() => { setForm(f => ({ ...f, novo_salario: salarioAtual ? String(salarioAtual) : '' })); setShowForm(true) }}
          className="text-xs px-3 py-1.5 bg-brand text-white rounded-lg font-semibold hover:bg-brand-dark flex items-center gap-1">
          <Plus className="w-3 h-3" /> Aplicar correção
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-blue-800">Nova correção individual</h4>
            <button onClick={() => setShowForm(false)} className="text-blue-400 hover:text-blue-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Motivo</label>
              <select value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })}
                className="w-full px-2 py-1.5 border border-blue-200 rounded-md text-xs bg-white">
                <option value="merito">Mérito</option>
                <option value="promocao">Promoção</option>
                <option value="correcao">Correção</option>
                <option value="piso">Ajuste ao piso</option>
                <option value="reenquadramento">Reenquadramento</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Data efetiva</label>
              <input type="date" value={form.data_efetivo} onChange={e => setForm({ ...form, data_efetivo: e.target.value })}
                className="w-full px-2 py-1.5 border border-blue-200 rounded-md text-xs bg-white"/>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Novo salário</label>
              <input type="number" step="0.01" value={form.novo_salario} onChange={e => setForm({ ...form, novo_salario: e.target.value })}
                className="w-full px-2 py-1.5 border border-blue-200 rounded-md text-xs bg-white"/>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-600 mb-1">Observação</label>
            <input type="text" value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })}
              placeholder="Ex: Promoção a encarregado após 6 meses"
              className="w-full px-2 py-1.5 border border-blue-200 rounded-md text-xs bg-white"/>
          </div>
          {salarioAtual != null && parseFloat(form.novo_salario) > 0 && (
            <div className="text-[11px] text-blue-700">
              Variação: {fmt(parseFloat(form.novo_salario) - salarioAtual)}
              {' '}({((parseFloat(form.novo_salario) - salarioAtual) / salarioAtual * 100).toFixed(1)}%)
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={aplicarCorrecao} disabled={saving}
              className="px-3 py-1.5 bg-brand text-white rounded-md text-xs font-bold hover:bg-brand-dark disabled:opacity-50 flex items-center gap-1">
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Aplicar
            </button>
          </div>
        </div>
      )}

      {historico.length === 0 ? (
        <div className="text-xs text-gray-400 py-3 italic">Sem histórico salarial registrado.</div>
      ) : (
      <div className="space-y-0">
      {historico.map((h, i) => {
        const anterior = Number(h.salario_anterior || 0)
        const novo = Number(h.salario_novo || 0)
        const diff = novo - anterior
        const pct = anterior > 0 ? (diff / anterior * 100) : null
        const isUp = diff > 0
        const isFirst = i === 0
        const isLast = i === historico.length - 1
        return (
          <div key={h.id} className="relative flex gap-3">
            {/* Vertical line */}
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${
                isFirst ? 'bg-brand ring-4 ring-brand/20' : 'bg-gray-300'
              }`} />
              {!isLast && <div className="w-px flex-1 bg-gray-200 my-1" />}
            </div>
            {/* Content */}
            <div className={`flex-1 pb-4 ${isLast ? '' : ''}`}>
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${MOTIVO_COLOR[h.motivo] || 'bg-gray-100 text-gray-600'}`}>
                      {MOTIVO_LABEL[h.motivo] || h.motivo}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(h.data_efetivo + 'T12:00').toLocaleDateString('pt-BR')}
                    </span>
                    {h.correcoes_salariais && (
                      <Link href={`/rh/correcoes/${h.correcoes_salariais.id}`}
                        className="text-[10px] text-brand hover:underline font-semibold">
                        {h.correcoes_salariais.titulo} →
                      </Link>
                    )}
                  </div>
                  {h.observacao && <p className="text-[11px] text-gray-400 mt-1 italic">{h.observacao}</p>}
                </div>
                <div className="text-right">
                  {h.motivo === 'admissao' ? (
                    <div className="text-sm font-bold text-brand">{fmt(novo)}</div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-[11px] text-gray-400 line-through">{fmt(anterior)}</span>
                        <span className="text-gray-300">→</span>
                        <span className="text-sm font-bold text-gray-900">{fmt(novo)}</span>
                      </div>
                      <div className={`text-[11px] font-bold flex items-center gap-0.5 justify-end ${isUp ? 'text-green-600' : 'text-red-600'}`}>
                        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isUp ? '+' : ''}{fmt(diff)}
                        {pct !== null && <span className="text-gray-400 font-normal">({isUp ? '+' : ''}{pct.toFixed(1)}%)</span>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
      </div>
      )}
    </div>
  )
}

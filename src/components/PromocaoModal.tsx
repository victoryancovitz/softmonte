'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { X, Loader2, TrendingUp, AlertTriangle } from 'lucide-react'

const TIPO_MUDANCA_LABEL: Record<string, string> = {
  promocao_cargo: 'Promoção de cargo',
  mudanca_cargo: 'Mudança de cargo',
  reajuste_salarial: 'Reajuste salarial',
}

const INSALUBRIDADE_OPTIONS = [0, 10, 20, 40]

interface Props {
  funcionario: any
  funcoes: any[]
  onClose: () => void
}

export default function PromocaoModal({ funcionario, funcoes, onClose }: Props) {
  const supabase = createClient()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    tipo_mudanca: 'promocao_cargo',
    data_efetivo: new Date().toISOString().slice(0, 10),
    cargo_novo: funcionario.cargo || '',
    funcao_id_novo: funcionario.funcao_id || '',
    salario_novo: String(Number(funcionario.salario_base || 0)),
    horas_mes_novo: String(funcionario.horas_mes || 220),
    insalubridade_pct_novo: String(funcionario.insalubridade_pct || 0),
    motivo: '',
  })

  const salarioAtual = Number(funcionario.salario_base || 0)
  const salarioNovo = parseFloat(form.salario_novo) || 0
  const variacao = salarioAtual > 0 ? ((salarioNovo - salarioAtual) / salarioAtual * 100) : 0
  const variacaoAbs = salarioNovo - salarioAtual

  const isReajuste = form.tipo_mudanca === 'reajuste_salarial'

  function handleFuncaoChange(funcaoId: string) {
    const funcao = funcoes.find((f: any) => String(f.id) === funcaoId)
    if (funcao) {
      setForm(prev => ({
        ...prev,
        funcao_id_novo: funcaoId,
        cargo_novo: funcao.nome,
        salario_novo: String(Number(funcao.salario_base || 0)),
        insalubridade_pct_novo: String(funcao.insalubridade_pct || 0),
      }))
    } else {
      setForm(prev => ({ ...prev, funcao_id_novo: funcaoId }))
    }
  }

  async function handleSave() {
    if (!form.data_efetivo) { toast.error('Data efetiva obrigatoria'); return }
    if (salarioNovo <= 0) { toast.error('Salario novo invalido'); return }
    if (!isReajuste && !form.cargo_novo.trim()) { toast.error('Cargo obrigatorio'); return }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // 1. INSERT historico
      const { error: errHist } = await supabase.from('funcionario_historico_salarial').insert({
        funcionario_id: funcionario.id,
        data_efetivo: form.data_efetivo,
        salario_anterior: salarioAtual,
        salario_novo: salarioNovo,
        cargo_anterior: funcionario.cargo || null,
        cargo_novo: isReajuste ? (funcionario.cargo || null) : form.cargo_novo,
        horas_mes_anterior: funcionario.horas_mes || 220,
        horas_mes_novo: parseInt(form.horas_mes_novo) || 220,
        insalubridade_pct_anterior: funcionario.insalubridade_pct || 0,
        insalubridade_pct_novo: parseInt(form.insalubridade_pct_novo) || 0,
        motivo: form.tipo_mudanca === 'promocao_cargo' ? 'promocao'
              : form.tipo_mudanca === 'mudanca_cargo' ? 'reenquadramento'
              : 'merito',
        observacao: form.motivo || null,
        created_by: user?.id ?? null,
      })
      if (errHist) throw errHist

      // 2. UPDATE funcionarios
      const updateData: any = {
        salario_base: salarioNovo,
        horas_mes: parseInt(form.horas_mes_novo) || 220,
        insalubridade_pct: parseInt(form.insalubridade_pct_novo) || 0,
      }
      if (!isReajuste) {
        updateData.cargo = form.cargo_novo
        updateData.funcao_id = form.funcao_id_novo || null
      }
      const { error: errFunc } = await supabase.from('funcionarios').update(updateData).eq('id', funcionario.id)
      if (errFunc) throw errFunc

      // 3. UPDATE alocacoes ativas com novo cargo
      if (!isReajuste && form.cargo_novo) {
        await supabase.from('alocacoes')
          .update({ cargo_na_obra: form.cargo_novo })
          .eq('funcionario_id', funcionario.id)
          .eq('ativo', true)
      }

      // Remove auto-generated trigger record if any
      await supabase.from('funcionario_historico_salarial')
        .delete()
        .eq('funcionario_id', funcionario.id)
        .eq('motivo', 'correcao')
        .gte('created_at', new Date(Date.now() - 5000).toISOString())

      toast.success(
        form.tipo_mudanca === 'promocao_cargo' ? 'Promoção registrada com sucesso'
          : form.tipo_mudanca === 'mudanca_cargo' ? 'Mudanca de cargo registrada'
          : 'Reajuste salarial aplicado',
        'As alocacoes ativas foram atualizadas.'
      )
      onClose()
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  const fmtR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Registrar Promoção / Reajuste</h2>
            <p className="text-xs text-gray-500 mt-0.5">{funcionario.nome_guerra || funcionario.nome}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Situacao atual */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Situacao atual</h3>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-[10px] text-gray-400">Cargo</div>
                <div className="font-semibold text-gray-800">{funcionario.cargo || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">Salario</div>
                <div className="font-semibold text-gray-800">{salarioAtual > 0 ? fmtR(salarioAtual) : '—'}</div>
              </div>
              <div>
                <div className="text-[10px] text-gray-400">Horas/mes</div>
                <div className="font-semibold text-gray-800">{funcionario.horas_mes || 220}h</div>
              </div>
            </div>
          </div>

          {/* Tipo de mudanca */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-600 mb-1">Tipo de mudanca</label>
            <select
              value={form.tipo_mudanca}
              onChange={e => setForm({ ...form, tipo_mudanca: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              {Object.entries(TIPO_MUDANCA_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Data efetivo */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-600 mb-1">Data efetiva</label>
            <input
              type="date"
              value={form.data_efetivo}
              min={funcionario.admissao || undefined}
              onChange={e => setForm({ ...form, data_efetivo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            />
          </div>

          {/* Cargo novo (hidden if reajuste) */}
          {!isReajuste && (
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Novo cargo (funcao)</label>
              <select
                value={form.funcao_id_novo}
                onChange={e => handleFuncaoChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="">Selecionar funcao...</option>
                {funcoes.map((fn: any) => (
                  <option key={fn.id} value={fn.id}>{fn.nome}</option>
                ))}
              </select>
              {form.cargo_novo && (
                <p className="text-[10px] text-gray-400 mt-1">Cargo: {form.cargo_novo}</p>
              )}
            </div>
          )}

          {/* Salario novo */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-600 mb-1">Novo salario</label>
            <input
              type="number"
              step="0.01"
              value={form.salario_novo}
              onChange={e => setForm({ ...form, salario_novo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            />
            {salarioAtual > 0 && salarioNovo > 0 && (
              <div className={`flex items-center gap-1 mt-1 text-[11px] font-semibold ${variacaoAbs >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <TrendingUp className="w-3 h-3" />
                {variacaoAbs >= 0 ? '+' : ''}{fmtR(variacaoAbs)} ({variacaoAbs >= 0 ? '+' : ''}{variacao.toFixed(1)}%)
              </div>
            )}
          </div>

          {/* Horas/mes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Horas/mes</label>
              <input
                type="number"
                value={form.horas_mes_novo}
                onChange={e => setForm({ ...form, horas_mes_novo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Insalubridade %</label>
              <select
                value={form.insalubridade_pct_novo}
                onChange={e => setForm({ ...form, insalubridade_pct_novo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                {INSALUBRIDADE_OPTIONS.map(v => (
                  <option key={v} value={v}>{v}%</option>
                ))}
              </select>
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-600 mb-1">Motivo / observacao</label>
            <input
              type="text"
              value={form.motivo}
              onChange={e => setForm({ ...form, motivo: e.target.value })}
              placeholder="Ex: Promovido a encarregado apos avaliacao"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            />
          </div>

          {/* Warning */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-800 leading-relaxed">
              <strong>Atencion:</strong> Esta acao vai atualizar o cadastro do funcionario (cargo, salario, insalubridade),
              registrar no historico salarial e atualizar o cargo em todas as alocacoes ativas.
              A mudanca reflete imediatamente na folha de pagamento.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-lg hover:bg-brand-dark disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Salvar alteracoes
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { Plus, Trash2, Save, AlertTriangle } from 'lucide-react'

type Linha = {
  id?: string
  funcao_nome: string
  quantidade_contratada: number
  carga_horaria_dia: number
  custo_hora_contratado: number
  custo_hora_extra_70: number
  custo_hora_extra_100: number
  ativo: boolean
  isNew?: boolean
  isDirty?: boolean
}

export default function ComposicaoFuncoes({ obraId }: { obraId: string }) {
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [funcoes, setFuncoes] = useState<{ id: string; nome: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    loadData()
  }, [obraId])

  async function loadData() {
    setLoading(true)
    const [{ data: comp }, { data: funcs }] = await Promise.all([
      supabase.from('contrato_composicao')
        .select('*')
        .eq('obra_id', obraId)
        .eq('ativo', true)
        .order('funcao_nome'),
      supabase.from('funcoes')
        .select('id, nome')
        .is('deleted_at', null)
        .order('nome'),
    ])

    setLinhas((comp ?? []).map((c: any) => ({
      id: c.id,
      funcao_nome: c.funcao_nome,
      quantidade_contratada: c.quantidade_contratada ?? 1,
      carga_horaria_dia: Number(c.carga_horaria_dia ?? 8),
      custo_hora_contratado: Number(c.custo_hora_contratado ?? 0),
      custo_hora_extra_70: Number(c.custo_hora_extra_70 ?? 0),
      custo_hora_extra_100: Number(c.custo_hora_extra_100 ?? 0),
      ativo: true,
    })))
    setFuncoes((funcs ?? []) as { id: string; nome: string }[])
    setLoading(false)
  }

  function addLinha() {
    setLinhas(prev => [...prev, {
      funcao_nome: '',
      quantidade_contratada: 1,
      carga_horaria_dia: 8,
      custo_hora_contratado: 0,
      custo_hora_extra_70: 0,
      custo_hora_extra_100: 0,
      ativo: true,
      isNew: true,
      isDirty: true,
    }])
  }

  function updateLinha(idx: number, field: keyof Linha, value: any) {
    setLinhas(prev => {
      const next = [...prev]
      const row = { ...next[idx], [field]: value, isDirty: true }

      // Auto-calcular HE quando valor base muda
      if (field === 'custo_hora_contratado') {
        const base = Number(value) || 0
        row.custo_hora_extra_70 = Math.round(base * 1.7 * 100) / 100
        row.custo_hora_extra_100 = Math.round(base * 2.0 * 100) / 100
      }

      next[idx] = row
      return next
    })
  }

  function removeLinha(idx: number) {
    const linha = linhas[idx]
    if (linha.isNew) {
      setLinhas(prev => prev.filter((_, i) => i !== idx))
    } else {
      // Marca como inativo (soft-remove)
      setLinhas(prev => {
        const next = [...prev]
        next[idx] = { ...next[idx], ativo: false, isDirty: true }
        return next
      })
    }
  }

  async function handleSave() {
    // Validação
    const ativos = linhas.filter(l => l.ativo)
    for (const l of ativos) {
      if (!l.funcao_nome.trim()) {
        toast.error('Preencha o nome da função em todas as linhas')
        return
      }
    }

    setSaving(true)
    let erros = 0

    for (const l of linhas) {
      if (!l.isDirty && !l.isNew) continue

      if (l.isNew && l.ativo) {
        // Insert
        const { error } = await supabase.from('contrato_composicao').insert({
          obra_id: obraId,
          funcao_nome: l.funcao_nome.toUpperCase().trim(),
          quantidade_contratada: l.quantidade_contratada,
          carga_horaria_dia: l.carga_horaria_dia,
          custo_hora_contratado: l.custo_hora_contratado,
          custo_hora_extra_70: l.custo_hora_extra_70,
          custo_hora_extra_100: l.custo_hora_extra_100,
          ativo: true,
          origem: 'manual',
        })
        if (error) { erros++; console.error(error) }
      } else if (l.id && !l.ativo) {
        // Desativar (soft remove)
        const { error } = await supabase.from('contrato_composicao')
          .update({ ativo: false })
          .eq('id', l.id)
        if (error) { erros++; console.error(error) }
      } else if (l.id && l.isDirty) {
        // Update
        const { error } = await supabase.from('contrato_composicao')
          .update({
            funcao_nome: l.funcao_nome.toUpperCase().trim(),
            quantidade_contratada: l.quantidade_contratada,
            carga_horaria_dia: l.carga_horaria_dia,
            custo_hora_contratado: l.custo_hora_contratado,
            custo_hora_extra_70: l.custo_hora_extra_70,
            custo_hora_extra_100: l.custo_hora_extra_100,
          })
          .eq('id', l.id)
        if (error) { erros++; console.error(error) }
      }
    }

    setSaving(false)
    if (erros > 0) {
      toast.error(`Salvo com ${erros} erro(s)`)
    } else {
      toast.success('Composição salva! Novos valores valem para os próximos BMs.')
    }
    await loadData()
  }

  const fmtR = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const ativas = linhas.filter(l => l.ativo)
  const temAlteracao = linhas.some(l => l.isDirty || l.isNew)

  if (loading) return <div className="text-sm text-gray-400 py-4">Carregando composição...</div>

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-brand font-display">Composição de Funções e Valores</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Define as funções contratadas, efetivo previsto e R$/HH. Alterações valem para novos BMs — BMs já criados mantêm os valores anteriores.
          </p>
        </div>
        <button onClick={addLinha} type="button"
          className="px-3 py-1.5 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-dark flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Adicionar função
        </button>
      </div>

      {ativas.length === 0 ? (
        <div className="text-center py-6 text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
          Nenhuma função cadastrada. Clique em "Adicionar função" pra começar.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-2 py-2 font-semibold text-gray-600 min-w-[160px]">Função</th>
                <th className="text-center px-2 py-2 font-semibold text-gray-600 w-[70px]">Efetivo</th>
                <th className="text-center px-2 py-2 font-semibold text-gray-600 w-[70px]">H/dia</th>
                <th className="text-right px-2 py-2 font-semibold text-gray-600 w-[100px]">R$/HH Normal</th>
                <th className="text-right px-2 py-2 font-semibold text-gray-600 w-[100px]">R$/HH 70%</th>
                <th className="text-right px-2 py-2 font-semibold text-gray-600 w-[100px]">R$/HH 100%</th>
                <th className="w-[40px]"></th>
              </tr>
            </thead>
            <tbody>
              {ativas.map((l, idx) => {
                const realIdx = linhas.indexOf(l)
                return (
                  <tr key={realIdx} className={`border-b border-gray-50 ${l.isDirty ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-2 py-1.5">
                      {l.isNew ? (
                        <div className="flex gap-1">
                          <input
                            list="funcoes-list"
                            type="text"
                            value={l.funcao_nome}
                            onChange={e => updateLinha(realIdx, 'funcao_nome', e.target.value)}
                            placeholder="Selecione ou digite..."
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs uppercase"
                          />
                          <datalist id="funcoes-list">
                            {funcoes.map(f => <option key={f.id} value={f.nome} />)}
                          </datalist>
                        </div>
                      ) : (
                        <span className="font-medium text-gray-800">{l.funcao_nome}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input type="number" min={0} value={l.quantidade_contratada}
                        onChange={e => updateLinha(realIdx, 'quantidade_contratada', Number(e.target.value))}
                        className="w-14 px-1 py-1 border border-gray-200 rounded text-xs text-center" />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input type="number" min={1} max={24} step={0.5} value={l.carga_horaria_dia}
                        onChange={e => updateLinha(realIdx, 'carga_horaria_dia', Number(e.target.value))}
                        className="w-14 px-1 py-1 border border-gray-200 rounded text-xs text-center" />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input type="number" min={0} step={0.01} value={l.custo_hora_contratado}
                        onChange={e => updateLinha(realIdx, 'custo_hora_contratado', Number(e.target.value))}
                        className="w-20 px-1 py-1 border border-gray-200 rounded text-xs text-right" />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input type="number" min={0} step={0.01} value={l.custo_hora_extra_70}
                        onChange={e => updateLinha(realIdx, 'custo_hora_extra_70', Number(e.target.value))}
                        className="w-20 px-1 py-1 border border-gray-200 rounded text-xs text-right" />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <input type="number" min={0} step={0.01} value={l.custo_hora_extra_100}
                        onChange={e => updateLinha(realIdx, 'custo_hora_extra_100', Number(e.target.value))}
                        className="w-20 px-1 py-1 border border-gray-200 rounded text-xs text-right" />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button onClick={() => removeLinha(realIdx)} type="button"
                        className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {temAlteracao && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-amber-700">
            <AlertTriangle className="w-3.5 h-3.5" />
            Alterações não salvas — novos valores valem apenas para BMs futuros
          </div>
          <button onClick={handleSave} disabled={saving} type="button"
            className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-dark disabled:opacity-50 flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Salvando...' : 'Salvar composição'}
          </button>
        </div>
      )}

      {ativas.length > 0 && !temAlteracao && (
        <div className="mt-3 text-[11px] text-gray-400">
          {ativas.length} função(ões) · Efetivo total: {ativas.reduce((s, l) => s + l.quantidade_contratada, 0)} ·
          Custo/dia estimado: {fmtR(ativas.reduce((s, l) => s + l.quantidade_contratada * l.carga_horaria_dia * l.custo_hora_contratado, 0))}
        </div>
      )}
    </div>
  )
}

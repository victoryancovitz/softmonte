'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import ImpactConfirmDialog from '@/components/ImpactConfirmDialog'
import { FileText, Plus, ChevronRight, Calendar, Users, DollarSign } from 'lucide-react'

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export default function FolhaPage() {
  const [fechamentos, setFechamentos] = useState<any[]>([])
  const [obras, setObras] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fechando, setFechando] = useState(false)
  const [reverterAlvo, setReverterAlvo] = useState<any>(null)
  const [form, setForm] = useState({ obra_id: '', ano: new Date().getFullYear(), mes: new Date().getMonth() + 1 })
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    (async () => {
      const [{ data: f }, { data: o }] = await Promise.all([
        supabase.from('folha_fechamentos').select('*, obras(nome)').is('deleted_at', null).order('ano', { ascending: false }).order('mes', { ascending: false }),
        supabase.from('obras').select('id, nome').eq('status', 'ativo').is('deleted_at', null).order('nome'),
      ])
      setFechamentos(f || [])
      setObras(o || [])
      if (o && o.length > 0) setForm(s => ({ ...s, obra_id: o[0].id }))
      setLoading(false)
    })()
  }, [])

  async function fecharFolha() {
    if (!form.obra_id) { toast.error('Selecione a obra'); return }
    setFechando(true)
    try {
      // 1) Verificar se já existe
      const { data: existing } = await supabase.from('folha_fechamentos')
        .select('id').eq('obra_id', form.obra_id).eq('ano', form.ano).eq('mes', form.mes).is('deleted_at', null).maybeSingle()
      if (existing) {
        toast.error('Já existe fechamento para este mês nessa obra.')
        setFechando(false); return
      }

      // 2) Buscar custo real do mês via vw_custo_funcionario_mes
      const { data: custos, error: cErr } = await supabase.from('vw_custo_funcionario_mes')
        .select('*').eq('obra_id', form.obra_id).eq('ano', form.ano).eq('mes', form.mes)
      if (cErr) throw cErr
      if (!custos || custos.length === 0) {
        toast.error('Sem dados de custo para esse período. Registre ponto primeiro.')
        setFechando(false); return
      }

      // 3) Totais
      const tot_bruto = custos.reduce((s, c) => s + Number(c.salario_liquido_empresa || 0), 0)
      const tot_enc = custos.reduce((s, c) => s + Number(c.encargos_valor || 0), 0)
      const tot_prov = custos.reduce((s, c) => s + Number(c.provisoes_valor || 0), 0)
      const tot_ben = custos.reduce((s, c) => s + Number(c.beneficios_valor || 0), 0)
      const tot = tot_bruto + tot_enc + tot_prov + tot_ben

      // data de pagamento: 5º dia útil do mês seguinte (simplificado: dia 5)
      const pagMes = form.mes === 12 ? 1 : form.mes + 1
      const pagAno = form.mes === 12 ? form.ano + 1 : form.ano
      const data_pg = `${pagAno}-${String(pagMes).padStart(2,'0')}-05`

      const { data: { user } } = await supabase.auth.getUser()

      // 4) Insere fechamento
      const { data: ff, error: ffErr } = await supabase.from('folha_fechamentos').insert({
        obra_id: form.obra_id,
        ano: form.ano,
        mes: form.mes,
        data_fechamento: new Date().toISOString().slice(0, 10),
        data_pagamento_prevista: data_pg,
        valor_total_bruto: tot_bruto,
        valor_total_encargos: tot_enc,
        valor_total_provisoes: tot_prov,
        valor_total_beneficios: tot_ben,
        valor_total: tot,
        funcionarios_incluidos: custos.length,
        status: 'fechada',
        created_by: user?.id ?? null,
      }).select().single()
      if (ffErr) throw ffErr

      // 5) Itens por funcionário
      const itens = custos.map(c => ({
        folha_id: ff.id,
        funcionario_id: c.funcionario_id,
        salario_base: Number(c.salario_total_bruto || 0),
        salario_total: Number(c.salario_total_bruto || 0),
        dias_trabalhados: Number(c.dias_trab || 0),
        dias_descontados: Number(c.dias_desc || 0),
        encargos_valor: Number(c.encargos_valor || 0),
        provisoes_valor: Number(c.provisoes_valor || 0),
        beneficios_valor: Number(c.beneficios_valor || 0),
        valor_bruto: Number(c.salario_liquido_empresa || 0),
        valor_liquido: Number(c.salario_liquido_empresa || 0), // líquido detalhado fica p/ holerite
        custo_total_empresa: Number(c.custo_real_mes || 0),
      }))
      const { error: itensErr } = await supabase.from('folha_itens').insert(itens)
      if (itensErr) throw new Error('Falha ao salvar itens da folha: ' + itensErr.message)

      // 6) Lançamento no financeiro (1 agregado)
      const obraNome = obras.find(o => o.id === form.obra_id)?.nome || 'Obra'
      const { data: lanc, error: lancErr } = await supabase.from('financeiro_lancamentos').insert({
        obra_id: form.obra_id,
        tipo: 'despesa',
        nome: `Folha ${String(form.mes).padStart(2,'0')}/${form.ano} — ${obraNome}`,
        categoria: 'Folha de Pagamento',
        valor: tot,
        status: 'em_aberto',
        data_competencia: `${form.ano}-${String(form.mes).padStart(2,'0')}-01`,
        data_vencimento: data_pg,
        origem: 'folha_fechamento',
        observacao: `Gerado automaticamente pelo fechamento de folha ${ff.id}`,
        created_by: user?.id ?? null,
      }).select().single()
      if (lancErr) throw new Error('Falha ao gerar lançamento financeiro da folha: ' + lancErr.message)

      if (lanc) {
        const { error: updFFErr } = await supabase.from('folha_fechamentos').update({ lancamentos_gerados: 1 }).eq('id', ff.id)
        if (updFFErr) throw new Error('Falha ao marcar folha como lançada: ' + updFFErr.message)
      }

      toast.success(`Folha ${String(form.mes).padStart(2,'0')}/${form.ano} fechada: R$ ${tot.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
      // recarrega
      const { data: f2 } = await supabase.from('folha_fechamentos').select('*, obras(nome)').is('deleted_at', null).order('ano', { ascending: false }).order('mes', { ascending: false })
      setFechamentos(f2 || [])
    } catch (e: any) {
      toast.error('Erro: ' + (e.message || e))
    } finally {
      setFechando(false)
    }
  }

  async function doReverter() {
    if (!reverterAlvo) return
    const f = reverterAlvo
    try {
      const { error: delLancErr } = await supabase.from('financeiro_lancamentos')
        .update({ deleted_at: new Date().toISOString() })
        .eq('obra_id', f.obra_id).eq('origem', 'folha_fechamento').ilike('observacao', `%${f.id}%`)
      if (delLancErr) throw new Error('Falha ao remover lançamentos financeiros: ' + delLancErr.message)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sessão expirada — faça login novamente')
      const { error: updFFErr } = await supabase.from('folha_fechamentos')
        .update({ deleted_at: new Date().toISOString(), deleted_by: user.id, status: 'revertida' })
        .eq('id', f.id)
      if (updFFErr) throw new Error('Falha ao reverter fechamento: ' + updFFErr.message)
      setFechamentos(prev => prev.filter(x => x.id !== f.id))
      setReverterAlvo(null)
      toast.success('Fechamento revertido.')
    } catch (e: any) {
      toast.error('Erro: ' + e.message)
    }
  }

  const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/rh" />
        <span className="text-gray-400">RH</span>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Folha de Pagamento</span>
      </div>

      <h1 className="text-xl font-bold font-display text-brand mb-1">Fechamento de Folha Mensal</h1>
      <p className="text-sm text-gray-500 mb-6">Gera lançamento automático no financeiro com base no custo real do mês (CLT + faltas).</p>

      {/* Form de novo fechamento */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <h2 className="text-sm font-bold text-brand mb-3">Fechar nova folha</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Obra</label>
            <select value={form.obra_id} onChange={e => setForm({ ...form, obra_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Mês</label>
            <select value={form.mes} onChange={e => setForm({ ...form, mes: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Ano</label>
            <input type="number" value={form.ano} onChange={e => setForm({ ...form, ano: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="flex items-end">
            <button onClick={fecharFolha} disabled={fechando}
              className="w-full px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-50 flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              {fechando ? 'Fechando...' : 'Fechar folha'}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Cria registro imutável com todos os itens por funcionário + 1 lançamento agregado no financeiro (vencimento dia 5 do mês seguinte).
        </p>
      </div>

      {/* Listagem de fechamentos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Período', 'Obra', 'Funcs', 'Bruto', 'Encargos', 'Provisões', 'Benef.', 'TOTAL', 'Status', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fechamentos.length > 0 ? fechamentos.map(f => (
              <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                <td className="px-4 py-3 font-semibold">
                  <Link href={`/rh/folha/${f.id}`} className="text-brand hover:underline">
                    {MESES[f.mes]}/{f.ano}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{f.obras?.nome}</td>
                <td className="px-4 py-3 text-center">{f.funcionarios_incluidos}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{fmt(Number(f.valor_total_bruto))}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{fmt(Number(f.valor_total_encargos))}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{fmt(Number(f.valor_total_provisoes))}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{fmt(Number(f.valor_total_beneficios))}</td>
                <td className="px-4 py-3 font-bold text-red-700">{fmt(Number(f.valor_total))}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    f.status === 'fechada' ? 'bg-amber-100 text-amber-700' :
                    f.status === 'paga' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {f.status === 'fechada' ? 'Fechada' : f.status === 'paga' ? 'Paga' : f.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setReverterAlvo(f)} className="text-[11px] text-red-600 hover:underline">Reverter</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">
                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p>Nenhum fechamento de folha realizado ainda.</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {fechamentos.length > 0 && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-violet-500" /><span className="text-[11px] font-semibold text-gray-400 uppercase">Fechamentos</span></div>
            <div className="text-xl font-bold text-gray-900">{fechamentos.length}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-red-500" /><span className="text-[11px] font-semibold text-gray-400 uppercase">Total acumulado</span></div>
            <div className="text-xl font-bold text-red-700">{fmt(fechamentos.reduce((s, f) => s + Number(f.valor_total || 0), 0))}</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-blue-500" /><span className="text-[11px] font-semibold text-gray-400 uppercase">Funcs/mês média</span></div>
            <div className="text-xl font-bold text-gray-900">{Math.round(fechamentos.reduce((s, f) => s + (f.funcionarios_incluidos || 0), 0) / fechamentos.length)}</div>
          </div>
        </div>
      )}

      {reverterAlvo && (
        <ImpactConfirmDialog
          open={!!reverterAlvo}
          onClose={() => setReverterAlvo(null)}
          onConfirm={doReverter}
          entity="folha"
          entityId={reverterAlvo.id}
          title={`Reverter folha ${MESES[reverterAlvo.mes]}/${reverterAlvo.ano}`}
          action="A reversão desfaz o fechamento: descarta itens por funcionário e soft-deleta o lançamento agregado no financeiro. A folha pode ser refeita em seguida com os mesmos dados de ponto/faltas."
          actionType="delete"
          confirmLabel="Reverter fechamento"
        />
      )}
    </div>
  )
}

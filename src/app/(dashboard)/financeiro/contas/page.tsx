'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'

interface Conta {
  id: string
  nome: string
  banco: string | null
  agencia: string | null
  conta: string | null
  tipo: string
  ativo: boolean
  saldo_inicial: number
  entradas?: number
  saidas?: number
  saldo_atual?: number
}

const TIPO_LABEL: Record<string, string> = {
  corrente: 'Conta Corrente',
  poupanca: 'Poupança',
  caixa: 'Caixa',
  aplicacao: 'Aplicação',
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ContasCorrentesPage() {
  const supabase = createClient()
  const toast = useToast()
  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({
    nome: '', banco: '', agencia: '', conta: '', tipo: 'corrente',
    saldo_inicial: '0', data_saldo_inicial: '',
  })

  const [showTransferir, setShowTransferir] = useState(false)
  const [transferir, setTransferir] = useState({
    origem: '', destino: '', valor: '', data: new Date().toISOString().slice(0,10), descricao: 'Transferência entre contas',
  })

  useEffect(() => { loadContas() }, [])

  async function loadContas() {
    setLoading(true)
    const { data, error } = await supabase.from('vw_contas_saldo').select('*').order('nome')
    if (error) toast.error('Erro ao carregar contas: ' + error.message)
    setContas((data ?? []) as any)
    setLoading(false)
  }

  function abrirNovo() {
    setEditing(null)
    setForm({ nome: '', banco: '', agencia: '', conta: '', tipo: 'corrente', saldo_inicial: '0', data_saldo_inicial: '' })
    setShowForm(true)
  }

  function abrirEditar(c: Conta) {
    setEditing(c.id)
    setForm({
      nome: c.nome,
      banco: c.banco ?? '',
      agencia: c.agencia ?? '',
      conta: c.conta ?? '',
      tipo: c.tipo,
      saldo_inicial: String(c.saldo_inicial),
      data_saldo_inicial: '',
    })
    setShowForm(true)
  }

  async function salvar() {
    const payload = {
      nome: form.nome.trim(),
      banco: form.banco.trim() || null,
      agencia: form.agencia.trim() || null,
      conta: form.conta.trim() || null,
      tipo: form.tipo,
      saldo_inicial: parseFloat(form.saldo_inicial) || 0,
      data_saldo_inicial: form.data_saldo_inicial || null,
    }
    if (!payload.nome) { toast.error('Informe o nome da conta'); return }
    if (editing) {
      const { error } = await supabase.from('contas_correntes').update(payload).eq('id', editing)
      if (error) { toast.error('Erro ao salvar: ' + error.message); return }
      toast.success('Conta atualizada')
    } else {
      const { error } = await supabase.from('contas_correntes').insert(payload)
      if (error) { toast.error('Erro ao salvar: ' + error.message); return }
      toast.success('Conta cadastrada')
    }
    setShowForm(false)
    loadContas()
  }

  async function apagar(c: Conta) {
    if (!confirm(`Excluir a conta "${c.nome}"? Lançamentos vinculados manterão o histórico.`)) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('contas_correntes')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
      .eq('id', c.id)
    if (error) { toast.error('Erro ao excluir: ' + error.message); return }
    toast.success('Conta excluída')
    loadContas()
  }

  async function executarTransferencia() {
    const valor = parseFloat(transferir.valor) || 0
    if (!transferir.origem || !transferir.destino) { toast.error('Selecione origem e destino'); return }
    if (transferir.origem === transferir.destino) { toast.error('Origem e destino não podem ser iguais'); return }
    if (valor <= 0) { toast.error('Valor deve ser maior que zero'); return }

    const contaOrigem = contas.find(c => c.id === transferir.origem)
    const contaDestino = contas.find(c => c.id === transferir.destino)
    const nomeBase = transferir.descricao || 'Transferência entre contas'

    // Cria 2 lançamentos: saída na origem + entrada no destino, ambos marcados como 'pago'
    const { error: e1 } = await supabase.from('financeiro_lancamentos').insert({
      tipo: 'despesa',
      nome: `${nomeBase} → ${contaDestino?.nome}`,
      categoria: 'Transferência',
      valor,
      status: 'pago',
      data_competencia: transferir.data,
      data_pagamento: transferir.data,
      conta_id: transferir.origem,
      origem: 'transferencia',
    })
    if (e1) { toast.error('Erro na saída: ' + e1.message); return }

    const { error: e2 } = await supabase.from('financeiro_lancamentos').insert({
      tipo: 'receita',
      nome: `${nomeBase} ← ${contaOrigem?.nome}`,
      categoria: 'Transferência',
      valor,
      status: 'pago',
      data_competencia: transferir.data,
      data_pagamento: transferir.data,
      conta_id: transferir.destino,
      origem: 'transferencia',
    })
    if (e2) { toast.error('Erro na entrada: ' + e2.message); return }

    toast.success(`Transferência de ${fmt(valor)} concluída`)
    setShowTransferir(false)
    setTransferir({ origem: '', destino: '', valor: '', data: new Date().toISOString().slice(0,10), descricao: 'Transferência entre contas' })
    loadContas()
  }

  const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo_atual ?? 0), 0)

  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand'
  const lbl = 'block text-xs font-semibold text-gray-600 mb-1'

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/financeiro" />
        <Link href="/financeiro" className="text-gray-400 hover:text-gray-600">Financeiro</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Contas Correntes</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Contas Correntes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contas.length} conta{contas.length !== 1 ? 's' : ''} cadastrada{contas.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTransferir(true)} disabled={contas.length < 2}
            className="px-4 py-2 border border-brand text-brand rounded-xl text-sm font-bold hover:bg-brand/5 disabled:opacity-50">
            ⇄ Transferir
          </button>
          <button onClick={abrirNovo}
            className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">
            + Nova Conta
          </button>
        </div>
      </div>

      {/* Saldo total */}
      <div className="bg-gradient-to-br from-brand to-brand-dark text-white rounded-xl p-5 mb-5">
        <p className="text-xs uppercase tracking-wide opacity-80">Saldo total</p>
        <p className="text-3xl font-bold font-display mt-1">{fmt(saldoTotal)}</p>
        <p className="text-xs opacity-60 mt-1">Soma dos saldos atuais de todas as contas ativas</p>
      </div>

      {/* Lista de contas */}
      {loading ? (
        <div className="text-sm text-gray-400">Carregando...</div>
      ) : contas.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 mb-3">Nenhuma conta cadastrada.</p>
          <button onClick={abrirNovo} className="text-brand font-semibold hover:underline">+ Cadastrar primeira conta</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {contas.map(c => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{TIPO_LABEL[c.tipo] ?? c.tipo}</p>
                  <h3 className="text-base font-bold text-gray-900 mt-0.5">{c.nome}</h3>
                  {(c.banco || c.agencia || c.conta) && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.banco && <span>{c.banco}</span>}
                      {c.agencia && <span className="ml-2">Ag. {c.agencia}</span>}
                      {c.conta && <span className="ml-2">C/C {c.conta}</span>}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => abrirEditar(c)}
                    className="text-xs text-gray-500 hover:text-brand px-2 py-1">Editar</button>
                  <button onClick={() => apagar(c)}
                    className="text-xs text-gray-400 hover:text-red-600 px-2 py-1">Excluir</button>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Saldo atual</p>
                <p className={`text-2xl font-bold font-display ${Number(c.saldo_atual ?? 0) < 0 ? 'text-red-600' : 'text-brand'}`}>
                  {fmt(Number(c.saldo_atual ?? 0))}
                </p>
                <div className="flex gap-4 mt-2 text-[11px] text-gray-500">
                  <span>Inicial: <span className="font-semibold text-gray-700">{fmt(Number(c.saldo_inicial ?? 0))}</span></span>
                  <span className="text-green-600">↑ {fmt(Number(c.entradas ?? 0))}</span>
                  <span className="text-red-600">↓ {fmt(Number(c.saidas ?? 0))}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Formulário */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-brand mb-4">
              {editing ? 'Editar conta' : 'Nova conta'}
            </h3>
            <div className="space-y-3">
              <div><label className={lbl}>Nome *</label>
                <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={inp} placeholder="Ex: Itaú — Conta Matriz"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Tipo</label>
                  <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className={inp + ' bg-white'}>
                    <option value="corrente">Conta Corrente</option>
                    <option value="poupanca">Poupança</option>
                    <option value="caixa">Caixa (dinheiro)</option>
                    <option value="aplicacao">Aplicação</option>
                  </select></div>
                <div><label className={lbl}>Banco</label>
                  <input type="text" value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} className={inp} placeholder="Itaú"/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Agência</label>
                  <input type="text" value={form.agencia} onChange={e => setForm(f => ({ ...f, agencia: e.target.value }))} className={inp}/></div>
                <div><label className={lbl}>Conta</label>
                  <input type="text" value={form.conta} onChange={e => setForm(f => ({ ...f, conta: e.target.value }))} className={inp}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Saldo inicial (R$)</label>
                  <input type="number" step="0.01" value={form.saldo_inicial} onChange={e => setForm(f => ({ ...f, saldo_inicial: e.target.value }))} className={inp}/></div>
                <div><label className={lbl}>Data do saldo inicial</label>
                  <input type="date" value={form.data_saldo_inicial} onChange={e => setForm(f => ({ ...f, data_saldo_inicial: e.target.value }))} className={inp}/></div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={salvar} className="px-5 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">
                Salvar
              </button>
              <button onClick={() => setShowForm(false)} className="px-5 py-2 border border-gray-200 rounded-xl text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Transferência */}
      {showTransferir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-brand mb-1">⇄ Transferência entre contas</h3>
            <p className="text-xs text-gray-500 mb-4">Registra uma saída na origem e uma entrada no destino (ambas já pagas).</p>
            <div className="space-y-3">
              <div><label className={lbl}>Conta de origem *</label>
                <select value={transferir.origem} onChange={e => setTransferir(t => ({ ...t, origem: e.target.value }))} className={inp + ' bg-white'}>
                  <option value="">Selecione...</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.nome} ({fmt(Number(c.saldo_atual ?? 0))})</option>)}
                </select></div>
              <div><label className={lbl}>Conta de destino *</label>
                <select value={transferir.destino} onChange={e => setTransferir(t => ({ ...t, destino: e.target.value }))} className={inp + ' bg-white'}>
                  <option value="">Selecione...</option>
                  {contas.filter(c => c.id !== transferir.origem).map(c => <option key={c.id} value={c.id}>{c.nome} ({fmt(Number(c.saldo_atual ?? 0))})</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Valor (R$) *</label>
                  <input type="number" step="0.01" value={transferir.valor} onChange={e => setTransferir(t => ({ ...t, valor: e.target.value }))} className={inp}/></div>
                <div><label className={lbl}>Data</label>
                  <input type="date" value={transferir.data} onChange={e => setTransferir(t => ({ ...t, data: e.target.value }))} className={inp}/></div>
              </div>
              <div><label className={lbl}>Descrição</label>
                <input type="text" value={transferir.descricao} onChange={e => setTransferir(t => ({ ...t, descricao: e.target.value }))} className={inp}/></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={executarTransferencia} className="px-5 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">
                Transferir
              </button>
              <button onClick={() => setShowTransferir(false)} className="px-5 py-2 border border-gray-200 rounded-xl text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

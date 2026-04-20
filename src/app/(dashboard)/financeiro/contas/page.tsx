'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import EntityActions from '@/components/ui/EntityActions'
import { fmt } from '@/lib/cores'

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
  proprietario?: string
  socio_id?: string | null
  socio_nome?: string | null
  titular?: string | null
  pix_chave?: string | null
  pix_tipo?: string | null
  is_padrao?: boolean
}

const TIPO_LABEL: Record<string, string> = {
  corrente: 'Conta Corrente',
  poupanca: 'Poupança',
  caixa: 'Caixa',
  aplicacao: 'Aplicação',
}

const BANCOS: Record<string, { cor: string; sigla: string }> = {
  'BTG':       { cor: '#003399', sigla: 'BTG' },
  'Santander': { cor: '#EC0000', sigla: 'SAN' },
  'Bradesco':  { cor: '#CC0000', sigla: 'BDB' },
  'Itaú':      { cor: '#EC7000', sigla: 'ITÁ' },
  'Caixa':     { cor: '#006699', sigla: 'CEF' },
  'Nubank':    { cor: '#820AD1', sigla: 'NUB' },
  'Inter':     { cor: '#FF7A00', sigla: 'INT' },
}

function BancoIcon({ banco }: { banco: string | null }) {
  const match = banco ? Object.entries(BANCOS).find(([k]) => banco.toLowerCase().includes(k.toLowerCase())) : null
  const cor = match ? match[1].cor : '#9ca3af'
  const sigla = match ? match[1].sigla : (banco?.slice(0, 2).toUpperCase() || '??')
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: cor }}>
      {sigla}
    </div>
  )
}

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
    pix_chave: '', pix_tipo: '',
  })

  const [extratoContaId, setExtratoContaId] = useState<string | null>(null)
  const [extratoData, setExtratoData] = useState<any[]>([])
  const [extratoLoading, setExtratoLoading] = useState(false)

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
    setForm({ nome: '', banco: '', agencia: '', conta: '', tipo: 'corrente', saldo_inicial: '0', data_saldo_inicial: '', pix_chave: '', pix_tipo: '' })
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
      pix_chave: c.pix_chave ?? '',
      pix_tipo: c.pix_tipo ?? '',
    })
    setShowForm(true)
  }

  async function carregarExtrato(contaId: string) {
    setExtratoContaId(contaId)
    setExtratoLoading(true)
    const { data, error } = await supabase.from('financeiro_lancamentos')
      .select('id, nome, tipo, categoria, valor, status, data_competencia, data_pagamento, origem')
      .eq('conta_id', contaId)
      .eq('status', 'pago')
      .is('deleted_at', null)
      .order('data_pagamento', { ascending: true })
      .limit(200)
    if (error) toast.error('Erro ao carregar extrato: ' + error.message)
    setExtratoData(data ?? [])
    setExtratoLoading(false)
  }

  async function salvar() {
    const payload: any = {
      nome: form.nome.trim(),
      banco: form.banco.trim() || null,
      agencia: form.agencia.trim() || null,
      conta: form.conta.trim() || null,
      tipo: form.tipo,
      saldo_inicial: parseFloat(form.saldo_inicial) || 0,
      data_saldo_inicial: form.data_saldo_inicial || null,
      pix_chave: form.pix_chave.trim() || null,
      pix_tipo: form.pix_tipo || null,
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
    if (!await confirmDialog({ title: 'Excluir conta?', message: `Excluir a conta "${c.nome}"? Lançamentos vinculados manterão o histórico.`, variant: 'danger', confirmLabel: 'Excluir' })) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('contas_correntes')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null, ativo: false })
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

  const saldoTotal = contas.filter(c => c.proprietario !== 'socio').reduce((s, c) => s + Number(c.saldo_atual ?? 0), 0)

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

      {/* Saldo total empresa */}
      <div className="bg-gradient-to-br from-brand to-brand-dark text-white rounded-xl p-5 mb-5">
        <p className="text-xs uppercase tracking-wide opacity-80">Caixa da Empresa</p>
        <p className="text-3xl font-bold font-display mt-1">{fmt(contas.filter(c => (c as any).proprietario !== 'socio').reduce((s, c) => s + Number((c as any).saldo_atual ?? 0), 0))}</p>
        <p className="text-xs opacity-60 mt-1">{contas.filter(c => (c as any).proprietario !== 'socio').length} conta(s) da empresa</p>
      </div>

      {/* Contas da empresa */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Contas da Empresa</p>
      {loading ? (
        <div className="text-sm text-gray-400">Carregando...</div>
      ) : contas.filter(c => (c as any).proprietario !== 'socio').length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center mb-5">
          <p className="text-gray-500 mb-3">Nenhuma conta cadastrada.</p>
          <button onClick={abrirNovo} className="text-brand font-semibold hover:underline">+ Cadastrar primeira conta</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {contas.filter(c => (c as any).proprietario !== 'socio').map(c => (
            <div key={c.id} className={`bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-all ${(c as any).is_padrao ? 'border-amber-300' : 'border-gray-100'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <BancoIcon banco={c.banco} />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-base font-bold text-gray-900">{c.nome}</h3>
                      {(c as any).is_padrao && <span className="text-amber-500 text-sm" title="Conta padrão">★</span>}
                    </div>
                    <p className="text-xs text-gray-400">{TIPO_LABEL[c.tipo] ?? c.tipo}</p>
                    {(c.banco || c.agencia || c.conta) && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c.banco && <span>{c.banco}</span>}
                        {c.agencia && <span className="ml-2">Ag. {c.agencia}</span>}
                        {c.conta && <span className="ml-2">C/C {c.conta}</span>}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!(c as any).is_padrao && (
                    <button onClick={async () => {
                      await supabase.from('contas_correntes').update({ is_padrao: true }).eq('id', c.id)
                      toast.success('Conta definida como padrão')
                      loadContas()
                    }} className="text-xs text-amber-600 hover:text-amber-800 px-2 py-1" title="Definir como padrão">★</button>
                  )}
                  <button onClick={() => carregarExtrato(c.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1">Extrato</button>
                  <EntityActions entity="conta_corrente" id={c.id} nome={c.nome} onRefresh={loadContas} onEdit={() => abrirEditar(c)} />
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
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Chave PIX</label>
                  <input type="text" value={form.pix_chave} onChange={e => setForm(f => ({ ...f, pix_chave: e.target.value }))} className={inp} placeholder="Ex: 12345678900"/></div>
                <div><label className={lbl}>Tipo PIX</label>
                  <select value={form.pix_tipo} onChange={e => setForm(f => ({ ...f, pix_tipo: e.target.value }))} className={inp + ' bg-white'}>
                    <option value="">Selecione...</option>
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                    <option value="Email">Email</option>
                    <option value="Celular">Celular</option>
                    <option value="Aleatória">Aleatória</option>
                  </select></div>
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

      {/* Contas dos sócios */}
      {contas.filter(c => (c as any).proprietario === 'socio').length > 0 && (
        <>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Contas dos Sócios</p>
          <p className="text-[10px] text-gray-400 mb-3">Contas pessoais vinculadas para recebimento de dividendos e pró-labore. Saldos pessoais não compõem o caixa da empresa.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {contas.filter(c => (c as any).proprietario === 'socio').map(c => (
              <div key={c.id} className="bg-white rounded-xl shadow-sm border border-violet-200 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-xs font-bold">{((c as any).titular || c.nome)?.charAt(0)}</div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{(c as any).titular || c.nome}</div>
                    <div className="text-[10px] text-gray-400">{(c as any).socio_nome || 'Sócio'}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <div>Banco: {c.banco || <span className="text-amber-600 font-semibold">A definir</span>}</div>
                  <div>Ag: {c.agencia || '—'} · Conta: {c.conta || '—'}</div>
                  {c.pix_chave ? (
                    <div className="text-green-700">PIX: {c.pix_chave} ({c.pix_tipo || '—'})</div>
                  ) : (
                    <div><span className="inline-block mt-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">PIX não cadastrado</span></div>
                  )}
                </div>
                {(!c.banco || c.banco === 'A definir') && (
                  <div className="mt-2 text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded">Dados bancários incompletos — preencha para transferências</div>
                )}
                <div className="flex gap-3 mt-2">
                  <button onClick={() => carregarExtrato(c.id)} className="text-xs text-blue-600 hover:underline">Ver extrato</button>
                  <button onClick={() => abrirEditar(c)} className="text-xs text-brand hover:underline">Editar dados bancários</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal Extrato */}
      {extratoContaId && (() => {
        const conta = contas.find(c => c.id === extratoContaId)
        const saldoInicial = Number(conta?.saldo_inicial || 0)
        let saldoAcc = saldoInicial
        let totalEntradas = 0
        let totalSaidas = 0
        const rows = extratoData.map(l => {
          const valor = Number(l.valor || 0)
          const isReceita = l.tipo === 'receita'
          if (isReceita) { totalEntradas += valor; saldoAcc += valor }
          else { totalSaidas += valor; saldoAcc -= valor }
          return { ...l, entrada: isReceita ? valor : 0, saida: !isReceita ? valor : 0, saldo: saldoAcc }
        })
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-base font-bold text-brand">Extrato — {conta?.nome}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Saldo inicial: {fmt(saldoInicial)} · {extratoData.length} lançamento{extratoData.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setExtratoContaId(null)} className="text-gray-400 hover:text-gray-600 text-lg px-2">✕</button>
              </div>
              <div className="overflow-auto flex-1 p-5">
                {extratoLoading ? (
                  <div className="text-sm text-gray-400 text-center py-10">Carregando extrato...</div>
                ) : rows.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-10">Nenhum lançamento pago encontrado para esta conta.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                        <th className="text-left py-2 pr-2 font-semibold">Data</th>
                        <th className="text-left py-2 pr-2 font-semibold">Descrição</th>
                        <th className="text-left py-2 pr-2 font-semibold">Origem</th>
                        <th className="text-right py-2 pr-2 font-semibold">Entrada</th>
                        <th className="text-right py-2 pr-2 font-semibold">Saída</th>
                        <th className="text-right py-2 font-semibold">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="py-1.5 pr-2 text-xs text-gray-500 whitespace-nowrap">{r.data_pagamento ? new Date(r.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                          <td className="py-1.5 pr-2 text-xs text-gray-800 max-w-[200px] truncate">{r.nome}</td>
                          <td className="py-1.5 pr-2 text-[10px] text-gray-400">{r.origem || '—'}</td>
                          <td className="py-1.5 pr-2 text-xs text-right font-medium text-green-600">{r.entrada > 0 ? fmt(r.entrada) : ''}</td>
                          <td className="py-1.5 pr-2 text-xs text-right font-medium text-red-600">{r.saida > 0 ? fmt(r.saida) : ''}</td>
                          <td className={`py-1.5 text-xs text-right font-bold ${r.saldo < 0 ? 'text-red-600' : 'text-gray-800'}`}>{fmt(r.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 font-bold text-xs">
                        <td colSpan={3} className="py-2 text-gray-600">Totais</td>
                        <td className="py-2 text-right text-green-700">{fmt(totalEntradas)}</td>
                        <td className="py-2 text-right text-red-700">{fmt(totalSaidas)}</td>
                        <td className={`py-2 text-right ${saldoAcc < 0 ? 'text-red-700' : 'text-brand'}`}>{fmt(saldoAcc)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          </div>
        )
      })()}

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

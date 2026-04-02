'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NovoFuncionarioPage() {
  const [funcoes, setFuncoes] = useState<any[]>([])
  const [form, setForm] = useState<any>({
    nome: '', matricula: '', cargo: '', funcao_id: '',
    turno: 'diurno', jornada_horas: 8, status: 'disponivel',
    re: '', cpf: '', pis: '', banco: '', agencia_conta: '', pix: '',
    vt_estrutura: '', tamanho_bota: '', tamanho_uniforme: '',
    admissao: '', prazo1: '', prazo2: '', periodo_contrato: '45 DIAS',
    custo_hora: '', custo_hora_extra: '', custo_hora_noturno: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('funcoes').select('*').eq('ativo', true).order('nome')
      .then(({ data }) => setFuncoes(data ?? []))
  }, [])

  function set(field: string, value: any) {
    setForm((f: any) => {
      const next = { ...f, [field]: value }
      // Auto-preencher custo quando seleciona função
      if (field === 'funcao_id' && value) {
        const fn = funcoes.find(fn => fn.id === value)
        if (fn) {
          next.cargo = fn.nome
          next.custo_hora = fn.custo_hora?.toString() ?? ''
          next.custo_hora_extra = fn.custo_hora && fn.multiplicador_extra
            ? (fn.custo_hora * fn.multiplicador_extra).toFixed(2) : ''
          next.custo_hora_noturno = fn.custo_hora && fn.multiplicador_noturno
            ? (fn.custo_hora * fn.multiplicador_noturno).toFixed(2) : ''
        }
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.from('funcionarios').insert({
      nome: form.nome.trim().toUpperCase(),
      matricula: form.matricula.trim(),
      cargo: form.cargo.trim().toUpperCase() || form.cargo,
      funcao_id: form.funcao_id || null,
      turno: form.turno,
      jornada_horas: parseInt(form.jornada_horas) || 8,
      status: form.status,
      re: form.re || null, cpf: form.cpf || null, pis: form.pis || null,
      banco: form.banco || null, agencia_conta: form.agencia_conta || null, pix: form.pix || null,
      vt_estrutura: form.vt_estrutura || null,
      tamanho_bota: form.tamanho_bota || null, tamanho_uniforme: form.tamanho_uniforme || null,
      admissao: form.admissao || null, prazo1: form.prazo1 || null, prazo2: form.prazo2 || null,
      periodo_contrato: form.periodo_contrato || '45 DIAS',
      custo_hora: parseFloat(form.custo_hora) || null,
      custo_hora_extra: parseFloat(form.custo_hora_extra) || null,
      custo_hora_noturno: parseFloat(form.custo_hora_noturno) || null,
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/funcionarios')
  }

  const inp = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
  const lbl = "block text-xs font-semibold text-gray-600 mb-1"

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/funcionarios" className="text-gray-400 hover:text-gray-600">Funcionários</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Novo</span>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h1 className="text-lg font-bold font-display text-brand mb-6">Novo funcionário</h1>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Identificação */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Identificação</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={lbl}>Nome completo *</label>
                <input required type="text" value={form.nome} onChange={e => set('nome', e.target.value)} className={inp} placeholder="NOME SOBRENOME"/></div>
              <div><label className={lbl}>Matrícula *</label>
                <input required type="text" value={form.matricula} onChange={e => set('matricula', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>RE</label>
                <input type="text" value={form.re} onChange={e => set('re', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>CPF</label>
                <input type="text" value={form.cpf} onChange={e => set('cpf', e.target.value)} className={inp} placeholder="000.000.000-00"/></div>
              <div><label className={lbl}>PIS</label>
                <input type="text" value={form.pis} onChange={e => set('pis', e.target.value)} className={inp}/></div>
            </div>
          </section>

          {/* Função */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">
              Função e custos
              <Link href="/cadastros/funcoes/nova" className="ml-2 text-brand normal-case font-normal hover:underline">(+ nova função)</Link>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lbl}>Função cadastrada</label>
                <select value={form.funcao_id} onChange={e => set('funcao_id', e.target.value)}
                  className={inp + ' bg-white'}>
                  <option value="">Selecione uma função...</option>
                  {funcoes.map(f => (
                    <option key={f.id} value={f.id}>{f.nome} — {f.custo_hora ? 'R$'+Number(f.custo_hora).toFixed(2)+'/h' : 'sem custo'}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Ao selecionar, cargo e custos são preenchidos automaticamente</p>
              </div>
              <div><label className={lbl}>Cargo (texto livre)</label>
                <input type="text" value={form.cargo} onChange={e => set('cargo', e.target.value)} className={inp}/></div>
              <div>
                <label className={lbl}>Turno</label>
                <select value={form.turno} onChange={e => set('turno', e.target.value)} className={inp + ' bg-white'}>
                  <option value="diurno">Diurno</option><option value="noturno">Noturno</option><option value="misto">Misto</option>
                </select>
              </div>
              <div><label className={lbl}>Custo/hora normal (R$)</label>
                <input type="number" step="0.01" value={form.custo_hora} onChange={e => set('custo_hora', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Custo hora extra (R$)</label>
                <input type="number" step="0.01" value={form.custo_hora_extra} onChange={e => set('custo_hora_extra', e.target.value)} className={inp}/></div>
            </div>
          </section>

          {/* Contratos */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Datas contratuais</h3>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={lbl}>Admissão</label>
                <input type="date" value={form.admissao} onChange={e => set('admissao', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Prazo 1</label>
                <input type="date" value={form.prazo1} onChange={e => set('prazo1', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Prazo 2</label>
                <input type="date" value={form.prazo2} onChange={e => set('prazo2', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Período contrato</label>
                <input type="text" value={form.periodo_contrato} onChange={e => set('periodo_contrato', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>VT Estrutura</label>
                <input type="text" value={form.vt_estrutura} onChange={e => set('vt_estrutura', e.target.value)} placeholder="10+7,25+7,25" className={inp}/></div>
              <div><label className={lbl}>Status inicial</label>
                <select value={form.status} onChange={e => set('status', e.target.value)} className={inp + ' bg-white'}>
                  <option value="disponivel">Disponível</option>
                  <option value="alocado">Alocado</option>
                </select>
              </div>
            </div>
          </section>

          {/* Banco */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Dados bancários</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Banco</label>
                <input type="text" value={form.banco} onChange={e => set('banco', e.target.value)} className={inp}/></div>
              <div><label className={lbl}>Agência / Conta</label>
                <input type="text" value={form.agencia_conta} onChange={e => set('agencia_conta', e.target.value)} className={inp}/></div>
              <div className="col-span-2"><label className={lbl}>PIX</label>
                <input type="text" value={form.pix} onChange={e => set('pix', e.target.value)} className={inp}/></div>
            </div>
          </section>

          {/* EPI */}
          <section>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">EPI</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Tamanho Bota</label>
                <input type="text" value={form.tamanho_bota} onChange={e => set('tamanho_bota', e.target.value)} placeholder="42" className={inp}/></div>
              <div><label className={lbl}>Tamanho Uniforme</label>
                <input type="text" value={form.tamanho_uniforme} onChange={e => set('tamanho_uniforme', e.target.value)} placeholder="G" className={inp}/></div>
            </div>
          </section>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
              {loading ? 'Salvando...' : 'Criar funcionário'}
            </button>
            <Link href="/funcionarios" className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancelar</Link>
          </div>
        </form>
      </div>
    </div>
  )
}

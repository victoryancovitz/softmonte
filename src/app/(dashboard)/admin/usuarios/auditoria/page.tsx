'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'

const ACAO_COLOR: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
}
const ACAO_LABEL: Record<string, string> = {
  INSERT: 'Criou',
  UPDATE: 'Alterou',
  DELETE: 'Excluiu',
}
const TABELA_LABEL: Record<string, string> = {
  funcionarios: 'Funcionários',
  obras: 'Obras',
  financeiro_lancamentos: 'Financeiro',
  hh_lancamentos: 'HH',
  efetivo_diario: 'Efetivo',
  boletins_medicao: 'Boletins',
}

export default function AuditoriaPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [fUser, setFUser] = useState('')
  const [fTabela, setFTabela] = useState('')
  const [fAcao, setFAcao] = useState('')
  const [fDataDe, setFDataDe] = useState('')
  const [fDataAte, setFDataAte] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    setLogs(data ?? [])
    setLoading(false)
  }

  const usuariosUnicos = Array.from(new Set(logs.map(l => l.usuario_nome).filter(Boolean))).sort()
  const tabelasUnicas = Array.from(new Set(logs.map(l => l.tabela).filter(Boolean))).sort()

  const filtered = logs.filter(l => {
    if (fUser && l.usuario_nome !== fUser) return false
    if (fTabela && l.tabela !== fTabela) return false
    if (fAcao && l.acao !== fAcao) return false
    if (fDataDe && l.created_at < fDataDe) return false
    if (fDataAte && l.created_at > fDataAte + 'T23:59:59') return false
    return true
  })

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/admin/usuarios" />
        <Link href="/admin/usuarios" className="text-gray-400 hover:text-gray-600">Usuários</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Auditoria</span>
      </div>

      <div className="mb-5">
        <h1 className="text-xl font-bold font-display text-brand">Trilha de Auditoria</h1>
        <p className="text-sm text-gray-500 mt-0.5">Quem fez o quê, quando e em qual registro</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Usuário</label>
          <select value={fUser} onChange={e => setFUser(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
            <option value="">Todos</option>
            {usuariosUnicos.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Entidade</label>
          <select value={fTabela} onChange={e => setFTabela(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
            <option value="">Todas</option>
            {tabelasUnicas.map(t => <option key={t} value={t}>{TABELA_LABEL[t] ?? t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Ação</label>
          <select value={fAcao} onChange={e => setFAcao(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white">
            <option value="">Todas</option>
            <option value="INSERT">Criação</option>
            <option value="UPDATE">Alteração</option>
            <option value="DELETE">Exclusão</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">De</label>
          <input type="date" value={fDataDe} onChange={e => setFDataDe(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs"/>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Até</label>
          <input type="date" value={fDataAte} onChange={e => setFDataAte(e.target.value)}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs"/>
        </div>
      </div>

      <div className="mb-3 text-xs text-gray-500">
        Mostrando {filtered.length} de {logs.length} registros
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 text-sm">Nenhum registro encontrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Data/Hora','Usuário','Role','Entidade','Ação','Campos alterados'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((log: any) => (
                <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-900 text-xs">{log.usuario_nome ?? '—'}</td>
                  <td className="px-4 py-2.5 text-[10px] text-gray-500">{log.usuario_role ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-medium text-gray-700">{TABELA_LABEL[log.tabela] ?? log.tabela}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ACAO_COLOR[log.acao] ?? 'bg-gray-100'}`}>
                      {ACAO_LABEL[log.acao] ?? log.acao}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-gray-500 max-w-md truncate">
                    {log.campos_alterados?.length > 0 ? (
                      <span className="text-gray-700">{log.campos_alterados.join(', ')}</span>
                    ) : log.acao === 'INSERT' ? (
                      <span className="text-green-600">Novo registro</span>
                    ) : log.acao === 'DELETE' ? (
                      <span className="text-red-600">Registro removido</span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

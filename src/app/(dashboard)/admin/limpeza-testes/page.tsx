'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { AlertTriangle, Trash2, Search } from 'lucide-react'

const TIPOS = [
  { key: 'funcionarios', label: 'Funcionários', table: 'funcionarios' },
  { key: 'obras', label: 'Obras', table: 'obras' },
  { key: 'clientes', label: 'Clientes', table: 'clientes' },
  { key: 'fornecedores', label: 'Fornecedores', table: 'fornecedores' },
  { key: 'lancamentos', label: 'Lançamentos', table: 'financeiro_lancamentos' },
  { key: 'alocacoes', label: 'Alocações', table: 'alocacoes' },
  { key: 'processos', label: 'Processos Jurídicos', table: 'processos_juridicos' },
]

export default function LimpezaTestesPage() {
  const supabase = createClient()
  const toast = useToast()
  const [periodo, setPeriodo] = useState('7d')
  const [tiposSelecionados, setTiposSelecionados] = useState<string[]>([])
  const [resultados, setResultados] = useState<Record<string, any[]>>({})
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  function getDataInicio() {
    const d = new Date()
    if (periodo === '24h') d.setHours(d.getHours() - 24)
    else if (periodo === '7d') d.setDate(d.getDate() - 7)
    else if (periodo === '30d') d.setDate(d.getDate() - 30)
    return d.toISOString()
  }

  async function analisar() {
    if (tiposSelecionados.length === 0) return toast.warning('Selecione pelo menos um tipo.')
    setLoading(true)
    const res: Record<string, any[]> = {}
    const desde = getDataInicio()

    for (const tipo of tiposSelecionados) {
      const config = TIPOS.find(t => t.key === tipo)
      if (!config) continue
      const { data } = await supabase
        .from(config.table)
        .select('id, nome, created_at')
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .limit(100)
      res[tipo] = data || []
    }

    setResultados(res)
    setSelecionados(new Set())
    setLoading(false)
    const total = Object.values(res).reduce((s, arr) => s + arr.length, 0)
    toast.success(`Encontrados ${total} registros no período.`)
  }

  function toggleSelect(id: string) {
    setSelecionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function executarLimpeza() {
    if (selecionados.size === 0) return toast.warning('Nenhum registro selecionado.')
    const ok = await confirmDialog({
      title: 'Excluir permanentemente?',
      message: `${selecionados.size} registro(s) serão excluídos permanentemente.\nEsta ação NÃO pode ser desfeita.`,
      variant: 'danger',
      confirmLabel: 'Excluir',
      requireTyping: 'EXCLUIR',
    })
    if (!ok) return

    setExcluindo(true)
    let excluidos = 0

    for (const tipo of Object.keys(resultados)) {
      const config = TIPOS.find(t => t.key === tipo)
      if (!config) continue
      const ids = resultados[tipo].filter(r => selecionados.has(r.id)).map(r => r.id)
      if (ids.length === 0) continue

      const { error } = await supabase.from(config.table).delete().in('id', ids)
      if (error) toast.error(`Erro em ${config.label}: ${error.message}`)
      else excluidos += ids.length
    }

    toast.success(`${excluidos} registros excluídos permanentemente.`)
    setExcluindo(false)
    setResultados({})
    setSelecionados(new Set())
  }

  const total = Object.values(resultados).reduce((s, arr) => s + arr.length, 0)

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Trash2 className="w-6 h-6 text-red-600" />
        <h1 className="text-2xl font-bold font-display text-gray-900">Limpeza de Dados de Teste</h1>
      </div>
      <p className="text-sm text-gray-500 mb-4">Remova registros criados durante testes. Apenas diretoria/admin.</p>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <strong>Atenção:</strong> Esta ferramenta executa exclusão permanente (HARD DELETE). Use apenas para dados de teste.
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2">Período</label>
          <select value={periodo} onChange={e => setPeriodo(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="24h">Últimas 24 horas</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2">Tipos de entidade</label>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map(t => (
              <label key={t.key} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={tiposSelecionados.includes(t.key)}
                  onChange={e => setTiposSelecionados(prev => e.target.checked ? [...prev, t.key] : prev.filter(x => x !== t.key))}
                  className="rounded border-gray-300" />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        <button onClick={analisar} disabled={loading}
          className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50 flex items-center gap-2">
          <Search className="w-4 h-4" />
          {loading ? 'Analisando...' : 'Analisar'}
        </button>
      </div>

      {total > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-600">{total} registros encontrados · {selecionados.size} selecionados</span>
            <button onClick={executarLimpeza} disabled={selecionados.size === 0 || excluindo}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              {excluindo ? 'Excluindo...' : `Excluir ${selecionados.size} selecionados`}
            </button>
          </div>

          {Object.entries(resultados).map(([tipo, items]) => {
            if (items.length === 0) return null
            const config = TIPOS.find(t => t.key === tipo)
            return (
              <div key={tipo} className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">{config?.label} ({items.length})</h3>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left w-8">
                          <input type="checkbox"
                            checked={items.every(i => selecionados.has(i.id))}
                            onChange={() => {
                              const allSel = items.every(i => selecionados.has(i.id))
                              setSelecionados(prev => {
                                const n = new Set(prev)
                                items.forEach(i => allSel ? n.delete(i.id) : n.add(i.id))
                                return n
                              })
                            }} className="rounded" />
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Nome</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Criado em</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((item: any) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={selecionados.has(item.id)}
                              onChange={() => toggleSelect(item.id)} className="rounded" />
                          </td>
                          <td className="px-3 py-2 text-gray-900">{item.nome || item.id.slice(0, 8)}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{new Date(item.created_at).toLocaleString('pt-BR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

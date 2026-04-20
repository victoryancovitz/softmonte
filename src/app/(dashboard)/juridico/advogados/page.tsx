'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import SearchInput from '@/components/SearchInput'
import { useToast } from '@/components/Toast'
import { Trash2 } from 'lucide-react'

const TIPOS: Record<string, { label: string; color: string }> = {
  interno: { label: 'Interno', color: 'bg-blue-100 text-blue-700' },
  externo: { label: 'Externo', color: 'bg-amber-100 text-amber-700' },
  escritorio: { label: 'Escritório', color: 'bg-purple-100 text-purple-700' },
}

export default function AdvogadosPage() {
  const [advogados, setAdvogados] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('advogados')
      .select('*')
      .is('deleted_at', null)
      .order('nome')
    setAdvogados(data ?? [])
    setLoading(false)
  }

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Deseja realmente excluir o advogado "${nome}"?`)) return
    const { error } = await supabase.from('advogados').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error('Erro ao excluir'); return }
    toast.success('Advogado excluído')
    setAdvogados(prev => prev.filter(a => a.id !== id))
  }

  const filtered = advogados.filter(a => {
    const matchBusca = !busca || a.nome?.toLowerCase().includes(busca.toLowerCase()) || a.oab?.toLowerCase().includes(busca.toLowerCase())
    const matchTipo = filtroTipo === 'todos' || a.tipo === filtroTipo
    return matchBusca && matchTipo
  })

  const fmt = (v: number | null) => v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Advogados</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtered.length} advogado(s)</p>
        </div>
        <Link href="/juridico/advogados/novo" className="px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">
          + Novo advogado
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por nome ou OAB..." />
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="todos">Todos os tipos</option>
          <option value="interno">Interno</option>
          <option value="externo">Externo</option>
          <option value="escritorio">Escritório</option>
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 py-10 text-center">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-gray-400 py-10 text-center">Nenhum advogado encontrado.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">OAB/UF</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Escritório</th>
                <th className="px-4 py-3 text-right">Honorários/mês</th>
                <th className="px-4 py-3 text-center">Ativo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/juridico/advogados/${a.id}/editar`} className="text-brand hover:underline">{a.nome}</Link>
                  </td>
                  <td className="px-4 py-3">{a.oab}/{a.uf_oab}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIPOS[a.tipo]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                      {TIPOS[a.tipo]?.label ?? a.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.escritorio || '—'}</td>
                  <td className="px-4 py-3 text-right">{fmt(a.honorarios_mensais)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${a.ativo !== false ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(a.id, a.nome)} className="text-gray-400 hover:text-red-500" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
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

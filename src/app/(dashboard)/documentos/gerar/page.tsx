'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import {
  FileText,
  AlertTriangle,
  Megaphone,
  Search,
  ChevronRight,
} from 'lucide-react'

type Modelo = {
  id: string
  nome: string
  categoria: 'termo' | 'advertencia' | 'comunicado'
  descricao: string
  variaveis: { key: string; label: string; tipo: string }[]
  created_at: string
}

const CATEGORIA_CONFIG = {
  termo: {
    label: 'Termos e Autorizações',
    icon: FileText,
    cor: 'blue',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500'
  },
  advertencia: {
    label: 'Advertências',
    icon: AlertTriangle,
    cor: 'amber',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    dot: 'bg-amber-500'
  },
  comunicado: {
    label: 'Comunicados',
    icon: Megaphone,
    cor: 'purple',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-700',
    dot: 'bg-purple-500'
  }
}

export default function GerarDocumentosPage() {
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todos')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('modelos_documentos')
        .select('*')
        .eq('ativo', true)
        .order('categoria')
        .order('nome')
      setModelos(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtrados = modelos.filter(m => {
    const matchBusca = m.nome.toLowerCase().includes(busca.toLowerCase()) ||
      m.descricao?.toLowerCase().includes(busca.toLowerCase())
    const matchCategoria = categoriaFiltro === 'todos' || m.categoria === categoriaFiltro
    return matchBusca && matchCategoria
  })

  const porCategoria = {
    termo: filtrados.filter(m => m.categoria === 'termo'),
    advertencia: filtrados.filter(m => m.categoria === 'advertencia'),
    comunicado: filtrados.filter(m => m.categoria === 'comunicado')
  }

  const totais = {
    termo: modelos.filter(m => m.categoria === 'termo').length,
    advertencia: modelos.filter(m => m.categoria === 'advertencia').length,
    comunicado: modelos.filter(m => m.categoria === 'comunicado').length,
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm mb-4">
          <Link href="/documentos" className="text-gray-400 hover:text-gray-600">Documentos</Link>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-700">Gerar Documento</span>
        </div>
        <h1 className="text-2xl font-bold font-display text-brand">Gerar Documentos</h1>
        <p className="text-gray-500 mt-1 text-sm">Gere documentos a partir de modelos pré-configurados</p>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(['termo', 'advertencia', 'comunicado'] as const).map(cat => {
          const cfg = CATEGORIA_CONFIG[cat]
          const Icon = cfg.icon
          return (
            <button
              key={cat}
              onClick={() => setCategoriaFiltro(categoriaFiltro === cat ? 'todos' : cat)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                categoriaFiltro === cat
                  ? `${cfg.border} ${cfg.bg}`
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${cfg.bg}`}>
                  <Icon className={`w-5 h-5 ${cfg.text}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totais[cat]}</p>
                  <p className="text-sm text-gray-500">{cfg.label}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Busca */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar modelo..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <button
          onClick={() => { setBusca(''); setCategoriaFiltro('todos') }}
          className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
        >
          Limpar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Carregando modelos...</div>
      ) : (
        <div className="space-y-8">
          {(['termo', 'advertencia', 'comunicado'] as const).map(cat => {
            const lista = porCategoria[cat]
            if (lista.length === 0) return null
            const cfg = CATEGORIA_CONFIG[cat]
            const Icon = cfg.icon
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`w-5 h-5 ${cfg.text}`} />
                  <h2 className="font-semibold text-gray-800">{cfg.label}</h2>
                  <span className={`ml-1 px-2 py-0.5 text-xs rounded-full font-medium ${cfg.badge}`}>
                    {lista.length}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {lista.map(modelo => (
                    <Link
                      key={modelo.id}
                      href={`/documentos/gerar/${modelo.id}`}
                      className="group bg-white border border-gray-100 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                            <p className="font-medium text-gray-900 text-sm leading-snug">{modelo.nome}</p>
                          </div>
                          {modelo.descricao && (
                            <p className="text-xs text-gray-400 ml-4 line-clamp-2">{modelo.descricao}</p>
                          )}
                          <div className="mt-3 ml-4">
                            <span className="text-xs text-gray-400">
                              {modelo.variaveis?.length || 0} campos variáveis
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 mt-0.5 transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}

          {filtrados.length === 0 && (
            <div className="text-center py-16">
              <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400">Nenhum modelo encontrado</p>
              {busca && (
                <button onClick={() => setBusca('')} className="mt-2 text-sm text-brand hover:underline">
                  Limpar busca
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

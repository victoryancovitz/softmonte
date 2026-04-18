'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { AlertTriangle, ArrowRight, Loader2, Search, CheckCircle2 } from 'lucide-react'

const TIPOS = [
  { key: 'centro_custo', label: 'Centros de Custo', icon: '🏢', desc: 'Migra lançamentos, ativos, funcionários, alocações, estoque e custos fixos' },
  { key: 'cliente', label: 'Clientes', icon: '🤝', desc: 'Migra obras vinculadas ao cliente' },
  { key: 'funcao', label: 'Funções', icon: '🪖', desc: 'Migra funcionários, alocações, composições e itens de BM' },
  { key: 'fornecedor', label: 'Fornecedores', icon: '🏭', desc: 'Migra lançamentos financeiros pelo nome do fornecedor' },
]

const TABELA_POR_TIPO: Record<string, string> = {
  centro_custo: 'centros_custo',
  cliente: 'clientes',
  funcao: 'funcoes',
  fornecedor: 'fornecedores',
}

interface Registro {
  id: string
  nome?: string
  codigo?: string
}

interface Impacto {
  tabela: string
  registros: number
}

interface PreviewResult {
  origem: { id: string; nome: string }
  destino: { id: string; nome: string }
  impacto: Impacto[]
  total: number
  seguro: boolean
}

export default function MergePage() {
  const toast = useToast()
  const supabase = createClient()

  const [passo, setPasso] = useState(1)
  const [tipo, setTipo] = useState('')
  const [registros, setRegistros] = useState<Registro[]>([])
  const [origemId, setOrigemId] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [resultado, setResultado] = useState<{ tabelas_afetadas: Record<string, number>; total_migrado: number } | null>(null)

  // Carregar registros quando tipo muda
  useEffect(() => {
    if (!tipo) return
    setRegistros([])
    setOrigemId('')
    setDestinoId('')
    setPreview(null)
    setConfirmText('')
    setResultado(null)

    const table = TABELA_POR_TIPO[tipo]
    const load = async () => {
      let query = supabase.from(table).select('id, nome, codigo').order('nome')

      if (tipo === 'funcao') {
        query = query.eq('ativo', true)
      } else {
        query = query.is('deleted_at', null)
      }

      const { data } = await query
      setRegistros(data ?? [])
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo])

  const selecionarTipo = (key: string) => {
    setTipo(key)
    setPasso(2)
  }

  const buscarPreview = async () => {
    if (!origemId || !destinoId) {
      toast.warning('Selecione origem e destino')
      return
    }
    if (origemId === destinoId) {
      toast.warning('Origem e destino devem ser diferentes')
      return
    }
    setLoadingPreview(true)
    setPreview(null)
    try {
      const res = await fetch(`/api/merge/preview?tipo=${tipo}&origem_id=${origemId}&destino_id=${destinoId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPreview(data)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao buscar preview')
    } finally {
      setLoadingPreview(false)
    }
  }

  const executarMerge = async () => {
    if (confirmText !== 'MESCLAR') {
      toast.warning('Digite MESCLAR para confirmar')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, origem_id: origemId, destino_id: destinoId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResultado(data)
      setPasso(4)
      toast.success(`Merge concluído! ${data.total_migrado} registros migrados.`)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao executar merge')
    } finally {
      setLoading(false)
    }
  }

  const nomeRegistro = (r: Registro) => {
    if (r.codigo && r.nome) return `${r.codigo} — ${r.nome}`
    return r.nome || r.codigo || r.id
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display text-brand">Mesclar cadastros duplicados</h1>
        <p className="text-sm text-gray-500 mt-1">Unifique registros duplicados migrando todos os vinculos para o registro de destino</p>
      </div>

      {/* Banner de alerta */}
      <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-red-800">Operacao irreversivel</p>
          <p className="text-xs text-red-600 mt-0.5">
            O registro de origem sera desativado e todos os vinculos serao transferidos para o destino. Esta acao nao pode ser desfeita.
          </p>
        </div>
      </div>

      {/* Passo 1: Escolher tipo */}
      {passo >= 1 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-3">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand text-white text-xs font-bold mr-2">1</span>
            Tipo de cadastro
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TIPOS.map(t => (
              <button
                key={t.key}
                onClick={() => selecionarTipo(t.key)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  tipo === t.key
                    ? 'border-brand bg-brand/5 ring-2 ring-brand/20'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{t.icon}</span>
                  <span className="text-sm font-bold text-gray-900">{t.label}</span>
                </div>
                <p className="text-xs text-gray-500">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Passo 2: Selecionar origem e destino */}
      {passo >= 2 && tipo && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-3">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand text-white text-xs font-bold mr-2">2</span>
            Selecione origem e destino
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-red-600 mb-1">Origem (sera desativado)</label>
                <select
                  value={origemId}
                  onChange={e => { setOrigemId(e.target.value); setPreview(null); setConfirmText('') }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
                >
                  <option value="">Selecione...</option>
                  {registros.filter(r => r.id !== destinoId).map(r => (
                    <option key={r.id} value={r.id}>{nomeRegistro(r)}</option>
                  ))}
                </select>
              </div>
              <div className="hidden sm:flex items-center justify-center pb-1">
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-green-600 mb-1">Destino (mantido)</label>
                <select
                  value={destinoId}
                  onChange={e => { setDestinoId(e.target.value); setPreview(null); setConfirmText('') }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand focus:border-brand"
                >
                  <option value="">Selecione...</option>
                  {registros.filter(r => r.id !== origemId).map(r => (
                    <option key={r.id} value={r.id}>{nomeRegistro(r)}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={buscarPreview}
              disabled={!origemId || !destinoId || loadingPreview}
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 bg-brand text-white rounded-xl hover:bg-brand-dark disabled:opacity-50 transition-all"
            >
              {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Ver impacto
            </button>

            {/* Tabela de preview */}
            {preview && (
              <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <p className="text-xs font-bold text-gray-700">
                    Impacto: <span className="text-red-600">{preview.origem.nome}</span>
                    {' → '}
                    <span className="text-green-600">{preview.destino.nome}</span>
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-left px-4 py-2 font-medium">Tabela</th>
                      <th className="text-right px-4 py-2 font-medium">Registros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.impacto.map(i => (
                      <tr key={i.tabela} className="border-b border-gray-50">
                        <td className="px-4 py-2 text-gray-700">{i.tabela}</td>
                        <td className="px-4 py-2 text-right font-mono font-bold text-gray-900">{i.registros}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold">
                      <td className="px-4 py-2 text-gray-900">Total</td>
                      <td className="px-4 py-2 text-right font-mono text-brand">{preview.total}</td>
                    </tr>
                  </tbody>
                </table>
                {preview.seguro && (
                  <div className="px-4 py-2 bg-green-50 text-xs text-green-700">
                    Nenhum registro vinculado. A origem sera apenas desativada.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Passo 3: Confirmacao */}
      {passo >= 2 && preview && passo < 4 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-3">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-600 text-white text-xs font-bold mr-2">3</span>
            Confirmar merge
          </h2>
          <div className="bg-white border-2 border-red-200 rounded-xl p-4 space-y-3">
            <p className="text-sm text-gray-700">
              Digite <span className="font-mono font-bold text-red-600">MESCLAR</span> para confirmar a operacao:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="MESCLAR"
              className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-red-400 focus:border-red-400"
            />
            <div>
              <button
                onClick={executarMerge}
                disabled={confirmText !== 'MESCLAR' || loading}
                className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                Executar merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Passo 4: Resultado */}
      {passo === 4 && resultado && (
        <div className="mb-6">
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h3 className="text-sm font-bold text-green-800">Merge concluido com sucesso</h3>
            </div>
            <p className="text-sm text-green-700 mb-3">
              Total de registros migrados: <span className="font-bold">{resultado.total_migrado}</span>
            </p>
            {Object.entries(resultado.tabelas_afetadas).length > 0 && (
              <ul className="space-y-1">
                {Object.entries(resultado.tabelas_afetadas).map(([tabela, count]) => (
                  <li key={tabela} className="text-xs text-green-700">
                    <span className="font-semibold">{tabela}</span>: {count} registros
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => { setPasso(1); setTipo(''); setPreview(null); setResultado(null); setConfirmText('') }}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all"
            >
              Novo merge
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

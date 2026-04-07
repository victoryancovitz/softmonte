'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab']
const TIPO_DIA_LABEL: Record<string, string> = {
  util: 'Dia útil', sabado: 'Sábado', domingo_feriado: 'Dom/Feriado'
}

function getTipoDia(date: Date): 'util' | 'sabado' | 'domingo_feriado' {
  const d = date.getDay()
  if (d === 0) return 'domingo_feriado'
  if (d === 6) return 'sabado'
  return 'util'
}

export default function EfetivoDiarioPage() {
  const [obras, setObras] = useState<any[]>([])
  const [obraId, setObraId] = useState('')
  const [data, setData] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  })
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [presentes, setPresentes] = useState<Set<string>>(new Set())
  const [obs, setObs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const tipoDia = getTipoDia(new Date(data + 'T12:00:00'))

  useEffect(() => {
    supabase.from('obras').select('id,nome,cliente').eq('status','ativo').is('deleted_at', null).order('nome')
      .then(({ data }) => setObras(data ?? []))
  }, [])

  const loadEfetivo = useCallback(async () => {
    if (!obraId) return
    setLoading(true)

    const [{ data: funcs }, { data: registros }] = await Promise.all([
      supabase.from('alocacoes')
        .select('funcionarios(id,nome,cargo,matricula)')
        .eq('obra_id', obraId).eq('ativo', true),
      supabase.from('efetivo_diario')
        .select('funcionario_id,observacao')
        .eq('obra_id', obraId).eq('data', data)
    ])

    const allFuncs = (funcs ?? []).map((a: any) => a.funcionarios).filter(Boolean)
    setFuncionarios(allFuncs)

    const presentSet = new Set<string>()
    const obsMap: Record<string, string> = {}
    ;(registros ?? []).forEach((r: any) => {
      presentSet.add(r.funcionario_id)
      if (r.observacao) obsMap[r.funcionario_id] = r.observacao
    })
    setPresentes(presentSet)
    setObs(obsMap)
    setSaved(false)
    setLoading(false)
  }, [obraId, data])

  useEffect(() => { loadEfetivo() }, [loadEfetivo])

  function togglePresente(id: string) {
    setPresentes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSaved(false)
  }

  function marcarTodos() {
    setPresentes(new Set(funcionarios.map(f => f.id)))
    setSaved(false)
  }

  async function salvarEfetivo() {
    if (!obraId) return
    setSaving(true)

    // Delete existing and reinsert
    await supabase.from('efetivo_diario')
      .delete().eq('obra_id', obraId).eq('data', data)

    if (presentes.size > 0) {
      const rows = Array.from(presentes).map(fid => ({
        obra_id: obraId, funcionario_id: fid, data,
        tipo_dia: tipoDia, observacao: obs[fid] || null
      }))
      await supabase.from('efetivo_diario').insert(rows)
    }

    setSaved(true)
    setSaving(false)
  }

  const obra = obras.find(o => o.id === obraId)
  const dataObj = new Date(data + 'T12:00:00')
  const diaSemana = DIAS_SEMANA[dataObj.getDay()]

  // Group by cargo
  const byCargo: Record<string, any[]> = {}
  funcionarios.forEach(f => {
    if (!byCargo[f.cargo]) byCargo[f.cargo] = []
    byCargo[f.cargo].push(f)
  })

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold font-display">Efetivo Diário</h1>
        <p className="text-sm text-gray-500 mt-0.5">Registre quem trabalhou no dia</p>
      </div>

      {/* Seleção de obra e data */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Obra</label>
            <select value={obraId} onChange={e => setObraId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Selecione a obra...</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
        </div>

        {obraId && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm text-gray-600">
              <strong>{diaSemana}</strong>, {dataObj.toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              tipoDia === 'util' ? 'bg-green-100 text-green-700' :
              tipoDia === 'sabado' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>{TIPO_DIA_LABEL[tipoDia]}</span>
          </div>
        )}
      </div>

      {obraId && (
        <>
          {loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-400 text-sm">Carregando...</div>
          ) : funcionarios.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <p className="text-gray-500 text-sm">Nenhum funcionário alocado nesta obra.</p>
              <p className="text-gray-400 text-xs mt-1">Faça a alocação primeiro na tela de Alocação.</p>
            </div>
          ) : (
            <>
              {/* Barra de ação */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600">
                  <span className="font-semibold text-brand">{presentes.size}</span> de {funcionarios.length} presentes
                </div>
                <div className="flex gap-2">
                  <button onClick={marcarTodos}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
                    Marcar todos
                  </button>
                  <button onClick={() => setPresentes(new Set())}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">
                    Limpar
                  </button>
                </div>
              </div>

              {/* Lista por cargo */}
              <div className="space-y-3">
                {Object.entries(byCargo).sort().map(([cargo, funcs]) => (
                  <div key={cargo} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{cargo}</span>
                      <span className="text-xs text-gray-400">
                        {funcs.filter(f => presentes.has(f.id)).length}/{funcs.length}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {funcs.map(f => (
                        <div key={f.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${presentes.has(f.id) ? 'bg-green-50/50' : 'hover:bg-gray-50'}`}>
                          <button onClick={() => togglePresente(f.id)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                              presentes.has(f.id)
                                ? 'bg-brand text-white shadow-sm'
                                : 'border-2 border-gray-300 bg-white'
                            }`}>
                            {presentes.has(f.id) && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">{f.nome}</div>
                            <div className="text-xs text-gray-400">{f.matricula}</div>
                          </div>
                          {presentes.has(f.id) && (
                            <>
                              <input
                                type="text"
                                value={obs[f.id] ?? ''}
                                onChange={e => setObs(prev => ({ ...prev, [f.id]: e.target.value }))}
                                placeholder="Observação..."
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-40 focus:outline-none focus:ring-1 focus:ring-brand"
                              />
                              <button onClick={() => togglePresente(f.id)} title="Remover presença"
                                className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Salvar */}
              <div className="mt-5 flex items-center gap-3">
                <button onClick={salvarEfetivo} disabled={saving}
                  className="px-6 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50 transition-colors">
                  {saving ? 'Salvando...' : 'Salvar efetivo'}
                </button>
                {saved && (
                  <span className="text-sm text-green-600 flex items-center gap-1.5">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill="#16a34a"/>
                      <path d="M5 8l2.5 2.5 3.5-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Efetivo salvo!
                  </span>
                )}
              </div>
            </>
          )}
        </>
      )}

      {!obraId && (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="mx-auto mb-3 text-gray-300">
            <circle cx="20" cy="20" r="19" stroke="currentColor" strokeWidth="2"/>
            <path d="M20 12v8M20 24v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-gray-500 text-sm font-medium">Selecione uma obra para registrar o efetivo</p>
          <p className="text-gray-400 text-xs mt-1">O efetivo é registrado por obra e por dia</p>
        </div>
      )}
    </div>
  )
}

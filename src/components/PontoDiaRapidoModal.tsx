'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

interface Props {
  obraId: string
  obraNome: string
  mes: number
  ano: number
  onClose: () => void
  onSaved: () => void
}

export default function PontoDiaRapidoModal({ obraId, obraNome, mes, ano, onClose, onSaved }: Props) {
  const supabase = createClient()
  const toast = useToast()

  const today = new Date()
  const inPeriodo = today.getFullYear() === ano && today.getMonth() + 1 === mes
  const initialDay = inPeriodo ? today.getDate() : 1
  const [data, setData] = useState(`${ano}-${String(mes).padStart(2, '0')}-${String(initialDay).padStart(2, '0')}`)
  const [horasPadrao, setHorasPadrao] = useState<string>('')
  const [funcs, setFuncs] = useState<any[]>([])
  const [presentes, setPresentes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [data])

  async function load() {
    setLoading(true)
    const [{ data: alocs }, { data: jaRegistrados }] = await Promise.all([
      supabase.from('alocacoes')
        .select('funcionarios(id, nome, nome_guerra, cargo, matricula, id_ponto)')
        .eq('obra_id', obraId).eq('ativo', true),
      supabase.from('efetivo_diario')
        .select('funcionario_id')
        .eq('obra_id', obraId).eq('data', data)
    ])
    const lista = (alocs ?? []).map((a: any) => a.funcionarios).filter(Boolean)
    lista.sort((a: any, b: any) => (a.nome ?? '').localeCompare(b.nome ?? ''))
    setFuncs(lista)
    setPresentes(new Set((jaRegistrados ?? []).map((r: any) => r.funcionario_id)))
    setLoading(false)
  }

  function toggle(id: string) {
    setPresentes(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  function toggleTodos() {
    if (presentes.size === funcs.length) setPresentes(new Set())
    else setPresentes(new Set(funcs.map(f => f.id)))
  }

  async function handleSalvar() {
    setSaving(true)
    // 1) Apaga lançamentos existentes do dia
    const { error: delErr } = await supabase.from('efetivo_diario')
      .delete().eq('obra_id', obraId).eq('data', data)
    if (delErr) { toast.error('Erro ao limpar: ' + delErr.message); setSaving(false); return }

    // 2) Insere os presentes
    if (presentes.size > 0) {
      const dt = new Date(data + 'T12:00')
      const dow = dt.getDay()
      const tipo_dia = dow === 6 ? 'sabado' : (dow === 0 ? 'domingo_feriado' : 'util')
      const horas = parseFloat(horasPadrao)
      const rows = Array.from(presentes).map(fid => ({
        obra_id: obraId,
        funcionario_id: fid,
        data,
        tipo_dia,
        horas_trabalhadas: isFinite(horas) && horas > 0 ? horas : null,
      }))
      const { error: insErr } = await supabase.from('efetivo_diario').insert(rows)
      if (insErr) { toast.error('Erro ao inserir: ' + insErr.message); setSaving(false); return }
    }

    setSaving(false)
    toast.success(`${presentes.size} presenças registradas em ${new Date(data + 'T12:00').toLocaleDateString('pt-BR')}`)
    onSaved()
    onClose()
  }

  const tipoDia = (() => {
    const dow = new Date(data + 'T12:00').getDay()
    if (dow === 0) return 'Domingo'
    if (dow === 6) return 'Sábado'
    return 'Dia útil'
  })()
  const tipoClass = tipoDia === 'Dia útil' ? 'bg-green-100 text-green-700' : tipoDia === 'Sábado' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-brand">Lançamento rápido do dia</h2>
          <p className="text-xs text-gray-500 mt-1">
            Marque quem trabalhou em <strong>{obraNome}</strong> no dia selecionado. Sobrescreve lançamentos existentes.
          </p>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)}
                min={`${ano}-${String(mes).padStart(2, '0')}-01`}
                max={`${ano}-${String(mes).padStart(2, '0')}-${new Date(ano, mes, 0).getDate()}`}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              <div className="mt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${tipoClass}`}>{tipoDia}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Horas trabalhadas <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input type="number" step="0.5" min="0" max="24" value={horasPadrao}
                onChange={e => setHorasPadrao(e.target.value)} placeholder="Ex: 9"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              <p className="text-[10px] text-gray-400 mt-1">Aplica a todos. Deixe em branco para contratos dia-pessoa.</p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400">Carregando...</p>
          ) : funcs.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum funcionário alocado nesta obra.</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600">
                  <strong className="text-brand">{presentes.size}</strong> de {funcs.length} presentes
                </div>
                <button onClick={toggleTodos}
                  className="text-xs text-brand font-semibold hover:underline">
                  {presentes.size === funcs.length ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              </div>
              <div className="border border-gray-200 rounded-lg max-h-80 overflow-y-auto divide-y divide-gray-100">
                {funcs.map(f => {
                  const checked = presentes.has(f.id)
                  return (
                    <label key={f.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 ${checked ? 'bg-brand/5' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(f.id)}
                        className="w-4 h-4 rounded text-brand focus:ring-brand" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800 truncate">{f.nome_guerra ?? f.nome}</div>
                        <div className="text-[10px] text-gray-500">{f.cargo}{f.id_ponto ? ` · ID ${f.id_ponto}` : ''}</div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-2 justify-end">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
          <button onClick={handleSalvar} disabled={saving || loading}
            className="px-6 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
            {saving ? 'Salvando...' : `Salvar ${presentes.size} presenças`}
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { Plus, Video, MapPin, Monitor, X } from 'lucide-react'

type Audiencia = {
  id: string
  processo_id: string
  data_audiencia: string
  tipo: string
  modalidade: string
  local: string | null
  link_virtual: string | null
  status: string
  created_at: string
}

const STATUS_BADGE: Record<string, string> = {
  agendada: 'bg-blue-100 text-blue-700',
  realizada: 'bg-emerald-100 text-emerald-700',
  remarcada: 'bg-amber-100 text-amber-700',
  cancelada: 'bg-zinc-100 text-zinc-700',
}

const TIPO_LABELS: Record<string, string> = {
  inicial: 'Inicial',
  instrucao: 'Instrução',
  una: 'Una',
  conciliacao: 'Conciliação',
  julgamento: 'Julgamento',
}

const MODALIDADE_ICONS: Record<string, typeof Video> = {
  presencial: MapPin,
  virtual: Video,
  hibrida: Monitor,
}

export default function AudienciasTab({ processo_id }: { processo_id: string }) {
  const supabase = createClient()
  const toast = useToast()
  const [audiencias, setAudiencias] = useState<Audiencia[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    data_audiencia: '',
    tipo: 'inicial',
    modalidade: 'presencial',
    local: '',
    link_virtual: '',
  })

  async function fetchAudiencias() {
    const { data } = await supabase
      .from('processo_audiencias')
      .select('*')
      .eq('processo_id', processo_id)
      .order('data_audiencia', { ascending: false })
    setAudiencias(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchAudiencias() }, [processo_id])

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('processo_audiencias').insert({
      processo_id,
      data_audiencia: form.data_audiencia,
      tipo: form.tipo,
      modalidade: form.modalidade,
      local: form.modalidade !== 'virtual' ? form.local || null : null,
      link_virtual: form.modalidade !== 'presencial' ? form.link_virtual || null : null,
      status: 'agendada',
    })
    setSaving(false)
    if (error) {
      toast.error('Erro ao salvar audiência')
      return
    }
    toast.success('Audiência registrada')
    setShowModal(false)
    setForm({ data_audiencia: '', tipo: 'inicial', modalidade: 'presencial', local: '', link_virtual: '' })
    fetchAudiencias()
  }

  if (loading) return <div className="animate-pulse h-32 bg-gray-100 rounded-lg" />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Audiências</h3>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 text-sm font-medium text-brand hover:underline"
        >
          <Plus size={16} /> Nova audiência
        </button>
      </div>

      {audiencias.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">Nenhuma audiência registrada</div>
      ) : (
        <div className="space-y-2">
          {audiencias.map(a => {
            const ModalIcon = MODALIDADE_ICONS[a.modalidade] || MapPin
            return (
              <div key={a.id} className="flex items-center justify-between border rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <ModalIcon size={16} className="text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      {new Date(a.data_audiencia).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </div>
                    <div className="text-xs text-gray-500">
                      {a.local || a.link_virtual || '-'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 font-medium">
                    {TIPO_LABELS[a.tipo] || a.tipo}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_BADGE[a.status] || 'bg-gray-100 text-gray-600'}`}>
                    {a.status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-800">Nova Audiência</h4>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Data e hora</label>
                <input
                  type="datetime-local"
                  value={form.data_audiencia}
                  onChange={e => setForm(f => ({ ...f, data_audiencia: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                >
                  <option value="inicial">Inicial</option>
                  <option value="instrucao">Instrução</option>
                  <option value="una">Una</option>
                  <option value="conciliacao">Conciliação</option>
                  <option value="julgamento">Julgamento</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Modalidade</label>
                <select
                  value={form.modalidade}
                  onChange={e => setForm(f => ({ ...f, modalidade: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                >
                  <option value="presencial">Presencial</option>
                  <option value="virtual">Virtual</option>
                  <option value="hibrida">Híbrida</option>
                </select>
              </div>
              {form.modalidade !== 'virtual' && (
                <div>
                  <label className="text-xs font-medium text-gray-600">Local</label>
                  <input
                    type="text"
                    value={form.local}
                    onChange={e => setForm(f => ({ ...f, local: e.target.value }))}
                    placeholder="Endereço / sala"
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
              )}
              {form.modalidade !== 'presencial' && (
                <div>
                  <label className="text-xs font-medium text-gray-600">Link virtual</label>
                  <input
                    type="url"
                    value={form.link_virtual}
                    onChange={e => setForm(f => ({ ...f, link_virtual: e.target.value }))}
                    placeholder="https://..."
                    className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.data_audiencia}
                className="px-4 py-2 text-sm bg-brand text-white rounded-lg disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

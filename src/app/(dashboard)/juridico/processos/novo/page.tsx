'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { useToast } from '@/components/Toast'

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

const TIPOS = [
  { value: 'trabalhista', label: 'Trabalhista' },
  { value: 'civel', label: 'Cível' },
  { value: 'tributario', label: 'Tributário' },
  { value: 'ambiental', label: 'Ambiental' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'criminal', label: 'Criminal' },
]

const STATUS_OPTIONS = [
  { value: 'inicial', label: 'Inicial' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'aguardando_audiencia', label: 'Aguardando audiência' },
  { value: 'aguardando_sentenca', label: 'Aguardando sentença' },
  { value: 'recurso', label: 'Recurso' },
  { value: 'acordo', label: 'Acordo' },
  { value: 'encerrado', label: 'Encerrado' },
  { value: 'arquivado', label: 'Arquivado' },
]

const POLOS = [
  { value: 'ativo', label: 'Polo Ativo (autor)' },
  { value: 'passivo', label: 'Polo Passivo (réu)' },
]

const PROGNOSTICOS = [
  { value: 'provavel', label: 'Provável' },
  { value: 'possivel', label: 'Possível' },
  { value: 'remoto', label: 'Remoto' },
]

export default function NovoProcessoPage() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<any>({
    numero_cnj: '', tipo: '', status: 'inicial', objeto: '', polo: '', parte_contraria: '',
    parte_contraria_cpf_cnpj: '', url_processo: '',
    tribunal: '', vara: '', comarca: '', uf: '', data_distribuicao: '', data_citacao: '',
    valor_causa: '', valor_provisionado: '', prognostico: '',
    funcionario_id: '', obra_id: '', centro_custo_id: '', advogado_id: '', observacoes: '',
  })
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [obras, setObras] = useState<any[]>([])
  const [centrosCusto, setCentrosCusto] = useState<any[]>([])
  const [advogados, setAdvogados] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    loadSelects()
  }, [])

  async function loadSelects() {
    const [{ data: funcs }, { data: obr }, { data: cc }, { data: advs }] = await Promise.all([
      supabase.from('funcionarios').select('id, nome').is('deleted_at', null).order('nome'),
      supabase.from('obras').select('id, nome').is('deleted_at', null).order('nome'),
      supabase.from('centros_custo').select('id, codigo, nome').is('deleted_at', null).order('nome'),
      supabase.from('advogados').select('id, nome').is('deleted_at', null).order('nome'),
    ])
    setFuncionarios(funcs ?? [])
    setObras(obr ?? [])
    setCentrosCusto(cc ?? [])
    setAdvogados(advs ?? [])
  }

  function set(field: string, value: string) {
    setForm((prev: any) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    setError('')
    if (!form.tipo || !form.status || !form.objeto || !form.polo || !form.parte_contraria) {
      setError('Preencha os campos obrigatórios: Tipo, Status, Objeto, Polo, Parte contrária.')
      setStep(1)
      return
    }

    setLoading(true)
    const payload: any = {
      numero_cnj: form.numero_cnj || null,
      tipo: form.tipo,
      status: form.status,
      objeto: form.objeto,
      polo: form.polo,
      parte_contraria: form.parte_contraria,
      parte_contraria_cpf_cnpj: form.parte_contraria_cpf_cnpj || null,
      url_processo: form.url_processo || null,
      tribunal: form.tribunal || null,
      vara: form.vara || null,
      comarca: form.comarca || null,
      uf: form.uf || null,
      data_distribuicao: form.data_distribuicao || null,
      data_citacao: form.data_citacao || null,
      valor_causa: form.valor_causa ? parseFloat(form.valor_causa) : null,
      valor_provisionado: form.valor_provisionado ? parseFloat(form.valor_provisionado) : null,
      prognostico: form.prognostico || null,
      funcionario_id: form.funcionario_id || null,
      obra_id: form.obra_id || null,
      centro_custo_id: form.centro_custo_id || null,
      advogado_id: form.advogado_id || null,
      observacoes: form.observacoes || null,
    }

    const { data, error: err } = await supabase.from('processos_juridicos').insert(payload).select('id').single()
    setLoading(false)

    if (err) {
      setError(err.message)
      return
    }

    toast.success('Processo cadastrado com sucesso')
    router.push(`/juridico/processos/${data.id}`)
  }

  const STEPS = [
    { n: 1, label: 'Dados Básicos' },
    { n: 2, label: 'Tribunal' },
    { n: 3, label: 'Financeiro' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <Breadcrumb items={[
        { label: 'Jurídico', href: '/juridico/processos' },
        { label: 'Processos', href: '/juridico/processos' },
        { label: 'Novo' },
      ]} />

      <h1 className="text-xl font-bold font-display text-brand mt-4 mb-6">Novo Processo</h1>

      {/* Step tabs */}
      <div className="flex border-b mb-6">
        {STEPS.map(s => (
          <button
            key={s.n}
            onClick={() => setStep(s.n)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${step === s.n ? 'border-brand text-brand' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {s.n}. {s.label}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}

      {/* Step 1 - Dados Básicos */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nº CNJ</label>
              <input type="text" value={form.numero_cnj} onChange={e => set('numero_cnj', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="0000000-00.0000.0.00.0000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Selecione...</option>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Polo *</label>
              <select value={form.polo} onChange={e => set('polo', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Selecione...</option>
                {POLOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objeto *</label>
            <textarea value={form.objeto} onChange={e => set('objeto', e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parte contrária *</label>
              <input type="text" value={form.parte_contraria} onChange={e => set('parte_contraria', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ parte contrária</label>
              <input type="text" value={form.parte_contraria_cpf_cnpj} onChange={e => set('parte_contraria_cpf_cnpj', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL do processo</label>
            <input type="text" value={form.url_processo} onChange={e => set('url_processo', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="https://..." />
          </div>
          <div className="flex justify-end pt-2">
            <button onClick={() => setStep(2)} className="px-5 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">Próximo</button>
          </div>
        </div>
      )}

      {/* Step 2 - Tribunal */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tribunal</label>
              <input type="text" value={form.tribunal} onChange={e => set('tribunal', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Ex: TRT-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vara</label>
              <input type="text" value={form.vara} onChange={e => set('vara', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comarca</label>
              <input type="text" value={form.comarca} onChange={e => set('comarca', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
              <select value={form.uf} onChange={e => set('uf', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Selecione...</option>
                {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data distribuição</label>
              <input type="date" value={form.data_distribuicao} onChange={e => set('data_distribuicao', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data citação</label>
              <input type="date" value={form.data_citacao} onChange={e => set('data_citacao', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="px-5 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">Voltar</button>
            <button onClick={() => setStep(3)} className="px-5 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark">Próximo</button>
          </div>
        </div>
      )}

      {/* Step 3 - Financeiro */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor da causa (R$)</label>
              <input type="number" step="0.01" value={form.valor_causa} onChange={e => set('valor_causa', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor provisionado (R$)</label>
              <input type="number" step="0.01" value={form.valor_provisionado} onChange={e => set('valor_provisionado', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prognóstico</label>
              <select value={form.prognostico} onChange={e => set('prognostico', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Selecione...</option>
                {PROGNOSTICOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Advogado</label>
              <select value={form.advogado_id} onChange={e => set('advogado_id', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Selecione...</option>
                {advogados.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Funcionário vinculado</label>
              <select value={form.funcionario_id} onChange={e => set('funcionario_id', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Nenhum</option>
                {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Obra vinculada</label>
              <select value={form.obra_id} onChange={e => set('obra_id', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Nenhuma</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Centro de custo</label>
              <select value={form.centro_custo_id} onChange={e => set('centro_custo_id', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Nenhum</option>
                {centrosCusto.map(cc => <option key={cc.id} value={cc.id}>{cc.codigo} - {cc.nome}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea value={form.observacoes} onChange={e => set('observacoes', e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(2)} className="px-5 py-2 border rounded-xl text-sm text-gray-600 hover:bg-gray-50">Voltar</button>
            <button onClick={handleSubmit} disabled={loading} className="px-5 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
              {loading ? 'Salvando...' : 'Salvar processo'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { Plus, X } from 'lucide-react'

type QuickCreateType = 'centro_custo' | 'categoria_financeira' | 'funcao' | 'cliente' | 'obra' | 'conta_bancaria' | 'fornecedor' | 'advogado' | 'credor_tipo'

interface QuickCreateOption {
  id: string
  label: string
  group?: string
}

interface QuickCreateSelectProps {
  type: QuickCreateType
  value: string
  onChange: (id: string, label: string) => void
  options: QuickCreateOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  context?: { obra_id?: string; tipo?: string }
  onCreated?: (id: string, label: string) => void
}

const TYPE_CONFIG: Record<QuickCreateType, { titulo: string; tabela: string }> = {
  centro_custo: { titulo: 'Novo Centro de Custo', tabela: 'centros_custo' },
  categoria_financeira: { titulo: 'Nova Categoria Financeira', tabela: 'categorias_financeiras' },
  funcao: { titulo: 'Nova Função', tabela: 'funcoes' },
  cliente: { titulo: 'Novo Cliente', tabela: 'clientes' },
  obra: { titulo: 'Nova Obra', tabela: 'obras' },
  conta_bancaria: { titulo: 'Nova Conta Bancária', tabela: 'contas_correntes' },
  fornecedor: { titulo: 'Novo Fornecedor', tabela: 'fornecedores' },
  advogado: { titulo: 'Novo Advogado', tabela: 'advogados' },
  credor_tipo: { titulo: 'Novo Tipo de Credor', tabela: 'credor_tipos' },
}

const CC_TIPOS = [
  { value: 'obra', label: 'Obra' },
  { value: 'suporte_obra', label: 'Suporte Obra' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'equipamento', label: 'Equipamento' },
]

/* ═══ Modal inline ═══ */

function QuickCreateModal({
  type,
  context,
  onCreated,
  onClose,
}: {
  type: QuickCreateType
  context?: { obra_id?: string; tipo?: string }
  onCreated: (id: string, label: string) => void
  onClose: () => void
}) {
  const supabase = createClient()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  // centro_custo
  const [ccNome, setCcNome] = useState('')
  const [ccTipo, setCcTipo] = useState(context?.tipo || 'obra')

  // categoria_financeira
  const [catNome, setCatNome] = useState('')
  const [catTipo, setCatTipo] = useState('despesa')

  // funcao
  const [funcNome, setFuncNome] = useState('')
  const [funcSalario, setFuncSalario] = useState('')
  const [funcHoras, setFuncHoras] = useState('220')

  // cliente
  const [cliNome, setCliNome] = useState('')
  const [cliCnpj, setCliCnpj] = useState('')

  // obra
  const [obraNome, setObraNome] = useState('')
  const [obraDataInicio, setObraDataInicio] = useState('')

  // conta_bancaria
  const [contaNome, setContaNome] = useState('')
  const [contaBanco, setContaBanco] = useState('')

  // fornecedor
  const [fornNome, setFornNome] = useState('')
  const [fornCnpj, setFornCnpj] = useState('')

  // credor_tipo
  const [ctLabel, setCtLabel] = useState('')

  // advogado
  const [advNome, setAdvNome] = useState('')
  const [advOab, setAdvOab] = useState('')
  const [advUf, setAdvUf] = useState('SP')
  const [advTipo, setAdvTipo] = useState('externo')

  const config = TYPE_CONFIG[type]

  async function handleSave() {
    setSaving(true)
    try {
      let insertData: Record<string, unknown> = {}
      let label = ''

      switch (type) {
        case 'centro_custo': {
          if (!ccNome.trim()) { toast.warning('Nome obrigatorio'); setSaving(false); return }
          // Tentar gerar codigo via RPC
          let codigo = ''
          try {
            const { data: rpcData } = await supabase.rpc('cc_gerar_codigo', { tipo_param: ccTipo })
            if (rpcData) codigo = rpcData
          } catch {
            // RPC pode nao existir, segue sem codigo
          }
          insertData = { nome: ccNome.trim(), tipo: ccTipo, ativo: true, ...(codigo ? { codigo } : {}) }
          label = codigo ? `${codigo} — ${ccNome.trim()}` : ccNome.trim()
          break
        }
        case 'categoria_financeira': {
          if (!catNome.trim()) { toast.warning('Nome obrigatorio'); setSaving(false); return }
          insertData = { nome: catNome.trim(), tipo: catTipo }
          label = catNome.trim()
          break
        }
        case 'funcao': {
          if (!funcNome.trim()) { toast.warning('Nome obrigatorio'); setSaving(false); return }
          insertData = {
            nome: funcNome.trim(),
            ativo: true,
            ...(funcSalario ? { salario_base: parseFloat(funcSalario) } : {}),
            ...(funcHoras ? { horas_mes: parseInt(funcHoras) } : {}),
          }
          label = funcNome.trim()
          break
        }
        case 'cliente': {
          if (!cliNome.trim()) { toast.warning('Nome obrigatorio'); setSaving(false); return }
          insertData = { nome: cliNome.trim(), ...(cliCnpj ? { cnpj: cliCnpj } : {}) }
          label = cliNome.trim()
          break
        }
        case 'obra': {
          if (!obraNome.trim() || !obraDataInicio) { toast.warning('Nome e data de inicio obrigatorios'); setSaving(false); return }
          insertData = { nome: obraNome.trim(), data_inicio: obraDataInicio, status: 'ativo' }
          label = obraNome.trim()
          break
        }
        case 'conta_bancaria': {
          if (!contaNome.trim()) { toast.warning('Nome obrigatório'); setSaving(false); return }
          insertData = { nome: contaNome.trim(), ativo: true, ...(contaBanco ? { banco: contaBanco } : {}) }
          label = contaNome.trim()
          break
        }
        case 'fornecedor': {
          if (!fornNome.trim()) { toast.warning('Nome obrigatório'); setSaving(false); return }
          insertData = { nome: fornNome.trim(), ativo: true, ...(fornCnpj ? { cnpj: fornCnpj } : {}) }
          label = fornNome.trim()
          break
        }
        case 'advogado': {
          if (!advNome.trim() || !advOab.trim()) { toast.warning('Nome e OAB obrigatórios'); setSaving(false); return }
          insertData = { nome: advNome.trim(), oab: advOab.trim(), uf_oab: advUf, tipo: advTipo, ativo: true }
          label = `${advNome.trim()} (OAB/${advUf} ${advOab.trim()})`
          break
        }
        case 'credor_tipo': {
          if (!ctLabel.trim()) { toast.warning('Nome do tipo obrigatório'); setSaving(false); return }
          const valor = ctLabel.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
          insertData = { valor, label: ctLabel.trim(), ativo: true }
          label = ctLabel.trim()
          break
        }
      }

      const { data, error } = await supabase
        .from(config.tabela)
        .insert(insertData)
        .select('id')
        .single()

      if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }
      if (!data) { toast.error('Erro ao criar registro'); setSaving(false); return }

      toast.success(`${config.titulo.replace('Nov', 'Criad').replace('a ', 'a: ').replace('o ', 'o: ')}`)
      // credor_tipo usa 'valor' como identificador, não 'id'
      const returnId = type === 'credor_tipo' ? (insertData as any).valor : data.id
      onCreated(returnId, label)
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error('Erro: ' + message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-800">{config.titulo}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {type === 'centro_custo' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome *</label>
                <input
                  value={ccNome}
                  onChange={e => setCcNome(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Nome do centro de custo"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo *</label>
                <select
                  value={ccTipo}
                  onChange={e => setCcTipo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                >
                  {CC_TIPOS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {type === 'categoria_financeira' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome *</label>
                <input
                  value={catNome}
                  onChange={e => setCatNome(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Nome da categoria"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo *</label>
                <select
                  value={catTipo}
                  onChange={e => setCatTipo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                >
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                </select>
              </div>
            </>
          )}

          {type === 'funcao' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome *</label>
                <input
                  value={funcNome}
                  onChange={e => setFuncNome(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Nome da funcao"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Salario (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={funcSalario}
                  onChange={e => setFuncSalario(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Horas/mes</label>
                <input
                  type="number"
                  value={funcHoras}
                  onChange={e => setFuncHoras(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="220"
                />
              </div>
            </>
          )}

          {type === 'cliente' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome *</label>
                <input
                  value={cliNome}
                  onChange={e => setCliNome(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Nome do cliente"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">CNPJ</label>
                <input
                  value={cliCnpj}
                  onChange={e => setCliCnpj(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="00.000.000/0000-00"
                />
              </div>
            </>
          )}

          {type === 'obra' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome *</label>
                <input
                  value={obraNome}
                  onChange={e => setObraNome(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Nome da obra"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Data de inicio *</label>
                <input
                  type="date"
                  value={obraDataInicio}
                  onChange={e => setObraDataInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </>
          )}

          {type === 'conta_bancaria' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome *</label>
                <input
                  value={contaNome}
                  onChange={e => setContaNome(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Nome da conta"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Banco</label>
                <input
                  value={contaBanco}
                  onChange={e => setContaBanco(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Ex: Itau, Bradesco..."
                />
              </div>
            </>
          )}

          {type === 'fornecedor' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome *</label>
                <input value={fornNome} onChange={e => setFornNome(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Ex: CONTABNEW ASSESSORIA" autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">CNPJ</label>
                <input value={fornCnpj} onChange={e => setFornCnpj(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="00.000.000/0000-00" />
              </div>
            </>
          )}

          {type === 'advogado' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome *</label>
                <input value={advNome} onChange={e => setAdvNome(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Dr. João Silva" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">OAB *</label>
                  <input value={advOab} onChange={e => setAdvOab(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    placeholder="123456" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">UF *</label>
                  <select value={advUf} onChange={e => setAdvUf(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white">
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo *</label>
                <select value={advTipo} onChange={e => setAdvTipo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white">
                  <option value="interno">Interno</option>
                  <option value="externo">Externo</option>
                  <option value="escritorio">Escritório</option>
                </select>
              </div>
            </>
          )}
          {type === 'credor_tipo' && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do tipo *</label>
              <input value={ctLabel} onChange={e => setCtLabel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="Ex: Consórcio, Factoring, Securitizadora..." autoFocus />
              {ctLabel.trim() && (
                <div className="text-[10px] text-gray-400 mt-1">
                  Identificador: <code>{ctLabel.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}</code>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══ QuickCreateSelect ═══ */

export default function QuickCreateSelect({
  type,
  value,
  onChange,
  options,
  placeholder = 'Selecionar...',
  disabled = false,
  className = '',
  context,
  onCreated,
}: QuickCreateSelectProps) {
  const [modalOpen, setModalOpen] = useState(false)

  // Agrupar por group se existir
  const hasGroups = options.some(o => o.group)
  const grouped = hasGroups
    ? options.reduce<Record<string, QuickCreateOption[]>>((acc, o) => {
        const g = o.group || 'Outros'
        if (!acc[g]) acc[g] = []
        acc[g].push(o)
        return acc
      }, {})
    : null

  function handleCreated(id: string, label: string) {
    onChange(id, label)
    onCreated?.(id, label)
  }

  return (
    <>
      <div className={`flex items-center gap-1 ${className}`}>
        <select
          value={value}
          onChange={e => {
            const opt = options.find(o => o.id === e.target.value)
            onChange(e.target.value, opt?.label || '')
          }}
          disabled={disabled}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
        >
          <option value="">{placeholder}</option>
          {grouped
            ? Object.entries(grouped).map(([group, opts]) => (
                <optgroup key={group} label={group}>
                  {opts.map(o => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </optgroup>
              ))
            : options.map(o => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))
          }
        </select>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={disabled}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-brand hover:text-white hover:border-brand transition-colors disabled:opacity-40"
          title="Criar novo"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {modalOpen && (
        <QuickCreateModal
          type={type}
          context={context}
          onCreated={handleCreated}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}

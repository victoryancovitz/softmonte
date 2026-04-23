'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import QuickCreateSelect from '@/components/ui/QuickCreateSelect'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const CATEGORIAS_RECEITA = ['Faturamento HH', 'Serviços', 'Outras receitas']
const CATEGORIAS_DESPESA = ['Folha de Pagamento', 'Encargos', 'Aluguel', 'Materiais', 'Compras', 'Impostos', 'Honorários', 'Despesas Financeiras', 'Amortização de Empréstimos', 'Depreciação', 'Custo dos Serviços Prestados', 'Outras despesas']

const CC_TIPO_LABEL: Record<string, string> = { obra: 'Obra', suporte_obra: 'Suporte Obra', administrativo: 'Administrativo', equipamento: 'Equipamento' }

const FORM_INITIAL = {
  tipo: 'despesa',
  nome: '',
  fornecedor: '',
  categoria: '',
  centro_custo: '',
  centro_custo_id: '',
  valor: '',
  data_competencia: new Date().toISOString().slice(0, 7) + '-01',
  data_vencimento: '',
  conta_id: '',
  numero_documento: '',
  observacao: '',
  anexo_url: '',
  obra_id: '',
  is_provisao: false,
  status: 'em_aberto',
  forma_pagamento: '',
  data_pagamento: '',
  is_parcelado: false,
  parcela_total: 1,
  intervalo_parcelas_dias: 30,
  is_recorrente: false,
  frequencia: 'mensal',
  total_ocorrencias: 12,
  alertar_dias_antes: 7,
  variacao_max_pct: 20,
  juros_dia_padrao_pct: 0.033,
  multa_padrao_pct: 2,
  valor_previsto: '',
}

interface LancamentoModalProps {
  open: boolean
  onClose: () => void
  editingLanc: any | null
  contas: any[]
  fornecedores: any[]
  obras: any[]
  onSaved: () => void
}

export default function LancamentoModal({ open, onClose, editingLanc, contas, fornecedores, obras, onSaved }: LancamentoModalProps) {
  const supabase = createClient()
  const toast = useToast()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [modalForm, setModalForm] = useState({ ...FORM_INITIAL })
  const [editingId, setEditingId] = useState<string | null>(null)
  // Tabs removidas — tudo em uma seção com accordions colapsáveis
  const [salvando, setSalvando] = useState(false)
  const [avisoSimilar, setAvisoSimilar] = useState<string | null>(null)
  const [uploadingAnexo, setUploadingAnexo] = useState(false)
  const [centrosCusto, setCentrosCusto] = useState<any[]>([])

  // Load centros de custo
  useEffect(() => {
    supabase.from('centros_custo').select('id, codigo, nome, tipo').is('deleted_at', null).eq('ativo', true).order('codigo').then(({ data }) => setCentrosCusto(data ?? []))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset form when modal opens/closes or editingLanc changes
  useEffect(() => {
    if (!open) return
    if (editingLanc) {
      setEditingId(editingLanc.id)
      setModalForm({
        tipo: editingLanc.tipo || 'despesa',
        nome: editingLanc.nome || '',
        fornecedor: editingLanc.fornecedor || '',
        categoria: editingLanc.categoria || '',
        centro_custo: editingLanc.centro_custo || '',
        centro_custo_id: editingLanc.centro_custo_id || '',
        valor: String(editingLanc.valor || ''),
        data_competencia: editingLanc.data_competencia || new Date().toISOString().slice(0, 7) + '-01',
        data_vencimento: editingLanc.data_vencimento || '',
        conta_id: editingLanc.conta_id || '',
        numero_documento: editingLanc.numero_documento || '',
        observacao: editingLanc.observacao || '',
        anexo_url: editingLanc.anexo_url || '',
        obra_id: editingLanc.obra_id || '',
        is_provisao: editingLanc.is_provisao || false,
        status: editingLanc.status || 'em_aberto',
        forma_pagamento: editingLanc.forma_pagamento || '',
        data_pagamento: editingLanc.data_pagamento || '',
        is_parcelado: false,
        parcela_total: 1,
        intervalo_parcelas_dias: 30,
        is_recorrente: false,
        frequencia: 'mensal',
        total_ocorrencias: 12,
        alertar_dias_antes: editingLanc.alertar_dias_antes ?? 7,
        variacao_max_pct: editingLanc.variacao_max_pct ?? 20,
        juros_dia_padrao_pct: editingLanc.juros_dia_padrao_pct ?? 0.033,
        multa_padrao_pct: editingLanc.multa_padrao_pct ?? 2,
        valor_previsto: editingLanc.valor_previsto ? String(editingLanc.valor_previsto) : '',
      })
    } else {
      setEditingId(null)
      setModalForm({ ...FORM_INITIAL })
    }
    setAvisoSimilar(null)
  }, [open, editingLanc])

  // Duplicate detection debounce
  useEffect(() => {
    if (!open || editingId) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const nome = modalForm.nome.trim()
    const valor = modalForm.valor
    if (!nome || !valor) { setAvisoSimilar(null); return }
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('financeiro_lancamentos')
        .select('id, nome, valor, data_competencia')
        .is('deleted_at', null)
        .ilike('nome', `%${nome}%`)
        .eq('valor', Number(valor))
        .limit(3)
      if (data && data.length > 0) {
        setAvisoSimilar(`Possível duplicidade: encontrado "${data[0].nome}" com mesmo valor (${fmt(Number(data[0].valor))}) em ${data[0].data_competencia || 'sem data'}`)
      } else {
        setAvisoSimilar(null)
      }
    }, 600)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [modalForm.nome, modalForm.valor, open, editingId])

  async function uploadAnexo(file: File) {
    const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
    const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp']

    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error('Tipo de arquivo nao permitido. Aceitos: PDF, JPG, PNG, WEBP')
      return
    }
    if (file.size > MAX_SIZE) {
      toast.error('Arquivo muito grande. Tamanho maximo: 10 MB')
      return
    }

    setUploadingAnexo(true)
    try {
      const path = `comprovantes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await supabase.storage.from('documentos').upload(path, file)
      if (error) { toast.error('Erro no upload: ' + error.message); return }
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)
      setModalForm(f => ({ ...f, anexo_url: urlData.publicUrl }))
      toast.success('Arquivo anexado')
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err.message || 'Tente novamente'))
    } finally {
      setUploadingAnexo(false)
    }
  }

  async function salvar() {
    setSalvando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const valorNum = Number(modalForm.valor)
      if (!valorNum || valorNum <= 0) { toast.error('Valor inválido'); setSalvando(false); return }
      if (!modalForm.nome.trim()) { toast.error('Descrição obrigatória'); setSalvando(false); return }

      const frequenciaDias = modalForm.frequencia === 'semanal' ? 7 : modalForm.frequencia === 'quinzenal' ? 15 : modalForm.frequencia === 'bimestral' ? 60 : modalForm.frequencia === 'trimestral' ? 90 : modalForm.frequencia === 'semestral' ? 180 : modalForm.frequencia === 'anual' ? 365 : 30

      // EDIT mode
      if (editingId) {
        // Check variacao if valor_previsto exists and valor changed
        if (modalForm.valor_previsto && Number(modalForm.valor_previsto) > 0) {
          const variacaoPct = Math.abs((valorNum - Number(modalForm.valor_previsto)) / Number(modalForm.valor_previsto) * 100)
          if (variacaoPct > (modalForm.variacao_max_pct ?? 20)) {
            const confirmar = await confirmDialog({
              title: 'Variação acima do limite',
              message: `O valor (${fmt(valorNum)}) variou ${variacaoPct.toFixed(1)}% em relação ao previsto (${fmt(Number(modalForm.valor_previsto))}), acima do limite de ${modalForm.variacao_max_pct ?? 20}%. Deseja salvar mesmo assim?`,
              variant: 'warning',
              confirmLabel: 'Salvar',
            })
            if (!confirmar) { setSalvando(false); return }
          }
        }
        const updatePayload: Record<string, any> = {
          tipo: modalForm.tipo,
          nome: modalForm.nome,
          fornecedor: modalForm.fornecedor || null,
          valor: valorNum,
          categoria: modalForm.categoria || null,
          centro_custo: modalForm.centro_custo || null,
          centro_custo_id: modalForm.centro_custo_id || null,
          obra_id: modalForm.obra_id || null,
          conta_id: modalForm.conta_id || null,
          data_competencia: modalForm.data_competencia || null,
          data_vencimento: modalForm.data_vencimento || null,
          observacao: modalForm.observacao || null,
          is_provisao: modalForm.is_provisao,
          numero_documento: modalForm.numero_documento || null,
          anexo_url: modalForm.anexo_url || null,
          updated_by: user?.id ?? null,
          juros_dia_padrao_pct: modalForm.juros_dia_padrao_pct ?? 0.033,
          multa_padrao_pct: modalForm.multa_padrao_pct ?? 2,
        }

        // Se é parte de um grupo (parcelado/recorrente), perguntar se aplica a todas
        const grupoId = (editingLanc as any)?.parcela_grupo_id
        let aplicarEmTodas = false
        if (grupoId) {
          aplicarEmTodas = await confirmDialog({
            title: 'Aplicar a todas as parcelas?',
            message: 'Este lançamento faz parte de um grupo recorrente/parcelado. Deseja aplicar as alterações (fornecedor, categoria, centro de custo, conta, obra) a todas as parcelas em aberto?',
            variant: 'info',
            confirmLabel: 'Aplicar a todas',
            cancelLabel: 'Apenas esta',
          })
        }

        if (aplicarEmTodas && grupoId) {
          // Campos que fazem sentido propagar (não valor/vencimento que variam por parcela)
          const grupoPayload: Record<string, any> = {
            fornecedor: updatePayload.fornecedor,
            categoria: updatePayload.categoria,
            centro_custo: updatePayload.centro_custo,
            centro_custo_id: updatePayload.centro_custo_id,
            obra_id: updatePayload.obra_id,
            conta_id: updatePayload.conta_id,
            updated_by: updatePayload.updated_by,
          }
          // Atualiza todas em aberto do mesmo grupo
          const { error: errGrupo, count } = await supabase.from('financeiro_lancamentos')
            .update(grupoPayload)
            .eq('parcela_grupo_id', grupoId)
            .eq('status', 'em_aberto')
            .neq('id', editingId)
          if (errGrupo) toast.warning('Erro ao atualizar grupo: ' + errGrupo.message)
          else toast.success(`${count ?? 0} parcelas atualizadas`)
        }

        // Atualiza o lançamento atual (com todos os campos, incluindo valor/vencimento)
        const { error } = await supabase.from('financeiro_lancamentos').update(updatePayload).eq('id', editingId)
        if (error) { toast.error('Erro: ' + error.message); setSalvando(false); return }
        toast.success('Lançamento atualizado')
      }
      // PARCELADO mode
      else if (modalForm.is_parcelado && modalForm.parcela_total > 1) {
        const grupoId = crypto.randomUUID()
        const valorParcela = Math.round(valorNum / modalForm.parcela_total * 100) / 100
        const baseVenc = modalForm.data_vencimento || new Date().toISOString().slice(0, 10)
        const rows = Array.from({ length: modalForm.parcela_total }, (_, i) => {
          const venc = new Date(baseVenc + 'T12:00')
          venc.setDate(venc.getDate() + i * modalForm.intervalo_parcelas_dias)
          return {
            tipo: modalForm.tipo, nome: `${modalForm.nome} (${i + 1}/${modalForm.parcela_total})`,
            fornecedor: modalForm.fornecedor || null,
            valor: valorParcela, categoria: modalForm.categoria || null,
            centro_custo: modalForm.centro_custo || null,
            centro_custo_id: modalForm.centro_custo_id || null,
            obra_id: modalForm.obra_id || null, conta_id: modalForm.conta_id || null,
            data_competencia: modalForm.data_competencia || null,
            data_vencimento: venc.toISOString().slice(0, 10),
            observacao: modalForm.observacao || null, is_provisao: modalForm.is_provisao,
            origem: 'manual', status: 'em_aberto', created_by: user?.id ?? null,
            is_parcelado: true, parcela_numero: i + 1, parcela_total: modalForm.parcela_total,
            parcela_grupo_id: grupoId, intervalo_parcelas_dias: modalForm.intervalo_parcelas_dias,
            numero_documento: modalForm.numero_documento || null,
            anexo_url: modalForm.anexo_url || null,
            juros_dia_padrao_pct: modalForm.juros_dia_padrao_pct ?? 0.033,
            multa_padrao_pct: modalForm.multa_padrao_pct ?? 2,
          }
        })
        const { error } = await supabase.from('financeiro_lancamentos').insert(rows)
        if (error) { toast.error('Erro: ' + error.message); setSalvando(false); return }
        toast.success(`${modalForm.parcela_total} parcelas criadas`)
      }
      // RECORRENTE mode — create only the current month's entry (cron handles future ones)
      else if (modalForm.is_recorrente) {
        const grupoId = crypto.randomUUID()
        const baseVenc = modalForm.data_vencimento || new Date().toISOString().slice(0, 10)
        const row = {
          tipo: modalForm.tipo, nome: modalForm.nome,
          fornecedor: modalForm.fornecedor || null,
          valor: valorNum, valor_previsto: valorNum,
          categoria: modalForm.categoria || null,
          centro_custo: modalForm.centro_custo || null,
          centro_custo_id: modalForm.centro_custo_id || null,
          obra_id: modalForm.obra_id || null, conta_id: modalForm.conta_id || null,
          data_competencia: modalForm.data_competencia || null,
          data_vencimento: baseVenc,
          observacao: modalForm.observacao || null, is_provisao: modalForm.is_provisao,
          origem: 'manual', status: 'em_aberto', created_by: user?.id ?? null,
          is_recorrente: true, frequencia: modalForm.frequencia,
          parcela_numero: 1, parcela_total: modalForm.total_ocorrencias,
          parcela_grupo_id: grupoId, intervalo_parcelas_dias: frequenciaDias,
          numero_documento: modalForm.numero_documento || null,
          anexo_url: modalForm.anexo_url || null,
          alertar_dias_antes: modalForm.alertar_dias_antes ?? 7,
          variacao_max_pct: modalForm.variacao_max_pct ?? 20,
          juros_dia_padrao_pct: modalForm.juros_dia_padrao_pct ?? 0.033,
          multa_padrao_pct: modalForm.multa_padrao_pct ?? 2,
        }
        const { error } = await supabase.from('financeiro_lancamentos').insert(row)
        if (error) { toast.error('Erro: ' + error.message); setSalvando(false); return }
        toast.success(`Lançamento recorrente criado (${modalForm.frequencia}, 1/${modalForm.total_ocorrencias})`)
      }
      // SIMPLE mode
      else {
        const { error } = await supabase.from('financeiro_lancamentos').insert({
          tipo: modalForm.tipo, nome: modalForm.nome, valor: valorNum,
          fornecedor: modalForm.fornecedor || null,
          categoria: modalForm.categoria || null,
          centro_custo: modalForm.centro_custo || null,
          centro_custo_id: modalForm.centro_custo_id || null,
          obra_id: modalForm.obra_id || null,
          conta_id: modalForm.conta_id || null,
          data_competencia: modalForm.data_competencia || null,
          data_vencimento: modalForm.data_vencimento || null,
          observacao: modalForm.observacao || null, is_provisao: modalForm.is_provisao,
          origem: 'manual', status: 'em_aberto', created_by: user?.id ?? null,
          numero_documento: modalForm.numero_documento || null,
          anexo_url: modalForm.anexo_url || null,
          juros_dia_padrao_pct: modalForm.juros_dia_padrao_pct ?? 0.033,
          multa_padrao_pct: modalForm.multa_padrao_pct ?? 2,
        })
        if (error) { toast.error('Erro: ' + error.message); setSalvando(false); return }
        toast.success('Lançamento criado')
      }
      onClose()
      onSaved()
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Tente novamente'))
    } finally {
      setSalvando(false)
    }
  }

  // Button text for modal
  const modalButtonText = editingId
    ? 'Salvar alterações'
    : modalForm.is_parcelado && modalForm.parcela_total > 1
      ? `Criar ${modalForm.parcela_total} parcelas`
      : modalForm.is_recorrente
        ? `Criar ${modalForm.total_ocorrencias} ocorrências`
        : 'Criar lançamento'

  // Parcelamento preview dates
  const previewParcelas = modalForm.is_parcelado && modalForm.parcela_total > 1 && modalForm.data_vencimento
    ? Array.from({ length: Math.min(modalForm.parcela_total, 6) }, (_, i) => {
        const d = new Date(modalForm.data_vencimento + 'T12:00')
        d.setDate(d.getDate() + i * modalForm.intervalo_parcelas_dias)
        return d.toLocaleDateString('pt-BR')
      })
    : []

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto">
        <div className={`px-6 py-4 flex items-center justify-between ${modalForm.tipo === 'receita' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
          <h2 className="font-bold">
            {editingId
              ? (modalForm.tipo === 'receita' ? 'Editar Receita' : 'Editar Despesa')
              : (modalForm.tipo === 'receita' ? 'Nova Receita' : 'Nova Despesa')}
          </h2>
          <div className="flex items-center gap-3">
            <select value={modalForm.tipo} onChange={e => setModalForm(f => ({ ...f, tipo: e.target.value }))}
              className="bg-white/20 text-white text-sm rounded px-2 py-1 border-0">
              <option value="receita" className="text-gray-900">Receita</option>
              <option value="despesa" className="text-gray-900">Despesa</option>
            </select>
            <button onClick={onClose} className="text-white/80 hover:text-white text-lg">✕</button>
          </div>
        </div>

        {/* Header separator */}
        <div className="border-b border-gray-200" />

        {/* Duplicate warning */}
        {avisoSimilar && (
          <div className="mx-6 mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            ⚠️ {avisoSimilar}
          </div>
        )}

        <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Descrição *</label>
                <input value={modalForm.nome} onChange={e => setModalForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Nome do lançamento" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Fornecedor</label>
                <QuickCreateSelect
                  type="fornecedor"
                  value={fornecedores.find(f => f.nome === modalForm.fornecedor)?.id || ''}
                  onChange={(id, label) => setModalForm(f => ({ ...f, fornecedor: label, fornecedor_id: id }))}
                  options={fornecedores.map(f => ({ id: f.id, label: f.nome }))}
                  placeholder="Buscar fornecedor..."
                  onCreated={(id, label) => {
                    fornecedores.push({ id, nome: label })
                    setModalForm(f => ({ ...f, fornecedor: label, fornecedor_id: id }))
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Valor *</label>
                <input type="number" step="0.01" value={modalForm.valor} onChange={e => setModalForm(f => ({ ...f, valor: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="0,00" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Vencimento</label>
                <input type="date" value={modalForm.data_vencimento} onChange={e => setModalForm(f => ({ ...f, data_vencimento: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Competência</label>
                <input type="date" value={modalForm.data_competencia} onChange={e => setModalForm(f => ({ ...f, data_competencia: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Conta *</label>
                <QuickCreateSelect
                  type="conta_bancaria"
                  value={modalForm.conta_id}
                  onChange={(id) => setModalForm(f => ({ ...f, conta_id: id }))}
                  options={contas.map(c => ({ id: c.id, label: `${c.banco ? c.banco + ' — ' : ''}${c.nome}` }))}
                  placeholder="Selecionar conta..."
                  onCreated={(id, label) => {
                    contas.push({ id, nome: label, banco: '' })
                    setModalForm(f => ({ ...f, conta_id: id }))
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Categoria</label>
                <QuickCreateSelect
                  type="categoria_financeira"
                  value={(modalForm.tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA).includes(modalForm.categoria) ? modalForm.categoria : ''}
                  onChange={(id, label) => setModalForm(f => ({ ...f, categoria: label }))}
                  options={(modalForm.tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA).map(c => ({ id: c, label: c }))}
                  placeholder="Selecionar categoria..."
                  onCreated={(id, label) => {
                    setModalForm(f => ({ ...f, categoria: label }))
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Centro de custo</label>
                <QuickCreateSelect
                  type="centro_custo"
                  value={modalForm.centro_custo_id}
                  onChange={(id, label) => {
                    const cc = centrosCusto.find(c => c.id === id)
                    setModalForm(f => ({ ...f, centro_custo_id: id, centro_custo: cc ? `${cc.codigo} — ${cc.nome}` : label }))
                  }}
                  options={centrosCusto.map(cc => ({
                    id: cc.id,
                    label: `${cc.codigo} — ${cc.nome}`,
                    group: CC_TIPO_LABEL[cc.tipo] || cc.tipo,
                  }))}
                  placeholder="Selecionar..."
                  onCreated={(id, label) => {
                    setCentrosCusto(prev => [...prev, { id, codigo: '', nome: label, tipo: 'obra' }])
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Obra</label>
                <select value={modalForm.obra_id} onChange={e => {
                  const oId = e.target.value
                  setModalForm(f => {
                    const ob = obras.find(o => o.id === oId)
                    const contaId = f.tipo === 'receita' ? ob?.conta_recebimento_id : ob?.conta_pagamento_id
                    return { ...f, obra_id: oId, conta_id: contaId || f.conta_id || contas.find(c => c.is_padrao)?.id || '' }
                  })
                }} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">Nenhuma</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Observação</label>
                <textarea value={modalForm.observacao} onChange={e => setModalForm(f => ({ ...f, observacao: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" rows={2} />
              </div>
              {/* Anexo */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Anexo (comprovante)</label>
                <div className="flex items-center gap-2">
                  <label className={`px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium cursor-pointer hover:bg-gray-50 transition-colors ${uploadingAnexo ? 'opacity-50 pointer-events-none' : ''}`}>
                    {uploadingAnexo ? 'Enviando...' : '📎 Selecionar arquivo'}
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) uploadAnexo(file)
                    }} />
                  </label>
                  {modalForm.anexo_url && (
                    <div className="flex items-center gap-1.5 text-xs text-green-700">
                      <span>✓ Anexado</span>
                      <a href={modalForm.anexo_url} target="_blank" rel="noopener noreferrer" className="underline">Ver</a>
                      <button onClick={() => setModalForm(f => ({ ...f, anexo_url: '' }))} className="text-red-500 hover:text-red-700">✕</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={modalForm.is_provisao} onChange={e => setModalForm(f => ({ ...f, is_provisao: e.target.checked }))}
                    className="rounded border-gray-300 text-brand" />
                  É provisão (despesa futura estimada)
                </label>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">N° Documento</label>
                <input value={modalForm.numero_documento} onChange={e => setModalForm(f => ({ ...f, numero_documento: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="NF-e, OS, boleto..." />
              </div>
            </div>

          {!editingId && (
            <div className="space-y-3">
              {/* Recorrência */}
              <details className="border border-gray-200 rounded-xl overflow-hidden">
                <summary className="px-4 py-3 bg-gray-50 cursor-pointer text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <input type="checkbox" checked={modalForm.is_recorrente} onChange={e => { e.stopPropagation(); setModalForm(f => ({ ...f, is_recorrente: e.target.checked, is_parcelado: false })) }} className="rounded" />
                  Recorrência
                </summary>
                {modalForm.is_recorrente && (
                  <div className="px-4 py-3 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Frequência</label>
                        <select name="frequencia" value={modalForm.frequencia || 'mensal'} onChange={e => setModalForm(f => ({ ...f, frequencia: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
                          <option value="semanal">Semanal</option>
                          <option value="quinzenal">Quinzenal</option>
                          <option value="mensal">Mensal</option>
                          <option value="anual">Anual</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Total de ocorrências</label>
                        <input type="number" name="total_ocorrencias" min="1" value={modalForm.total_ocorrencias || ''} onChange={e => setModalForm(f => ({ ...f, total_ocorrencias: Number(e.target.value) || 12 }))} placeholder="∞" className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Alertar N dias antes</label>
                        <input type="number" name="alertar_dias_antes" value={modalForm.alertar_dias_antes ?? 7} onChange={e => setModalForm(f => ({ ...f, alertar_dias_antes: Number(e.target.value) }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Variação máx (%)</label>
                        <input type="number" name="variacao_max_pct" value={modalForm.variacao_max_pct ?? 20} onChange={e => setModalForm(f => ({ ...f, variacao_max_pct: Number(e.target.value) }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                    </div>
                  </div>
                )}
              </details>

              {/* Parcelamento */}
              <details className="border border-gray-200 rounded-xl overflow-hidden">
                <summary className="px-4 py-3 bg-gray-50 cursor-pointer text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <input type="checkbox" checked={modalForm.is_parcelado} onChange={e => { e.stopPropagation(); setModalForm(f => ({ ...f, is_parcelado: e.target.checked, is_recorrente: false })) }} className="rounded" />
                  Parcelamento
                </summary>
                {modalForm.is_parcelado && (
                  <div className="px-4 py-3 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">N° parcelas</label>
                        <input type="number" name="parcela_total" min="2" value={modalForm.parcela_total || ''} onChange={e => setModalForm(f => ({ ...f, parcela_total: Number(e.target.value) || 1 }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Intervalo (dias)</label>
                        <input type="number" name="intervalo_parcelas_dias" value={modalForm.intervalo_parcelas_dias ?? 30} onChange={e => setModalForm(f => ({ ...f, intervalo_parcelas_dias: Number(e.target.value) || 30 }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Valor/parcela</label>
                        <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700">
                          {modalForm.parcela_total && Number(modalForm.valor) > 0 ? `R$ ${(Number(modalForm.valor) / Number(modalForm.parcela_total)).toFixed(2)}` : '\u2014'}
                        </div>
                      </div>
                    </div>
                    {modalForm.parcela_total && Number(modalForm.parcela_total) > 1 && Number(modalForm.valor) > 0 && modalForm.data_vencimento && (
                      <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                        <div className="text-xs font-semibold text-gray-500 mb-2">Preview das parcelas:</div>
                        {Array.from({length: Math.min(Number(modalForm.parcela_total), 12)}).map((_, i) => {
                          const d = new Date(modalForm.data_vencimento + 'T12:00')
                          d.setDate(d.getDate() + i * Number(modalForm.intervalo_parcelas_dias || 30))
                          return (
                            <div key={i} className="flex justify-between text-xs text-gray-600 py-0.5">
                              <span>{i+1}/{modalForm.parcela_total}</span>
                              <span>{d.toLocaleDateString('pt-BR')}</span>
                              <span>R$ {(Number(modalForm.valor) / Number(modalForm.parcela_total)).toFixed(2)}</span>
                            </div>
                          )
                        })}
                        {Number(modalForm.parcela_total) > 12 && <div className="text-xs text-gray-400 mt-1">...e mais {Number(modalForm.parcela_total) - 12} parcelas</div>}
                      </div>
                    )}
                  </div>
                )}
              </details>

              {/* Juros e Multa */}
              <details className="border border-gray-200 rounded-xl overflow-hidden">
                <summary className="px-4 py-3 bg-gray-50 cursor-pointer text-sm font-semibold text-gray-700 flex items-center gap-2">
                  Juros e multa por atraso
                </summary>
                <div className="px-4 py-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Juros por dia (%)</label>
                      <input type="number" name="juros_dia_padrao_pct" step="0.001" value={modalForm.juros_dia_padrao_pct ?? 0.033} onChange={e => setModalForm(f => ({ ...f, juros_dia_padrao_pct: Number(e.target.value) }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Multa fixa (%)</label>
                      <input type="number" name="multa_padrao_pct" step="0.1" value={modalForm.multa_padrao_pct ?? 2} onChange={e => setModalForm(f => ({ ...f, multa_padrao_pct: Number(e.target.value) }))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                  </div>
                  {Number(modalForm.valor) > 0 && (
                    <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-800">
                      <div className="font-semibold mb-1">Preview de atraso:</div>
                      <div>5 dias: +R$ {(Number(modalForm.valor) * Number(modalForm.juros_dia_padrao_pct || 0.033) / 100 * 5 + Number(modalForm.valor) * Number(modalForm.multa_padrao_pct || 2) / 100).toFixed(2)}</div>
                      <div>15 dias: +R$ {(Number(modalForm.valor) * Number(modalForm.juros_dia_padrao_pct || 0.033) / 100 * 15 + Number(modalForm.valor) * Number(modalForm.multa_padrao_pct || 2) / 100).toFixed(2)}</div>
                      <div>30 dias: +R$ {(Number(modalForm.valor) * Number(modalForm.juros_dia_padrao_pct || 0.033) / 100 * 30 + Number(modalForm.valor) * Number(modalForm.multa_padrao_pct || 2) / 100).toFixed(2)}</div>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">
              Cancelar
            </button>
            <button disabled={!modalForm.nome || !modalForm.valor || salvando} onClick={salvar}
              className={`flex-1 px-4 py-2 text-white rounded-xl text-sm font-medium disabled:opacity-40 ${editingId ? 'bg-brand hover:bg-brand-dark' : modalForm.tipo === 'receita' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {salvando ? 'Salvando...' : modalButtonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

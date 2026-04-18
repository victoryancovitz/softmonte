'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

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
  const [abaModal, setAbaModal] = useState<'basico' | 'avancado'>('basico')
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
      })
    } else {
      setEditingId(null)
      setModalForm({ ...FORM_INITIAL })
    }
    setAbaModal('basico')
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
        setAvisoSimilar(`Possivel duplicidade: encontrado "${data[0].nome}" com mesmo valor (${fmt(Number(data[0].valor))}) em ${data[0].data_competencia || 'sem data'}`)
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
      if (!valorNum || valorNum <= 0) { toast.error('Valor invalido'); setSalvando(false); return }
      if (!modalForm.nome.trim()) { toast.error('Descricao obrigatoria'); setSalvando(false); return }

      const frequenciaDias = modalForm.frequencia === 'semanal' ? 7 : modalForm.frequencia === 'quinzenal' ? 15 : modalForm.frequencia === 'bimestral' ? 60 : modalForm.frequencia === 'trimestral' ? 90 : modalForm.frequencia === 'semestral' ? 180 : modalForm.frequencia === 'anual' ? 365 : 30

      // EDIT mode
      if (editingId) {
        const { error } = await supabase.from('financeiro_lancamentos').update({
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
        }).eq('id', editingId)
        if (error) { toast.error('Erro: ' + error.message); setSalvando(false); return }
        toast.success('Lancamento atualizado')
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
          }
        })
        const { error } = await supabase.from('financeiro_lancamentos').insert(rows)
        if (error) { toast.error('Erro: ' + error.message); setSalvando(false); return }
        toast.success(`${modalForm.parcela_total} parcelas criadas`)
      }
      // RECORRENTE mode
      else if (modalForm.is_recorrente) {
        const grupoId = crypto.randomUUID()
        const baseVenc = modalForm.data_vencimento || new Date().toISOString().slice(0, 10)
        const rows = Array.from({ length: modalForm.total_ocorrencias }, (_, i) => {
          const venc = new Date(baseVenc + 'T12:00')
          venc.setDate(venc.getDate() + i * frequenciaDias)
          const comp = new Date(venc)
          return {
            tipo: modalForm.tipo, nome: modalForm.nome,
            fornecedor: modalForm.fornecedor || null,
            valor: valorNum, categoria: modalForm.categoria || null,
            centro_custo: modalForm.centro_custo || null,
            centro_custo_id: modalForm.centro_custo_id || null,
            obra_id: modalForm.obra_id || null, conta_id: modalForm.conta_id || null,
            data_competencia: comp.toISOString().slice(0, 10),
            data_vencimento: venc.toISOString().slice(0, 10),
            observacao: modalForm.observacao || null, is_provisao: modalForm.is_provisao,
            origem: 'manual', status: 'em_aberto', created_by: user?.id ?? null,
            is_parcelado: true, parcela_numero: i + 1, parcela_total: modalForm.total_ocorrencias,
            parcela_grupo_id: grupoId, intervalo_parcelas_dias: frequenciaDias,
            numero_documento: modalForm.numero_documento || null,
            anexo_url: modalForm.anexo_url || null,
            is_recorrente: true,
          }
        })
        const { error } = await supabase.from('financeiro_lancamentos').insert(rows)
        if (error) { toast.error('Erro: ' + error.message); setSalvando(false); return }
        toast.success(`${modalForm.total_ocorrencias} lancamentos recorrentes criados`)
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
        })
        if (error) { toast.error('Erro: ' + error.message); setSalvando(false); return }
        toast.success('Lancamento criado')
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
    ? 'Salvar alteracoes'
    : modalForm.is_parcelado && modalForm.parcela_total > 1
      ? `Criar ${modalForm.parcela_total} parcelas`
      : modalForm.is_recorrente
        ? `Criar ${modalForm.total_ocorrencias} ocorrencias`
        : 'Criar lancamento'

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

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button onClick={() => setAbaModal('basico')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${abaModal === 'basico' ? 'text-brand border-b-2 border-brand' : 'text-gray-500 hover:text-gray-700'}`}>
            Basico
          </button>
          {!editingId && (
            <button onClick={() => setAbaModal('avancado')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${abaModal === 'avancado' ? 'text-brand border-b-2 border-brand' : 'text-gray-500 hover:text-gray-700'}`}>
              Avancado
            </button>
          )}
        </div>

        {/* Duplicate warning */}
        {avisoSimilar && (
          <div className="mx-6 mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            ⚠️ {avisoSimilar}
          </div>
        )}

        <div className="p-6 space-y-4">
          {abaModal === 'basico' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Descricao *</label>
                <input value={modalForm.nome} onChange={e => setModalForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Nome do lancamento" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Fornecedor</label>
                <input value={modalForm.fornecedor} onChange={e => setModalForm(f => ({ ...f, fornecedor: e.target.value }))}
                  list="fornecedores-list"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Buscar fornecedor..." />
                <datalist id="fornecedores-list">
                  {fornecedores.map(f => <option key={f.id} value={f.nome} />)}
                </datalist>
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
                <label className="block text-xs font-semibold text-gray-500 mb-1">Competencia</label>
                <input type="date" value={modalForm.data_competencia} onChange={e => setModalForm(f => ({ ...f, data_competencia: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Conta</label>
                <select value={modalForm.conta_id} onChange={e => setModalForm(f => ({ ...f, conta_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">Selecionar...</option>
                  {contas.map(c => <option key={c.id} value={c.id}>{c.is_padrao ? '★ ' : ''}{c.banco ? `${c.banco} — ` : ''}{c.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Categoria</label>
                <select value={modalForm.categoria} onChange={e => setModalForm(f => ({ ...f, categoria: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="">Selecionar...</option>
                  {(modalForm.tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Centro de custo</label>
                {centrosCusto.length > 0 ? (
                  <select value={modalForm.centro_custo_id} onChange={e => {
                    const ccId = e.target.value
                    const cc = centrosCusto.find(c => c.id === ccId)
                    setModalForm(f => ({ ...f, centro_custo_id: ccId, centro_custo: cc ? `${cc.codigo} — ${cc.nome}` : '' }))
                  }} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                    <option value="">Selecionar...</option>
                    {Object.entries(
                      centrosCusto.reduce((acc: Record<string, any[]>, cc) => {
                        const t = cc.tipo || 'outros'
                        if (!acc[t]) acc[t] = []
                        acc[t].push(cc)
                        return acc
                      }, {})
                    ).map(([tipo, ccs]) => (
                      <optgroup key={tipo} label={CC_TIPO_LABEL[tipo] || tipo}>
                        {ccs.map((cc: any) => <option key={cc.id} value={cc.id}>{cc.codigo} — {cc.nome}</option>)}
                      </optgroup>
                    ))}
                  </select>
                ) : (
                  <input value={modalForm.centro_custo} onChange={e => setModalForm(f => ({ ...f, centro_custo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Ex: ADM, Obra X..." />
                )}
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
                <label className="block text-xs font-semibold text-gray-500 mb-1">Observacao</label>
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
                  E provisao (despesa futura estimada)
                </label>
              </div>
            </div>
          )}

          {abaModal === 'avancado' && !editingId && (
            <div className="space-y-4">
              {/* Nº Documento */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">N° Documento</label>
                <input value={modalForm.numero_documento} onChange={e => setModalForm(f => ({ ...f, numero_documento: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="NF-e, OS, boleto..." />
              </div>

              {/* Parcelamento */}
              <div className="border border-gray-200 rounded-xl p-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
                  <input type="checkbox" checked={modalForm.is_parcelado} onChange={e => setModalForm(f => ({ ...f, is_parcelado: e.target.checked, is_recorrente: false }))}
                    className="rounded border-gray-300 text-brand" />
                  <span className="font-medium">Parcelado</span>
                </label>
                {modalForm.is_parcelado && (
                  <div className="space-y-3 mt-2">
                    <div className="flex gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-0.5">Parcelas</label>
                        <select value={modalForm.parcela_total} onChange={e => setModalForm(f => ({ ...f, parcela_total: Number(e.target.value) }))}
                          className="px-2 py-1 border border-gray-200 rounded text-sm">
                          {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36].map(n => <option key={n} value={n}>{n}x</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-400 mb-0.5">Intervalo</label>
                        <select value={modalForm.intervalo_parcelas_dias} onChange={e => setModalForm(f => ({ ...f, intervalo_parcelas_dias: Number(e.target.value) }))}
                          className="px-2 py-1 border border-gray-200 rounded text-sm">
                          <option value={7}>Semanal</option>
                          <option value={15}>Quinzenal</option>
                          <option value={30}>Mensal</option>
                          <option value={60}>Bimestral</option>
                          <option value={90}>Trimestral</option>
                        </select>
                      </div>
                    </div>
                    {modalForm.parcela_total > 1 && Number(modalForm.valor) > 0 && (
                      <div className="bg-gray-50 rounded-lg p-2.5 text-xs space-y-1">
                        <div className="font-semibold text-gray-700">{modalForm.parcela_total}x de {fmt(Math.round(Number(modalForm.valor) / modalForm.parcela_total * 100) / 100)}</div>
                        {previewParcelas.length > 0 && (
                          <div className="text-gray-500">
                            Vencimentos: {previewParcelas.join(', ')}{modalForm.parcela_total > 6 ? '...' : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Recorrencia */}
              <div className="border border-gray-200 rounded-xl p-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
                  <input type="checkbox" checked={modalForm.is_recorrente} onChange={e => setModalForm(f => ({ ...f, is_recorrente: e.target.checked, is_parcelado: false }))}
                    className="rounded border-gray-300 text-brand" />
                  <span className="font-medium">Recorrente (gera automaticamente)</span>
                </label>
                {modalForm.is_recorrente && (
                  <div className="flex gap-3 mt-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">Frequencia</label>
                      <select value={modalForm.frequencia} onChange={e => setModalForm(f => ({ ...f, frequencia: e.target.value }))}
                        className="px-2 py-1 border border-gray-200 rounded text-sm">
                        <option value="semanal">Semanal</option>
                        <option value="quinzenal">Quinzenal</option>
                        <option value="mensal">Mensal</option>
                        <option value="bimestral">Bimestral</option>
                        <option value="trimestral">Trimestral</option>
                        <option value="semestral">Semestral</option>
                        <option value="anual">Anual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-0.5">Total de ocorrencias</label>
                      <select value={modalForm.total_ocorrencias} onChange={e => setModalForm(f => ({ ...f, total_ocorrencias: Number(e.target.value) }))}
                        className="px-2 py-1 border border-gray-200 rounded text-sm">
                        {[3,6,12,24,36,48,60].map(n => <option key={n} value={n}>{n}x</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
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

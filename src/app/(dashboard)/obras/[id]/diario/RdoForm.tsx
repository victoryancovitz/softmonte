'use client'
import { useState, useEffect, useCallback, Fragment } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { ChevronLeft, FileDown, Save, Send, Trash2, Plus, X, AlertTriangle, CheckCircle2, Edit3, PenLine } from 'lucide-react'
import { exportarRdoPDF } from './rdo-pdf'
import SignatureModal from './SignatureModal'

const HORAS_TURNO = ['07-08', '08-09', '09-10', '10-11', '11-12', '12-13', '13-14', '14-15', '15-16', '16-17', '17-18']
const CLIMA_OPTS = [
  { v: 'normal', label: 'Normal', cls: 'bg-green-100 text-green-700' },
  { v: 'chuvoso', label: 'Chuvoso', cls: 'bg-blue-100 text-blue-700' },
  { v: 'restrito', label: 'Restrito', cls: 'bg-amber-100 text-amber-700' },
  { v: 'impraticavel', label: 'Impraticável', cls: 'bg-red-100 text-red-700' },
]

type Efetivo = {
  id?: string
  tipo: 'direta' | 'indireta'
  funcao: string
  quantidade: number
  hora_entrada?: string
  entrada_almoco?: string
  saida_almoco?: string
  hora_saida?: string
  horas_trabalhadas: number
}

type Atividade = {
  id?: string
  item?: number
  projeto?: string
  local?: string
  encarregado?: string
  pt?: string
  descricao?: string
  total_hh?: number
}

type Equipamento = {
  id?: string
  descricao: string
  quantidade: number
}

type Ocorrencia = {
  id?: string
  tipo: string
  descricao: string
  responsavel: string
  impacto_hh: number
  impacto_desc: string
  acao_tomada: string
  status: 'aberta' | 'em_tratamento' | 'resolvida'
  gera_claim: boolean
  claim_valor_hh: number
  evidencia_url: string
}

const TIPOS_OCORRENCIA = [
  { v: 'obstrucao_contratante', label: 'Obstrução do Contratante' },
  { v: 'falha_contratada', label: 'Falha da Contratada' },
  { v: 'condicao_climatica', label: 'Condição Climática' },
  { v: 'acidente', label: 'Acidente' },
  { v: 'quase_acidente', label: 'Quase-Acidente' },
  { v: 'falta_material', label: 'Falta de Material' },
  { v: 'falta_equipamento', label: 'Falta de Equipamento' },
  { v: 'outro', label: 'Outro' },
]

const STATUS_STEPS = [
  { key: 'rascunho', label: 'Rascunho', icon: '✍' },
  { key: 'revisado', label: 'Revisado', icon: '👁' },
  { key: 'aprovado', label: 'Aprovado', icon: '✅' },
  { key: 'fechado', label: 'Fechado', icon: '🔒' },
]

type Foto = {
  id?: string
  numero: number
  legenda: string
  url: string
  file?: File
}

type Clima = {
  turno: '1turno' | '2turno'
  hora: string
  condicao: string
}

interface Props {
  obraId: string
  rdoId: string | null
  onClose: () => void
}

const hoje = new Date().toISOString().slice(0, 10)

export default function RdoForm({ obraId, rdoId, onClose }: Props) {
  const supabase = createClient()
  const toast = useToast()
  const [loading, setLoading] = useState(!!rdoId)
  const [saving, setSaving] = useState(false)

  // Identificação
  const [data, setData] = useState(hoje)
  const [numeroRdo, setNumeroRdo] = useState<number | ''>('')
  const [engenheiro, setEngenheiro] = useState('')
  const [horasTrab, setHorasTrab] = useState('9')
  const [status, setStatus] = useState<string>('rascunho')

  // Clima
  const [clima, setClima] = useState<Record<string, string>>({}) // `${turno}-${hora}` -> condicao

  // Efetivo
  const [efetivo, setEfetivo] = useState<Efetivo[]>([])

  // Atividades
  const [atividades, setAtividades] = useState<Atividade[]>([])

  // Fotos
  const [fotos, setFotos] = useState<Foto[]>(
    Array.from({ length: 10 }, (_, i) => ({ numero: i + 1, legenda: '', url: '' })),
  )

  // Equipamentos
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([])

  // Observações
  const [obsContratada, setObsContratada] = useState('')
  const [obsFiscalizacao, setObsFiscalizacao] = useState('')

  // Ocorrências
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])

  // Workflow & signatures (read-only from DB)
  const [rdoMeta, setRdoMeta] = useState<any>({})
  const [historico, setHistorico] = useState<any[]>([])
  const [userRole, setUserRole] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [signModal, setSignModal] = useState<'responsavel' | 'fiscal' | null>(null)

  const [currentRdoId, setCurrentRdoId] = useState<string | null>(rdoId)
  const [obraNome, setObraNome] = useState<string>('')

  // Carregar RDO existente
  const loadRdo = useCallback(async () => {
    // Ler user/role sempre
    const { data: { user } } = await supabase.auth.getUser()
    setUserId(user?.id ?? '')
    if (user?.id) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
      setUserRole((prof as any)?.role ?? '')
    }

    if (!rdoId) {
      // Auto-incrementar numero_rdo para novo
      const { data: last } = await supabase
        .from('diario_obra')
        .select('numero_rdo')
        .eq('obra_id', obraId)
        .order('numero_rdo', { ascending: false })
        .limit(1)
      const next = ((last?.[0]?.numero_rdo as number) ?? 0) + 1
      setNumeroRdo(next)
      const { data: obra } = await supabase.from('obras').select('nome').eq('id', obraId).maybeSingle()
      setObraNome(obra?.nome ?? '')
      return
    }
    setLoading(true)
    const [{ data: rdo }, { data: efs }, { data: ats }, { data: clis }, { data: fts }, { data: eqs }, { data: obra }, { data: ocs }, { data: hist }] = await Promise.all([
      supabase.from('diario_obra').select('*').eq('id', rdoId).maybeSingle(),
      supabase.from('diario_efetivo').select('*').eq('diario_id', rdoId),
      supabase.from('diario_atividades').select('*').eq('diario_id', rdoId).order('item'),
      supabase.from('diario_clima').select('*').eq('diario_id', rdoId),
      supabase.from('diario_fotos').select('*').eq('diario_id', rdoId).order('numero'),
      supabase.from('diario_equipamentos').select('*').eq('diario_id', rdoId),
      supabase.from('obras').select('nome').eq('id', obraId).maybeSingle(),
      supabase.from('diario_ocorrencias').select('*').eq('diario_id', rdoId),
      supabase.from('diario_historico').select('*').eq('diario_id', rdoId).order('feito_em', { ascending: true }),
    ])
    setRdoMeta(rdo ?? {})
    setHistorico(hist ?? [])
    setOcorrencias((ocs ?? []).map((o: any) => ({
      id: o.id, tipo: o.tipo, descricao: o.descricao ?? '', responsavel: o.responsavel ?? '',
      impacto_hh: Number(o.impacto_hh ?? 0), impacto_desc: o.impacto_desc ?? '',
      acao_tomada: o.acao_tomada ?? '', status: o.status ?? 'aberta',
      gera_claim: !!o.gera_claim, claim_valor_hh: Number(o.claim_valor_hh ?? 0),
      evidencia_url: o.evidencia_url ?? '',
    })))
    if (rdo) {
      setData(rdo.data)
      setNumeroRdo(rdo.numero_rdo ?? '')
      setEngenheiro(rdo.engenheiro_resp ?? '')
      setHorasTrab(String(rdo.horas_trabalhadas ?? 9))
      setStatus(rdo.status ?? 'rascunho')
      setObsContratada(rdo.observacoes_contratada ?? '')
      setObsFiscalizacao(rdo.observacoes_fiscalizacao ?? '')
    }
    setEfetivo((efs ?? []).map((e: any) => ({
      id: e.id, tipo: e.tipo, funcao: e.funcao, quantidade: e.quantidade,
      hora_entrada: e.hora_entrada, entrada_almoco: e.entrada_almoco,
      saida_almoco: e.saida_almoco, hora_saida: e.hora_saida,
      horas_trabalhadas: Number(e.horas_trabalhadas ?? 0),
    })))
    setAtividades((ats ?? []) as Atividade[])
    const cMap: Record<string, string> = {}
    ;(clis ?? []).forEach((c: any) => { cMap[`${c.turno}-${c.hora}`] = c.condicao })
    setClima(cMap)
    const fMap: Foto[] = Array.from({ length: 10 }, (_, i) => ({ numero: i + 1, legenda: '', url: '' }))
    ;(fts ?? []).forEach((f: any) => {
      const idx = (f.numero ?? 1) - 1
      if (idx >= 0 && idx < 10) fMap[idx] = { id: f.id, numero: f.numero, legenda: f.legenda ?? '', url: f.url ?? '' }
    })
    setFotos(fMap)
    setEquipamentos((eqs ?? []) as Equipamento[])
    setObraNome(obra?.nome ?? '')
    setLoading(false)
  }, [rdoId, obraId, supabase])

  useEffect(() => { loadRdo() }, [loadRdo])

  const addEfetivo = (tipo: 'direta' | 'indireta') => {
    setEfetivo(prev => [...prev, { tipo, funcao: '', quantidade: 1, horas_trabalhadas: 9 }])
  }
  const removeEfetivo = (idx: number) => setEfetivo(prev => prev.filter((_, i) => i !== idx))
  const updateEfetivo = (idx: number, patch: Partial<Efetivo>) => {
    setEfetivo(prev => prev.map((e, i) => i === idx ? { ...e, ...patch } : e))
  }

  const addAtividade = () => {
    setAtividades(prev => [...prev, { item: prev.length + 1, projeto: '', descricao: '' }])
  }
  const removeAtividade = (idx: number) => setAtividades(prev => prev.filter((_, i) => i !== idx))

  const addEquipamento = () => setEquipamentos(prev => [...prev, { descricao: '', quantidade: 1 }])
  const removeEquipamento = (idx: number) => setEquipamentos(prev => prev.filter((_, i) => i !== idx))

  const addOcorrencia = () => setOcorrencias(prev => [...prev, {
    tipo: 'outro', descricao: '', responsavel: '', impacto_hh: 0, impacto_desc: '',
    acao_tomada: '', status: 'aberta', gera_claim: false, claim_valor_hh: 0, evidencia_url: '',
  }])
  const removeOcorrencia = (idx: number) => setOcorrencias(prev => prev.filter((_, i) => i !== idx))
  const updateOcorrencia = (idx: number, patch: Partial<Ocorrencia>) => {
    setOcorrencias(prev => prev.map((o, i) => i === idx ? { ...o, ...patch } : o))
  }

  const readOnly = ['aprovado', 'fechado'].includes(status) && userRole !== 'admin'
  const hasClaim = ocorrencias.some(o => o.tipo === 'obstrucao_contratante' && o.gera_claim)
  const climaAlerta = Object.values(clima).some(c => c === 'restrito' || c === 'impraticavel')

  const onFotoChange = async (idx: number, file: File | null) => {
    if (!file) return
    setFotos(prev => prev.map((f, i) => i === idx ? { ...f, file } : f))
  }

  const totalHH = efetivo.reduce((s, e) => s + Number(e.horas_trabalhadas ?? 0) * Number(e.quantidade ?? 1), 0)
  const totalDireta = efetivo.filter(e => e.tipo === 'direta').reduce((s, e) => s + Number(e.quantidade ?? 0), 0)
  const totalIndireta = efetivo.filter(e => e.tipo === 'indireta').reduce((s, e) => s + Number(e.quantidade ?? 0), 0)

  async function saveAll(novoStatus?: string) {
    if (!data) { toast.warning('Informe a data'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload: any = {
        obra_id: obraId,
        data,
        numero_rdo: numeroRdo || null,
        engenheiro_resp: engenheiro || null,
        horas_trabalhadas: Number(horasTrab) || 9,
        observacoes_contratada: obsContratada || null,
        observacoes_fiscalizacao: obsFiscalizacao || null,
        status: novoStatus ?? status,
        formato: 'tecnomonte',
        updated_at: new Date().toISOString(),
      }
      let id = currentRdoId
      if (id) {
        const { error } = await supabase.from('diario_obra').update(payload).eq('id', id)
        if (error) throw error
      } else {
        payload.created_by = user?.id ?? null
        const { data: ins, error } = await supabase.from('diario_obra').insert(payload).select('id').single()
        if (error) throw error
        id = ins.id
        setCurrentRdoId(id)
      }
      if (!id) throw new Error('ID do RDO não gerado')

      // Upload de fotos novas
      for (let i = 0; i < fotos.length; i++) {
        const f = fotos[i]
        if (f.file) {
          const ext = f.file.name.split('.').pop() || 'jpg'
          const path = `${obraId}/${data}/${f.numero}-${Date.now()}.${ext}`
          const { error: upErr } = await supabase.storage.from('rdos').upload(path, f.file, { upsert: true })
          if (upErr) { toast.error('Erro upload foto ' + f.numero, upErr.message); continue }
          const { data: pub } = supabase.storage.from('rdos').getPublicUrl(path)
          fotos[i] = { ...f, file: undefined, url: pub.publicUrl }
        }
      }

      // Replace children (delete + insert em batch)
      await Promise.all([
        supabase.from('diario_clima').delete().eq('diario_id', id),
        supabase.from('diario_efetivo').delete().eq('diario_id', id),
        supabase.from('diario_atividades').delete().eq('diario_id', id),
        supabase.from('diario_fotos').delete().eq('diario_id', id),
        supabase.from('diario_equipamentos').delete().eq('diario_id', id),
        supabase.from('diario_ocorrencias').delete().eq('diario_id', id),
      ])

      const climaRows = Object.entries(clima).map(([key, cond]) => {
        const [turno, ...horaParts] = key.split('-')
        const hora = horaParts.join('-')
        return { diario_id: id, turno, hora, condicao: cond }
      })
      const efetivoRows = efetivo.filter(e => e.funcao.trim()).map(e => ({
        diario_id: id, tipo: e.tipo, funcao: e.funcao, quantidade: e.quantidade,
        hora_entrada: e.hora_entrada || null, entrada_almoco: e.entrada_almoco || null,
        saida_almoco: e.saida_almoco || null, hora_saida: e.hora_saida || null,
        horas_trabalhadas: e.horas_trabalhadas,
      }))
      const atividadeRows = atividades.filter(a => (a.descricao ?? '').trim() || (a.projeto ?? '').trim()).map((a, i) => ({
        diario_id: id, item: a.item ?? (i + 1), projeto: a.projeto || null, local: a.local || null,
        encarregado: a.encarregado || null, pt: a.pt || null, descricao: a.descricao || null,
        total_hh: Number(a.total_hh ?? 0),
      }))
      const fotoRows = fotos.filter(f => f.url).map(f => ({
        diario_id: id, numero: f.numero, legenda: f.legenda || null, url: f.url,
      }))
      const equipRows = equipamentos.filter(e => (e.descricao ?? '').trim()).map(e => ({
        diario_id: id, descricao: e.descricao, quantidade: e.quantidade,
      }))

      const ocorrenciaRows = ocorrencias.filter(o => (o.descricao ?? '').trim()).map(o => ({
        diario_id: id, tipo: o.tipo, descricao: o.descricao, responsavel: o.responsavel || null,
        impacto_hh: o.impacto_hh, impacto_desc: o.impacto_desc || null, acao_tomada: o.acao_tomada || null,
        status: o.status, gera_claim: o.gera_claim, claim_valor_hh: o.claim_valor_hh,
        evidencia_url: o.evidencia_url || null, registrado_por: user?.id ?? null,
      }))

      const inserts: Array<PromiseLike<any>> = []
      if (climaRows.length) inserts.push(supabase.from('diario_clima').insert(climaRows) as any)
      if (efetivoRows.length) inserts.push(supabase.from('diario_efetivo').insert(efetivoRows) as any)
      if (atividadeRows.length) inserts.push(supabase.from('diario_atividades').insert(atividadeRows) as any)
      if (fotoRows.length) inserts.push(supabase.from('diario_fotos').insert(fotoRows) as any)
      if (equipRows.length) inserts.push(supabase.from('diario_equipamentos').insert(equipRows) as any)
      if (ocorrenciaRows.length) inserts.push(supabase.from('diario_ocorrencias').insert(ocorrenciaRows) as any)
      await Promise.all(inserts)

      // Log history se mudou status
      if (novoStatus && novoStatus !== status) {
        const { data: prof } = await supabase.from('profiles').select('nome').eq('user_id', user?.id).maybeSingle()
        await supabase.from('diario_historico').insert({
          diario_id: id, status_de: status, status_para: novoStatus,
          feito_por: user?.id ?? null,
          feito_por_nome: (prof as any)?.nome ?? user?.email ?? null,
        })
      }

      toast.success(`RDO ${novoStatus && novoStatus !== status ? novoStatus : 'salvo'}!`)
      if (novoStatus) setStatus(novoStatus)
    } catch (e: any) {
      toast.error('Erro ao salvar RDO', e?.message ?? '')
    } finally {
      setSaving(false)
    }
  }

  const handleExportPdf = () => {
    exportarRdoPDF({
      obraNome,
      data,
      numeroRdo: Number(numeroRdo) || 0,
      engenheiro,
      horasTrab,
      status,
      clima,
      efetivo,
      atividades,
      fotos: fotos.filter(f => f.url),
      equipamentos,
      ocorrencias,
      obsContratada,
      obsFiscalizacao,
      totalHH,
      historico,
      assinaturaResp: rdoMeta?.assinatura_responsavel_url ? {
        nome: rdoMeta.assinatura_responsavel_nome,
        cargo: rdoMeta.assinatura_responsavel_cargo,
        url: rdoMeta.assinatura_responsavel_url,
        em: rdoMeta.assinatura_responsavel_em,
      } : null,
      assinaturaFiscal: rdoMeta?.assinatura_fiscal_url ? {
        nome: rdoMeta.assinatura_fiscal_nome,
        empresa: rdoMeta.assinatura_fiscal_empresa,
        url: rdoMeta.assinatura_fiscal_url,
        em: rdoMeta.assinatura_fiscal_em,
      } : null,
    })
  }

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Carregando RDO...</div>

  const canRevisar = status === 'rascunho' && currentRdoId && rdoMeta?.criado_por !== userId
  const canAprovar = status === 'revisado' && (userRole === 'admin' || userRole === 'diretoria' || userRole === 'gerente')
  const canAssinarResp = currentRdoId && ['aprovado', 'fechado'].includes(status) && !rdoMeta?.assinatura_responsavel_url
  const canAssinarFiscal = currentRdoId && status === 'aprovado' && rdoMeta?.assinatura_responsavel_url && !rdoMeta?.assinatura_fiscal_url

  return (
    <div>
      {/* Header fixo */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <button onClick={onClose} className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand">
          <ChevronLeft className="w-4 h-4" /> Voltar à lista
        </button>
        <div className="flex gap-2 flex-wrap">
          {currentRdoId && (
            <button onClick={handleExportPdf}
              className="px-3 py-2 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 flex items-center gap-1.5">
              <FileDown className="w-3.5 h-3.5" /> Exportar PDF
            </button>
          )}
          {!readOnly && status === 'rascunho' && (
            <>
              <button onClick={() => saveAll()} disabled={saving}
                className="px-3 py-2 border border-brand text-brand text-xs font-semibold rounded-lg hover:bg-brand/5 flex items-center gap-1.5 disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /> {saving ? 'Salvando...' : 'Salvar rascunho'}
              </button>
              {currentRdoId && canRevisar && (
                <button onClick={() => saveAll('revisado')} disabled={saving}
                  className="px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-50">
                  <Send className="w-3.5 h-3.5" /> Enviar para revisão →
                </button>
              )}
            </>
          )}
          {!readOnly && status === 'revisado' && (
            <>
              <button onClick={() => saveAll('rascunho')} disabled={saving}
                className="px-3 py-2 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50">
                ← Devolver
              </button>
              {canAprovar && (
                <button onClick={() => saveAll('aprovado')} disabled={saving}
                  className="px-3 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 flex items-center gap-1.5 disabled:opacity-50">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                </button>
              )}
            </>
          )}
          {canAssinarResp && (
            <button onClick={() => setSignModal('responsavel')}
              className="px-3 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand/90 flex items-center gap-1.5">
              <PenLine className="w-3.5 h-3.5" /> Assinar (Tecnomonte)
            </button>
          )}
          {canAssinarFiscal && (
            <button onClick={() => setSignModal('fiscal')}
              className="px-3 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 flex items-center gap-1.5">
              <PenLine className="w-3.5 h-3.5" /> Registrar assinatura fiscalização
            </button>
          )}
        </div>
      </div>

      {/* Workflow status bar */}
      {currentRdoId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-4">
          <div className="flex items-center justify-between gap-2 text-xs">
            {STATUS_STEPS.map((s, i) => {
              const stepIdx = STATUS_STEPS.findIndex(x => x.key === status)
              const reached = i <= stepIdx
              const isCurrent = i === stepIdx
              return (
                <Fragment key={s.key}>
                  <div className={`flex items-center gap-1.5 ${reached ? 'text-brand' : 'text-gray-300'}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${isCurrent ? 'bg-brand text-white' : reached ? 'bg-brand/10' : 'bg-gray-100'}`}>
                      {s.icon}
                    </div>
                    <span className={`font-semibold ${isCurrent ? 'text-brand' : ''}`}>{s.label}</span>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 ${reached && i < stepIdx ? 'bg-brand/30' : 'bg-gray-200'}`} />
                  )}
                </Fragment>
              )
            })}
          </div>
          {historico.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-[10px] text-gray-500 space-y-0.5">
              {historico.slice(-3).map((h, i) => (
                <div key={i}>
                  <span className="font-semibold">{h.feito_por_nome ?? 'usuário'}</span>
                  {' · '}{h.status_de ? `${h.status_de} → ` : ''}{h.status_para}
                  {' · '}{new Date(h.feito_em).toLocaleString('pt-BR')}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alertas */}
      {hasClaim && (
        <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 text-sm text-red-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>⚠️ Este RDO contém impedimento com impacto contratual (claim)</span>
        </div>
      )}
      {climaAlerta && (
        <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Condições climáticas restritas/impraticáveis registradas — considere criar uma ocorrência.</span>
        </div>
      )}
      {readOnly && (
        <div className="mb-3 p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center gap-2 text-xs text-gray-700">
          <Edit3 className="w-4 h-4 flex-shrink-0" />
          <span>RDO {status} — somente leitura. Apenas admin pode reabrir.</span>
        </div>
      )}

      <div className="space-y-4">
        {/* 1 Identificação */}
        <Section title="1. Identificação">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Field label="Data *">
              <input type="date" value={data} onChange={e => setData(e.target.value)} className={inp} />
            </Field>
            <Field label="Nº RDO">
              <input type="number" value={numeroRdo} onChange={e => setNumeroRdo(e.target.value ? Number(e.target.value) : '')} className={inp} />
            </Field>
            <Field label="Engenheiro responsável">
              <input value={engenheiro} onChange={e => setEngenheiro(e.target.value)} className={inp} />
            </Field>
            <Field label="Horas trabalhadas (dia)">
              <input type="number" step="0.5" value={horasTrab} onChange={e => setHorasTrab(e.target.value)} className={inp} />
            </Field>
          </div>
        </Section>

        {/* 2 Clima */}
        <Section title="2. Condições Climáticas">
          <div className="grid grid-cols-[auto_1fr_1fr] gap-1 text-xs max-w-lg">
            <div></div>
            <div className="text-center font-semibold text-gray-600 pb-1">1º Turno</div>
            <div className="text-center font-semibold text-gray-600 pb-1">2º Turno</div>
            {HORAS_TURNO.map(h => (
              <Fragment key={h}>
                <div className="text-[10px] text-gray-500 py-1 font-mono">{h}</div>
                {(['1turno', '2turno'] as const).map(turno => {
                  const key = `${turno}-${h}`
                  const val = clima[key] ?? ''
                  const opt = CLIMA_OPTS.find(o => o.v === val)
                  return (
                    <select
                      key={`${turno}-${h}`}
                      value={val}
                      onChange={e => setClima(prev => ({ ...prev, [key]: e.target.value }))}
                      className={`text-[10px] rounded px-1 py-0.5 border border-gray-200 outline-none ${opt?.cls ?? 'bg-white'}`}
                    >
                      <option value="">—</option>
                      {CLIMA_OPTS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                    </select>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </Section>

        {/* 3 Efetivo */}
        <Section title={`3. Efetivo do dia (${totalDireta} direta · ${totalIndireta} indireta · ${totalHH.toFixed(1)}h total)`}>
          {(['direta', 'indireta'] as const).map(tipo => (
            <div key={tipo} className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-gray-600 uppercase">MO {tipo === 'direta' ? 'Direta' : 'Indireta'}</h4>
                <button onClick={() => addEfetivo(tipo)} className="text-xs text-brand hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Adicionar função
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Função', 'Qtd', 'Entrada', 'Saída almoço', 'Retorno', 'Saída', 'HH', ''].map(h => (
                        <th key={h} className="text-left px-2 py-1.5 font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {efetivo.map((e, i) => e.tipo !== tipo ? null : (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="px-2 py-1"><input value={e.funcao} onChange={ev => updateEfetivo(i, { funcao: ev.target.value })} className={inpSm + ' min-w-[140px]'} /></td>
                        <td className="px-2 py-1"><input type="number" value={e.quantidade} onChange={ev => updateEfetivo(i, { quantidade: Number(ev.target.value) })} className={inpSm + ' w-14'} /></td>
                        <td className="px-2 py-1"><input type="time" value={e.hora_entrada ?? ''} onChange={ev => updateEfetivo(i, { hora_entrada: ev.target.value })} className={inpSm} /></td>
                        <td className="px-2 py-1"><input type="time" value={e.entrada_almoco ?? ''} onChange={ev => updateEfetivo(i, { entrada_almoco: ev.target.value })} className={inpSm} /></td>
                        <td className="px-2 py-1"><input type="time" value={e.saida_almoco ?? ''} onChange={ev => updateEfetivo(i, { saida_almoco: ev.target.value })} className={inpSm} /></td>
                        <td className="px-2 py-1"><input type="time" value={e.hora_saida ?? ''} onChange={ev => updateEfetivo(i, { hora_saida: ev.target.value })} className={inpSm} /></td>
                        <td className="px-2 py-1"><input type="number" step="0.5" value={e.horas_trabalhadas} onChange={ev => updateEfetivo(i, { horas_trabalhadas: Number(ev.target.value) })} className={inpSm + ' w-16'} /></td>
                        <td className="px-2 py-1">
                          <button onClick={() => removeEfetivo(i)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </Section>

        {/* 4 Atividades */}
        <Section title="4. Atividades">
          <button onClick={addAtividade} className="text-xs text-brand hover:underline flex items-center gap-1 mb-2">
            <Plus className="w-3 h-3" /> Adicionar atividade
          </button>
          <div className="space-y-2">
            {atividades.map((a, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <Field label="Item"><input type="number" value={a.item ?? i + 1} onChange={e => setAtividades(prev => prev.map((x, j) => j === i ? { ...x, item: Number(e.target.value) } : x))} className={inpSm} /></Field>
                  <Field label="Projeto"><input value={a.projeto ?? ''} onChange={e => setAtividades(prev => prev.map((x, j) => j === i ? { ...x, projeto: e.target.value } : x))} className={inpSm} /></Field>
                  <Field label="Local"><input value={a.local ?? ''} onChange={e => setAtividades(prev => prev.map((x, j) => j === i ? { ...x, local: e.target.value } : x))} className={inpSm} /></Field>
                  <Field label="Encarregado"><input value={a.encarregado ?? ''} onChange={e => setAtividades(prev => prev.map((x, j) => j === i ? { ...x, encarregado: e.target.value } : x))} className={inpSm} /></Field>
                  <Field label="PT"><input value={a.pt ?? ''} onChange={e => setAtividades(prev => prev.map((x, j) => j === i ? { ...x, pt: e.target.value } : x))} className={inpSm} /></Field>
                </div>
                <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
                  <Field label="Descrição">
                    <textarea value={a.descricao ?? ''} onChange={e => setAtividades(prev => prev.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x))} rows={2} className={inp + ' resize-none'} />
                  </Field>
                  <Field label="HH total">
                    <input type="number" step="0.5" value={a.total_hh ?? 0} onChange={e => setAtividades(prev => prev.map((x, j) => j === i ? { ...x, total_hh: Number(e.target.value) } : x))} className={inpSm + ' w-20'} />
                  </Field>
                  <button onClick={() => removeAtividade(i)} className="text-red-500 hover:text-red-700 pb-1.5"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 5 Fotos */}
        <Section title="5. Fotos (máx 10)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fotos.map((f, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-2">
                <div className="text-[10px] font-bold text-gray-500 mb-1">FOTO {f.numero}</div>
                {(f.url || f.file) && (
                  <div className="aspect-video bg-gray-100 rounded overflow-hidden mb-2 relative">
                    {f.file ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={URL.createObjectURL(f.file)} alt={f.legenda} className="w-full h-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.url} alt={f.legenda} className="w-full h-full object-cover" />
                    )}
                    <button onClick={() => setFotos(prev => prev.map((x, j) => j === i ? { numero: x.numero, legenda: '', url: '' } : x))}
                      className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded hover:bg-black/70">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={e => onFotoChange(i, e.target.files?.[0] ?? null)} className="text-xs w-full mb-2" />
                <input value={f.legenda} onChange={e => setFotos(prev => prev.map((x, j) => j === i ? { ...x, legenda: e.target.value } : x))}
                  placeholder="Legenda..." className={inpSm} />
              </div>
            ))}
          </div>
        </Section>

        {/* 6 Ocorrências */}
        <Section title={`6. Ocorrências / Impedimentos (${ocorrencias.length})`}>
          <button onClick={addOcorrencia} className="text-xs text-brand hover:underline flex items-center gap-1 mb-3">
            <Plus className="w-3 h-3" /> Adicionar ocorrência
          </button>
          <div className="space-y-3">
            {ocorrencias.map((o, i) => (
              <div key={i} className={`border rounded-lg p-3 space-y-2 ${o.gera_claim ? 'border-red-300 bg-red-50/50' : 'border-gray-200'}`}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Field label="Tipo">
                    <select value={o.tipo} onChange={e => updateOcorrencia(i, { tipo: e.target.value })} className={inpSm}>
                      {TIPOS_OCORRENCIA.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Responsável">
                    <input value={o.responsavel} onChange={e => updateOcorrencia(i, { responsavel: e.target.value })} className={inpSm} />
                  </Field>
                  <Field label="Status">
                    <select value={o.status} onChange={e => updateOcorrencia(i, { status: e.target.value as any })} className={inpSm}>
                      <option value="aberta">Aberta</option>
                      <option value="em_tratamento">Em tratamento</option>
                      <option value="resolvida">Resolvida</option>
                    </select>
                  </Field>
                </div>
                <Field label="Descrição">
                  <textarea value={o.descricao} onChange={e => updateOcorrencia(i, { descricao: e.target.value })} rows={2} className={inp + ' resize-none'} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Field label="Impacto HH">
                    <input type="number" step="0.5" value={o.impacto_hh} onChange={e => updateOcorrencia(i, { impacto_hh: Number(e.target.value) })} className={inpSm} />
                  </Field>
                  <Field label="Descrição do impacto">
                    <input value={o.impacto_desc} onChange={e => updateOcorrencia(i, { impacto_desc: e.target.value })} className={inpSm} />
                  </Field>
                  <Field label="Ação tomada">
                    <input value={o.acao_tomada} onChange={e => updateOcorrencia(i, { acao_tomada: e.target.value })} className={inpSm} />
                  </Field>
                </div>
                {o.tipo === 'obstrucao_contratante' && (
                  <div className="flex items-center gap-3 pt-2 border-t border-red-100">
                    <label className="flex items-center gap-2 text-xs text-red-800">
                      <input type="checkbox" checked={o.gera_claim} onChange={e => updateOcorrencia(i, { gera_claim: e.target.checked })} className="w-4 h-4 text-red-600" />
                      <span className="font-semibold">Gera claim contratual?</span>
                    </label>
                    {o.gera_claim && (
                      <Field label="Valor HH do claim">
                        <input type="number" step="0.5" value={o.claim_valor_hh} onChange={e => updateOcorrencia(i, { claim_valor_hh: Number(e.target.value) })} className={inpSm + ' w-24'} />
                      </Field>
                    )}
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={() => removeOcorrencia(i)} className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 7 Equipamentos */}
        <Section title="7. Equipamentos">
          <button onClick={addEquipamento} className="text-xs text-brand hover:underline flex items-center gap-1 mb-2">
            <Plus className="w-3 h-3" /> Adicionar equipamento
          </button>
          <div className="space-y-1">
            {equipamentos.map((e, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={e.descricao} onChange={ev => setEquipamentos(prev => prev.map((x, j) => j === i ? { ...x, descricao: ev.target.value } : x))} placeholder="Descrição" className={inpSm + ' flex-1'} />
                <input type="number" value={e.quantidade} onChange={ev => setEquipamentos(prev => prev.map((x, j) => j === i ? { ...x, quantidade: Number(ev.target.value) } : x))} className={inpSm + ' w-20'} />
                <button onClick={() => removeEquipamento(i)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </Section>

        {/* 8 Observações */}
        <Section title="8. Observações">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Comentários Contratada">
              <textarea value={obsContratada} onChange={e => setObsContratada(e.target.value)} rows={4} className={inp + ' resize-none'} />
            </Field>
            <Field label="Comentários Fiscalização">
              <textarea value={obsFiscalizacao} onChange={e => setObsFiscalizacao(e.target.value)} rows={4} className={inp + ' resize-none'} />
            </Field>
          </div>
        </Section>

        {/* Assinaturas (readonly display) */}
        {currentRdoId && (rdoMeta?.assinatura_responsavel_url || rdoMeta?.assinatura_fiscal_url) && (
          <Section title="9. Assinaturas">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-lg p-3">
                <div className="text-xs font-bold text-gray-600 mb-2">CONTRATADA (Tecnomonte)</div>
                {rdoMeta?.assinatura_responsavel_url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={rdoMeta.assinatura_responsavel_url} alt="Assinatura" className="max-h-24 mb-2" />
                    <div className="text-xs"><strong>{rdoMeta.assinatura_responsavel_nome}</strong></div>
                    <div className="text-[10px] text-gray-500">{rdoMeta.assinatura_responsavel_cargo}</div>
                    <div className="text-[10px] text-gray-400">{new Date(rdoMeta.assinatura_responsavel_em).toLocaleString('pt-BR')}</div>
                  </>
                ) : <p className="text-xs text-gray-400">Não assinado</p>}
              </div>
              <div className="border border-gray-200 rounded-lg p-3">
                <div className="text-xs font-bold text-gray-600 mb-2">FISCALIZAÇÃO (Cliente)</div>
                {rdoMeta?.assinatura_fiscal_url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={rdoMeta.assinatura_fiscal_url} alt="Assinatura" className="max-h-24 mb-2" />
                    <div className="text-xs"><strong>{rdoMeta.assinatura_fiscal_nome}</strong></div>
                    <div className="text-[10px] text-gray-500">{rdoMeta.assinatura_fiscal_empresa}</div>
                    <div className="text-[10px] text-gray-400">{new Date(rdoMeta.assinatura_fiscal_em).toLocaleString('pt-BR')}</div>
                  </>
                ) : <p className="text-xs text-gray-400">Não assinado</p>}
              </div>
            </div>
          </Section>
        )}
      </div>

      {signModal && currentRdoId && (
        <SignatureModal
          rdoId={currentRdoId}
          obraId={obraId}
          tipo={signModal}
          onClose={() => setSignModal(null)}
          onSigned={() => { setSignModal(null); loadRdo() }}
        />
      )}
    </div>
  )
}

const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none'
const inpSm = 'w-full border border-gray-200 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-brand/30 focus:border-brand outline-none'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-gray-400 text-xs">{open ? '▼' : '▶'}</span>
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 mb-0.5 uppercase">{label}</label>
      {children}
    </div>
  )
}

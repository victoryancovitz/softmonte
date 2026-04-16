'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { AlertTriangle, Building2, Calendar, User, FileText, MapPin, Upload, CheckSquare, X } from 'lucide-react'

/* ─── Types ─── */

interface Props {
  funcionario: any
  workflowId: string
  obras: any[]
  onComplete: () => void
}

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand'

const TOPICOS_PADRAO = [
  'Apresentação da empresa',
  'Normas de segurança',
  'EPI obrigatório',
  'Procedimentos de emergência',
  'Regras internas da obra',
  'Contatos importantes',
]

export default function WizardStep8Integracao({ funcionario, workflowId, obras, onComplete }: Props) {
  const supabase = createClient()
  const toast = useToast()

  // Section 1: Integração SST
  const [dataIntegracao, setDataIntegracao] = useState('')
  const [responsavelSST, setResponsavelSST] = useState('')
  const [localSST, setLocalSST] = useState<'obra' | 'sede' | ''>('')
  const [topicos, setTopicos] = useState<string[]>([])
  const [obsSST, setObsSST] = useState('')
  const [fotoUrl, setFotoUrl] = useState('')
  const [uploadingFoto, setUploadingFoto] = useState(false)

  // Section 2: eSocial
  const [dataEnvioS2200, setDataEnvioS2200] = useState('')
  const [reciboESocial, setReciboESocial] = useState('')
  const [obsESocial, setObsESocial] = useState('')

  // Section 3: Alocação
  const [obraId, setObraId] = useState('')
  const [dataInicioObra, setDataInicioObra] = useState('')
  const [cargoNaObra, setCargoNaObra] = useState(funcionario.cargo || '')

  const [saving, setSaving] = useState(false)

  // Sync data_inicio_obra com data_integracao
  function handleDataIntegracaoChange(val: string) {
    setDataIntegracao(val)
    if (!dataInicioObra) setDataInicioObra(val)
  }

  function toggleTopico(t: string) {
    setTopicos(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  async function handleUploadFoto(file: File) {
    setUploadingFoto(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${funcionario.id}/integracao/foto_${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(path)
      setFotoUrl(publicUrl)
      toast.success('Arquivo enviado')
    } catch {
      toast.error('Erro ao enviar arquivo')
    } finally {
      setUploadingFoto(false)
    }
  }

  function canSubmit() {
    return dataIntegracao && responsavelSST && obraId
  }

  const obraSelecionada = obras.find(o => o.id === obraId)

  async function handleSave() {
    if (!canSubmit()) {
      toast.warning('Preencha os campos obrigatórios: data de integração, responsável e obra.')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const email = user?.email ?? 'sistema'

      // 1. Atualiza funcionários — alocado se tem obra, senão disponível
      await supabase.from('funcionarios').update({
        data_inicio_ponto: dataIntegracao,
        data_integracao: dataIntegracao,
        status: obraId ? 'alocado' : 'disponivel',
      }).eq('id', funcionario.id)

      // 2. Valida se obra está ativa antes de inserir alocação
      const { data: freshObra } = await supabase.from('obras')
        .select('status').eq('id', obraId).maybeSingle()
      if (!freshObra || freshObra.status !== 'ativo') {
        toast.error(`Não é possível alocar em obra ${freshObra?.status ?? 'desconhecida'}.`)
        setSaving(false)
        return
      }

      // 3. Insere alocação (com funcao_id para cruzamento de composição/EPI/NR)
      await supabase.from('alocacoes').insert({
        funcionario_id: funcionario.id,
        obra_id: obraId,
        data_inicio: dataInicioObra || dataIntegracao,
        cargo: cargoNaObra || null,
        funcao_id: funcionario.funcao_id ?? null,
        created_by: user?.id,
      })

      // 4. Atualiza workflow — marca como concluída
      const localLabel = localSST === 'obra'
        ? (obraSelecionada?.nome ? `Obra: ${obraSelecionada.nome}` : 'Obra')
        : localSST === 'sede' ? 'Sede' : null

      const updates: any = {
        etapa_integracao: {
          ok: true,
          data: dataIntegracao,
          por: email,
          responsavel: responsavelSST,
          local: localSST || null,
          local_label: localLabel,
          obra_id: localSST === 'obra' ? obraId : null,
          topicos,
          observacoes: obsSST || null,
          foto_url: fotoUrl || null,
        },
        status: 'concluida',
        concluida_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        wizard_passo_atual: 8,
      }

      if (dataEnvioS2200) {
        updates.etapa_esocial = {
          ok: true,
          data_envio: dataEnvioS2200,
          recibo: reciboESocial || null,
          observacoes: obsESocial || null,
          por: email,
        }
      }

      await supabase.from('admissoes_workflow').update(updates).eq('id', workflowId)

      // 5. Fecha admissao_overrides ativos
      await supabase.from('admissao_overrides')
        .update({ ativo: false, regularizado: true, fechado_em: new Date().toISOString(), regularizado_em: new Date().toISOString() })
        .eq('workflow_id', workflowId)
        .eq('ativo', true)

      toast.success('Admissão concluída com sucesso!')
      onComplete()
    } catch {
      toast.error('Erro ao finalizar admissão')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── Section 1: Integração SST ─── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand" />
          <h4 className="text-sm font-bold text-gray-800">Integração SST</h4>
        </div>

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            A <strong>data de integração</strong> será utilizada como <strong>data de início do ponto</strong> do funcionário. Certifique-se de que está correta.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data da integração *</label>
            <input type="date" value={dataIntegracao} onChange={e => handleDataIntegracaoChange(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Responsável pela integração *</label>
            <input type="text" value={responsavelSST} onChange={e => setResponsavelSST(e.target.value)} className={inputCls} placeholder="Nome do responsável" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Local</label>
            <select value={localSST} onChange={e => setLocalSST(e.target.value as 'obra' | 'sede' | '')} className={inputCls}>
              <option value="">Selecionar local...</option>
              <option value="obra">Obra{obraSelecionada?.nome ? ` — ${obraSelecionada.nome}` : ''}</option>
              <option value="sede">Sede</option>
            </select>
            {localSST === 'obra' && !obraId && (
              <p className="text-[11px] text-amber-600 mt-1">Selecione a obra na seção de alocação abaixo.</p>
            )}
          </div>
        </div>

        {/* Tópicos abordados */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
            <CheckSquare className="w-3.5 h-3.5" /> Tópicos abordados
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TOPICOS_PADRAO.map(t => {
              const checked = topicos.includes(t)
              return (
                <label
                  key={t}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                    checked ? 'border-brand bg-brand/5 text-gray-800' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTopico(t)}
                    className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                  />
                  <span>{t}</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Observações */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Observações</label>
          <textarea
            value={obsSST}
            onChange={e => setObsSST(e.target.value)}
            className={`${inputCls} min-h-[80px] resize-y`}
            placeholder="Observações adicionais sobre a integração (opcional)"
          />
        </div>

        {/* Upload foto/assinatura */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
            <Upload className="w-3.5 h-3.5" /> Foto / assinatura <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          {fotoUrl ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-green-200 bg-green-50 text-xs">
              <a href={fotoUrl} target="_blank" rel="noreferrer" className="text-green-700 hover:underline truncate flex-1">
                Arquivo enviado — visualizar
              </a>
              <button
                type="button"
                onClick={() => setFotoUrl('')}
                className="p-1 rounded-lg hover:bg-green-100 text-green-700"
                aria-label="Remover arquivo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-dashed border-gray-300 text-xs cursor-pointer hover:bg-gray-50 transition-colors ${uploadingFoto ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{uploadingFoto ? 'Enviando...' : 'Clique para enviar foto ou assinatura'}</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleUploadFoto(f)
                }}
              />
            </label>
          )}
        </div>
      </div>

      {/* ─── Section 2: eSocial ─── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <h4 className="text-sm font-bold text-gray-800">eSocial</h4>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 uppercase">Opcional</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data envio S-2200</label>
            <input type="date" value={dataEnvioS2200} onChange={e => setDataEnvioS2200(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Recibo eSocial</label>
            <input type="text" value={reciboESocial} onChange={e => setReciboESocial(e.target.value)} className={inputCls} placeholder="Número do recibo" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Observações</label>
            <input type="text" value={obsESocial} onChange={e => setObsESocial(e.target.value)} className={inputCls} placeholder="Opcional" />
          </div>
        </div>
      </div>

      {/* ─── Section 3: Alocação ─── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-brand" />
          <h4 className="text-sm font-bold text-gray-800">Alocação em Obra</h4>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Obra *</label>
            <select value={obraId} onChange={e => setObraId(e.target.value)} className={inputCls}>
              <option value="">Selecionar obra...</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.nome}{o.codigo ? ` (${o.codigo})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data início na obra</label>
            <input type="date" value={dataInicioObra} onChange={e => setDataInicioObra(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Cargo na obra</label>
            <input type="text" value={cargoNaObra} onChange={e => setCargoNaObra(e.target.value)} className={inputCls} placeholder="Função/cargo" />
          </div>
        </div>
      </div>

      {/* ─── Section 4: Resumo ─── */}
      {canSubmit() && (
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Resumo da Admissão</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1"><User className="w-3.5 h-3.5" /> Funcionário</span>
              <span className="font-medium text-gray-800">{funcionario.nome}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Cargo</span>
              <span className="font-medium text-gray-800">{funcionario.cargo || '---'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Início ponto</span>
              <span className="font-medium text-gray-800">
                {dataIntegracao ? new Date(dataIntegracao + 'T12:00:00').toLocaleDateString('pt-BR') : '---'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Obra</span>
              <span className="font-medium text-gray-800">{obraSelecionada?.nome || '---'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Integração SST</span>
              <span className="font-medium text-gray-800">
                {responsavelSST}
                {localSST === 'obra' ? ' — Obra' : localSST === 'sede' ? ' — Sede' : ''}
              </span>
            </div>
            {topicos.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1"><CheckSquare className="w-3.5 h-3.5" /> Tópicos</span>
                <span className="font-medium text-gray-800">{topicos.length} abordado{topicos.length > 1 ? 's' : ''}</span>
              </div>
            )}
            {dataEnvioS2200 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> eSocial S-2200</span>
                <span className="font-medium text-gray-800">
                  {new Date(dataEnvioS2200 + 'T12:00:00').toLocaleDateString('pt-BR')}
                  {reciboESocial ? ` (${reciboESocial})` : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSave}
        disabled={!canSubmit() || saving}
        className="w-full px-5 py-3 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Finalizando...' : 'Concluir Admissão'}
      </button>
    </div>
  )
}

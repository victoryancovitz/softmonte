'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { AlertTriangle, Building2, Calendar, User, FileText, MapPin } from 'lucide-react'

/* ─── Types ─── */

interface Props {
  funcionario: any
  workflowId: string
  obras: any[]
  onComplete: () => void
}

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand'

export default function WizardStep8Integracao({ funcionario, workflowId, obras, onComplete }: Props) {
  const supabase = createClient()
  const toast = useToast()

  // Section 1: Integracao SST
  const [dataIntegracao, setDataIntegracao] = useState('')
  const [responsavelSST, setResponsavelSST] = useState('')
  const [localSST, setLocalSST] = useState('')
  const [obsSST, setObsSST] = useState('')

  // Section 2: eSocial
  const [dataEnvioS2200, setDataEnvioS2200] = useState('')
  const [reciboESocial, setReciboESocial] = useState('')
  const [obsESocial, setObsESocial] = useState('')

  // Section 3: Alocacao
  const [obraId, setObraId] = useState('')
  const [dataInicioObra, setDataInicioObra] = useState('')
  const [cargoNaObra, setCargoNaObra] = useState(funcionario.cargo || '')

  const [saving, setSaving] = useState(false)

  // Sync data_inicio_obra with data_integracao when changed
  function handleDataIntegracaoChange(val: string) {
    setDataIntegracao(val)
    if (!dataInicioObra) setDataInicioObra(val)
  }

  function canSubmit() {
    return dataIntegracao && responsavelSST && obraId
  }

  async function handleSave() {
    if (!canSubmit()) {
      toast.warning('Preencha os campos obrigatorios: data de integracao, responsavel e obra.')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const email = user?.email ?? 'sistema'

      // 1. Update funcionarios — alocado se tem obra, senão disponivel
      await supabase.from('funcionarios').update({
        data_inicio_ponto: dataIntegracao,
        status: obraId ? 'alocado' : 'disponivel',
      }).eq('id', funcionario.id)

      // 2. Validate obra is active before inserting
      const { data: freshObra } = await supabase.from('obras')
        .select('status').eq('id', obraId).maybeSingle()
      if (!freshObra || freshObra.status !== 'ativo') {
        toast.error(`Não é possível alocar em obra ${freshObra?.status ?? 'desconhecida'}.`)
        setSaving(false)
        return
      }

      // 3. Insert alocacao
      await supabase.from('alocacoes').insert({
        funcionario_id: funcionario.id,
        obra_id: obraId,
        data_inicio: dataInicioObra || dataIntegracao,
        cargo: cargoNaObra || null,
        created_by: user?.id,
      })

      // 4. Update workflow — mark as concluida
      const updates: any = {
        etapa_integracao: {
          ok: true,
          data: dataIntegracao,
          por: email,
          responsavel: responsavelSST,
          local: localSST || null,
          observacoes: obsSST || null,
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

      // 5. Close any active admissao_overrides
      await supabase.from('admissao_overrides')
        .update({ ativo: false, regularizado: true, fechado_em: new Date().toISOString(), regularizado_em: new Date().toISOString() })
        .eq('workflow_id', workflowId)
        .eq('ativo', true)

      toast.success('Admissão concluída com sucesso!')
      onComplete()
    } catch {
      toast.error('Erro ao finalizar admissao')
    } finally {
      setSaving(false)
    }
  }

  const obraSelecionada = obras.find(o => o.id === obraId)

  return (
    <div className="space-y-6">
      {/* ─── Section 1: Integracao SST ─── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand" />
          <h4 className="text-sm font-bold text-gray-800">Integracao SST</h4>
        </div>

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            A <strong>data de integracao</strong> sera utilizada como <strong>data de inicio do ponto</strong> do funcionario. Certifique-se de que esta correta.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data da integracao *</label>
            <input type="date" value={dataIntegracao} onChange={e => handleDataIntegracaoChange(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Responsavel SST *</label>
            <input type="text" value={responsavelSST} onChange={e => setResponsavelSST(e.target.value)} className={inputCls} placeholder="Nome do responsavel" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Local</label>
            <input type="text" value={localSST} onChange={e => setLocalSST(e.target.value)} className={inputCls} placeholder="Ex: Escritorio central" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Observacoes</label>
            <input type="text" value={obsSST} onChange={e => setObsSST(e.target.value)} className={inputCls} placeholder="Opcional" />
          </div>
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
            <input type="text" value={reciboESocial} onChange={e => setReciboESocial(e.target.value)} className={inputCls} placeholder="Numero do recibo" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Observacoes</label>
            <input type="text" value={obsESocial} onChange={e => setObsESocial(e.target.value)} className={inputCls} placeholder="Opcional" />
          </div>
        </div>
      </div>

      {/* ─── Section 3: Alocacao ─── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-brand" />
          <h4 className="text-sm font-bold text-gray-800">Alocacao em Obra</h4>
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
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data inicio na obra</label>
            <input type="date" value={dataInicioObra} onChange={e => setDataInicioObra(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Cargo na obra</label>
            <input type="text" value={cargoNaObra} onChange={e => setCargoNaObra(e.target.value)} className={inputCls} placeholder="Funcao/cargo" />
          </div>
        </div>
      </div>

      {/* ─── Section 4: Summary ─── */}
      {canSubmit() && (
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Resumo da Admissão</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1"><User className="w-3.5 h-3.5" /> Funcionario</span>
              <span className="font-medium text-gray-800">{funcionario.nome}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Cargo</span>
              <span className="font-medium text-gray-800">{funcionario.cargo || '---'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Inicio ponto</span>
              <span className="font-medium text-gray-800">
                {dataIntegracao ? new Date(dataIntegracao + 'T12:00:00').toLocaleDateString('pt-BR') : '---'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Obra</span>
              <span className="font-medium text-gray-800">{obraSelecionada?.nome || '---'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Integracao SST</span>
              <span className="font-medium text-gray-800">{responsavelSST} {localSST ? `- ${localSST}` : ''}</span>
            </div>
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

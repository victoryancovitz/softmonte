'use client'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { X } from 'lucide-react'
import SignatureCanvas from 'react-signature-canvas'

interface Props {
  rdoId: string
  obraId: string
  tipo: 'responsavel' | 'fiscal'
  onClose: () => void
  onSigned: () => void
}

export default function SignatureModal({ rdoId, obraId, tipo, onClose, onSigned }: Props) {
  const supabase = createClient()
  const toast = useToast()
  const sigRef = useRef<SignatureCanvas | null>(null)
  const [nome, setNome] = useState('')
  const [cargoOuEmpresa, setCargoOuEmpresa] = useState('')
  const [saving, setSaving] = useState(false)

  const isResp = tipo === 'responsavel'
  const titulo = isResp ? 'Assinar como Responsável Tecnomonte' : 'Assinar como Fiscalização (Cliente)'
  const label2 = isResp ? 'Cargo' : 'Empresa'

  const handleSave = async () => {
    if (!nome.trim()) { toast.warning('Informe seu nome'); return }
    if (!cargoOuEmpresa.trim()) { toast.warning(`Informe ${label2.toLowerCase()}`); return }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.warning('Desenhe sua assinatura na área'); return
    }
    setSaving(true)
    try {
      // Captura como PNG base64
      const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL('image/png')
      // Convert to blob
      const blob = await (await fetch(dataUrl)).blob()
      const fileName = `${rdoId}/assinatura-${tipo}-${Date.now()}.png`
      const { error: upErr } = await supabase.storage.from('rdos').upload(fileName, blob, {
        contentType: 'image/png',
        upsert: true,
      })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('rdos').getPublicUrl(fileName)
      const signUrl = pub.publicUrl

      const now = new Date().toISOString()
      const patch: any = isResp
        ? {
            assinatura_responsavel_nome: nome,
            assinatura_responsavel_cargo: cargoOuEmpresa,
            assinatura_responsavel_url: signUrl,
            assinatura_responsavel_em: now,
          }
        : {
            assinatura_fiscal_nome: nome,
            assinatura_fiscal_empresa: cargoOuEmpresa,
            assinatura_fiscal_url: signUrl,
            assinatura_fiscal_em: now,
          }

      const { error: updErr } = await supabase.from('diario_obra').update(patch).eq('id', rdoId)
      if (updErr) throw updErr

      // Se assinatura fiscal, muda status para 'fechado'
      if (!isResp) {
        await supabase.from('diario_obra').update({ status: 'fechado' }).eq('id', rdoId)
        const { data: { user } } = await supabase.auth.getUser()
        const { data: prof } = await supabase.from('profiles').select('nome').eq('user_id', user?.id).maybeSingle()
        await supabase.from('diario_historico').insert({
          diario_id: rdoId,
          status_de: 'aprovado',
          status_para: 'fechado',
          feito_por: user?.id ?? null,
          feito_por_nome: (prof as any)?.nome ?? user?.email ?? null,
          observacao: `Assinatura fiscal: ${nome} (${cargoOuEmpresa})`,
        })
      }

      toast.success('Assinatura registrada')
      onSigned()
    } catch (e: any) {
      toast.error('Erro ao assinar', e?.message ?? '')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-brand">{titulo}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Nome *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{label2} *</label>
            <input value={cargoOuEmpresa} onChange={e => setCargoOuEmpresa(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/30" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Assinatura *</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 overflow-hidden">
              <SignatureCanvas
                ref={sigRef}
                canvasProps={{ className: 'w-full h-40 bg-white' }}
                penColor="#00215B"
              />
            </div>
            <button type="button" onClick={() => sigRef.current?.clear()}
              className="text-xs text-gray-500 hover:text-red-600 mt-1">Limpar</button>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand/90 disabled:opacity-50">
            {saving ? 'Salvando...' : '✅ Assinar'}
          </button>
        </div>
      </div>
    </div>
  )
}

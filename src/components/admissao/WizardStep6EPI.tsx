'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { Plus, Trash2, Check } from 'lucide-react'

/* ─── Types ─── */

interface EPIItem {
  id: string
  nome: string
  qtd: number
  un: string
  ca: string
  entregue: boolean
}

interface Props {
  funcionario: any
  workflowId: string
  onComplete: () => void
}

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand'

const STEP_LABELS = ['Itens', 'Assinatura']

const TERMO_PARAGRAFOS = [
  'Declaro ter recebido gratuitamente os Equipamentos de Proteção Individual (EPI) acima relacionados, comprometendo-me a usá-los adequadamente durante a jornada de trabalho, conforme as instruções recebidas.',
  'Comprometo-me a zelar pela guarda e conservação dos equipamentos, devolvendo-os quando danificados, para substituição, ou ao término do contrato de trabalho.',
  'Estou ciente de que o uso do EPI é obrigatório conforme o disposto na NR-6 do Ministério do Trabalho, e que o não cumprimento poderá acarretar em sanções disciplinares, conforme legislação vigente.',
  'Declaro ainda que os EPIs foram entregues em perfeitas condições de uso e que fui orientado sobre a forma correta de utilização, guarda e conservação dos mesmos.',
]

let itemIdCounter = 0
function genId() { return `tmp_${++itemIdCounter}_${Date.now()}` }

export default function WizardStep6EPI({ funcionario, workflowId, onComplete }: Props) {
  const supabase = createClient()
  const toast = useToast()

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1 state
  const [itens, setItens] = useState<EPIItem[]>([])
  const [dataEntrega, setDataEntrega] = useState(new Date().toISOString().split('T')[0])
  const [responsavel, setResponsavel] = useState('')
  const [loadingKit, setLoadingKit] = useState(true)

  // Step 2 state
  const [assinaturaTipo, setAssinaturaTipo] = useState<'digital' | 'fisica' | null>(null)
  const [termoAceito, setTermoAceito] = useState(false)
  const [printConfirmed, setPrintConfirmed] = useState(false)

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)

  /* ─── Load kit on mount ─── */

  useEffect(() => {
    async function loadKit() {
      setLoadingKit(true)
      const { data: kit } = await supabase
        .from('epi_kits_funcao')
        .select('*')
        .eq('funcao_id', funcionario.funcao_id)
        .eq('ativo', true)
        .order('ordem')

      if (kit && kit.length > 0) {
        setItens(kit.map((k: any) => ({
          id: genId(),
          nome: k.nome_epi || '',
          qtd: Number(k.quantidade) || 1,
          un: k.unidade || 'UND',
          ca: k.ca || '',
          entregue: false,
        })))
      }
      setLoadingKit(false)
    }
    loadKit()
  }, [funcionario.funcao_id])

  /* ─── Canvas drawing ─── */

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const touch = e.touches[0]
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY }
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }, [])

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    isDrawing.current = true
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }, [getPos])

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }, [getPos])

  const stopDrawing = useCallback(() => { isDrawing.current = false }, [])

  function clearCanvas() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  function initCanvas() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  function exportCanvas(): string | null {
    return canvasRef.current?.toDataURL('image/png') ?? null
  }

  /* ─── Print ─── */

  function openPrintWindow() {
    const today = new Date().toLocaleDateString('pt-BR')
    const admissao = funcionario.admissao
      ? new Date(funcionario.admissao + 'T12:00:00').toLocaleDateString('pt-BR')
      : '-'
    const signImg = exportCanvas()

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Ficha de EPI - ${funcionario.nome}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #333; }
  h1 { text-align: center; font-size: 16px; margin-bottom: 4px; }
  h2 { text-align: center; font-size: 12px; font-weight: normal; margin-bottom: 20px; color: #666; }
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 16px; }
  .info span { font-weight: bold; }
  .termo { margin: 16px 0; padding: 12px; border: 1px solid #ccc; font-size: 10px; line-height: 1.5; }
  .termo p { margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; font-size: 10px; }
  th { background: #f0f0f0; font-weight: bold; }
  .sig { margin-top: 30px; text-align: center; }
  .sig img { max-width: 240px; height: 80px; border-bottom: 1px solid #333; }
  .sig-line { width: 300px; border-top: 1px solid #333; margin: 40px auto 4px; }
  .footer { margin-top: 30px; font-size: 9px; color: #999; text-align: center; }
  @media print { body { margin: 10mm; } }
</style></head><body>
<h1>TECNOMONTE</h1>
<h2>FICHA DE ENTREGA DE EPI - EQUIPAMENTO DE PROTECAO INDIVIDUAL</h2>
<div class="info">
  <div><span>Nome:</span> ${funcionario.nome || '-'}</div>
  <div><span>CPF:</span> ${funcionario.cpf || '-'}</div>
  <div><span>Funcao:</span> ${funcionario.funcao_nome || funcionario.funcao || '-'}</div>
  <div><span>Matricula:</span> ${funcionario.matricula || '-'}</div>
  <div><span>Data Admissão:</span> ${admissao}</div>
  <div><span>Data Entrega:</span> ${dataEntrega ? new Date(dataEntrega + 'T12:00:00').toLocaleDateString('pt-BR') : today}</div>
</div>
<table>
  <thead><tr><th>EPI</th><th>QTD</th><th>UN</th><th>C.A.</th><th>Data Recebimento</th><th>Devolucao</th><th>Assinatura</th></tr></thead>
  <tbody>
    ${itens.map(i => `<tr><td>${i.nome}</td><td>${i.qtd}</td><td>${i.un}</td><td>${i.ca}</td><td>${dataEntrega ? new Date(dataEntrega + 'T12:00:00').toLocaleDateString('pt-BR') : today}</td><td></td><td></td></tr>`).join('')}
  </tbody>
</table>
<div class="termo">
  ${TERMO_PARAGRAFOS.map(p => `<p>${p}</p>`).join('')}
</div>
${signImg ? `<div class="sig"><img src="${signImg}" alt="Assinatura digital" /><p style="font-size:10px;color:#666;">Assinatura digital</p></div>` : `<div class="sig"><div class="sig-line"></div><p style="font-size:10px;">Assinatura do funcionario</p></div>`}
<div style="margin-top:20px;text-align:center;">
  <div class="sig-line"></div>
  <p style="font-size:10px;">Responsavel: ${responsavel || '_______________'}</p>
</div>
<div class="footer">Conforme NR-6 e NFPA 70E. Documento gerado em ${today}.</div>
<script>window.onload = function() { window.print(); }</script>
</body></html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
    }
  }

  /* ─── Save ─── */

  async function handleComplete(tipo: 'digital' | 'fisica') {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const email = user?.email ?? 'sistema'

      let signatureData: string | null = null
      if (tipo === 'digital') signatureData = exportCanvas()

      const itensJson = itens.map(i => ({ nome: i.nome, qtd: i.qtd, un: i.un, ca: i.ca, entregue: i.entregue }))

      const { data: ficha } = await supabase.from('fichas_epi').insert({
        funcionario_id: funcionario.id,
        workflow_id: workflowId,
        data_entrega: dataEntrega,
        responsavel,
        itens: itensJson,
        assinatura_tipo: tipo,
        assinatura_svg: signatureData,
        termo_aceito: tipo === 'digital' ? true : null,
        created_by: user?.id,
      }).select().single()

      await supabase.from('admissoes_workflow').update({
        etapa_epi_entregue: {
          ok: true,
          data: new Date().toISOString().split('T')[0],
          por: email,
          ficha_id: ficha?.id ?? null,
          assinatura_tipo: tipo,
        },
        updated_at: new Date().toISOString(),
      }).eq('id', workflowId)

      toast.success('Ficha de EPI registrada!')
      onComplete()
    } catch {
      toast.error('Erro ao salvar ficha de EPI')
    } finally {
      setSaving(false)
    }
  }

  /* ─── Item helpers ─── */

  function addItem() { setItens(prev => [...prev, { id: genId(), nome: '', qtd: 1, un: 'un', ca: '', entregue: false }]) }
  function removeItem(id: string) { setItens(prev => prev.filter(i => i.id !== id)) }
  function updateItem(id: string, field: keyof EPIItem, value: string | number | boolean) {
    setItens(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }
  async function naoSeAplica() {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const email = user?.email ?? 'sistema'
      await supabase.from('admissoes_workflow').update({
        etapa_epi_entregue: {
          ok: true,
          data: new Date().toISOString().split('T')[0],
          por: email,
          nao_se_aplica: true,
        },
        updated_at: new Date().toISOString(),
      }).eq('id', workflowId)
      toast.success('Etapa de EPI marcada como não aplicável')
      onComplete()
    } catch {
      toast.error('Erro ao marcar etapa')
    } finally {
      setSaving(false)
    }
  }

  /* ─── Render ─── */

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-2">
        {STEP_LABELS.map((label, idx) => {
          const num = idx + 1
          const done = step > num
          const active = step === num
          return (
            <div key={label} className="flex items-center gap-2">
              {idx > 0 && <div className={`w-8 h-0.5 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />}
              <div className={`flex items-center gap-1.5 ${active ? 'text-brand' : done ? 'text-green-600' : 'text-gray-400'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  done ? 'bg-green-500 text-white' : active ? 'bg-brand text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {done ? <Check className="w-3.5 h-3.5" /> : num}
                </span>
                <span className="text-xs font-medium">{label}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ═══ STEP 1: Items ═══ */}
      {step === 1 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Data de entrega</label>
              <input type="date" value={dataEntrega} onChange={e => setDataEntrega(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Responsável</label>
              <input type="text" value={responsavel} onChange={e => setResponsavel(e.target.value)} className={inputCls} placeholder="Nome do responsável" />
            </div>
          </div>

          {loadingKit ? (
            <div className="py-8 text-center text-sm text-gray-400">Carregando kit da função...</div>
          ) : itens.length === 0 ? (
            <div className="py-8 px-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-center space-y-3">
              <p className="text-sm font-semibold text-gray-700">Nenhum kit EPI para esta função</p>
              <p className="text-xs text-gray-500">
                Você pode adicionar EPIs manualmente ou marcar esta etapa como não aplicável.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                <button onClick={addItem} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-brand border border-brand rounded-lg hover:bg-brand/5 transition-colors">
                  <Plus className="w-4 h-4" /> Adicionar EPI manualmente
                </button>
                <button
                  onClick={naoSeAplica}
                  disabled={saving}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
                >
                  Não se aplica
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Itens EPI</p>
                <div className="grid grid-cols-[28px_1fr_60px_60px_100px_36px] gap-2 px-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase text-center">OK</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">EPI</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">QTD</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">UN</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">C.A.</span>
                  <span />
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {itens.map(item => (
                    <div key={item.id} className="grid grid-cols-[28px_1fr_60px_60px_100px_36px] gap-2 items-center">
                      <label className="flex items-center justify-center cursor-pointer" title="Marcar como entregue">
                        <input
                          type="checkbox"
                          checked={item.entregue}
                          onChange={e => updateItem(item.id, 'entregue', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                        />
                      </label>
                      <input type="text" value={item.nome} onChange={e => updateItem(item.id, 'nome', e.target.value)}
                        className="px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" placeholder="Nome do EPI" />
                      <input type="number" min={1} value={item.qtd} onChange={e => updateItem(item.id, 'qtd', Number(e.target.value) || 1)}
                        className="px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand" />
                      <input type="text" value={item.un} onChange={e => updateItem(item.id, 'un', e.target.value)}
                        className="px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand" placeholder="un" />
                      <input type="text" value={item.ca} onChange={e => updateItem(item.id, 'ca', e.target.value)}
                        className="px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand" placeholder="C.A." />
                      <button onClick={() => removeItem(item.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <button onClick={addItem} className="flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark transition-colors">
                  <Plus className="w-4 h-4" /> Adicionar EPI
                </button>
                <button
                  onClick={naoSeAplica}
                  disabled={saving}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                  Não se aplica
                </button>
              </div>
            </>
          )}

          <button
            onClick={() => { setStep(2); setTimeout(initCanvas, 100) }}
            disabled={itens.length === 0}
            className="w-full px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50"
          >
            Avançar para Assinatura
          </button>
        </>
      )}

      {/* ═══ STEP 2: Signature ═══ */}
      {step === 2 && (
        <>
          {/* Responsibility term */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-2 max-h-48 overflow-y-auto">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Termo de Responsabilidade</p>
            {TERMO_PARAGRAFOS.map((p, i) => (
              <p key={i} className="text-xs text-gray-700 leading-relaxed">{p}</p>
            ))}
          </div>

          {/* Signature choice buttons */}
          {!assinaturaTipo && (
            <>
              <div className="flex gap-3">
                <button
                  onClick={() => { setAssinaturaTipo('digital'); setTimeout(initCanvas, 100) }}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-brand bg-brand/5 text-sm font-bold text-brand hover:bg-brand/10 transition-colors"
                >
                  Assinar digitalmente
                </button>
                <button
                  onClick={() => setAssinaturaTipo('fisica')}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Imprimir para assinar
                </button>
              </div>
              <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
                &larr; Voltar para itens
              </button>
              <button
                onClick={naoSeAplica}
                disabled={saving}
                className="w-full text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
              >
                Não se aplica — pular etapa de EPI
              </button>
            </>
          )}

          {/* Digital signature */}
          {assinaturaTipo === 'digital' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-600">Assine no campo abaixo:</p>
              <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-white touch-none">
                <canvas
                  ref={canvasRef}
                  width={480}
                  height={160}
                  className="w-full cursor-crosshair"
                  style={{ touchAction: 'none' }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={clearCanvas} className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Limpar</button>
                <button onClick={() => { setAssinaturaTipo(null); setTermoAceito(false) }} className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700">Voltar</button>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={termoAceito} onChange={e => setTermoAceito(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand" />
                <span className="text-xs text-gray-700">Li e concordo com os termos acima</span>
              </label>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={() => handleComplete('digital')}
                  disabled={!termoAceito || saving}
                  className="flex-1 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Confirmar assinatura'}
                </button>
                <button onClick={() => setStep(1)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">&larr; Voltar</button>
              </div>
            </div>
          )}

          {/* Physical signature (print) */}
          {assinaturaTipo === 'fisica' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-800 font-medium">
                  Clique em &ldquo;Imprimir ficha&rdquo; para gerar o documento. Após assinatura física, clique em &ldquo;Confirmar&rdquo;.
                </p>
              </div>
              <button onClick={openPrintWindow}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                Imprimir ficha
              </button>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={printConfirmed} onChange={e => setPrintConfirmed(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand" />
                <span className="text-xs text-gray-700">A ficha foi impressa e assinada fisicamente</span>
              </label>

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={() => handleComplete('fisica')}
                  disabled={!printConfirmed || saving}
                  className="flex-1 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Confirmar entrega física'}
                </button>
                <button onClick={() => { setAssinaturaTipo(null); setPrintConfirmed(false) }}
                  className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Voltar</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

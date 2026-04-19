'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { X, Plus, Trash2, Check } from 'lucide-react'
import { gerarPDFHTML } from '@/lib/pdf-template'

/* ─── Types ─── */

interface EPIItem {
  id: string
  nome: string
  qtd: number
  un: string
  ca: string
}

interface Props {
  funcionario: any
  workflowId: string
  onClose: () => void
  onSuccess: () => void
}

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand'

const STEP_LABELS = ['Itens', 'Assinatura', 'Concluido']

const TERMO_PARAGRAFOS = [
  'Declaro ter recebido gratuitamente os Equipamentos de Protecao Individual (EPI) acima relacionados, comprometendo-me a usa-los adequadamente durante a jornada de trabalho, conforme as instrucoes recebidas.',
  'Comprometo-me a zelar pela guarda e conservacao dos equipamentos, devolvendo-os quando danificados, para substituicao, ou ao termino do contrato de trabalho.',
  'Estou ciente de que o uso do EPI e obrigatorio conforme o disposto na NR-6 do Ministerio do Trabalho, e que o nao cumprimento podera acarretar em sancoes disciplinares, conforme legislacao vigente.',
  'Declaro ainda que os EPIs foram entregues em perfeitas condicoes de uso e que fui orientado sobre a forma correta de utilizacao, guarda e conservacao dos mesmos.',
]

let itemIdCounter = 0
function genId() {
  return `tmp_${++itemIdCounter}_${Date.now()}`
}

/* ─── Main Component ─── */

export default function ModalFichaEPI({ funcionario, workflowId, onClose, onSuccess }: Props) {
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
  const [assinaturaSvg, setAssinaturaSvg] = useState<string | null>(null)
  const [termoAceito, setTermoAceito] = useState(false)
  const [printConfirmed, setPrintConfirmed] = useState(false)

  // Step 3 state
  const [fichaId, setFichaId] = useState<string | null>(null)

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
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
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

  const stopDrawing = useCallback(() => {
    isDrawing.current = false
  }, [])

  function clearCanvas() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setAssinaturaSvg(null)
  }

  function initCanvas() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  function exportCanvas(): string | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.toDataURL('image/png')
  }

  /* ─── Save to DB ─── */

  async function handleComplete(tipo: 'digital' | 'fisica') {
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const email = user?.email ?? 'sistema'

      let signatureData: string | null = null
      if (tipo === 'digital') {
        signatureData = exportCanvas()
      }

      const itensJson = itens.map(i => ({
        nome: i.nome,
        qtd: i.qtd,
        un: i.un,
        ca: i.ca,
      }))

      // 1. Insert ficha_epi
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

      const fichaIdResult = ficha?.id ?? null
      setFichaId(fichaIdResult)

      // 2. Update workflow
      await supabase.from('admissoes_workflow').update({
        etapa_epi_entregue: {
          ok: true,
          data: new Date().toISOString().split('T')[0],
          por: email,
          ficha_id: fichaIdResult,
          assinatura_tipo: tipo,
        },
        updated_at: new Date().toISOString(),
      }).eq('id', workflowId)

      // 3. Update custo_epi (sum if items have cost, set to item count as placeholder)
      // No cost field in the items table for EPI kit — skip if not applicable

      // 4. Call onSuccess
      onSuccess()

      // 5. Toast
      toast.success('Ficha de EPI registrada!')

      setAssinaturaTipo(tipo)
      setStep(3)
    } catch (err) {
      toast.error('Erro ao salvar ficha de EPI')
    } finally {
      setSaving(false)
    }
  }

  /* ─── PDF / Print ─── */

  function generatePrintHTML() {
    const today = new Date().toLocaleDateString('pt-BR')
    const admissao = funcionario.admissao
      ? new Date(funcionario.admissao + 'T12:00:00').toLocaleDateString('pt-BR')
      : '-'
    const signImg = assinaturaSvg || exportCanvas()
    const entregaFmt = dataEntrega ? new Date(dataEntrega + 'T12:00:00').toLocaleDateString('pt-BR') : today

    const bodyHTML = `
      <div class="info-row">
        <span>NOME: <strong>${funcionario.nome || '-'}</strong></span>
        <span>CPF: <strong>${funcionario.cpf || '-'}</strong></span>
        <span>FUNCAO: <strong>${funcionario.funcao_nome || funcionario.funcao || '-'}</strong></span>
        <span>MATRICULA: <strong>${funcionario.matricula || '-'}</strong></span>
      </div>
      <div class="info-row">
        <span>DATA ADMISSAO: <strong>${admissao}</strong></span>
        <span>DATA ENTREGA: <strong>${entregaFmt}</strong></span>
      </div>

      <table>
        <thead><tr><th>EPI</th><th>QTD</th><th>UN</th><th>C.A.</th><th>Data Recebimento</th><th>Devolucao</th><th>Assinatura</th></tr></thead>
        <tbody>
          ${itens.map(i => `<tr><td>${i.nome}</td><td>${i.qtd}</td><td>${i.un}</td><td>${i.ca}</td><td>${entregaFmt}</td><td></td><td></td></tr>`).join('')}
        </tbody>
      </table>

      <div class="termo-box">
        ${TERMO_PARAGRAFOS.map(p => `<p style="margin:6px 0;">${p}</p>`).join('')}
      </div>

      ${signImg ? `<div style="margin-top:20px;text-align:center;"><img src="${signImg}" style="max-width:240px;height:80px;border-bottom:1px solid #333;" alt="Assinatura digital" /><p style="font-size:8px;color:#666;">Assinatura digital</p></div>` : `<div class="assinatura-area"><div class="assinatura-line">Assinatura do funcionário</div><div class="assinatura-line">Responsável: ${responsavel || '_______________'}</div></div>`}

      ${signImg ? `<div class="assinatura-area"><div class="assinatura-line">Responsável: ${responsavel || '_______________'}</div></div>` : ''}

      <p style="font-size:7px;color:#999;margin-top:16px;text-align:center;">Conforme NR-6 e NFPA 70E.</p>
    `

    return gerarPDFHTML({
      titulo: 'FICHA DE EQUIPAMENTOS DE PROTEÇÃO INDIVIDUAL',
      numero: `EPI-ADM-${funcionario.matricula || '---'}`,
      logoUrl: '/logo_tecnomonte.png',
    }, bodyHTML)
  }

  function openPrintWindow() {
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(generatePrintHTML())
      win.document.close()
    }
  }

  function downloadPDF() {
    openPrintWindow()
  }

  /* ─── Add / Remove item ─── */

  function addItem() {
    setItens(prev => [...prev, { id: genId(), nome: '', qtd: 1, un: 'un', ca: '' }])
  }

  function removeItem(id: string) {
    setItens(prev => prev.filter(i => i.id !== id))
  }

  function updateItem(id: string, field: keyof EPIItem, value: string | number) {
    setItens(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  /* ─── Render ─── */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-brand">Ficha de EPI</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
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
                  <span className="text-xs font-medium hidden sm:inline">{label}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="px-5 py-4 space-y-4">
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
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Itens EPI</p>

                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_60px_60px_100px_36px] gap-2 px-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">EPI</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">QTD</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">UN</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">C.A.</span>
                      <span />
                    </div>

                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {itens.map(item => (
                        <div key={item.id} className="grid grid-cols-[1fr_60px_60px_100px_36px] gap-2 items-center">
                          <input
                            type="text"
                            value={item.nome}
                            onChange={e => updateItem(item.id, 'nome', e.target.value)}
                            className="px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                            placeholder="Nome do EPI"
                          />
                          <input
                            type="number"
                            min={1}
                            value={item.qtd}
                            onChange={e => updateItem(item.id, 'qtd', Number(e.target.value) || 1)}
                            className="px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand"
                          />
                          <input
                            type="text"
                            value={item.un}
                            onChange={e => updateItem(item.id, 'un', e.target.value)}
                            className="px-2 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand"
                            placeholder="un"
                          />
                          <input
                            type="text"
                            value={item.ca}
                            onChange={e => updateItem(item.id, 'ca', e.target.value)}
                            className="px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                            placeholder="C.A."
                          />
                          <button
                            onClick={() => removeItem(item.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={addItem}
                    className="flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Adicionar EPI
                  </button>
                </>
              )}

              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={() => {
                    setStep(2)
                    setTimeout(initCanvas, 100)
                  }}
                  disabled={itens.length === 0}
                  className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50"
                >
                  Avancar &rarr; Assinatura
                </button>
                <button onClick={onClose} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">
                  Cancelar
                </button>
              </div>
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
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setAssinaturaTipo('digital')
                      setTimeout(initCanvas, 100)
                    }}
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
                    <button onClick={clearCanvas} className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                      Limpar
                    </button>
                    <button
                      onClick={() => {
                        setAssinaturaTipo(null)
                        setTermoAceito(false)
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
                    >
                      Voltar
                    </button>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={termoAceito}
                      onChange={e => setTermoAceito(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                    />
                    <span className="text-xs text-gray-700">Li e concordo com os termos acima</span>
                  </label>

                  <div className="flex gap-3 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleComplete('digital')}
                      disabled={!termoAceito || saving}
                      className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50"
                    >
                      {saving ? 'Salvando...' : 'Confirmar assinatura'}
                    </button>
                    <button
                      onClick={() => setStep(1)}
                      className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50"
                    >
                      &larr; Voltar
                    </button>
                  </div>
                </div>
              )}

              {/* Physical signature (print) */}
              {assinaturaTipo === 'fisica' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                    <p className="text-sm text-blue-800 font-medium">
                      Clique em &ldquo;Imprimir ficha&rdquo; para gerar o documento. Apos assinatura fisica, clique em &ldquo;Confirmar&rdquo;.
                    </p>
                  </div>
                  <button
                    onClick={openPrintWindow}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Imprimir ficha
                  </button>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={printConfirmed}
                      onChange={e => setPrintConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                    />
                    <span className="text-xs text-gray-700">A ficha foi impressa e assinada fisicamente</span>
                  </label>

                  <div className="flex gap-3 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleComplete('fisica')}
                      disabled={!printConfirmed || saving}
                      className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50"
                    >
                      {saving ? 'Salvando...' : 'Confirmar entrega fisica'}
                    </button>
                    <button
                      onClick={() => {
                        setAssinaturaTipo(null)
                        setPrintConfirmed(false)
                      }}
                      className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              )}

              {/* If no type selected yet, show back button */}
              {!assinaturaTipo && (
                <div className="flex gap-3 pt-2 border-t border-gray-100">
                  <button onClick={() => setStep(1)} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">
                    &larr; Voltar
                  </button>
                </div>
              )}
            </>
          )}

          {/* ═══ STEP 3: Done ═══ */}
          {step === 3 && (
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-green-600" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-gray-900">Ficha de EPI registrada</h4>
                <p className="text-sm text-gray-500 mt-1">Todos os dados foram salvos com sucesso.</p>
              </div>

              <div className="text-left p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Funcionário</span>
                  <span className="font-medium text-gray-800">{funcionario.nome}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Itens entregues</span>
                  <span className="font-medium text-gray-800">{itens.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Data</span>
                  <span className="font-medium text-gray-800">
                    {dataEntrega ? new Date(dataEntrega + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Assinatura</span>
                  <span className="font-medium text-gray-800">
                    {assinaturaTipo === 'digital' ? 'Digital' : 'Fisica (impressa)'}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={downloadPDF}
                  className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
                >
                  Baixar PDF
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react'

interface Props {
  obraId: string
  onClose: () => void
  onImported: () => void
}

type PreviewData = {
  formato: 'ageo' | 'generico' | string
  abas: string[]
  rdo?: any
  ponto?: any[]
  imagens?: Array<{ name: string; dataBase64: string; mediaType: string }>
  preview?: any[]
  fileName: string
  fileSize: number
}

export default function RdoImportModal({ obraId, onClose, onImported }: Props) {
  const supabase = createClient()
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'rdo' | 'ponto' | 'nao_encontrados'>('rdo')
  const [pontoMatch, setPontoMatch] = useState<Record<string, string | null>>({}) // nome → funcionario_id ou null
  const [lancarPonto, setLancarPonto] = useState(true)
  const [sobrescreverPonto, setSobrescreverPonto] = useState(false)

  const handleFile = async (f: File | null) => {
    if (!f) return
    setFile(f)
    setLoading(true)
    setPreview(null)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch('/api/rdo/importar', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? 'Erro ao processar arquivo')
      }
      const data: PreviewData = await res.json()
      setPreview(data)

      // Match ponto com funcionários cadastrados
      if (data.ponto && data.ponto.length > 0) {
        const nomes = Array.from(new Set(data.ponto.map((p: any) => p.nome).filter(Boolean)))
        const { data: funcs } = await supabase.from('funcionarios')
          .select('id, nome')
          .is('deleted_at', null)
        const matches: Record<string, string | null> = {}
        for (const nome of nomes) {
          const match = (funcs ?? []).find(f => normalize(f.nome) === normalize(nome))
          matches[nome] = match?.id ?? null
        }
        setPontoMatch(matches)
      }
    } catch (e: any) {
      toast.error('Erro ao processar arquivo', e?.message ?? '')
      setFile(null)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!preview || !preview.rdo) { toast.error('Nada para importar'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const rdo = preview.rdo
      const cab = rdo.cabecalho ?? {}
      const dataRdo = cab.data ?? new Date().toISOString().slice(0, 10)
      const numeroRdo = Number(cab.numero_rdo) || null

      // Check duplicate
      const { data: existing } = await supabase
        .from('diario_obra')
        .select('id')
        .eq('obra_id', obraId)
        .eq('data', dataRdo)
        .maybeSingle()
      if (existing?.id) {
        if (!confirm(`Já existe RDO de ${dataRdo}. Substituir?`)) {
          setSaving(false); return
        }
        // Deleta existente (cascata apaga filhos)
        await supabase.from('diario_obra').delete().eq('id', existing.id)
      }

      // Upload arquivo original pro storage
      let arquivoUrl: string | null = null
      if (file) {
        const path = `${obraId}/${dataRdo}/original-${Date.now()}-${file.name}`
        const { error: upErr } = await supabase.storage.from('rdos').upload(path, file, { upsert: true })
        if (!upErr) {
          const { data: pub } = supabase.storage.from('rdos').getPublicUrl(path)
          arquivoUrl = pub.publicUrl
        }
      }

      // Cria RDO
      const { data: ins, error } = await supabase.from('diario_obra').insert({
        obra_id: obraId,
        data: dataRdo,
        numero_rdo: numeroRdo,
        formato: 'importado',
        arquivo_origem: arquivoUrl,
        status: 'rascunho',
        observacoes_contratada: rdo.observacoes_contratada ?? null,
        observacoes_fiscalizacao: rdo.observacoes_fiscalizacao ?? null,
        horas_trabalhadas: 9,
        created_by: user?.id ?? null,
      }).select('id').single()
      if (error) throw error
      const id = ins.id

      const inserts: Array<PromiseLike<any>> = []
      if (rdo.clima?.length) {
        inserts.push(supabase.from('diario_clima').insert(
          rdo.clima.map((c: any) => ({ diario_id: id, ...c })),
        ) as any)
      }
      if (rdo.efetivo?.length) {
        inserts.push(supabase.from('diario_efetivo').insert(
          rdo.efetivo.map((e: any) => ({ diario_id: id, ...e })),
        ) as any)
      }
      if (rdo.atividades?.length) {
        inserts.push(supabase.from('diario_atividades').insert(
          rdo.atividades.map((a: any) => ({ diario_id: id, ...a })),
        ) as any)
      }
      if (rdo.equipamentos?.length) {
        inserts.push(supabase.from('diario_equipamentos').insert(
          rdo.equipamentos.map((e: any) => ({ diario_id: id, ...e })),
        ) as any)
      }
      // Upload de imagens embutidas no OOXML para o Storage
      const fotosComUrl: any[] = []
      const imagens = preview.imagens ?? []
      const legendas = rdo.fotos ?? []
      for (let i = 0; i < imagens.length && i < 10; i++) {
        const img = imagens[i]
        const legenda = legendas[i]?.legenda ?? ''
        const numero = legendas[i]?.numero ?? (i + 1)
        try {
          const ext = img.mediaType === 'image/jpeg' ? 'jpg' : img.mediaType === 'image/png' ? 'png' : 'img'
          const binary = Uint8Array.from(atob(img.dataBase64), c => c.charCodeAt(0))
          const blob = new Blob([binary], { type: img.mediaType })
          const path = `${obraId}/${dataRdo}/foto-${numero}-${Date.now()}.${ext}`
          const { error: upErr } = await supabase.storage.from('rdos').upload(path, blob, { upsert: true })
          if (!upErr) {
            const { data: pub } = supabase.storage.from('rdos').getPublicUrl(path)
            fotosComUrl.push({ diario_id: id, numero, legenda, url: pub.publicUrl })
          }
        } catch { /* ignore individual image failures */ }
      }

      // Se não conseguiu extrair imagens mas tem legendas, ainda salva só as legendas
      if (fotosComUrl.length === 0 && legendas.length > 0) {
        legendas.slice(0, 10).forEach((f: any) => {
          fotosComUrl.push({ diario_id: id, numero: f.numero, legenda: f.legenda, url: f.url || '' })
        })
      }

      if (fotosComUrl.length > 0) {
        inserts.push(supabase.from('diario_fotos').insert(fotosComUrl) as any)
      }
      await Promise.all(inserts)

      // Lançar ponto dos funcionários identificados
      let pontoLancado = 0
      if (lancarPonto && preview.ponto && preview.ponto.length > 0) {
        pontoLancado = await inserirPontoRegistros(id, dataRdo, preview.ponto)
      }

      const msg = `${preview.rdo.efetivo?.length ?? 0} efetivo · ${preview.rdo.atividades?.length ?? 0} atividades · ${fotosComUrl.length} fotos` +
        (pontoLancado > 0 ? ` · ${pontoLancado} pontos` : '')
      toast.success('RDO importado!', msg)
      onImported()
    } catch (e: any) {
      toast.error('Erro ao importar', e?.message ?? '')
    } finally {
      setSaving(false)
    }
  }

  async function inserirPontoRegistros(rdoId: string, dataRdo: string, pontos: any[]): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser()
    let inseridos = 0
    const linhasParaUpsert: any[] = []
    const parsePonto = (p: any) => ({
      funcionario_id: pontoMatch[p.nome],
      obra_id: obraId,
      data: dataRdo,
      entrada: p.entrada1 || null,
      saida: p.saida1 || null,
      horas_trabalhadas: Number(p.normais ?? 0) + Number(p.extras ?? 0),
      origem: 'importacao_rdo',
      origem_ref: rdoId,
      registrado_por: user?.id ?? null,
      observacao: `Importado de RDO (aba ${p.aba ?? ''})`,
    })

    for (const p of pontos) {
      const funcId = pontoMatch[p.nome]
      if (!funcId) continue // não encontrado

      const { data: existing } = await supabase
        .from('ponto_registros')
        .select('id')
        .eq('funcionario_id', funcId)
        .eq('data', dataRdo)
        .maybeSingle()

      if (existing?.id) {
        if (!sobrescreverPonto) continue
        // Sobrescreve o existente
        const row = parsePonto(p)
        const { error } = await supabase.from('ponto_registros').update({
          entrada: row.entrada, saida: row.saida, horas_trabalhadas: row.horas_trabalhadas,
          origem: row.origem, origem_ref: row.origem_ref,
          editado_em: new Date().toISOString(), editado_por: user?.id ?? null,
          motivo_edicao: 'Reimportação de RDO',
        }).eq('id', existing.id)
        if (!error) inseridos++
      } else {
        linhasParaUpsert.push(parsePonto(p))
      }
    }

    if (linhasParaUpsert.length > 0) {
      const { error } = await supabase.from('ponto_registros').insert(linhasParaUpsert)
      if (!error) inseridos += linhasParaUpsert.length
    }

    return inseridos
  }

  const naoEncontrados = preview?.ponto
    ? Array.from(new Set(preview.ponto.map((p: any) => p.nome).filter(n => n && !pontoMatch[n])))
    : []
  const encontrados = preview?.ponto
    ? preview.ponto.filter((p: any) => p.nome && pontoMatch[p.nome])
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold">Importar RDO Excel</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {!preview && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault()
              setDragOver(false)
              const f = e.dataTransfer?.files?.[0]
              if (f) handleFile(f)
            }}
            className={`m-6 border-2 border-dashed rounded-xl p-10 text-center transition-colors ${dragOver ? 'border-brand bg-brand/5' : 'border-gray-300'}`}
          >
            {loading ? (
              <>
                <div className="inline-block w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm text-gray-500">Processando arquivo...</p>
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700 mb-1">Arraste o arquivo Excel aqui</p>
                <p className="text-xs text-gray-500 mb-4">ou clique para selecionar (.xlsx, .xlsm, .xls)</p>
                <label className="inline-block px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 cursor-pointer">
                  Selecionar arquivo
                  <input type="file" accept=".xlsx,.xlsm,.xls" onChange={e => handleFile(e.target.files?.[0] ?? null)} className="hidden" />
                </label>
              </>
            )}
          </div>
        )}

        {preview && (
          <div className="p-6">
            {/* Summary */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <div className="text-sm flex-1 min-w-0">
                <p className="font-semibold text-blue-900 truncate">{preview.fileName}</p>
                <p className="text-xs text-blue-700">
                  Formato: <strong>{preview.formato.toUpperCase()}</strong> · {Math.round(preview.fileSize / 1024)}KB · abas: {preview.abas.join(', ')}
                </p>
              </div>
              <button onClick={() => { setFile(null); setPreview(null) }} className="text-xs text-blue-600 hover:underline">Trocar</button>
            </div>

            {preview.formato !== 'ageo' && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-sm text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Formato genérico detectado — os dados podem não estar completos. Revise antes de confirmar.</span>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-200 mb-3">
              {[
                { k: 'rdo', label: 'Dados do RDO' },
                { k: 'ponto', label: `Ponto (${encontrados.length})` },
                { k: 'nao_encontrados', label: `Não encontrados (${naoEncontrados.length})` },
              ].map(t => (
                <button
                  key={t.k}
                  onClick={() => setActiveTab(t.k as any)}
                  className={`px-3 py-2 text-xs font-semibold transition-colors ${activeTab === t.k ? 'text-brand border-b-2 border-brand' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'rdo' && preview.rdo && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Data" value={preview.rdo.cabecalho?.data ?? '—'} />
                  <Info label="Nº RDO" value={preview.rdo.cabecalho?.numero_rdo ?? '—'} />
                  <Info label="Contratante" value={preview.rdo.cabecalho?.contratante ?? '—'} />
                  <Info label="Contrato" value={preview.rdo.cabecalho?.contrato ?? '—'} />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <Info label="Efetivo" value={preview.rdo.efetivo?.length ?? 0} />
                  <Info label="Atividades" value={preview.rdo.atividades?.length ?? 0} />
                  <Info label="Equipamentos" value={preview.rdo.equipamentos?.length ?? 0} />
                  <Info label="Fotos" value={preview.rdo.fotos?.length ?? 0} />
                </div>
                {preview.rdo.efetivo?.length > 0 && (
                  <details className="bg-gray-50 rounded-lg p-2">
                    <summary className="text-xs font-semibold text-gray-600 cursor-pointer">Ver efetivo extraído</summary>
                    <table className="w-full text-xs mt-2">
                      <thead><tr className="text-left text-gray-500">
                        <th>Tipo</th><th>Função</th><th>Qtd</th><th>HH</th>
                      </tr></thead>
                      <tbody>
                        {preview.rdo.efetivo.slice(0, 20).map((e: any, i: number) => (
                          <tr key={i} className="border-t border-gray-200">
                            <td className="py-1">{e.tipo}</td>
                            <td>{e.funcao}</td>
                            <td>{e.quantidade}</td>
                            <td>{e.horas_trabalhadas}h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </div>
            )}

            {activeTab === 'ponto' && (
              <div className="space-y-2">
                {encontrados.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">Nenhum funcionário encontrado nas abas NR 12 / APOIO.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-gray-500 border-b border-gray-200">
                      <th className="py-1.5">Nome</th><th>Entrada</th><th>Saída</th><th>Normais</th><th>Extras</th><th>Faltas</th>
                    </tr></thead>
                    <tbody>
                      {encontrados.slice(0, 30).map((p: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-1 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            {p.nome}
                          </td>
                          <td>{p.entrada1 ?? '—'}</td>
                          <td>{p.saida1 ?? '—'}</td>
                          <td>{p.normais}h</td>
                          <td>{p.extras}h</td>
                          <td>{p.faltas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="text-[10px] text-gray-400">O ponto pode ser lançado separadamente via /ponto após importar o RDO.</p>
              </div>
            )}

            {activeTab === 'nao_encontrados' && (
              <div className="space-y-2">
                {naoEncontrados.length === 0 ? (
                  <p className="text-xs text-green-700 text-center py-4 flex items-center justify-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Todos os funcionários do Excel foram identificados.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {naoEncontrados.map(n => (
                      <div key={n} className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                        <span className="flex-1 truncate">{n}</span>
                        <span className="text-[10px] text-amber-700">Não cadastrado</span>
                      </div>
                    ))}
                    <p className="text-[10px] text-gray-400 mt-2">Cadastre esses funcionários via /funcionarios/novo para lançar o ponto deles.</p>
                  </div>
                )}
              </div>
            )}

            {/* Footer options */}
            {encontrados.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                <label className="flex items-center gap-2 text-sm text-blue-900">
                  <input type="checkbox" checked={lancarPonto} onChange={e => setLancarPonto(e.target.checked)} className="w-4 h-4" />
                  <span className="font-semibold">Lançar ponto automaticamente</span>
                  <span className="text-xs text-blue-700">({encontrados.length} funcionários)</span>
                </label>
                {lancarPonto && (
                  <label className="flex items-center gap-2 text-xs text-blue-700 ml-6">
                    <input type="checkbox" checked={sobrescreverPonto} onChange={e => setSobrescreverPonto(e.target.checked)} className="w-4 h-4" />
                    <span>Sobrescrever registros existentes</span>
                  </label>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
              <button onClick={handleConfirm} disabled={saving}
                className="px-5 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand/90 disabled:opacity-50">
                {saving ? 'Importando...' : 'Confirmar importação'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <div className="text-[10px] text-gray-400 uppercase font-semibold">{label}</div>
      <div className="text-sm text-gray-800 truncate">{String(value)}</div>
    </div>
  )
}

function normalize(s: string): string {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

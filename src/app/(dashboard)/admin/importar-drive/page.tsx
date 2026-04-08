'use client'
import { useState, useEffect } from 'react'
// JSZip importado dinamicamente no handler (lazy) para não inchar o bundle inicial
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import BackButton from '@/components/BackButton'
import Link from 'next/link'

interface Funcionario {
  id: string
  nome: string
  cpf: string | null
  matricula: string | null
}

interface ArquivoClassificado {
  path: string            // caminho dentro do zip
  nome_arquivo: string
  funcionario_id: string
  funcionario_nome: string
  tipo: string            // categoria (ASO, RG, CPF, NR, contrato, etc)
  score: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  erro?: string
}

const EXTENSOES_OK = ['pdf', 'jpg', 'jpeg', 'png', 'webp']

function normalize(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9 ]/g, ' ')
}

function classificarTipo(filename: string): string | null {
  const fn = filename.toUpperCase()
  const ext = fn.split('.').pop()
  if (!ext || !EXTENSOES_OK.includes(ext.toLowerCase())) return null

  if (/\bASO\b|EXAME/.test(fn)) return 'ASO'
  if (/\bCTPS\b|CARTEIRA/.test(fn)) return 'CTPS'
  if (/\bRG\b/.test(fn)) return 'RG'
  if (/\bCPF\b/.test(fn)) return 'CPF'
  if (/\bPIS\b/.test(fn)) return 'PIS'
  if (/NR[-_ ]?(01|05|06|10|12|18|20|33|35)/.test(fn) || /\bNRS?\b/.test(fn)) return 'NR'
  if (/REGISTRO.*EMPREG/.test(fn)) return 'registro'
  if (/CONTRATO|PRORROGACAO|PRORROGAÇÃO/.test(fn)) return 'contrato'
  if (/ADMISSAO|ADMISSÃO/.test(fn)) return 'admissao'
  if (/FICHA.*EPI|\bEPI\b/.test(fn)) return 'EPI'
  if (/HOLERITE/.test(fn)) return 'holerite'
  if (/ESPELHO|\bPONTO\b|FOLHA.*PONTO/.test(fn)) return 'ponto'
  if (/ATESTADO/.test(fn)) return 'atestado'
  if (/TERMO/.test(fn)) return 'termo'
  if (/FERIAS|FÉRIAS/.test(fn)) return 'ferias'
  if (/\bVT\b|VALE/.test(fn)) return 'beneficio'
  if (/ESOCIAL|S2200/.test(fn)) return 'esocial'
  if (/DECLARACAO|DECLARAÇÃO/.test(fn)) return 'declaracao'
  if (/COMPROVANTE/.test(fn)) return 'comprovante'
  return 'outro'
}

function matchFuncionario(path: string, funcs: Funcionario[]): { fid: string; score: number } | null {
  const segments = path.split('/').map(normalize)
  let best: { fid: string; score: number } | null = null

  for (const f of funcs) {
    const tokens = normalize(f.nome).split(/\s+/).filter(Boolean)
    if (tokens.length === 0) continue
    const first = tokens[0]
    const second = tokens[1] ?? ''
    const last = tokens[tokens.length - 1]
    let score = 0
    for (const seg of segments) {
      const segTokens = seg.split(/\s+/).filter(Boolean)
      if (seg.includes(normalize(f.nome))) { score = 100; break }
      if (segTokens.includes(first) && last && segTokens.includes(last)) score = Math.max(score, 50)
      else if (segTokens.includes(first) && second && segTokens.includes(second)) score = Math.max(score, 40)
      else if (segTokens.includes(first) && segTokens.length <= 3) {
        // Só match se o primeiro nome for único entre os funcionários
        const dup = funcs.filter(x => normalize(x.nome).split(/\s+/)[0] === first).length
        if (dup === 1) score = Math.max(score, 30)
      }
    }
    if (!best || score > best.score) best = { fid: f.id, score }
  }
  return best && best.score >= 30 ? best : null
}

export default function ImportarDrivePage() {
  const supabase = createClient()
  const toast = useToast()
  const [funcs, setFuncs] = useState<Funcionario[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [classificados, setClassificados] = useState<ArquivoClassificado[]>([])
  const [naoClassificados, setNaoClassificados] = useState(0)
  const [importando, setImportando] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [zipRef, setZipRef] = useState<any>(null)
  const [filtroFunc, setFiltroFunc] = useState('')

  useEffect(() => {
    supabase.from('funcionarios').select('id,nome,cpf,matricula').is('deleted_at', null).order('nome')
      .then(({ data }) => setFuncs((data ?? []) as any))
  }, [])

  async function handleUpload(f: File) {
    setFile(f)
    setParsing(true)
    setClassificados([])

    try {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(f)
      setZipRef(zip)
      const items: ArquivoClassificado[] = []
      let semClass = 0
      let semMatch = 0

      zip.forEach((path, entry) => {
        if (entry.dir) return
        const tipo = classificarTipo(entry.name)
        if (!tipo) return
        const match = matchFuncionario(path, funcs)
        if (!match) { semMatch++; return }
        const func = funcs.find(x => x.id === match.fid)!
        const nomeArq = path.split('/').pop() ?? path
        items.push({
          path,
          nome_arquivo: nomeArq,
          funcionario_id: match.fid,
          funcionario_nome: func.nome,
          tipo,
          score: match.score,
          status: 'pending',
        })
      })

      items.sort((a, b) => a.funcionario_nome.localeCompare(b.funcionario_nome) || a.tipo.localeCompare(b.tipo))
      setClassificados(items)
      setNaoClassificados(semMatch)
      toast.success(`${items.length} arquivos classificados · ${semMatch} sem match`)
    } catch (e: any) {
      toast.error('Erro ao ler zip: ' + e.message)
    }
    setParsing(false)
  }

  async function handleImportar() {
    if (!zipRef || classificados.length === 0) return
    setImportando(true)
    setProgress({ done: 0, total: classificados.length })

    const atualizados = [...classificados]

    for (let i = 0; i < atualizados.length; i++) {
      const item = atualizados[i]
      try {
        item.status = 'uploading'
        setClassificados([...atualizados])

        // Extrai arquivo
        const entry = zipRef.file(item.path)
        if (!entry) { item.status = 'error'; item.erro = 'não encontrado no zip'; continue }
        const blob = await entry.async('blob')

        // Path no storage: funcionarios/{funcId}/drive/{timestamp}_{nome}
        const safeName = item.nome_arquivo.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath = `funcionarios/${item.funcionario_id}/drive/${Date.now()}_${i}_${safeName}`
        const { error: upErr } = await supabase.storage.from('documentos').upload(storagePath, blob, {
          upsert: false,
          contentType: item.nome_arquivo.toLowerCase().endsWith('.pdf') ? 'application/pdf' : undefined,
        })
        if (upErr) { item.status = 'error'; item.erro = upErr.message; continue }

        const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(storagePath)

        // Vencimento padrão: 1 ano (ASOs e NRs) ou 10 anos pra docs pessoais
        const vencAnos = ['ASO','NR','EPI','atestado','ferias'].includes(item.tipo) ? 1 : 10
        const venc = new Date()
        venc.setFullYear(venc.getFullYear() + vencAnos)
        const vencIso = venc.toISOString().split('T')[0]

        const { error: insErr } = await supabase.from('documentos').insert({
          funcionario_id: item.funcionario_id,
          tipo: item.tipo,
          vencimento: vencIso,
          arquivo_url: publicUrl,
          arquivo_nome: item.nome_arquivo,
          observacao: `Importado do drive · ${item.path}`,
        })
        if (insErr) { item.status = 'error'; item.erro = insErr.message; continue }

        item.status = 'done'
      } catch (e: any) {
        item.status = 'error'
        item.erro = e.message
      }
      setProgress({ done: i + 1, total: atualizados.length })
      setClassificados([...atualizados])
    }

    setImportando(false)
    const ok = atualizados.filter(x => x.status === 'done').length
    const err = atualizados.filter(x => x.status === 'error').length
    toast.success(`${ok} importados · ${err} com erro`)
  }

  const porFuncionario: Record<string, { total: number; done: number; error: number }> = {}
  classificados.forEach(c => {
    if (!porFuncionario[c.funcionario_nome]) porFuncionario[c.funcionario_nome] = { total: 0, done: 0, error: 0 }
    porFuncionario[c.funcionario_nome].total++
    if (c.status === 'done') porFuncionario[c.funcionario_nome].done++
    if (c.status === 'error') porFuncionario[c.funcionario_nome].error++
  })

  const filtrados = filtroFunc
    ? classificados.filter(c => c.funcionario_nome === filtroFunc)
    : classificados

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/admin/usuarios" />
        <Link href="/admin/usuarios" className="text-gray-400 hover:text-gray-600">Administrativo</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Importar documentos do drive</span>
      </div>

      <h1 className="text-xl font-bold font-display text-brand mb-1">Importar documentos do drive</h1>
      <p className="text-sm text-gray-500 mb-5">
        Faça upload de um arquivo .zip contendo as pastas dos funcionários (ex: OneDrive_2026-04-07.zip).
        A tela identifica os arquivos por nome, classifica por tipo (ASO, RG, NR, contratos, etc)
        e vincula ao funcionário correto.
      </p>

      {!file ? (
        <label className="block border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-brand hover:bg-brand/5 transition-colors">
          <input type="file" accept=".zip" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
          <div className="text-4xl mb-3">📦</div>
          <p className="text-base font-semibold text-gray-700">Clique para selecionar o .zip do drive</p>
          <p className="text-xs text-gray-400 mt-1">Tamanho sem limite · processa no browser, nada sai do seu computador antes de você confirmar</p>
        </label>
      ) : (
        <>
          <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl mb-4">
            <div>
              <p className="text-sm font-semibold">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <button onClick={() => { setFile(null); setClassificados([]); setZipRef(null) }}
              className="text-xs text-red-600 hover:underline">Trocar arquivo</button>
          </div>

          {parsing && <p className="text-sm text-gray-400">Processando zip...</p>}

          {!parsing && classificados.length > 0 && (
            <>
              {/* Resumo */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-white rounded-xl border border-gray-100 p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Classificados</p>
                  <p className="text-2xl font-bold text-brand">{classificados.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Funcionários</p>
                  <p className="text-2xl font-bold text-gray-700">{Object.keys(porFuncionario).length}</p>
                </div>
                <div className="bg-green-50 rounded-xl border border-green-200 p-3">
                  <p className="text-[10px] text-green-600 uppercase font-bold">Importados</p>
                  <p className="text-2xl font-bold text-green-700">{classificados.filter(c => c.status === 'done').length}</p>
                </div>
                <div className="bg-red-50 rounded-xl border border-red-200 p-3">
                  <p className="text-[10px] text-red-600 uppercase font-bold">Erro</p>
                  <p className="text-2xl font-bold text-red-700">{classificados.filter(c => c.status === 'error').length}</p>
                </div>
              </div>

              {/* Por funcionário */}
              <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-700">Por funcionário</h3>
                  {filtroFunc && <button onClick={() => setFiltroFunc('')} className="text-xs text-brand hover:underline">Limpar filtro</button>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(porFuncionario).sort(([a], [b]) => a.localeCompare(b)).map(([nome, s]) => (
                    <button key={nome} onClick={() => setFiltroFunc(filtroFunc === nome ? '' : nome)}
                      className={`text-[11px] px-2 py-1 rounded-full border ${
                        filtroFunc === nome ? 'bg-brand text-white border-brand' : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-brand'
                      }`}>
                      {nome.split(' ')[0]} {nome.split(' ').slice(-1)[0]} · <strong>{s.total}</strong>
                      {s.done > 0 && <span className="ml-1 text-green-600">✓{s.done}</span>}
                      {s.error > 0 && <span className="ml-1 text-red-600">✗{s.error}</span>}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">{naoClassificados} arquivos ignorados (sem match com nenhum funcionário ativo)</p>
              </div>

              {/* Importar button */}
              <div className="mb-4 flex items-center gap-3">
                <button onClick={handleImportar} disabled={importando}
                  className="px-6 py-2.5 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
                  {importando ? `Importando... ${progress.done}/${progress.total}` : `📥 Importar ${classificados.length} arquivos`}
                </button>
                {importando && (
                  <div className="flex-1">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand transition-all"
                        style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Lista detalhada */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">Status</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">Funcionário</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">Tipo</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">Arquivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtrados.slice(0, 300).map((c, i) => (
                        <tr key={i} className="border-t border-gray-50">
                          <td className="px-3 py-1.5">
                            {c.status === 'pending' && <span className="text-gray-400">•</span>}
                            {c.status === 'uploading' && <span className="text-amber-600">⟳</span>}
                            {c.status === 'done' && <span className="text-green-600 font-bold">✓</span>}
                            {c.status === 'error' && <span className="text-red-600" title={c.erro}>✗</span>}
                          </td>
                          <td className="px-3 py-1.5 text-gray-700">{c.funcionario_nome}</td>
                          <td className="px-3 py-1.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand/10 text-brand font-bold">{c.tipo}</span>
                          </td>
                          <td className="px-3 py-1.5 text-gray-500 truncate max-w-md" title={c.path}>{c.nome_arquivo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtrados.length > 300 && <p className="text-[10px] text-center text-gray-400 py-2">... e mais {filtrados.length - 300} linhas</p>}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

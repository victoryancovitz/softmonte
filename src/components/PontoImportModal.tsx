'use client'
import { useState } from 'react'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

interface Props {
  obraId: string
  obraNome: string
  mes: number
  ano: number
  onClose: () => void
  onImported: () => void
}

interface ParsedRow {
  funcionario_ref: string        // matricula, id_ponto ou nome
  data: string                   // YYYY-MM-DD
  tipo_dia: 'util' | 'sabado' | 'domingo_feriado'
  resolvido?: boolean
  funcionario_id?: string
  funcionario_nome?: string
  erro?: string
}

export default function PontoImportModal({ obraId, obraNome, mes, ano, onClose, onImported }: Props) {
  const supabase = createClient()
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [sobrescrever, setSobrescrever] = useState(false)
  const [importing, setImporting] = useState(false)

  function inferTipoDia(iso: string): 'util' | 'sabado' | 'domingo_feriado' {
    const d = new Date(iso + 'T12:00')
    const dow = d.getDay()
    if (dow === 0) return 'domingo_feriado'
    if (dow === 6) return 'sabado'
    return 'util'
  }

  async function parseFile(f: File) {
    setParsing(true)
    setRows([])
    try {
      const buf = await f.arrayBuffer()
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buf)
      const ws = wb.worksheets[0]
      if (!ws) throw new Error('Planilha vazia')

      // Detecta header: primeira linha não vazia
      let headerRow = 1
      for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
        const row = ws.getRow(r)
        if (row.values && (row.values as any[]).filter(Boolean).length >= 2) { headerRow = r; break }
      }
      const headers: string[] = []
      const hRow = ws.getRow(headerRow)
      hRow.eachCell((cell, col) => { headers[col] = String(cell.value ?? '').trim().toLowerCase() })

      // Detecta colunas relevantes
      const findCol = (...opts: string[]) => {
        for (let c = 1; c < headers.length; c++) {
          const h = headers[c] ?? ''
          if (opts.some(o => h.includes(o))) return c
        }
        return -1
      }
      const colFunc = findCol('matricula', 'matrícula', 'id ponto', 'id_ponto', 'idponto', 'funcion', 'nome', 'colaborador')
      const colData = findCol('data', 'dia')
      const colTipo = findCol('tipo', 'status', 'ocorr')

      if (colFunc === -1 || colData === -1) {
        throw new Error('Não encontrei as colunas "Funcionário/Matrícula" e "Data". A planilha precisa ter pelo menos essas duas colunas.')
      }

      const parsed: ParsedRow[] = []
      for (let r = headerRow + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r)
        const rawFunc = row.getCell(colFunc).value
        const rawData = row.getCell(colData).value
        const rawTipo = colTipo > 0 ? row.getCell(colTipo).value : null

        if (!rawFunc || !rawData) continue

        let dataIso = ''
        if (rawData instanceof Date) {
          dataIso = rawData.toISOString().slice(0, 10)
        } else {
          const s = String(rawData).trim()
          // Tenta parsear dd/mm/yyyy ou yyyy-mm-dd
          const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
          if (m1) {
            const [, d, m, y] = m1
            const yy = y.length === 2 ? '20' + y : y
            dataIso = `${yy}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
          } else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
            dataIso = s.slice(0, 10)
          }
        }
        if (!dataIso) continue

        // Filtrar para o período selecionado
        const mesAno = dataIso.slice(0, 7)
        const periodoSel = `${ano}-${String(mes).padStart(2, '0')}`
        if (mesAno !== periodoSel) continue

        let tipo: 'util' | 'sabado' | 'domingo_feriado' = inferTipoDia(dataIso)
        if (rawTipo) {
          const t = String(rawTipo).toLowerCase().trim()
          if (t.includes('feriado') || t.includes('domingo')) tipo = 'domingo_feriado'
          else if (t.includes('sabado') || t.includes('sábado')) tipo = 'sabado'
          else if (t.includes('util') || t === 'p' || t === 'presente' || t === 'x') tipo = inferTipoDia(dataIso)
        }

        parsed.push({
          funcionario_ref: String(rawFunc).trim(),
          data: dataIso,
          tipo_dia: tipo,
        })
      }

      if (parsed.length === 0) {
        throw new Error(`Nenhuma linha válida encontrada para ${String(mes).padStart(2,'0')}/${ano}. Verifique as datas.`)
      }

      // Resolve funcionarios
      const refs = Array.from(new Set(parsed.map(p => p.funcionario_ref)))
      const { data: funcs } = await supabase
        .from('funcionarios')
        .select('id, nome, nome_guerra, matricula, id_ponto')
      const fMap: Record<string, { id: string; nome: string }> = {}
      const normalize = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase()
      refs.forEach(ref => {
        const nRef = normalize(ref)
        const hit = (funcs ?? []).find((f: any) =>
          (f.matricula && normalize(f.matricula) === nRef) ||
          (f.id_ponto && normalize(f.id_ponto) === nRef) ||
          (f.nome && normalize(f.nome).includes(nRef) && nRef.length > 3) ||
          (f.nome_guerra && normalize(f.nome_guerra) === nRef)
        ) as any
        if (hit) fMap[ref] = { id: hit.id, nome: hit.nome_guerra ?? hit.nome }
      })

      parsed.forEach(p => {
        const f = fMap[p.funcionario_ref]
        if (f) { p.funcionario_id = f.id; p.funcionario_nome = f.nome; p.resolvido = true }
        else { p.erro = 'Funcionário não encontrado'; p.resolvido = false }
      })

      setRows(parsed)
      toast.success(`${parsed.length} linhas lidas (${parsed.filter(p => p.resolvido).length} com funcionário identificado)`)
    } catch (e: any) {
      toast.error('Erro ao ler planilha: ' + e.message)
    }
    setParsing(false)
  }

  async function handleImport() {
    const validas = rows.filter(r => r.resolvido && r.funcionario_id)
    if (validas.length === 0) { toast.error('Nenhuma linha válida'); return }
    setImporting(true)

    // Se sobrescrever: deleta efetivo existente do período primeiro
    if (sobrescrever) {
      const dateStart = `${ano}-${String(mes).padStart(2, '0')}-01`
      const lastDay = new Date(ano, mes, 0).getDate()
      const dateEnd = `${ano}-${String(mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      const { error: delErr } = await supabase.from('efetivo_diario')
        .delete()
        .eq('obra_id', obraId)
        .gte('data', dateStart).lte('data', dateEnd)
      if (delErr) { toast.error('Erro ao limpar período: ' + delErr.message); setImporting(false); return }
    }

    // Inserir em batches
    const batch = validas.map(v => ({
      obra_id: obraId,
      funcionario_id: v.funcionario_id!,
      data: v.data,
      tipo_dia: v.tipo_dia,
    }))

    // Chunk de 500
    for (let i = 0; i < batch.length; i += 500) {
      const chunk = batch.slice(i, i + 500)
      const { error } = await supabase.from('efetivo_diario').upsert(chunk, {
        onConflict: 'obra_id,funcionario_id,data',
        ignoreDuplicates: !sobrescrever,
      })
      if (error) {
        toast.error(`Erro no lote ${i / 500 + 1}: ${error.message}`)
        setImporting(false)
        return
      }
    }

    setImporting(false)
    toast.success(`${validas.length} registros importados`)
    onImported()
    onClose()
  }

  const validas = rows.filter(r => r.resolvido).length
  const invalidas = rows.length - validas

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-brand">Importar folha de ponto</h2>
          <p className="text-xs text-gray-500 mt-1">
            Obra: <strong>{obraNome}</strong> · Período: <strong>{String(mes).padStart(2,'0')}/{ano}</strong>
          </p>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 mb-4">
            <p className="font-bold mb-1">Formato esperado:</p>
            <p>A planilha deve ter ao menos duas colunas: uma com <strong>Matrícula</strong>, <strong>ID Ponto</strong> ou <strong>Nome</strong> do funcionário, e outra com a <strong>Data</strong> (dd/mm/aaaa).</p>
            <p className="mt-1">Coluna opcional: <strong>Tipo</strong> (útil / sábado / domingo_feriado). Se ausente, o tipo é inferido do dia da semana.</p>
            <p className="mt-1 text-blue-600">Só serão consideradas linhas com data dentro do período selecionado.</p>
          </div>

          {!file ? (
            <label className="block border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-brand hover:bg-brand/5 transition-colors">
              <input type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) { setFile(f); parseFile(f) }
                }} />
              <div className="text-3xl mb-2">📥</div>
              <p className="text-sm font-semibold text-gray-700">Clique ou arraste um arquivo .xlsx</p>
              <p className="text-xs text-gray-400 mt-1">Planilhas do Excel apenas</p>
            </label>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3 p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-semibold">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={() => { setFile(null); setRows([]) }} className="text-xs text-red-600 hover:underline">Trocar arquivo</button>
              </div>

              {parsing && <p className="text-sm text-gray-400">Lendo planilha...</p>}

              {rows.length > 0 && (
                <>
                  <div className="flex gap-3 mb-3">
                    <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-green-600 font-bold uppercase">Válidas</p>
                      <p className="text-xl font-bold text-green-700">{validas}</p>
                    </div>
                    <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-red-600 font-bold uppercase">Com erro</p>
                      <p className="text-xl font-bold text-red-700">{invalidas}</p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 mb-3 text-sm cursor-pointer">
                    <input type="checkbox" checked={sobrescrever} onChange={e => setSobrescrever(e.target.checked)} />
                    <span>Sobrescrever registros existentes do período (apaga antes de importar)</span>
                  </label>

                  <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-2 py-1.5 font-semibold text-gray-600">Funcionário</th>
                          <th className="text-left px-2 py-1.5 font-semibold text-gray-600">Data</th>
                          <th className="text-left px-2 py-1.5 font-semibold text-gray-600">Tipo</th>
                          <th className="text-left px-2 py-1.5 font-semibold text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 100).map((r, i) => (
                          <tr key={i} className={`border-t border-gray-50 ${!r.resolvido ? 'bg-red-50' : ''}`}>
                            <td className="px-2 py-1">{r.funcionario_nome ?? r.funcionario_ref}</td>
                            <td className="px-2 py-1 text-gray-500">{new Date(r.data + 'T12:00').toLocaleDateString('pt-BR')}</td>
                            <td className="px-2 py-1 text-gray-500">{r.tipo_dia}</td>
                            <td className="px-2 py-1">
                              {r.resolvido ? <span className="text-green-600">✓</span> : <span className="text-red-600 text-[10px]">{r.erro}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rows.length > 100 && <p className="text-[10px] text-center text-gray-400 py-1">... e mais {rows.length - 100} linhas</p>}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-2 justify-end">
          <button onClick={onClose} disabled={importing}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={handleImport} disabled={importing || validas === 0}
            className="px-6 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-50">
            {importing ? 'Importando...' : `Importar ${validas} registros`}
          </button>
        </div>
      </div>
    </div>
  )
}

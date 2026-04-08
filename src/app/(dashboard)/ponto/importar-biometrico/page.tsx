'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import { Upload, AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react'

interface LinhaImportada {
  data: string
  matricula: string
  entrada?: string
  saida_almoco?: string
  volta_almoco?: string
  saida?: string
  funcionario_id?: string
  funcionario_nome?: string
  erro?: string
  calc?: any
  sucesso?: boolean
}

// Campos esperados no XLSX (aliases comuns)
const ALIASES: Record<string, string[]> = {
  data:         ['data', 'dia', 'date'],
  matricula:    ['matricula', 'matrícula', 'mat', 'id', 'idponto', 'id_ponto', 're'],
  entrada:      ['entrada', 'ent', 'inicio', 'início', 'e1'],
  saida_almoco: ['saida_almoco', 'saída almoço', 'saida almoco', 'almoco_saida', 'almoço saída', 'inicio almoco', 's1', 'inicio_intervalo'],
  volta_almoco: ['volta_almoco', 'volta almoço', 'volta almoco', 'almoco_volta', 'retorno', 'fim_almoco', 'fim almoço', 'e2', 'fim_intervalo'],
  saida:        ['saida', 'saída', 'sai', 'fim', 'termino', 'término', 's2'],
}

function normalizeKey(k: string): string {
  return (k || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')
}

function findColumn(header: string[], aliases: string[]): number {
  for (let i = 0; i < header.length; i++) {
    const h = normalizeKey(header[i])
    if (aliases.some(a => normalizeKey(a) === h)) return i
  }
  return -1
}

function parseTimeCell(v: any): string | undefined {
  if (v == null || v === '') return undefined
  if (typeof v === 'string') {
    const m = v.match(/(\d{1,2}):(\d{2})/)
    if (m) return `${m[1].padStart(2, '0')}:${m[2]}`
  }
  if (typeof v === 'number') {
    // Excel time fraction
    const totalMin = Math.round(v * 24 * 60)
    const h = Math.floor(totalMin / 60) % 24
    const m = totalMin % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  if (v instanceof Date) {
    return `${String(v.getHours()).padStart(2, '0')}:${String(v.getMinutes()).padStart(2, '0')}`
  }
  return undefined
}

function parseDateCell(v: any): string | undefined {
  if (!v) return undefined
  if (typeof v === 'string') {
    // DD/MM/YYYY ou DD/MM/YY
    const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
    if (br) {
      const yy = br[3].length === 2 ? '20' + br[3] : br[3]
      return `${yy}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
    }
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10)
  }
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  if (typeof v === 'number') {
    // Excel serial date
    const epoch = new Date(Date.UTC(1899, 11, 30))
    const d = new Date(epoch.getTime() + v * 86400000)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }
  return undefined
}

export default function ImportarBiometricoPage() {
  const [obras, setObras] = useState<any[]>([])
  const [obraId, setObraId] = useState('')
  const [obra, setObra] = useState<any>(null)
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [linhas, setLinhas] = useState<LinhaImportada[]>([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [filename, setFilename] = useState('')
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    supabase.from('obras')
      .select('id,nome,modelo_cobranca,escala_entrada,escala_saida_seg_qui,escala_saida_sex,escala_almoco_minutos,escala_tolerancia_min')
      .eq('status', 'ativo').is('deleted_at', null).order('nome')
      .then(({ data }) => setObras(data || []))
  }, [])

  useEffect(() => {
    if (!obraId) { setObra(null); setFuncionarios([]); return }
    const o = obras.find(x => x.id === obraId)
    setObra(o)
    // Buscar funcionários alocados na obra com id_ponto ou matrícula
    supabase.from('alocacoes')
      .select('funcionario_id, funcionarios(id, nome, matricula, id_ponto, cpf)')
      .eq('obra_id', obraId).eq('ativo', true)
      .then(({ data }) => {
        const funcs = (data || []).map((a: any) => a.funcionarios).filter(Boolean)
        setFuncionarios(funcs)
      })
  }, [obraId, obras])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!obraId) { toast.error('Selecione a obra antes de importar'); e.target.value = ''; return }
    setParsing(true)
    setFilename(file.name)
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())
      const ws = wb.worksheets[0]
      if (!ws) throw new Error('Planilha vazia')

      // Assume primeira linha como cabeçalho
      const headerRow = ws.getRow(1).values as any[]
      const header = headerRow.slice(1).map(v => String(v ?? ''))

      const colData = findColumn(header, ALIASES.data)
      const colMat = findColumn(header, ALIASES.matricula)
      const colEnt = findColumn(header, ALIASES.entrada)
      const colSai1 = findColumn(header, ALIASES.saida_almoco)
      const colVol = findColumn(header, ALIASES.volta_almoco)
      const colSai2 = findColumn(header, ALIASES.saida)

      if (colData === -1 || colMat === -1) {
        throw new Error('Colunas obrigatórias não encontradas: data, matrícula. Cabeçalho detectado: ' + header.join(', '))
      }

      const result: LinhaImportada[] = []
      for (let i = 2; i <= ws.rowCount; i++) {
        const row = ws.getRow(i).values as any[]
        if (!row || row.length === 0) continue
        const vals = row.slice(1)
        const data = parseDateCell(vals[colData])
        const matricula = String(vals[colMat] ?? '').trim()
        if (!data || !matricula) continue

        // Match por matricula OU id_ponto
        const func = funcionarios.find(f =>
          String(f.matricula || '').trim() === matricula ||
          String(f.id_ponto || '').trim() === matricula
        )

        const linha: LinhaImportada = {
          data,
          matricula,
          entrada: colEnt >= 0 ? parseTimeCell(vals[colEnt]) : undefined,
          saida_almoco: colSai1 >= 0 ? parseTimeCell(vals[colSai1]) : undefined,
          volta_almoco: colVol >= 0 ? parseTimeCell(vals[colVol]) : undefined,
          saida: colSai2 >= 0 ? parseTimeCell(vals[colSai2]) : undefined,
        }
        if (func) {
          linha.funcionario_id = func.id
          linha.funcionario_nome = func.nome
        } else {
          linha.erro = 'Matrícula não encontrada em funcionários alocados nesta obra'
        }
        result.push(linha)
      }
      setLinhas(result)
      toast.success(`${result.length} linhas parseadas (${result.filter(r => r.funcionario_id).length} identificadas)`)
    } catch (err: any) {
      toast.error('Erro ao ler arquivo: ' + err.message)
    } finally {
      setParsing(false)
      e.target.value = ''
    }
  }

  async function importar() {
    if (!obra) return
    setImporting(true)
    let ok = 0
    let fail = 0
    const novo = [...linhas]
    for (let i = 0; i < novo.length; i++) {
      const l = novo[i]
      if (!l.funcionario_id || l.erro) { fail++; continue }
      try {
        const diaSem = new Date(l.data + 'T12:00').getDay()
        const tipoDia = diaSem === 6 ? 'sabado' : (diaSem === 0 ? 'domingo_feriado' : 'util')
        const escalaSaida = diaSem === 5 ? obra.escala_saida_sex : obra.escala_saida_seg_qui
        const { data: calc, error: cErr } = await supabase.rpc('calcular_horas_ponto', {
          p_entrada: l.entrada || null,
          p_saida_almoco: l.saida_almoco || null,
          p_volta_almoco: l.volta_almoco || null,
          p_saida: l.saida || null,
          p_escala_entrada: obra.escala_entrada || '07:00',
          p_escala_saida: escalaSaida || '17:00',
          p_almoco_minutos: obra.escala_almoco_minutos || 60,
          p_tolerancia_min: obra.escala_tolerancia_min || 10,
          p_tipo_dia: tipoDia,
        })
        if (cErr) throw cErr
        l.calc = calc

        // Delete existing + insert
        await supabase.from('efetivo_diario')
          .delete()
          .eq('funcionario_id', l.funcionario_id)
          .eq('obra_id', obraId)
          .eq('data', l.data)

        const { data: { user } } = await supabase.auth.getUser()
        const { error: upErr } = await supabase.from('efetivo_diario').insert({
          funcionario_id: l.funcionario_id,
          obra_id: obraId,
          data: l.data,
          tipo_dia: tipoDia,
          horas_normais: calc?.horas_normais ?? 0,
          horas_extras_50: calc?.horas_extras_50 ?? 0,
          horas_extras_100: calc?.horas_extras_100 ?? 0,
          horas_trabalhadas: (Number(calc?.horas_normais || 0) + Number(calc?.horas_extras_50 || 0) + Number(calc?.horas_extras_100 || 0)),
          entrada: l.entrada || null,
          saida_almoco: l.saida_almoco || null,
          volta_almoco: l.volta_almoco || null,
          saida: l.saida || null,
          atraso_minutos: calc?.atraso_minutos || 0,
          horas_previstas: calc?.escala_minutos ? calc.escala_minutos / 60 : null,
          origem_registro: 'biometrico',
          registrado_por: user?.id ?? null,
        })
        if (upErr) throw upErr
        l.sucesso = true
        ok++
      } catch (err: any) {
        l.erro = err.message
        fail++
      }
      if (i % 10 === 0) setLinhas([...novo])
    }
    setLinhas(novo)
    setImporting(false)
    toast.success(`Importação concluída: ${ok} ok · ${fail} falhas`)
  }

  const identificadas = linhas.filter(l => l.funcionario_id && !l.erro).length
  const comErro = linhas.filter(l => l.erro).length

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/ponto" />
        <Link href="/ponto" className="text-gray-400 hover:text-gray-600">Ponto</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Importar Biométrico</span>
      </div>

      <h1 className="text-xl font-bold font-display text-brand mb-1">Importar ponto do relógio biométrico</h1>
      <p className="text-sm text-gray-500 mb-6">
        Upload de XLSX do relógio com colunas: data, matrícula, entrada, saída almoço, volta almoço, saída.
        O sistema calcula as horas normais/extras/atrasos conforme a escala da obra.
      </p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Obra *</label>
            <select value={obraId} onChange={e => setObraId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">— Selecione a obra —</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>
                  {o.nome} · {o.modelo_cobranca === 'hh_diaria' ? 'HH-Diária' : o.modelo_cobranca === 'hh_hora_efetiva' ? 'HH-Hora Efetiva' : 'HH-220'}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className={`w-full px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold text-center cursor-pointer hover:bg-brand-dark flex items-center justify-center gap-2 ${parsing || !obraId ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload className="w-4 h-4" />
              {parsing ? 'Lendo...' : 'Escolher XLSX'}
              <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" disabled={parsing || !obraId} />
            </label>
          </div>
        </div>
        {obra && (
          <p className="text-[11px] text-gray-500 mt-3">
            Escala da obra: {obra.escala_entrada} → {obra.escala_saida_seg_qui} (seg-qui) / {obra.escala_saida_sex} (sex) ·
            almoço {obra.escala_almoco_minutos}min · tolerância {obra.escala_tolerancia_min}min
          </p>
        )}
        {filename && (
          <p className="text-[11px] text-gray-500 mt-1">Arquivo: {filename}</p>
        )}
      </div>

      {linhas.length > 0 && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="text-[11px] font-bold text-gray-400 uppercase">Total de linhas</div>
              <div className="text-2xl font-bold text-gray-900 font-display">{linhas.length}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-green-500 p-4">
              <div className="text-[11px] font-bold text-gray-400 uppercase">Identificadas</div>
              <div className="text-2xl font-bold text-green-700 font-display">{identificadas}</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 border-l-4 border-l-red-500 p-4">
              <div className="text-[11px] font-bold text-gray-400 uppercase">Com erro</div>
              <div className="text-2xl font-bold text-red-700 font-display">{comErro}</div>
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            <button onClick={importar} disabled={importing || identificadas === 0}
              className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brand-dark disabled:opacity-50 flex items-center gap-2">
              {importing && <Loader2 className="w-4 h-4 animate-spin" />}
              Importar {identificadas} linha{identificadas !== 1 ? 's' : ''}
            </button>
            <button onClick={() => setLinhas([])} disabled={importing}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">
              Limpar
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Data', 'Matrícula', 'Funcionário', 'Entrada', 'Sai almoço', 'Volta', 'Saída', 'Normais', 'HE70', 'HE100', 'Atraso', 'Status'].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.slice(0, 200).map((l, i) => (
                  <tr key={i} className={`border-b border-gray-50 ${l.erro ? 'bg-red-50/30' : l.sucesso ? 'bg-green-50/30' : ''}`}>
                    <td className="px-3 py-1.5 font-mono">{l.data ? new Date(l.data + 'T12:00').toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-600">{l.matricula}</td>
                    <td className="px-3 py-1.5">{l.funcionario_nome || <span className="text-red-600 italic">—</span>}</td>
                    <td className="px-3 py-1.5 font-mono">{l.entrada || '—'}</td>
                    <td className="px-3 py-1.5 font-mono">{l.saida_almoco || '—'}</td>
                    <td className="px-3 py-1.5 font-mono">{l.volta_almoco || '—'}</td>
                    <td className="px-3 py-1.5 font-mono">{l.saida || '—'}</td>
                    <td className="px-3 py-1.5 font-bold">{l.calc?.horas_normais ?? '—'}</td>
                    <td className="px-3 py-1.5 text-amber-700">{l.calc?.horas_extras_50 ?? '—'}</td>
                    <td className="px-3 py-1.5 text-red-700">{l.calc?.horas_extras_100 ?? '—'}</td>
                    <td className="px-3 py-1.5 text-red-600">{l.calc?.atraso_minutos ? `${l.calc.atraso_minutos}min` : '—'}</td>
                    <td className="px-3 py-1.5">
                      {l.sucesso && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                      {l.erro && <span title={l.erro}><AlertTriangle className="w-4 h-4 text-red-600" /></span>}
                      {!l.sucesso && !l.erro && <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {linhas.length > 200 && (
              <p className="text-center text-xs text-gray-400 py-2">+ {linhas.length - 200} linhas omitidas na visualização</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

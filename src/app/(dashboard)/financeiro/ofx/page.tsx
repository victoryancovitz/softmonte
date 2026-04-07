'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import { Upload, Link2, CheckCircle2, X } from 'lucide-react'

// Parser OFX simples (regex — cobre Bradesco/Itaú/Santander padrão)
function parseOFX(text: string) {
  const trans: any[] = []
  const re = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const body = m[1]
    const get = (tag: string) => {
      const r = new RegExp(`<${tag}>([^<\\n\\r]+)`, 'i').exec(body)
      return r ? r[1].trim() : ''
    }
    const dt = get('DTPOSTED').slice(0, 8)
    const data = dt.length === 8 ? `${dt.slice(0,4)}-${dt.slice(4,6)}-${dt.slice(6,8)}` : null
    const valor = parseFloat(get('TRNAMT'))
    if (!data || !isFinite(valor)) continue
    trans.push({
      fit_id: get('FITID'),
      data,
      valor,
      tipo: valor >= 0 ? 'credito' : 'debito',
      descricao: get('MEMO') || get('NAME') || '',
      memo: get('MEMO'),
    })
  }
  return trans
}

export default function OfxPage() {
  const [imports, setImports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    supabase.from('ofx_imports').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setImports(data || []); setLoading(false)
    })
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProcessing(true)
    try {
      const text = await file.text()
      const trans = parseOFX(text)
      if (trans.length === 0) { toast.error('Nenhuma transação encontrada no OFX'); setProcessing(false); return }

      const { data: { user } } = await supabase.auth.getUser()
      const datas = trans.map(t => t.data).sort()
      const { data: imp, error } = await supabase.from('ofx_imports').insert({
        arquivo_nome: file.name,
        periodo_inicio: datas[0],
        periodo_fim: datas[datas.length - 1],
        total_transacoes: trans.length,
        created_by: user?.id ?? null,
      }).select().single()
      if (error) throw error

      const { error: tErr } = await supabase.from('ofx_transacoes').insert(
        trans.map(t => ({ ...t, import_id: imp.id }))
      )
      if (tErr) throw tErr

      toast.success(`${trans.length} transações importadas`)
      const { data: imps } = await supabase.from('ofx_imports').select('*').order('created_at', { ascending: false })
      setImports(imps || [])
    } catch (err: any) {
      toast.error('Erro: ' + err.message)
    } finally {
      setProcessing(false)
      e.target.value = ''
    }
  }

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/financeiro" />
        <Link href="/financeiro" className="text-gray-400 hover:text-gray-600">Financeiro</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Conciliação OFX</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand mb-1">Conciliação Bancária (OFX)</h1>
          <p className="text-sm text-gray-500">Importe o extrato do banco e concilie com os lançamentos em aberto.</p>
        </div>
        <label className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark cursor-pointer flex items-center gap-2">
          <Upload className="w-4 h-4" />
          {processing ? 'Processando...' : 'Importar OFX'}
          <input type="file" accept=".ofx,.OFX" onChange={handleUpload} className="hidden" disabled={processing} />
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Arquivo', 'Período', 'Transações', 'Conciliadas', 'Importado em', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {imports.length > 0 ? imports.map(i => (
              <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                <td className="px-4 py-3 font-medium">{i.arquivo_nome}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {i.periodo_inicio ? new Date(i.periodo_inicio + 'T12:00').toLocaleDateString('pt-BR') : '—'} → {i.periodo_fim ? new Date(i.periodo_fim + 'T12:00').toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-3 font-semibold">{i.total_transacoes}</td>
                <td className="px-4 py-3 text-green-700 font-semibold">{i.total_conciliadas} / {i.total_transacoes}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(i.created_at).toLocaleString('pt-BR')}</td>
                <td className="px-4 py-3">
                  <Link href={`/financeiro/ofx/${i.id}`} className="text-xs text-brand font-semibold hover:underline">Conciliar</Link>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p>Nenhum OFX importado.</p>
                <p className="text-xs mt-1">Exporte o extrato do banco em formato OFX e clique em "Importar OFX".</p>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

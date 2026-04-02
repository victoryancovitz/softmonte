'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Printer,
  Users,
  Check,
  X,
  FileText,
  AlertTriangle,
  Megaphone,
  Search,
  Eye,
} from 'lucide-react'

type Modelo = {
  id: string
  nome: string
  categoria: 'termo' | 'advertencia' | 'comunicado'
  descricao: string
  conteudo: string
  variaveis: Variavel[]
}

type Variavel = {
  key: string
  label: string
  tipo: 'funcionario' | 'manual' | 'data'
  campo?: string
}

type Funcionario = {
  id: string
  nome: string
  cpf?: string
  data_admissao?: string
  funcoes?: { nome: string }
}

const CATEGORIA_ICON = {
  termo: FileText,
  advertencia: AlertTriangle,
  comunicado: Megaphone
}

const CATEGORIA_COR = {
  termo: 'text-blue-600 bg-blue-50',
  advertencia: 'text-amber-600 bg-amber-50',
  comunicado: 'text-purple-600 bg-purple-50'
}

function formatarData(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function aplicarVariaveis(template: string, vars: Record<string, string>): string {
  let resultado = template
  Object.entries(vars).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    resultado = resultado.replace(regex, value || `<span style="background:#ffe4e4;padding:0 4px;border-radius:3px;">{{${key}}}</span>`)
  })
  resultado = resultado.replace(/\{\{([^}]+)\}\}/g, '<span style="background:#ffe4e4;padding:0 4px;border-radius:3px;">{{$1}}</span>')
  return resultado
}

function getFuncionarioValue(func: Funcionario, campo: string): string {
  switch (campo) {
    case 'nome': return func.nome || ''
    case 'cpf': return func.cpf || ''
    case 'funcao': return func.funcoes?.nome || ''
    case 'data_admissao': return func.data_admissao
      ? new Date(func.data_admissao + 'T00:00:00').toLocaleDateString('pt-BR')
      : ''
    default: return ''
  }
}

export default function GerarDocumentoPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [modelo, setModelo] = useState<Modelo | null>(null)
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [camposManual, setCamposManual] = useState<Record<string, string>>({})
  const [buscaFunc, setBuscaFunc] = useState('')
  const [docAtivo, setDocAtivo] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!camposManual.DATA_DOCUMENTO) {
      setCamposManual(prev => ({ ...prev, DATA_DOCUMENTO: formatarData(new Date()) }))
    }
  }, [])

  useEffect(() => {
    async function load() {
      const [{ data: modeloData }, { data: funcData }] = await Promise.all([
        supabase.from('modelos_documentos').select('*').eq('id', params.id).single(),
        supabase.from('funcionarios').select('id, nome, cpf, admissao, funcao_id, cargo').order('nome')
      ])
      // Map fields to expected shape
      const mapped = (funcData || []).map((f: any) => ({
        ...f,
        data_admissao: f.admissao,
        funcoes: f.cargo ? { nome: f.cargo } : undefined,
      }))
      setModelo(modeloData)
      setFuncionarios(mapped)
      setLoading(false)
    }
    load()
  }, [params.id])

  const funcFiltrados = funcionarios.filter(f =>
    f.nome.toLowerCase().includes(buscaFunc.toLowerCase())
  )

  const toggleFuncionario = (id: string) => {
    setSelecionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const getVarsParaFuncionario = (func: Funcionario): Record<string, string> => {
    const vars: Record<string, string> = { ...camposManual }
    modelo?.variaveis?.forEach(v => {
      if (v.tipo === 'funcionario' && v.campo) {
        vars[v.key] = getFuncionarioValue(func, v.campo)
      }
    })
    return vars
  }

  const funcsSelecionadas = funcionarios.filter(f => selecionados.includes(f.id))
  const variavelManual = modelo?.variaveis?.filter(v => v.tipo === 'manual') || []
  const variavelData = modelo?.variaveis?.filter(v => v.tipo === 'data') || []

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const documentos = funcsSelecionadas.map(func => {
      const vars = getVarsParaFuncionario(func)
      const conteudo = aplicarVariaveis(modelo!.conteudo, vars)
      return `
        <div style="page-break-after: always;">
          <div style="border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 24px; text-align: center;">
            <p style="margin:0; font-size:11px; color:#666; text-transform:uppercase; letter-spacing:1px;">TECNOMONTE FABRICAÇÃO E MONTAGENS DE TANQUES INDUSTRIAIS LTDA</p>
            <p style="margin:4px 0 0; font-size:9px; color:#999;">CNPJ: 31.045.857/0001-51 | Rua Amazonas, 1262, Centro – Avaré/SP</p>
          </div>
          ${conteudo}
        </div>
      `
    }).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>${modelo?.nome}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 12px; color: #000; }
          div[style*="page-break"] { padding: 40px 50px; max-width: 800px; margin: 0 auto; }
          h2 { font-size: 14px; text-align: center; text-transform: uppercase; margin-bottom: 20px; }
          h3 { font-size: 13px; margin: 16px 0 8px; }
          p { margin-bottom: 12px; line-height: 1.6; text-align: justify; }
          ol, ul { margin: 12px 0 12px 20px; }
          li { margin-bottom: 6px; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; margin: 16px 0; }
          td, th { border: 1px solid #000; padding: 6px 8px; font-size: 11px; }
          th { background: #f0f0f0; font-weight: bold; text-align: center; }
          @media print { body { font-size: 11px; } div[style*="page-break"] { padding: 20px 30px; } }
        </style>
      </head>
      <body>${documentos}<script>window.onload=()=>window.print()</script></body>
      </html>
    `)
    printWindow.document.close()
  }

  if (loading) return <div className="p-6 flex items-center justify-center h-64"><div className="text-gray-400">Carregando...</div></div>
  if (!modelo) return (
    <div className="p-6">
      <p className="text-red-500 text-sm">Modelo não encontrado.</p>
      <Link href="/documentos/gerar" className="text-brand hover:underline text-sm mt-2 inline-block">Voltar</Link>
    </div>
  )

  const Icon = CATEGORIA_ICON[modelo.categoria]
  const corClass = CATEGORIA_COR[modelo.categoria]
  const funcAtiva = funcsSelecionadas[docAtivo] || null
  const varsPreview = funcAtiva ? getVarsParaFuncionario(funcAtiva) : { ...camposManual }
  const previewHtml = aplicarVariaveis(modelo.conteudo, varsPreview)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/documentos/gerar" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className={`p-1.5 rounded-lg ${corClass}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900 text-sm">{modelo.nome}</h1>
              <p className="text-xs text-gray-400 capitalize">{modelo.categoria}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {funcsSelecionadas.length > 0 && (
              <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
                {funcsSelecionadas.length} {funcsSelecionadas.length === 1 ? 'documento' : 'documentos'}
              </span>
            )}
            <button
              onClick={handlePrint}
              disabled={funcsSelecionadas.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir / PDF
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-[340px,1fr] gap-6">
        {/* Left panel */}
        <div className="space-y-4">
          {/* Employee selection */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="font-medium text-sm text-gray-800">Funcionários</span>
              </div>
              {selecionados.length > 0 && (
                <button onClick={() => setSelecionados([])} className="text-xs text-red-500 hover:text-red-700">
                  Limpar ({selecionados.length})
                </button>
              )}
            </div>
            <div className="p-3">
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input type="text" placeholder="Buscar funcionário..." value={buscaFunc}
                  onChange={e => setBuscaFunc(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1">
                {funcFiltrados.map(func => {
                  const sel = selecionados.includes(func.id)
                  return (
                    <button key={func.id} onClick={() => toggleFuncionario(func.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors text-sm ${
                        sel ? 'bg-blue-50 text-blue-800' : 'hover:bg-gray-50 text-gray-700'
                      }`}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                        sel ? 'bg-brand border-brand' : 'border-gray-300'
                      }`}>
                        {sel && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-xs truncate">{func.nome}</p>
                        <p className="text-xs text-gray-400 truncate">{func.funcoes?.nome || '—'}</p>
                      </div>
                    </button>
                  )
                })}
                {funcFiltrados.length === 0 && <p className="text-center text-xs text-gray-400 py-4">Nenhum funcionário encontrado</p>}
              </div>
              {selecionados.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Documentos a gerar:</p>
                  <div className="flex flex-wrap gap-1">
                    {funcsSelecionadas.map((f, i) => (
                      <button key={f.id} onClick={() => setDocAtivo(i)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                          docAtivo === i ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                        {f.nome.split(' ')[0]}
                        <span onClick={e => { e.stopPropagation(); toggleFuncionario(f.id) }} className="ml-0.5 hover:text-red-400">
                          <X className="w-3 h-3" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Manual fields */}
          {(variavelManual.length > 0 || variavelData.length > 0) && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <span className="font-medium text-sm text-gray-800">Campos do Documento</span>
                <p className="text-xs text-gray-400 mt-0.5">Iguais para todos os funcionários</p>
              </div>
              <div className="p-4 space-y-3">
                {variavelData.map(v => (
                  <div key={v.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{v.label}</label>
                    <input type="text" value={camposManual[v.key] || ''}
                      onChange={e => setCamposManual(prev => ({ ...prev, [v.key]: e.target.value }))}
                      placeholder={formatarData(new Date())}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
                  </div>
                ))}
                {variavelManual.map(v => (
                  <div key={v.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{v.label}</label>
                    {v.label.toLowerCase().includes('descrição') || v.label.toLowerCase().includes('motivo') ? (
                      <textarea value={camposManual[v.key] || ''}
                        onChange={e => setCamposManual(prev => ({ ...prev, [v.key]: e.target.value }))}
                        placeholder={`Digite ${v.label.toLowerCase()}...`} rows={3}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
                    ) : (
                      <input type="text" value={camposManual[v.key] || ''}
                        onChange={e => setCamposManual(prev => ({ ...prev, [v.key]: e.target.value }))}
                        placeholder={`Digite ${v.label.toLowerCase()}...`}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Auto-fill info */}
          {(modelo.variaveis?.filter(v => v.tipo === 'funcionario').length ?? 0) > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-medium text-blue-700 mb-2">Preenchido automaticamente</p>
              <div className="space-y-1">
                {modelo.variaveis.filter(v => v.tipo === 'funcionario').map(v => (
                  <p key={v.key} className="text-xs text-blue-600">
                    <span className="font-mono bg-blue-100 px-1 rounded">{v.label}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">
                {funcAtiva ? `Preview — ${funcAtiva.nome}` : 'Preview do documento'}
              </span>
            </div>
            {funcsSelecionadas.length > 1 && (
              <div className="flex items-center gap-1">
                {funcsSelecionadas.map((f, i) => (
                  <button key={f.id} onClick={() => setDocAtivo(i)}
                    className={`w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                      docAtivo === i ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`} title={f.nome}>
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <div className="p-8">
              <div className="bg-white shadow-sm border border-gray-200 rounded mx-auto"
                style={{ maxWidth: '720px', minHeight: '900px', padding: '48px 56px' }}>
                <div className="border-b-2 border-gray-800 pb-4 mb-6 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-600">
                    TECNOMONTE FABRICAÇÃO E MONTAGENS DE TANQUES INDUSTRIAIS LTDA
                  </p>
                  <p className="text-xs text-gray-400 mt-1">CNPJ: 31.045.857/0001-51 | Rua Amazonas, 1262, Centro – Avaré/SP</p>
                </div>
                <div className="documento-preview text-sm text-gray-800 leading-relaxed"
                  style={{ fontFamily: 'Georgia, serif' }}
                  dangerouslySetInnerHTML={{ __html: previewHtml }} />
                {!funcAtiva && selecionados.length === 0 && (
                  <div className="mt-8 p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center text-gray-400 text-sm">
                    Selecione um ou mais funcionários para gerar os documentos
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .documento-preview h2 { font-size: 15px; font-weight: bold; text-align: center; text-transform: uppercase; margin-bottom: 20px; }
        .documento-preview h3 { font-size: 13px; font-weight: bold; text-align: center; margin-bottom: 16px; color: #444; }
        .documento-preview p { margin-bottom: 12px; text-align: justify; line-height: 1.7; }
        .documento-preview ol, .documento-preview ul { margin: 12px 0 12px 20px; }
        .documento-preview li { margin-bottom: 6px; line-height: 1.6; }
        .documento-preview table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
        .documento-preview td, .documento-preview th { border: 1px solid #aaa; padding: 6px 10px; }
        .documento-preview th { background: #f5f5f5; font-weight: bold; text-align: center; }
        .documento-preview hr { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
      `}</style>
    </div>
  )
}

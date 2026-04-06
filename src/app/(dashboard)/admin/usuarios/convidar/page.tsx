'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { useToast } from '@/components/Toast'

const ROLES = [
  { key: 'admin', label: 'Administrador', desc: 'Acesso total ao sistema', color: 'bg-red-50 border-red-200 text-red-700' },
  { key: 'engenheiro', label: 'Engenheiro', desc: 'Obras, boletins e engenharia', color: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
  { key: 'encarregado', label: 'Encarregado', desc: 'Gestão de obras e equipes', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { key: 'rh', label: 'RH', desc: 'Funcionários, faltas, documentos', color: 'bg-pink-50 border-pink-200 text-pink-700' },
  { key: 'financeiro', label: 'Financeiro', desc: 'Lançamentos e relatórios financeiros', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { key: 'almoxarife', label: 'Almoxarife', desc: 'Controle de estoque e EPIs', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { key: 'funcionario', label: 'Funcionário', desc: 'Visualiza próprios dados e HH', color: 'bg-gray-50 border-gray-200 text-gray-700' },
  { key: 'visualizador', label: 'Visualizador', desc: 'Apenas visualização, sem edição', color: 'bg-purple-50 border-purple-200 text-purple-700' },
]

const MODULOS = ['dashboard', 'obras', 'funcionarios', 'ponto', 'faltas', 'boletins', 'financeiro', 'documentos', 'cadastros', 'admin', 'usuarios']

const CATEGORIAS_FUNCAO = ['Montagem', 'Elétrica', 'Gestão', 'Qualidade', 'Suporte', 'Tubulação', 'Pintura', 'Mecânica', 'Equipamentos', 'Operacional', 'Administrativo', 'Engenharia']

type TipoValidade = 'indeterminado' | 'dias' | 'data' | 'contrato'

function parseEmails(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map(e => e.trim().toLowerCase())
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
}

export default function ConvidarUsuarioPage() {
  const [form, setForm] = useState({
    nome: '',
    emails: '',
    role: '',
    funcionario_id: '',
    mensagem: '',
    cargo: '',
  })
  const [tipoValidade, setTipoValidade] = useState<TipoValidade>('indeterminado')
  const [diasExpiracao, setDiasExpiracao] = useState(7)
  const [dataExpiracao, setDataExpiracao] = useState('')
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [funcoes, setFuncoes] = useState<any[]>([])
  const [modulos, setModulos] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<{ sucesso: string[]; erro: string[] } | null>(null)
  const [copied, setCopied] = useState(false)
  const [linksGerados, setLinksGerados] = useState<{ email: string; link: string }[]>([])
  // Funcao creation
  const [showNovaFuncao, setShowNovaFuncao] = useState(false)
  const [novaFuncao, setNovaFuncao] = useState({ nome: '', categoria: 'Montagem', custo_hora: '' })
  const [criandoFuncao, setCriandoFuncao] = useState(false)
  // Cargo search/filter
  const [cargoSearch, setCargoSearch] = useState('')
  const [showCargoDropdown, setShowCargoDropdown] = useState(false)
  const cargoRef = useRef<HTMLDivElement>(null)
  // Email sending
  const [emailAberto, setEmailAberto] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()

  useEffect(() => {
    supabase.from('funcionarios').select('id, nome, cargo, periodo_contrato, admissao').is('deleted_at', null).order('nome').then(({ data }: any) => {
      setFuncionarios(data ?? [])
    })
    loadFuncoes()
  }, [])

  async function loadFuncoes() {
    const { data } = await supabase.from('funcoes').select('id, nome, categoria, custo_hora').eq('ativo', true).order('nome')
    setFuncoes(data ?? [])
  }

  useEffect(() => {
    if (form.role === 'admin') setModulos([...MODULOS])
  }, [form.role])

  // Close cargo dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (cargoRef.current && !cargoRef.current.contains(e.target as Node)) setShowCargoDropdown(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function set(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function toggleModulo(m: string) {
    setModulos(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  function calcExpiresAt(): string | null {
    if (tipoValidade === 'indeterminado') return null
    if (tipoValidade === 'dias') return new Date(Date.now() + diasExpiracao * 86400000).toISOString()
    if (tipoValidade === 'data') return dataExpiracao ? new Date(dataExpiracao + 'T23:59:59').toISOString() : null
    if (tipoValidade === 'contrato' && form.funcionario_id) {
      const func = funcionarios.find(f => f.id === form.funcionario_id)
      if (func?.admissao && func?.periodo_contrato) {
        const match = func.periodo_contrato.match(/(\d+)/i)
        if (match) {
          const d = new Date(func.admissao)
          d.setDate(d.getDate() + parseInt(match[1]))
          return d.toISOString()
        }
      }
    }
    return null
  }

  const emailsList = parseEmails(form.emails)
  const isSingle = emailsList.length <= 1

  // Filtered funcoes for cargo dropdown
  const filteredFuncoes = cargoSearch
    ? funcoes.filter(f => f.nome.toLowerCase().includes(cargoSearch.toLowerCase()))
    : funcoes
  const cargoExistsExact = funcoes.some(f => f.nome.toUpperCase() === cargoSearch.toUpperCase())

  async function handleCriarFuncao(e: React.FormEvent) {
    e.preventDefault()
    if (!novaFuncao.nome.trim()) return
    setCriandoFuncao(true)
    const { data, error } = await supabase.from('funcoes').insert({
      nome: novaFuncao.nome.trim().toUpperCase(),
      categoria: novaFuncao.categoria,
      custo_hora: novaFuncao.custo_hora ? Number(novaFuncao.custo_hora) : null,
      multiplicador_extra: 1.7,
      multiplicador_noturno: 1.4,
      ativo: true,
    }).select().single()
    if (error) {
      toast.error('Erro ao criar função: ' + error.message)
    } else {
      toast.success(`Função "${data.nome}" criada!`)
      await loadFuncoes()
      set('cargo', data.nome)
      setCargoSearch(data.nome)
      setShowNovaFuncao(false)
      setNovaFuncao({ nome: '', categoria: 'Montagem', custo_hora: '' })
    }
    setCriandoFuncao(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome || emailsList.length === 0 || !form.role) return
    setLoading(true)

    const expires_at = calcExpiresAt()
    const sucesso: string[] = []
    const erro: string[] = []
    const links: { email: string; link: string }[] = []

    const { data: { user } } = await supabase.auth.getUser()
    let criadorNome = ''
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('nome').eq('user_id', user.id).single()
      criadorNome = profile?.nome || ''
    }

    for (const email of emailsList) {
      const token = crypto.randomUUID()
      const { error } = await supabase.from('convites').insert({
        token,
        nome_convidado: form.nome,
        email,
        role: form.role,
        acessos: modulos,
        funcionario_id: form.funcionario_id || null,
        mensagem_boas_vindas: form.mensagem || null,
        expires_at,
        ativo: true,
        criado_por: user?.id || null,
        criado_por_nome: criadorNome || null,
      })

      if (error) {
        erro.push(email)
        console.error('Erro ao criar convite para', email, error)
      } else {
        sucesso.push(email)
        links.push({ email, link: `${window.location.origin}/convite/${token}` })
      }
    }

    setResultado({ sucesso, erro })
    setLinksGerados(links)
    setLoading(false)
  }

  function buildMailto() {
    if (linksGerados.length === 0) return

    const toEmails = linksGerados.map(l => l.email)
    const roleName = ROLES.find(r => r.key === form.role)?.label || form.role

    const subject = encodeURIComponent(
      `Convite Softmonte — ${form.nome}`
    )

    let bodyText = `Olá ${form.nome},\n\n`
    bodyText += `Você foi convidado(a) para acessar o sistema Softmonte como ${roleName}.\n\n`

    if (linksGerados.length === 1) {
      bodyText += `Clique no link abaixo para criar sua conta:\n${linksGerados[0].link}\n\n`
    } else {
      bodyText += `Cada pessoa deve usar seu link individual abaixo:\n\n`
      linksGerados.forEach(l => {
        bodyText += `${l.email}:\n${l.link}\n\n`
      })
    }

    if (form.mensagem) {
      bodyText += `Mensagem: ${form.mensagem}\n\n`
    }

    bodyText += `Após criar sua conta, acesse: ${window.location.origin}/login\n\n`
    bodyText += `Atenciosamente,\nTecnomonte Montagens Industriais`

    const body = encodeURIComponent(bodyText)

    const mailtoLink = `mailto:${toEmails[0]}` +
      (toEmails.length > 1 ? `?cc=${toEmails.slice(1).join(',')}` : '?') +
      `${toEmails.length > 1 ? '&' : ''}subject=${subject}&body=${body}`

    window.open(mailtoLink, '_blank')
    setEmailAberto(true)
  }

  function copyAllLinks() {
    const text = linksGerados.map(l => `${l.email}: ${l.link}`).join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copySingleLink(link: string) {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function resetForm() {
    setForm({ nome: '', emails: '', role: '', funcionario_id: '', mensagem: '', cargo: '' })
    setModulos([])
    setResultado(null)
    setLinksGerados([])
    setCopied(false)
    setTipoValidade('indeterminado')
    setDiasExpiracao(7)
    setDataExpiracao('')
    setCargoSearch('')
    setEmailAberto(false)
  }

  const funcSelecionado = funcionarios.find(f => f.id === form.funcionario_id)

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <Breadcrumb fallback="/admin/usuarios" items={[
        { label: 'Admin', href: '/admin/usuarios' },
        { label: 'Usuarios', href: '/admin/usuarios' },
        { label: 'Convidar' },
      ]} />

      <h1 className="text-xl font-bold font-display text-brand mb-6">Convidar Usuário</h1>

      {/* ═══ SUCCESS MODE ═══ */}
      {resultado !== null ? (
        <div className="space-y-6">
          {resultado.sucesso.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M6 10l3 3 5-6" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-green-800">
                    {resultado.sucesso.length === 1 ? 'Convite criado!' : `${resultado.sucesso.length} convites criados!`}
                  </h2>
                  <p className="text-sm text-green-600">Envie o convite por email ou compartilhe o link.</p>
                </div>
              </div>

              {/* Email sending */}
              {!emailAberto ? (
                <button
                  onClick={buildMailto}
                  className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="white" strokeWidth="1.3"/><path d="M1 5l7 4 7-4" stroke="white" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                  Enviar convite por email
                </button>
              ) : (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-amber-600 flex-shrink-0">
                      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M10 6v5M10 13v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <p className="text-sm text-amber-800 font-medium">Email aberto no seu cliente de email!</p>
                  </div>
                  <p className="text-xs text-amber-700 mb-3">Verifique se os links de convite estão no corpo do email e envie.</p>
                  <div className="flex gap-2">
                    <button onClick={buildMailto}
                      className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50">
                      Reabrir email
                    </button>
                    <button onClick={() => toast.success('Convite enviado!')}
                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700">
                      ✓ Já enviei
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {linksGerados.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      {linksGerados.length > 1 && (
                        <span className="text-xs text-green-700 font-medium">{l.email}</span>
                      )}
                      <input type="text" readOnly value={l.link}
                        className="w-full px-3 py-2 border border-green-200 rounded-lg bg-white text-sm text-gray-700" />
                    </div>
                    <button onClick={() => copySingleLink(l.link)}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors flex-shrink-0">
                      {copied ? '✓' : 'Copiar'}
                    </button>
                  </div>
                ))}
              </div>

              {linksGerados.length > 1 && (
                <button onClick={copyAllLinks}
                  className="mt-3 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors">
                  {copied ? 'Copiado!' : 'Copiar todos os links'}
                </button>
              )}
            </div>
          )}

          {resultado.erro.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <h3 className="text-sm font-bold text-red-700 mb-2">Falha ao criar convite para:</h3>
              <ul className="space-y-1">
                {resultado.erro.map((email, i) => (
                  <li key={i} className="text-sm text-red-600">{email}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Resumo</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Nome:</span> <span className="ml-2 font-medium text-gray-900">{form.nome}</span></div>
              <div><span className="text-gray-500">Perfil:</span> <span className="ml-2 font-medium text-gray-900">{ROLES.find(r => r.key === form.role)?.label || form.role}</span></div>
              {form.cargo && <div><span className="text-gray-500">Função:</span> <span className="ml-2 font-medium text-gray-900">{form.cargo}</span></div>}
              <div><span className="text-gray-500">Módulos:</span> <span className="ml-2 font-medium text-gray-900">{modulos.length} módulos</span></div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={resetForm} className="px-4 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors">
              Criar outro convite
            </button>
            <Link href="/admin/usuarios" className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              Voltar para lista
            </Link>
          </div>
        </div>
      ) : (
        /* ═══ FORM MODE ═══ */
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Vincular a funcionário */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-3">
              Vincular a funcionário <span className="text-gray-400 font-normal">(opcional)</span>
            </h2>
            <select value={form.funcionario_id} onChange={e => set('funcionario_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand">
              <option value="">Selecione um funcionário...</option>
              {funcionarios.map((f: any) => (
                <option key={f.id} value={f.id}>{f.nome} {f.cargo ? `- ${f.cargo}` : ''}</option>
              ))}
            </select>
            {funcSelecionado?.periodo_contrato && (
              <p className="text-xs text-gray-400 mt-2">
                Contrato: {funcSelecionado.periodo_contrato}
                {funcSelecionado.admissao && ` · Admissão: ${new Date(funcSelecionado.admissao).toLocaleDateString('pt-BR')}`}
              </p>
            )}
          </div>

          {/* Dados do convite */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-3">Dados do convite</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do convidado</label>
                <input type="text" value={form.nome} onChange={e => set('nome', e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Email(s) <span className="text-gray-400 font-normal ml-1">— um por linha, ou separados por vírgula</span>
                </label>
                <textarea value={form.emails} onChange={e => set('emails', e.target.value)} rows={3}
                  placeholder={"joao@empresa.com\nmaria@empresa.com"}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none font-mono" />
                {form.emails && (
                  <p className="text-xs mt-1.5 text-gray-500">
                    {emailsList.length === 0 ? (
                      <span className="text-red-500">Nenhum email válido detectado</span>
                    ) : emailsList.length === 1 ? (
                      <span className="text-green-600">1 email válido</span>
                    ) : (
                      <span className="text-green-600">{emailsList.length} emails válidos — será criado 1 convite por email</span>
                    )}
                  </p>
                )}
              </div>

              {/* Função / Cargo */}
              <div ref={cargoRef} className="relative">
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Função / Cargo <span className="text-gray-400 font-normal">(opcional — será vinculado ao perfil)</span>
                </label>
                <input
                  type="text"
                  value={cargoSearch}
                  onChange={e => { setCargoSearch(e.target.value); setShowCargoDropdown(true) }}
                  onFocus={() => setShowCargoDropdown(true)}
                  placeholder="Digite ou selecione a função..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
                {showCargoDropdown && (cargoSearch || funcoes.length > 0) && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                    {filteredFuncoes.map(f => (
                      <button key={f.id} type="button"
                        onClick={() => { set('cargo', f.nome); setCargoSearch(f.nome); setShowCargoDropdown(false) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between">
                        <span className="font-medium">{f.nome}</span>
                        <span className="text-xs text-gray-400">{f.categoria}</span>
                      </button>
                    ))}
                    {/* Create new option */}
                    {cargoSearch && !cargoExistsExact && (
                      <button type="button"
                        onClick={() => { setNovaFuncao(nf => ({ ...nf, nome: cargoSearch })); setShowNovaFuncao(true); setShowCargoDropdown(false) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-brand font-medium border-t border-gray-100 flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        Criar função "{cargoSearch.toUpperCase()}"
                      </button>
                    )}
                    {filteredFuncoes.length === 0 && !cargoSearch && (
                      <div className="px-3 py-2 text-xs text-gray-400">Nenhuma função cadastrada</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Nova Função inline modal */}
          {showNovaFuncao && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-blue-800">Criar nova função</h3>
                <button type="button" onClick={() => setShowNovaFuncao(false)} className="text-blue-400 hover:text-blue-600 text-xs">Cancelar</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-blue-700 mb-1">Nome</label>
                  <input type="text" value={novaFuncao.nome} onChange={e => setNovaFuncao(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Ex: ENGENHEIRO CIVIL"
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-700 mb-1">Categoria</label>
                  <select value={novaFuncao.categoria} onChange={e => setNovaFuncao(f => ({ ...f, categoria: e.target.value }))}
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white">
                    {CATEGORIAS_FUNCAO.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-blue-700 mb-1">Custo/hora (R$)</label>
                  <input type="number" step="0.01" value={novaFuncao.custo_hora} onChange={e => setNovaFuncao(f => ({ ...f, custo_hora: e.target.value }))}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white" />
                </div>
              </div>
              <button type="button" onClick={handleCriarFuncao} disabled={!novaFuncao.nome.trim() || criandoFuncao}
                className="mt-3 px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50">
                {criandoFuncao ? 'Criando...' : 'Criar função'}
              </button>
            </div>
          )}

          {/* Validade do convite */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-3">Validade do acesso</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {([
                { key: 'indeterminado', label: 'Indeterminado', desc: 'Sem data de expiração' },
                { key: 'dias', label: 'Dias fixos', desc: 'Expira após X dias' },
                { key: 'data', label: 'Data específica', desc: 'Escolha a data limite' },
                { key: 'contrato', label: 'Vinculado ao contrato', desc: form.funcionario_id ? funcSelecionado?.periodo_contrato || 'Sem período definido' : 'Selecione um funcionário' },
              ] as const).map(opt => (
                <button key={opt.key} type="button"
                  onClick={() => setTipoValidade(opt.key as TipoValidade)}
                  disabled={opt.key === 'contrato' && !form.funcionario_id}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    tipoValidade === opt.key
                      ? 'border-2 border-brand bg-blue-50 text-brand'
                      : opt.key === 'contrato' && !form.funcionario_id
                      ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="text-sm font-bold">{opt.label}</div>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
            {tipoValidade === 'dias' && (
              <select value={diasExpiracao} onChange={e => setDiasExpiracao(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand">
                {[1,3,7,15,30,60,90,180,365].map(d => <option key={d} value={d}>{d === 365 ? '1 ano' : `${d} dias`}</option>)}
              </select>
            )}
            {tipoValidade === 'data' && (
              <input type="date" value={dataExpiracao} onChange={e => setDataExpiracao(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
            )}
            {tipoValidade === 'contrato' && funcSelecionado && (
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600">
                {funcSelecionado.admissao && funcSelecionado.periodo_contrato ? (
                  <>
                    Admissão: {new Date(funcSelecionado.admissao).toLocaleDateString('pt-BR')} · Período: {funcSelecionado.periodo_contrato}
                    {(() => {
                      const match = funcSelecionado.periodo_contrato.match(/(\d+)/i)
                      if (match && funcSelecionado.admissao) {
                        const d = new Date(funcSelecionado.admissao)
                        d.setDate(d.getDate() + parseInt(match[1]))
                        return <span className="font-semibold"> · Expira em: {d.toLocaleDateString('pt-BR')}</span>
                      }
                      return null
                    })()}
                  </>
                ) : (
                  <span className="text-amber-600">Funcionário sem dados de contrato completos.</span>
                )}
              </div>
            )}
          </div>

          {/* Mensagem */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Mensagem de boas-vindas <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea value={form.mensagem} onChange={e => set('mensagem', e.target.value)} rows={3}
              placeholder="Mensagem opcional para o convidado..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none" />
          </div>

          {/* Perfil de acesso */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-3">Perfil de acesso</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {ROLES.map(role => (
                <button key={role.key} type="button" onClick={() => set('role', role.key)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    form.role === role.key ? `border-2 ${role.color}` : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      role.key === 'admin' ? 'bg-red-500' : role.key === 'engenheiro' ? 'bg-cyan-500' :
                      role.key === 'encarregado' ? 'bg-blue-500' : role.key === 'rh' ? 'bg-pink-500' :
                      role.key === 'financeiro' ? 'bg-emerald-500' : role.key === 'almoxarife' ? 'bg-amber-500' :
                      role.key === 'funcionario' ? 'bg-gray-500' : 'bg-purple-500'
                    }`} />
                    <span className="text-sm font-bold">{role.label}</span>
                  </div>
                  <p className="text-xs text-gray-500">{role.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Módulos */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-700">Módulos</h2>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setModulos([...MODULOS])} className="text-xs text-brand hover:underline font-medium">Todos</button>
                <button type="button" onClick={() => setModulos([])} className="text-xs text-gray-500 hover:underline font-medium">Nenhum</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {MODULOS.map(m => (
                <label key={m} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer text-sm">
                  <input type="checkbox" checked={modulos.includes(m)} onChange={() => toggleModulo(m)}
                    className="rounded border-gray-300 text-brand focus:ring-brand" />
                  <span className="capitalize text-gray-700">{m}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={!form.nome || emailsList.length === 0 || !form.role || loading}
              className="px-6 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? 'Criando...' : emailsList.length > 1 ? `Criar ${emailsList.length} convites` : 'Criar Convite'}
            </button>
            <Link href="/admin/usuarios" className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}

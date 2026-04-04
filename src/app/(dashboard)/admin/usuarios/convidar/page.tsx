'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Breadcrumb from '@/components/ui/Breadcrumb'

const ROLES = [
  { key: 'admin', label: 'Administrador', desc: 'Acesso total ao sistema', color: 'bg-red-50 border-red-200 text-red-700' },
  { key: 'encarregado', label: 'Encarregado', desc: 'Gestão de obras e equipes', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { key: 'rh', label: 'RH', desc: 'Funcionários, faltas, documentos', color: 'bg-pink-50 border-pink-200 text-pink-700' },
  { key: 'financeiro', label: 'Financeiro', desc: 'Lançamentos e relatórios financeiros', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { key: 'almoxarife', label: 'Almoxarife', desc: 'Controle de estoque e EPIs', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { key: 'funcionario', label: 'Funcionário', desc: 'Visualiza próprios dados e HH', color: 'bg-gray-50 border-gray-200 text-gray-700' },
  { key: 'visualizador', label: 'Visualizador', desc: 'Apenas visualização, sem edição', color: 'bg-purple-50 border-purple-200 text-purple-700' },
]

const MODULOS = ['dashboard', 'obras', 'funcionarios', 'ponto', 'faltas', 'boletins', 'financeiro', 'documentos', 'cadastros', 'admin', 'usuarios']

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
  })
  const [tipoValidade, setTipoValidade] = useState<TipoValidade>('indeterminado')
  const [diasExpiracao, setDiasExpiracao] = useState(7)
  const [dataExpiracao, setDataExpiracao] = useState('')
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [modulos, setModulos] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<{ sucesso: string[]; erro: string[] } | null>(null)
  const [copied, setCopied] = useState(false)
  const [linksGerados, setLinksGerados] = useState<{ email: string; link: string }[]>([])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('funcionarios').select('id, nome, cargo, periodo_contrato, admissao').eq('deleted_at', null).order('nome').then(({ data }) => {
      setFuncionarios(data ?? [])
    })
  }, [])

  useEffect(() => {
    if (form.role === 'admin') {
      setModulos([...MODULOS])
    }
  }, [form.role])

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
          const dias = parseInt(match[1])
          const admissao = new Date(func.admissao)
          admissao.setDate(admissao.getDate() + dias)
          return admissao.toISOString()
        }
      }
    }
    return null
  }

  const emailsList = parseEmails(form.emails)
  const isSingle = emailsList.length <= 1

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome || emailsList.length === 0 || !form.role) return
    setLoading(true)

    const expires_at = calcExpiresAt()
    const sucesso: string[] = []
    const erro: string[] = []
    const links: { email: string; link: string }[] = []

    // Get current user info for criado_por
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
        nome_convidado: isSingle ? form.nome : form.nome,
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
    setForm({ nome: '', emails: '', role: '', funcionario_id: '', mensagem: '' })
    setModulos([])
    setResultado(null)
    setLinksGerados([])
    setCopied(false)
    setTipoValidade('indeterminado')
    setDiasExpiracao(7)
    setDataExpiracao('')
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

      {/* Success mode */}
      {resultado !== null ? (
        <div className="space-y-6">
          {/* Sucesso */}
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
                  <p className="text-sm text-green-600">Compartilhe os links abaixo com os convidados.</p>
                </div>
              </div>

              <div className="space-y-2">
                {linksGerados.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      {linksGerados.length > 1 && (
                        <span className="text-xs text-green-700 font-medium">{l.email}</span>
                      )}
                      <input
                        type="text"
                        readOnly
                        value={l.link}
                        className="w-full px-3 py-2 border border-green-200 rounded-lg bg-white text-sm text-gray-700"
                      />
                    </div>
                    <button
                      onClick={() => copySingleLink(l.link)}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors flex-shrink-0"
                    >
                      Copiar
                    </button>
                  </div>
                ))}
              </div>

              {linksGerados.length > 1 && (
                <button
                  onClick={copyAllLinks}
                  className="mt-3 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
                >
                  {copied ? 'Copiado!' : 'Copiar todos os links'}
                </button>
              )}
            </div>
          )}

          {/* Erros */}
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

          {/* Resumo */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-3">Resumo</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Nome/grupo:</span>
                <span className="ml-2 font-medium text-gray-900">{form.nome}</span>
              </div>
              <div>
                <span className="text-gray-500">Perfil:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {ROLES.find(r => r.key === form.role)?.label || form.role}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Módulos:</span>
                <span className="ml-2 font-medium text-gray-900">{modulos.length} módulos</span>
              </div>
              <div>
                <span className="text-gray-500">Validade:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {tipoValidade === 'indeterminado' ? 'Indeterminada' :
                   tipoValidade === 'dias' ? `${diasExpiracao} dias` :
                   tipoValidade === 'data' ? new Date(dataExpiracao).toLocaleDateString('pt-BR') :
                   'Vinculada ao contrato'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={resetForm}
              className="px-4 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors"
            >
              Criar outro convite
            </button>
            <Link
              href="/admin/usuarios"
              className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Voltar para lista
            </Link>
          </div>
        </div>
      ) : (
        /* Form mode */
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Vincular a funcionário */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-3">
              Vincular a funcionário <span className="text-gray-400 font-normal">(opcional)</span>
            </h2>
            <select
              value={form.funcionario_id}
              onChange={e => set('funcionario_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            >
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
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do convidado / grupo</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => set('nome', e.target.value)}
                  placeholder="Ex: João Silva ou Equipe Manutenção"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Email(s)
                  <span className="text-gray-400 font-normal ml-1">— um por linha, ou separados por vírgula</span>
                </label>
                <textarea
                  value={form.emails}
                  onChange={e => set('emails', e.target.value)}
                  rows={3}
                  placeholder={"joao@empresa.com\nmaria@empresa.com\ncarlos@empresa.com"}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none font-mono"
                />
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
            </div>
          </div>

          {/* Validade do convite */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-3">Validade do acesso</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => setTipoValidade('indeterminado')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  tipoValidade === 'indeterminado'
                    ? 'border-2 border-brand bg-blue-50 text-brand'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-bold">Indeterminado</div>
                <p className="text-xs text-gray-500 mt-0.5">Sem data de expiração</p>
              </button>
              <button
                type="button"
                onClick={() => setTipoValidade('dias')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  tipoValidade === 'dias'
                    ? 'border-2 border-brand bg-blue-50 text-brand'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-bold">Dias fixos</div>
                <p className="text-xs text-gray-500 mt-0.5">Expira após X dias</p>
              </button>
              <button
                type="button"
                onClick={() => setTipoValidade('data')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  tipoValidade === 'data'
                    ? 'border-2 border-brand bg-blue-50 text-brand'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-bold">Data específica</div>
                <p className="text-xs text-gray-500 mt-0.5">Escolha a data limite</p>
              </button>
              <button
                type="button"
                onClick={() => setTipoValidade('contrato')}
                disabled={!form.funcionario_id}
                className={`p-3 rounded-xl border text-left transition-all ${
                  tipoValidade === 'contrato'
                    ? 'border-2 border-brand bg-blue-50 text-brand'
                    : !form.funcionario_id
                    ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-bold">Vinculado ao contrato</div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {form.funcionario_id
                    ? funcSelecionado?.periodo_contrato || 'Sem período definido'
                    : 'Selecione um funcionário'}
                </p>
              </button>
            </div>

            {/* Sub-options */}
            {tipoValidade === 'dias' && (
              <select
                value={diasExpiracao}
                onChange={e => setDiasExpiracao(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              >
                <option value={1}>1 dia</option>
                <option value={3}>3 dias</option>
                <option value={7}>7 dias</option>
                <option value={15}>15 dias</option>
                <option value={30}>30 dias</option>
                <option value={60}>60 dias</option>
                <option value={90}>90 dias</option>
                <option value={180}>180 dias</option>
                <option value={365}>1 ano</option>
              </select>
            )}
            {tipoValidade === 'data' && (
              <input
                type="date"
                value={dataExpiracao}
                onChange={e => setDataExpiracao(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              />
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
                  <span className="text-amber-600">Funcionário sem dados de contrato completos. O convite ficará sem expiração.</span>
                )}
              </div>
            )}
          </div>

          {/* Mensagem */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Mensagem de boas-vindas <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={form.mensagem}
              onChange={e => set('mensagem', e.target.value)}
              rows={3}
              placeholder="Mensagem opcional para o convidado..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand resize-none"
            />
          </div>

          {/* Perfil de acesso */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-3">Perfil de acesso</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {ROLES.map(role => (
                <button
                  key={role.key}
                  type="button"
                  onClick={() => set('role', role.key)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    form.role === role.key
                      ? `border-2 ${role.color}`
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      role.key === 'admin' ? 'bg-red-500' :
                      role.key === 'encarregado' ? 'bg-blue-500' :
                      role.key === 'rh' ? 'bg-pink-500' :
                      role.key === 'financeiro' ? 'bg-emerald-500' :
                      role.key === 'almoxarife' ? 'bg-amber-500' :
                      role.key === 'funcionario' ? 'bg-gray-500' :
                      'bg-purple-500'
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
                <button
                  type="button"
                  onClick={() => setModulos([...MODULOS])}
                  className="text-xs text-brand hover:underline font-medium"
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setModulos([])}
                  className="text-xs text-gray-500 hover:underline font-medium"
                >
                  Nenhum
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {MODULOS.map(m => (
                <label key={m} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={modulos.includes(m)}
                    onChange={() => toggleModulo(m)}
                    className="rounded border-gray-300 text-brand focus:ring-brand"
                  />
                  <span className="capitalize text-gray-700">{m}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!form.nome || emailsList.length === 0 || !form.role || loading}
              className="px-6 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Criando...'
                : emailsList.length > 1
                ? `Criar ${emailsList.length} convites`
                : 'Criar Convite'}
            </button>
            <Link
              href="/admin/usuarios"
              className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}

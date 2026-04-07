'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { User, FileText, Calendar, Folder, LogOut } from 'lucide-react'

export default function PortalPage() {
  const [funcionario, setFuncionario] = useState<any>(null)
  const [stats, setStats] = useState<any>({ folhas: 0, ponto30: 0, docs: 0, faltasMes: 0 })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data: func } = await supabase.from('funcionarios').select('*, obras:alocacoes(obra_id, obras(nome))').eq('user_id', user.id).is('deleted_at', null).maybeSingle()
      if (!func) { setLoading(false); return }
      setFuncionario(func)

      const hoje = new Date()
      const mesInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
      const ha30 = new Date(Date.now() - 30*86400000).toISOString().slice(0, 10)

      const [{ count: fc }, { count: pc }, { count: dc }, { count: fmc }] = await Promise.all([
        supabase.from('folha_itens').select('id', { count: 'exact', head: true }).eq('funcionario_id', func.id),
        supabase.from('efetivo_diario').select('id', { count: 'exact', head: true }).eq('funcionario_id', func.id).gte('data', ha30),
        supabase.from('documentos').select('id', { count: 'exact', head: true }).eq('funcionario_id', func.id).is('deleted_at', null),
        supabase.from('faltas').select('id', { count: 'exact', head: true }).eq('funcionario_id', func.id).gte('data', mesInicio),
      ])
      setStats({ folhas: fc || 0, ponto30: pc || 0, docs: dc || 0, faltasMes: fmc || 0 })
      setLoading(false)
    })()
  }, [])

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>
  if (!funcionario) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <User className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-sm font-bold text-amber-800">Conta não vinculada a funcionário</h2>
          <p className="text-xs text-amber-700 mt-1">Procure o RH para vincular seu usuário a um cadastro de funcionário.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold font-display text-brand mb-1">Olá, {funcionario.nome_guerra || funcionario.nome.split(' ')[0]}</h1>
      <p className="text-sm text-gray-500 mb-6">Portal do funcionário — seus dados, ponto e holerites.</p>

      {/* Card perfil */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center text-2xl font-bold text-brand">
            {funcionario.nome.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">{funcionario.nome}</h2>
            <p className="text-sm text-gray-500">{funcionario.cargo} · Matrícula {funcionario.matricula}</p>
            <p className="text-xs text-gray-400 mt-0.5">Admitido em {funcionario.admissao ? new Date(funcionario.admissao + 'T12:00').toLocaleDateString('pt-BR') : '—'}</p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Link href="/portal/holerites" className="bg-white rounded-xl border border-gray-100 p-4 hover:border-brand/50 transition-colors">
          <FileText className="w-5 h-5 text-blue-500 mb-1" />
          <div className="text-2xl font-bold text-gray-900 font-display">{stats.folhas}</div>
          <div className="text-[11px] text-gray-400 font-semibold uppercase">Holerites</div>
        </Link>
        <Link href="/portal/ponto" className="bg-white rounded-xl border border-gray-100 p-4 hover:border-brand/50 transition-colors">
          <Calendar className="w-5 h-5 text-green-500 mb-1" />
          <div className="text-2xl font-bold text-gray-900 font-display">{stats.ponto30}</div>
          <div className="text-[11px] text-gray-400 font-semibold uppercase">Dias 30d</div>
        </Link>
        <Link href="/portal/documentos" className="bg-white rounded-xl border border-gray-100 p-4 hover:border-brand/50 transition-colors">
          <Folder className="w-5 h-5 text-violet-500 mb-1" />
          <div className="text-2xl font-bold text-gray-900 font-display">{stats.docs}</div>
          <div className="text-[11px] text-gray-400 font-semibold uppercase">Documentos</div>
        </Link>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <Calendar className="w-5 h-5 text-amber-500 mb-1" />
          <div className="text-2xl font-bold text-gray-900 font-display">{stats.faltasMes}</div>
          <div className="text-[11px] text-gray-400 font-semibold uppercase">Faltas mês</div>
        </div>
      </div>

      {/* Dados pessoais */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-brand mb-3">Meus dados</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-gray-400">CPF</dt><dd className="text-gray-700">{funcionario.cpf || '—'}</dd></div>
          <div><dt className="text-xs text-gray-400">PIS</dt><dd className="text-gray-700">{funcionario.pis || '—'}</dd></div>
          <div><dt className="text-xs text-gray-400">Telefone</dt><dd className="text-gray-700">{funcionario.telefone || '—'}</dd></div>
          <div><dt className="text-xs text-gray-400">Endereço</dt><dd className="text-gray-700">{funcionario.endereco || '—'}</dd></div>
          <div><dt className="text-xs text-gray-400">Banco</dt><dd className="text-gray-700">{funcionario.banco || '—'}</dd></div>
          <div><dt className="text-xs text-gray-400">Pix</dt><dd className="text-gray-700">{funcionario.pix || '—'}</dd></div>
        </dl>
        <p className="text-[11px] text-gray-400 mt-3">Para atualizar seus dados, procure o RH.</p>
      </div>
    </div>
  )
}

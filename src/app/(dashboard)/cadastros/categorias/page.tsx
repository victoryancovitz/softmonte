'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function CategoriasPage() {
  const [cats, setCats] = useState<any[]>([])
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<'receita'|'despesa'>('despesa')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => { load() }, [])
  async function load() {
    const { data } = await supabase.from('categorias_financeiras').select('*').order('tipo').order('nome')
    setCats(data ?? [])
  }

  async function add() {
    if (!nome.trim()) return
    setLoading(true)
    await supabase.from('categorias_financeiras').insert({ nome: nome.trim(), tipo })
    setNome('')
    await load()
    setLoading(false)
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from('categorias_financeiras').update({ ativo: !ativo }).eq('id', id)
    setCats(prev => prev.map(c => c.id === id ? { ...c, ativo: !ativo } : c))
  }

  const receitas = cats.filter(c => c.tipo === 'receita')
  const despesas = cats.filter(c => c.tipo === 'despesa')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link href="/cadastros" className="text-gray-400 hover:text-gray-600">Cadastros</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium">Categorias Financeiras</span>
      </div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Categorias Financeiras</h1>
          <p className="text-sm text-gray-500 mt-0.5">{cats.length} categorias para classificar receitas e despesas</p>
        </div>
      </div>

      {/* Adicionar nova */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <h2 className="text-sm font-bold text-gray-700 mb-3">Adicionar nova categoria</h2>
        <div className="flex gap-3">
          <select value={tipo} onChange={e => setTipo(e.target.value as any)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand">
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
          <input type="text" value={nome} onChange={e => setNome(e.target.value)}
            placeholder="Nome da categoria..." onKeyDown={e => e.key === 'Enter' && add()}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand"/>
          <button onClick={add} disabled={loading || !nome.trim()}
            className="px-5 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark disabled:opacity-40">
            + Adicionar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {[{ label: 'Receitas', icon: '↑', items: receitas, color: 'text-green-700', bg: 'bg-green-50 border-green-100', badge: 'bg-green-100 text-green-700' },
          { label: 'Despesas', icon: '↓', items: despesas, color: 'text-red-700', bg: 'bg-red-50 border-red-100', badge: 'bg-red-100 text-red-700' }
        ].map(({ label, icon, items, color, bg, badge }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className={`px-5 py-3 ${bg} border-b flex items-center gap-2`}>
              <span className={`font-bold ${color}`}>{icon}</span>
              <span className="text-sm font-bold text-gray-700">{label} ({items.length})</span>
            </div>
            <div className="divide-y divide-gray-50">
              {items.map((c: any) => (
                <div key={c.id} className={`px-5 py-2.5 flex items-center justify-between ${!c.ativo ? 'opacity-40' : ''}`}>
                  <span className="text-sm text-gray-800">{c.nome}</span>
                  <button onClick={() => toggleAtivo(c.id, c.ativo)}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-all ${c.ativo ? badge + ' hover:bg-gray-100 hover:text-gray-600' : 'bg-gray-100 text-gray-400 hover:' + badge}`}>
                    {c.ativo ? 'Ativa' : 'Inativa'}
                  </button>
                </div>
              ))}
              {items.length === 0 && <div className="px-5 py-6 text-center text-gray-400 text-sm">Nenhuma categoria.</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

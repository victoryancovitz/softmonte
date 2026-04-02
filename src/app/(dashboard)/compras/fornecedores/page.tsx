'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, X, Star } from 'lucide-react'

const CATEGORIAS = ['Material', 'EPI', 'Ferramentas', 'Serviços', 'Transporte', 'Alimentação'] as const

interface Fornecedor {
  id: string
  nome: string
  razao_social: string | null
  cnpj: string | null
  categoria: string | null
  contato_nome: string | null
  email: string | null
  telefone: string | null
  avaliacao: number | null
  ativo: boolean
}

const emptyForm = {
  nome: '',
  razao_social: '',
  cnpj: '',
  categoria: 'Material',
  contato_nome: '',
  email: '',
  telefone: '',
  avaliacao: 3,
}

export default function FornecedoresPage() {
  const supabase = createClient()
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterRating, setFilterRating] = useState(0)

  async function loadFornecedores() {
    setLoading(true)
    const { data } = await supabase
      .from('fornecedores')
      .select('*')
      .order('nome')
    setFornecedores(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadFornecedores() }, [])

  async function handleSave() {
    if (!form.nome.trim()) return
    setSaving(true)
    await supabase.from('fornecedores').insert({
      nome: form.nome,
      razao_social: form.razao_social || null,
      cnpj: form.cnpj || null,
      categoria: form.categoria,
      contato_nome: form.contato_nome || null,
      email: form.email || null,
      telefone: form.telefone || null,
      avaliacao: form.avaliacao,
      ativo: true,
    })
    setForm(emptyForm)
    setShowForm(false)
    setSaving(false)
    loadFornecedores()
  }

  async function toggleAtivo(f: Fornecedor) {
    await supabase.from('fornecedores').update({ ativo: !f.ativo }).eq('id', f.id)
    loadFornecedores()
  }

  const filtered = fornecedores.filter((f) => {
    if (filterCategoria && f.categoria !== filterCategoria) return false
    if (filterRating && (f.avaliacao ?? 0) < filterRating) return false
    return true
  })

  function RatingDots({ rating }: { rating: number }) {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} width="12" height="12" viewBox="0 0 12 12">
            <circle
              cx="6"
              cy="6"
              r="5"
              fill={i <= rating ? '#d4a017' : 'none'}
              stroke={i <= rating ? '#d4a017' : '#d1d5db'}
              strokeWidth="1"
            />
          </svg>
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold font-display text-brand">Fornecedores</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 transition"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancelar' : 'Novo Fornecedor'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={filterCategoria}
          onChange={(e) => setFilterCategoria(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">Todas categorias</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterRating}
          onChange={(e) => setFilterRating(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value={0}>Qualquer avaliação</option>
          {[1, 2, 3, 4, 5].map((r) => (
            <option key={r} value={r}>Min. {r} estrela{r > 1 ? 's' : ''}</option>
          ))}
        </select>
      </div>

      {/* Inline Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4">Cadastrar Fornecedor</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Nome fantasia"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Razão Social</label>
              <input
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">CNPJ</label>
              <input
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Categoria</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Contato</label>
              <input
                value={form.contato_nome}
                onChange={(e) => setForm({ ...form, contato_nome: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Nome do contato"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Telefone</label>
              <input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Avaliação</label>
              <select
                value={form.avaliacao}
                onChange={(e) => setForm({ ...form, avaliacao: Number(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {[1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r}>{r} estrela{r > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !form.nome.trim()}
              className="bg-brand text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 transition disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhum fornecedor encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((f) => (
            <div
              key={f.id}
              className={`bg-white rounded-xl shadow-sm border p-5 ${f.ativo ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-bold text-gray-900 truncate">{f.nome}</h3>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    f.ativo
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {f.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              {f.categoria && (
                <span className="inline-block text-[10px] font-medium bg-brand/10 text-brand px-2 py-0.5 rounded-full mb-2">
                  {f.categoria}
                </span>
              )}
              <div className="mb-2">
                <RatingDots rating={f.avaliacao ?? 0} />
              </div>
              {f.contato_nome && (
                <p className="text-xs text-gray-600">{f.contato_nome}</p>
              )}
              {f.email && (
                <p className="text-xs text-gray-400 truncate">{f.email}</p>
              )}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => toggleAtivo(f)}
                  className={`text-xs font-medium ${
                    f.ativo
                      ? 'text-red-500 hover:text-red-600'
                      : 'text-green-600 hover:text-green-700'
                  }`}
                >
                  {f.ativo ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

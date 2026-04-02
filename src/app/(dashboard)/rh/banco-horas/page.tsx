'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { Clock, Users, TrendingUp, TrendingDown, Lock, AlertTriangle } from 'lucide-react'

interface BancoHorasRow {
  id: string
  funcionario_id: string
  obra_id: string
  mes: number
  ano: number
  hh_contrato: number
  hh_trabalhado: number
  hh_extras: number
  hh_faltas: number
  hh_compensadas: number
  saldo_mes: number
  saldo_acumulado: number
  fechado: boolean
  funcionarios: { nome: string; cargo: string } | null
}

interface Obra {
  id: string
  nome: string
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function saldoColor(val: number): string {
  if (val < 0) return 'text-red-600 font-bold'
  if (val > 40) return 'text-red-600 font-bold'
  if (val > 20) return 'text-amber-600 font-semibold'
  return 'text-green-600 font-semibold'
}

export default function BancoHorasPage() {
  const supabase = createClient()
  const [obras, setObras] = useState<Obra[]>([])
  const [obraId, setObraId] = useState('')
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<BancoHorasRow[]>([])
  const [loading, setLoading] = useState(false)
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [fechando, setFechando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('obras').select('id, nome').order('nome').then(({ data }) => {
      setObras(data ?? [])
      if (data && data.length > 0 && !obraId) {
        setObraId(data[0].id)
      }
    })
  }, [])

  useEffect(() => {
    if (!obraId) return
    loadData()
  }, [obraId, mes, ano])

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('banco_horas')
      .select('*, funcionarios(nome, cargo)')
      .eq('obra_id', obraId)
      .eq('mes', mes)
      .eq('ano', ano)
      .order('funcionarios(nome)')

    setRows(data ?? [])
    setLoading(false)
  }

  function startEdit(id: string, field: string, currentValue: number) {
    const row = rows.find(r => r.id === id)
    if (row?.fechado) return
    setEditingCell({ id, field })
    setEditValue(String(currentValue))
  }

  async function saveEdit() {
    if (!editingCell) return
    const { id, field } = editingCell
    const numValue = parseFloat(editValue) || 0

    const row = rows.find(r => r.id === id)
    if (!row) return

    const updatedRow = { ...row, [field]: numValue }
    const saldoMes = updatedRow.hh_trabalhado + updatedRow.hh_extras - updatedRow.hh_contrato - updatedRow.hh_faltas + updatedRow.hh_compensadas

    await supabase
      .from('banco_horas')
      .update({
        [field]: numValue,
        saldo_mes: saldoMes,
        saldo_acumulado: (updatedRow.saldo_acumulado - row.saldo_mes) + saldoMes,
      })
      .eq('id', id)

    setEditingCell(null)
    setEditValue('')
    loadData()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      saveEdit()
    } else if (e.key === 'Escape') {
      setEditingCell(null)
      setEditValue('')
    }
  }

  async function fecharMes() {
    if (!obraId) return
    const confirmed = window.confirm(`Fechar o mês de ${MESES[mes - 1]}/${ano} para esta obra? Esta acao nao pode ser desfeita.`)
    if (!confirmed) return

    setFechando(true)
    await supabase
      .from('banco_horas')
      .update({ fechado: true })
      .eq('obra_id', obraId)
      .eq('mes', mes)
      .eq('ano', ano)

    setFechando(false)
    loadData()
  }

  const totalFuncionarios = rows.length
  const totalExtras = rows.reduce((s, r) => s + (r.hh_extras || 0), 0)
  const totalFaltas = rows.reduce((s, r) => s + (r.hh_faltas || 0), 0)
  const saldoGeral = rows.reduce((s, r) => s + (r.saldo_mes || 0), 0)
  const mesFechado = rows.length > 0 && rows.every(r => r.fechado)

  const editableFields = ['hh_contrato', 'hh_trabalhado', 'hh_extras', 'hh_faltas', 'hh_compensadas']

  function renderCell(row: BancoHorasRow, field: string, value: number) {
    const isEditing = editingCell?.id === row.id && editingCell?.field === field
    if (isEditing) {
      return (
        <input
          ref={inputRef}
          type="number"
          step="0.5"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={handleKeyDown}
          className="w-20 px-2 py-1 text-sm border border-brand rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      )
    }
    return (
      <span
        onClick={() => startEdit(row.id, field, value)}
        className={`cursor-pointer hover:bg-gray-100 px-2 py-1 rounded ${row.fechado ? 'cursor-not-allowed opacity-60' : ''}`}
        title={row.fechado ? 'Mes fechado' : 'Clique para editar'}
      >
        {(value || 0).toFixed(1)}
      </span>
    )
  }

  const anos = []
  for (let y = new Date().getFullYear(); y >= 2020; y--) {
    anos.push(y)
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <BackButton fallback="/rh" />
        <div>
          <h1 className="text-xl font-bold font-display text-brand">Banco de Horas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Controle de horas por obra e periodo</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-brand" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Funcionarios</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{totalFuncionarios}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total HH Extras</p>
          </div>
          <p className="text-2xl font-bold text-amber-600">{totalExtras.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total Faltas</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{totalFaltas.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-green-500" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Saldo Geral</p>
          </div>
          <p className={`text-2xl font-bold ${saldoColor(saldoGeral)}`}>{saldoGeral >= 0 ? '+' : ''}{saldoGeral.toFixed(1)}h</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Obra</label>
            <select
              value={obraId}
              onChange={e => setObraId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="">Selecione...</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Mes</label>
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              {MESES.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[100px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ano</label>
            <select
              value={ano}
              onChange={e => setAno(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            >
              {anos.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={fecharMes}
            disabled={mesFechado || rows.length === 0 || fechando}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Lock className="w-4 h-4" />
            {mesFechado ? 'Mes Fechado' : fechando ? 'Fechando...' : 'Fechar Mes'}
          </button>
        </div>
      </div>

      {/* Status banner */}
      {mesFechado && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4" />
          <span>Este mes esta fechado. Os valores nao podem ser editados.</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Funcionario', 'Cargo', 'HH Contrato', 'HH Trabalhado', 'HH Extras', 'HH Faltas', 'HH Compensadas', 'Saldo Mes', 'Saldo Acumulado'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400">Carregando...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                  {obraId ? 'Nenhum registro para este periodo.' : 'Selecione uma obra.'}
                </td>
              </tr>
            ) : rows.map(row => (
              <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/80">
                <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{row.funcionarios?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.funcionarios?.cargo ?? '—'}</td>
                <td className="px-4 py-3">{renderCell(row, 'hh_contrato', row.hh_contrato)}</td>
                <td className="px-4 py-3">{renderCell(row, 'hh_trabalhado', row.hh_trabalhado)}</td>
                <td className="px-4 py-3">{renderCell(row, 'hh_extras', row.hh_extras)}</td>
                <td className="px-4 py-3">{renderCell(row, 'hh_faltas', row.hh_faltas)}</td>
                <td className="px-4 py-3">{renderCell(row, 'hh_compensadas', row.hh_compensadas)}</td>
                <td className={`px-4 py-3 ${saldoColor(row.saldo_mes)}`}>
                  {(row.saldo_mes >= 0 ? '+' : '')}{(row.saldo_mes || 0).toFixed(1)}h
                </td>
                <td className={`px-4 py-3 ${saldoColor(row.saldo_acumulado)}`}>
                  {(row.saldo_acumulado >= 0 ? '+' : '')}{(row.saldo_acumulado || 0).toFixed(1)}h
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

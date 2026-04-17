'use client'

import { useState, FormEvent } from 'react'

interface Props {
  token: string
}

function mascaraCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

export default function ConfirmarForm({ token }: Props) {
  const [cpf, setCpf] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [tentativasRestantes, setTentativasRestantes] = useState<number | null>(null)
  const [sucesso, setSucesso] = useState<{ documento: string; funcionarioNome: string } | null>(null)
  const [bloqueado, setBloqueado] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      const res = await fetch('/api/whatsapp/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, cpf: cpf.replace(/\D/g, '') }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 403) {
          setBloqueado(true)
          return
        }
        if (data.tentativasRestantes !== undefined) {
          setTentativasRestantes(data.tentativasRestantes)
        }
        setErro(data.error || 'Erro ao confirmar')
        return
      }

      setSucesso(data)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (bloqueado) {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">&#128274;</div>
        <h2 className="text-lg font-bold text-red-600 mb-2">Acesso bloqueado</h2>
        <p className="text-gray-600 text-sm">
          Excesso de tentativas incorretas. Entre em contato com o RH.
        </p>
      </div>
    )
  }

  if (sucesso) {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">&#9989;</div>
        <h2 className="text-lg font-bold text-green-600 mb-2">Confirmado!</h2>
        <p className="text-gray-600 text-sm">
          {sucesso.funcionarioNome}, o documento <strong>{sucesso.documento}</strong> foi confirmado com sucesso.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-1">
          Digite seu CPF para confirmar
        </label>
        <input
          id="cpf"
          type="text"
          inputMode="numeric"
          placeholder="000.000.000-00"
          value={cpf}
          onChange={(e) => setCpf(mascaraCpf(e.target.value))}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-lg tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          maxLength={14}
          required
          disabled={loading}
        />
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {erro}
          {tentativasRestantes !== null && (
            <span className="block mt-1 font-medium">
              {tentativasRestantes} tentativa{tentativasRestantes !== 1 ? 's' : ''} restante{tentativasRestantes !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || cpf.replace(/\D/g, '').length !== 11}
        className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Verificando...' : 'Confirmar recebimento'}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Seus dados estao protegidos e nao serao compartilhados.
      </p>
    </form>
  )
}

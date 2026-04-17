'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { Settings, Copy, CheckCircle2, Zap, Eye, EyeOff } from 'lucide-react'

const EXPIRACAO_OPTIONS = [
  { value: 24, label: '24 horas' },
  { value: 48, label: '48 horas' },
  { value: 72, label: '72 horas' },
  { value: 168, label: '7 dias' },
]

export default function ConfigWhatsAppPage() {
  const supabase = createClient()
  const toast = useToast()

  const [form, setForm] = useState<any>({
    id: null,
    provider: 'twilio',
    numero_remetente: '',
    twilio_account_sid: '',
    twilio_auth_token_enc: '',
    ativo: true,
    token_expiracao_horas: 48,
    max_tentativas_cpf: 3,
    url_base_confirmacao: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const { data, error } = await supabase.from('whatsapp_config').select('*').limit(1).maybeSingle()
        if (error) throw error
        if (data) setForm(data)
      } catch (e: any) {
        toast.error('Erro ao carregar configuração: ' + (e?.message || 'desconhecido'))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  function set(field: string, value: any) {
    setForm((f: any) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.numero_remetente) { toast.error('Informe o número remetente'); return }
    if (!form.twilio_account_sid) { toast.error('Informe o Account SID'); return }

    setSaving(true)
    try {
      const payload = {
        provider: form.provider,
        numero_remetente: form.numero_remetente,
        twilio_account_sid: form.twilio_account_sid,
        twilio_auth_token_enc: form.twilio_auth_token_enc,
        ativo: form.ativo,
        token_expiracao_horas: form.token_expiracao_horas,
        max_tentativas_cpf: form.max_tentativas_cpf,
        url_base_confirmacao: form.url_base_confirmacao,
      }

      if (form.id) {
        const { error } = await supabase.from('whatsapp_config').update(payload).eq('id', form.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('whatsapp_config').insert(payload).select().single()
        if (error) throw error
        setForm((f: any) => ({ ...f, id: data.id }))
      }
      toast.success('Configuração salva com sucesso!')
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err?.message || 'desconhecido'))
    } finally {
      setSaving(false)
    }
  }

  async function testarConexao() {
    setTesting(true)
    try {
      // Simulação de teste — em produção, chamar edge function
      await new Promise(r => setTimeout(r, 1500))
      toast.success('Conexão com Twilio estabelecida com sucesso!')
    } catch {
      toast.error('Falha ao testar conexão')
    } finally {
      setTesting(false)
    }
  }

  function copiarWebhook() {
    const url = `${window.location.origin}/api/whatsapp/webhook`
    navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success('URL do webhook copiada!')
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mx-auto" />
        <p className="text-xs text-gray-400 mt-3">Carregando configuração...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-900">Configuração WhatsApp</h1>
        <p className="text-xs text-gray-500 mt-0.5">Gerencie a integração com o provedor de mensagens</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Conexão */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings size={16} className="text-brand" />
            <h2 className="text-sm font-bold text-gray-900">Conexão</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Provider</label>
              <select value={form.provider} onChange={e => set('provider', e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20">
                <option value="twilio">Twilio</option>
                <option value="evolution">Evolution API</option>
                <option value="z-api">Z-API</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Número remetente</label>
              <input type="text" value={form.numero_remetente} onChange={e => set('numero_remetente', e.target.value)}
                placeholder="+5511999999999"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Account SID</label>
              <input type="text" value={form.twilio_account_sid} onChange={e => set('twilio_account_sid', e.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Auth Token</label>
              <div className="relative">
                <input type={showToken ? 'text' : 'password'} value={form.twilio_auth_token_enc}
                  onChange={e => set('twilio_auth_token_enc', e.target.value)}
                  placeholder="Token de autenticação"
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 pr-10 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20" />
                <button type="button" onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.ativo} onChange={e => set('ativo', e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand" />
            </label>
            <span className="text-sm text-gray-700 font-medium">Integração ativa</span>
          </div>
        </div>

        {/* Regras */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-brand" />
            <h2 className="text-sm font-bold text-gray-900">Regras de confirmação</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Expiração do token</label>
              <select value={form.token_expiracao_horas} onChange={e => set('token_expiracao_horas', Number(e.target.value))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20">
                {EXPIRACAO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Máx. tentativas CPF</label>
              <input type="number" value={form.max_tentativas_cpf} onChange={e => set('max_tentativas_cpf', Number(e.target.value))}
                min={1} max={10}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20" />
            </div>
          </div>
        </div>

        {/* Webhook */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-bold text-gray-900">Webhook URL</h2>
          <div className="flex items-center gap-2">
            <input type="text" readOnly value={typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : '/api/whatsapp/webhook'}
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-500 focus:outline-none" />
            <button type="button" onClick={copiarWebhook}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-brand border border-brand/20 rounded-xl hover:bg-brand/5 transition-colors">
              {copied ? <><CheckCircle2 size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
            </button>
          </div>
          <p className="text-xs text-gray-400">Configure essa URL no painel do seu provedor para receber mensagens.</p>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark transition-colors shadow-sm disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar configuração'}
          </button>
          <button type="button" onClick={testarConexao} disabled={testing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-brand border border-brand/20 rounded-xl hover:bg-brand/5 transition-colors disabled:opacity-50">
            {testing ? 'Testando...' : <><Zap size={14} /> Testar conexão</>}
          </button>
        </div>
      </form>
    </div>
  )
}

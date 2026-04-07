'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import BackButton from '@/components/BackButton'
import { useToast } from '@/components/Toast'
import { Calculator, Save } from 'lucide-react'

const TIPOS = [
  { v: 'sem_justa_causa', l: 'Dispensa sem justa causa' },
  { v: 'justa_causa', l: 'Justa causa' },
  { v: 'pedido_demissao', l: 'Pedido de demissão' },
  { v: 'comum_acordo', l: 'Comum acordo (art. 484-A)' },
  { v: 'fim_contrato_experiencia', l: 'Fim contrato experiência' },
  { v: 'fim_contrato_determinado', l: 'Fim contrato determinado' },
  { v: 'rescisao_indireta', l: 'Rescisão indireta' },
  { v: 'falecimento', l: 'Falecimento' },
]

export default function NovaRescisaoPage() {
  const router = useRouter()
  const supabase = createClient()
  const toast = useToast()
  const [funcionarios, setFuncionarios] = useState<any[]>([])
  const [form, setForm] = useState({
    funcionario_id: '',
    tipo: 'sem_justa_causa',
    aviso_previo_tipo: 'indenizado',
    data_desligamento: new Date().toISOString().slice(0, 10),
  })
  const [preview, setPreview] = useState<any>(null)
  const [edit, setEdit] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('funcionarios').select('id,nome,cargo,matricula,admissao').is('deleted_at', null).order('nome').then(({ data }) => setFuncionarios(data || []))
  }, [])

  async function calcular() {
    if (!form.funcionario_id) { toast.error('Selecione o funcionário'); return }
    setLoading(true)
    const { data, error } = await supabase.rpc('calcular_rescisao', {
      p_funcionario_id: form.funcionario_id,
      p_data_desligamento: form.data_desligamento,
      p_tipo: form.tipo,
      p_aviso_tipo: form.aviso_previo_tipo,
    })
    setLoading(false)
    if (error) { toast.error('Erro: ' + error.message); return }
    setPreview(data)
    setEdit({
      saldo_salario: data.saldo_salario,
      aviso_previo_valor: data.aviso_previo_valor,
      ferias_vencidas: data.ferias_vencidas,
      ferias_proporcionais: data.ferias_proporcionais,
      terco_ferias: data.terco_ferias,
      decimo_proporcional: data.decimo_proporcional,
      multa_fgts_40: data.multa_fgts_40,
      desconto_inss: data.desconto_inss,
      desconto_irrf: data.desconto_irrf,
      desconto_vt: 0,
      desconto_adiantamento: 0,
      outros_descontos: 0,
      outros_proventos: 0,
    })
  }

  const fmt = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const totalProventos = preview ? (
    Number(edit.saldo_salario || 0) + Number(edit.aviso_previo_valor || 0) +
    Number(edit.ferias_vencidas || 0) + Number(edit.ferias_proporcionais || 0) +
    Number(edit.terco_ferias || 0) + Number(edit.decimo_proporcional || 0) +
    Number(edit.outros_proventos || 0)
  ) : 0

  const totalDescontos = preview ? (
    Number(edit.desconto_inss || 0) + Number(edit.desconto_irrf || 0) +
    Number(edit.desconto_vt || 0) + Number(edit.desconto_adiantamento || 0) +
    Number(edit.outros_descontos || 0)
  ) : 0

  const liquido = totalProventos - totalDescontos
  const custoEmpresa = preview ? totalProventos + Number(preview.fgts_mes || 0) + Number(preview.fgts_aviso || 0) + Number(preview.fgts_13 || 0) + Number(edit.multa_fgts_40 || 0) : 0

  async function salvar(status: 'rascunho' | 'homologada') {
    if (!preview) { toast.error('Calcule primeiro'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: alocacao } = await supabase.from('alocacoes')
      .select('id, obra_id').eq('funcionario_id', form.funcionario_id).order('data_inicio', { ascending: false }).limit(1).maybeSingle()

    const { data, error } = await supabase.from('rescisoes').insert({
      funcionario_id: form.funcionario_id,
      alocacao_id: alocacao?.id ?? null,
      obra_id: alocacao?.obra_id ?? null,
      tipo: form.tipo,
      aviso_previo_tipo: form.aviso_previo_tipo,
      aviso_previo_dias: preview.aviso_dias,
      data_aviso: form.data_desligamento,
      data_desligamento: form.data_desligamento,
      salario_base_rescisao: preview.salario_base,
      salario_total_rescisao: preview.salario_total,
      saldo_salario: edit.saldo_salario,
      aviso_previo_valor: edit.aviso_previo_valor,
      ferias_vencidas: edit.ferias_vencidas,
      ferias_proporcionais: edit.ferias_proporcionais,
      terco_ferias: edit.terco_ferias,
      decimo_proporcional: edit.decimo_proporcional,
      fgts_mes: preview.fgts_mes,
      fgts_aviso: preview.fgts_aviso,
      fgts_13: preview.fgts_13,
      fgts_saldo_estimado: preview.fgts_saldo_estimado,
      multa_fgts_40: edit.multa_fgts_40,
      outros_proventos: edit.outros_proventos,
      desconto_inss: edit.desconto_inss,
      desconto_irrf: edit.desconto_irrf,
      desconto_vt: edit.desconto_vt,
      desconto_adiantamento: edit.desconto_adiantamento,
      outros_descontos: edit.outros_descontos,
      total_proventos: totalProventos,
      total_descontos: totalDescontos,
      valor_liquido: liquido,
      custo_total_empresa: custoEmpresa,
      status,
      homologada_em: status === 'homologada' ? new Date().toISOString() : null,
      homologada_por: status === 'homologada' ? user?.id : null,
      created_by: user?.id ?? null,
    }).select().single()

    if (error) { toast.error('Erro: ' + error.message); setSaving(false); return }

    // Se homologada, gera lançamento no financeiro
    if (status === 'homologada' && data) {
      const funcNome = funcionarios.find(f => f.id === form.funcionario_id)?.nome || 'Funcionário'
      const { data: lanc } = await supabase.from('financeiro_lancamentos').insert({
        obra_id: alocacao?.obra_id ?? null,
        tipo: 'despesa',
        nome: `Rescisão — ${funcNome}`,
        categoria: 'Rescisão',
        valor: liquido,
        status: 'em_aberto',
        data_competencia: form.data_desligamento,
        data_vencimento: form.data_desligamento,
        origem: 'rescisao',
        observacao: `Rescisão homologada ref ${data.id}`,
        created_by: user?.id ?? null,
      }).select().single()
      if (lanc) {
        await supabase.from('rescisoes').update({ financeiro_lancamento_id: lanc.id }).eq('id', data.id)
      }
    }

    toast.success(status === 'homologada' ? 'Rescisão homologada e lançada no financeiro' : 'Rascunho salvo')
    router.push(`/rh/rescisoes/${data.id}`)
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/rh/rescisoes" />
        <span className="text-gray-400">Rescisões</span>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">Nova</span>
      </div>

      <h1 className="text-xl font-bold font-display text-brand mb-1">Nova rescisão</h1>
      <p className="text-sm text-gray-500 mb-6">Cálculo automático pela CLT, com todos os valores editáveis antes de homologar.</p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
        <h2 className="text-sm font-bold text-brand mb-3">1. Dados do desligamento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Funcionário</label>
            <select value={form.funcionario_id} onChange={e => setForm({ ...form, funcionario_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">— Selecione —</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} · {f.cargo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Data desligamento</label>
            <input type="date" value={form.data_desligamento} onChange={e => setForm({ ...form, data_desligamento: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Tipo</label>
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              {TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Aviso prévio</label>
            <select value={form.aviso_previo_tipo} onChange={e => setForm({ ...form, aviso_previo_tipo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="indenizado">Indenizado</option>
              <option value="trabalhado">Trabalhado</option>
              <option value="dispensado">Dispensado (sem pagamento)</option>
              <option value="nao_aplicavel">Não aplicável</option>
            </select>
          </div>
          <div className="sm:col-span-2 flex items-end">
            <button onClick={calcular} disabled={loading}
              className="w-full px-4 py-2 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-dark disabled:opacity-50 flex items-center justify-center gap-2">
              <Calculator className="w-4 h-4" /> {loading ? 'Calculando...' : 'Calcular rescisão'}
            </button>
          </div>
        </div>
      </div>

      {preview && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
          <h2 className="text-sm font-bold text-brand mb-1">2. Verbas calculadas (editáveis)</h2>
          <p className="text-xs text-gray-500 mb-4">
            {preview.funcionario_nome} · Admissão {new Date(preview.admissao + 'T12:00').toLocaleDateString('pt-BR')} ·
            {' '}{preview.meses_empresa} meses · Salário {fmt(preview.salario_total)}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-bold text-green-700 uppercase tracking-wide mb-2">Proventos</h3>
              {[
                ['saldo_salario', 'Saldo de salário'],
                ['aviso_previo_valor', `Aviso prévio (${preview.aviso_dias}d)`],
                ['ferias_vencidas', 'Férias vencidas'],
                ['ferias_proporcionais', 'Férias proporcionais'],
                ['terco_ferias', '1/3 constitucional'],
                ['decimo_proporcional', '13º proporcional'],
                ['outros_proventos', 'Outros proventos'],
              ].map(([k, l]) => (
                <div key={k} className="flex items-center gap-2 mb-1.5">
                  <label className="text-xs text-gray-600 flex-1">{l}</label>
                  <input type="number" step="0.01" value={edit[k] || 0}
                    onChange={e => setEdit({ ...edit, [k]: e.target.value })}
                    className="w-32 px-2 py-1 border border-gray-200 rounded text-sm text-right" />
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-sm font-bold">
                <span className="text-green-700">Total proventos</span>
                <span className="text-green-700">{fmt(totalProventos)}</span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">Descontos</h3>
              {[
                ['desconto_inss', 'INSS'],
                ['desconto_irrf', 'IRRF'],
                ['desconto_vt', 'VT'],
                ['desconto_adiantamento', 'Adiantamentos'],
                ['outros_descontos', 'Outros descontos'],
              ].map(([k, l]) => (
                <div key={k} className="flex items-center gap-2 mb-1.5">
                  <label className="text-xs text-gray-600 flex-1">{l}</label>
                  <input type="number" step="0.01" value={edit[k] || 0}
                    onChange={e => setEdit({ ...edit, [k]: e.target.value })}
                    className="w-32 px-2 py-1 border border-gray-200 rounded text-sm text-right" />
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-sm font-bold">
                <span className="text-red-700">Total descontos</span>
                <span className="text-red-700">{fmt(totalDescontos)}</span>
              </div>

              <h3 className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-2 mt-4">FGTS + Multa</h3>
              <div className="text-xs text-gray-500 space-y-0.5">
                <div className="flex justify-between"><span>FGTS mês</span><span>{fmt(preview.fgts_mes)}</span></div>
                <div className="flex justify-between"><span>FGTS aviso</span><span>{fmt(preview.fgts_aviso)}</span></div>
                <div className="flex justify-between"><span>FGTS 13º</span><span>{fmt(preview.fgts_13)}</span></div>
                <div className="flex justify-between"><span>Saldo FGTS estimado</span><span>{fmt(preview.fgts_saldo_estimado)}</span></div>
                <div className="flex items-center gap-2 mt-1">
                  <label className="text-xs text-gray-600 flex-1 font-semibold">Multa 40% FGTS</label>
                  <input type="number" step="0.01" value={edit.multa_fgts_40 || 0}
                    onChange={e => setEdit({ ...edit, multa_fgts_40: e.target.value })}
                    className="w-32 px-2 py-1 border border-gray-200 rounded text-sm text-right" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t-2 border-brand/20 grid grid-cols-2 gap-4">
            <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
              <div className="text-[10px] text-green-600 font-semibold uppercase">Líquido ao funcionário</div>
              <div className="text-2xl font-bold text-green-700 font-display">{fmt(liquido)}</div>
            </div>
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
              <div className="text-[10px] text-red-600 font-semibold uppercase">Custo total empresa</div>
              <div className="text-2xl font-bold text-red-700 font-display">{fmt(custoEmpresa)}</div>
              <div className="text-[10px] text-red-500 mt-0.5">Inclui FGTS + multa 40%</div>
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-5">
            <button onClick={() => salvar('rascunho')} disabled={saving}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">
              Salvar rascunho
            </button>
            <button onClick={() => salvar('homologada')} disabled={saving}
              className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brand-dark disabled:opacity-50 flex items-center gap-2">
              <Save className="w-4 h-4" /> Homologar e lançar no financeiro
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

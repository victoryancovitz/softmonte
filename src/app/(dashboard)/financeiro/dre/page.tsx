import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import BackButton from '@/components/BackButton'
import DreClient from './DreClient'

export default async function DrePage() {
  const supabase = createClient()

  const [{ data: dre }, { data: dreMes }, { data: custos }, { data: lancamentos }, { data: empresaArr }, { data: contasSaldo }, { data: ccsAdm }, { data: obrasAtivas }, { data: rateioConfigArr }, { data: distribuicoes }, { data: contingenciasArr }] = await Promise.all([
    supabase.from('vw_dre_obra').select('*').limit(500),
    supabase.from('vw_dre_obra_mes').select('*').limit(500),
    supabase.from('vw_custo_funcionario').select('*'),
    supabase.from('financeiro_lancamentos').select('*, centros_custo(codigo, nome, tipo, obra_id)').is('deleted_at', null).order('data_competencia').limit(5000),
    supabase.from('empresa_config').select('regime_tributario, aliquota_simples_efetiva, aliquota_iss, aliquota_pis, aliquota_cofins, aliquota_ir, aliquota_csll, capital_social').limit(1),
    supabase.from('vw_contas_saldo').select('*'),
    supabase.from('centros_custo').select('id, codigo, nome, tipo').eq('tipo', 'administrativo').eq('ativo', true),
    supabase.from('obras').select('id, nome, data_inicio, data_fim, status').in('status', ['em_andamento', 'planejamento']),
    supabase.from('cc_rateio_config').select('*').order('created_at', { ascending: false }).limit(1),
    supabase.from('movimentacoes_societarias').select('*').eq('tipo', 'distribuicao_lucro'),
    supabase.from('processos_juridicos').select('valor_provisionado').is('deleted_at', null).eq('prognostico', 'provavel'),
  ])
  const empresa = (empresaArr ?? [])[0] ?? { regime_tributario: 'lucro_presumido', capital_social: 100000, aliquota_iss: 0.02, aliquota_pis: 0.0065, aliquota_cofins: 0.03, aliquota_ir: 0.048, aliquota_csll: 0.0288 }
  const contingenciasJuridicas = (contingenciasArr ?? []).reduce((s: number, p: any) => s + Number(p.valor_provisionado || 0), 0)

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6 text-sm">
        <BackButton fallback="/financeiro" />
        <Link href="/financeiro" className="text-gray-400 hover:text-gray-600">Financeiro</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">DRE & Resultado</span>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold font-display text-brand mb-1">DRE & Resultado</h1>
          <p className="text-sm text-gray-500">Demonstrativo de resultado, margem por contrato e custo de MO por funcionário.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/forecast" className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Forecast</Link>
          <Link href="/relatorios/bm-comparativo" className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">BM Comparativo</Link>
        </div>
      </div>

      <DreClient
        dre={dre ?? []}
        dreMes={dreMes ?? []}
        custos={custos ?? []}
        lancamentos={lancamentos ?? []}
        empresa={empresa}
        contasSaldo={contasSaldo ?? []}
        ccsAdm={ccsAdm ?? []}
        obrasAtivas={obrasAtivas ?? []}
        rateioConfig={(rateioConfigArr ?? [])[0] ?? null}
        distribuicoes={distribuicoes ?? []}
        contingenciasJuridicas={contingenciasJuridicas}
      />
    </div>
  )
}

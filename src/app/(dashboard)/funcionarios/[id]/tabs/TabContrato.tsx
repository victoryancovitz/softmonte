import Link from 'next/link'

const STATUS_COLOR: Record<string, string> = {
  disponivel: 'bg-green-100 text-green-700 border-green-200',
  alocado: 'bg-blue-100 text-blue-700 border-blue-200',
  afastado: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  inativo: 'bg-gray-100 text-gray-500 border-gray-200',
}

const TIPO_VINCULO_LABEL: Record<string, string> = {
  experiencia_45_45: 'Experiência 45+45 dias',
  experiencia_30_60: 'Experiência 30+60 dias',
  experiencia_90: 'Experiência 90 dias',
  determinado_6m: 'Determinado 6 meses',
  determinado_12m: 'Determinado 12 meses',
  indeterminado: 'Indeterminado (CLT)',
  temporario: 'Temporário',
}

interface TabContratoProps {
  f: any
  prazos: any
  prazo1Badge: { label: string; cls: string } | null
  prazo2Badge: { label: string; cls: string } | null
  podeFerias: boolean
  feriasAtrasada: boolean
  proximoPeriodoFerias: Date | null
  fmtD: (d: string | null | undefined) => string
}

export default function TabContrato({
  f, prazos, prazo1Badge, prazo2Badge,
  podeFerias, feriasAtrasada, proximoPeriodoFerias, fmtD,
}: TabContratoProps) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contrato e vínculo</h2>
          <Link href={`/funcionarios/${f.id}/editar`} className="text-[11px] text-brand hover:underline">Editar</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {[
            ['Tipo de vínculo', f.tipo_vinculo ? (TIPO_VINCULO_LABEL[f.tipo_vinculo] ?? f.tipo_vinculo) : '—'],
            ['Data de admissão', fmtD(f.admissao)],
            ['Cargo', f.cargo],
            ['Turno', f.turno],
            ['Jornada', `${f.horas_mes ?? 220}h/mês`],
            ['Status', <span key="s" className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${STATUS_COLOR[f.status] ?? 'bg-gray-100'}`}>{f.status}</span>],
          ].map(([k, v], i) => (
            <div key={i} className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-[11px] text-gray-500">{k}</span>
              <span className="text-xs font-medium text-gray-800">{v}</span>
            </div>
          ))}
          {f.prazo1 && (
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-[11px] text-gray-500">1º período exp.</span>
              <span className="text-xs font-medium flex items-center gap-1.5">
                {fmtD(f.prazo1)}
                {prazo1Badge && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${prazo1Badge.cls}`}>{prazo1Badge.label}</span>}
              </span>
            </div>
          )}
          {f.prazo2 && (
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-[11px] text-gray-500">2º período exp.</span>
              <span className="text-xs font-medium flex items-center gap-1.5">
                {fmtD(f.prazo2)}
                {prazo2Badge && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${prazo2Badge.cls}`}>{prazo2Badge.label}</span>}
              </span>
            </div>
          )}
          <div className="flex justify-between py-1 border-b border-gray-50">
            <span className="text-[11px] text-gray-500">Renovação</span>
            <span className={`text-xs font-medium ${f.nao_renovar ? 'text-red-700' : 'text-gray-800'}`}>
              {f.nao_renovar ? '⚠ NÃO RENOVAR' : 'Permitida'}
            </span>
          </div>
        </div>
        {f.nao_renovar && f.observacao_renovacao && (
          <p className="text-[11px] text-red-600 mt-3 p-2 bg-red-50 rounded-lg">Motivo: {f.observacao_renovacao}</p>
        )}
      </div>

      {/* Prazos legais & férias */}
      {prazos && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Prazos legais & férias</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {f.admissao && (
              <>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-[11px] text-gray-500">Pode tirar férias</span>
                  <span className="text-xs font-medium flex items-center gap-2">
                    {proximoPeriodoFerias?.toLocaleDateString('pt-BR')}
                    {podeFerias && !feriasAtrasada && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">DISPONÍVEL</span>}
                    {feriasAtrasada && <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">EM ATRASO</span>}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-[11px] text-gray-500">Saldo de férias</span>
              <span className="text-xs font-bold text-brand">{prazos.saldo_ferias ?? 0} dias</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-50">
              <span className="text-[11px] text-gray-500">Converteu p/ CLT</span>
              <span className={`text-xs font-medium ${prazos.ja_converteu_clt ? 'text-green-700' : 'text-gray-400'}`}>
                {prazos.ja_converteu_clt ? 'Sim' : 'Não'}
              </span>
            </div>
            {prazos.proximas_ferias_inicio && (
              <div className="flex justify-between py-1 border-b border-gray-50 sm:col-span-2">
                <span className="text-[11px] text-gray-500">Próximas férias</span>
                <span className="text-xs font-medium text-green-700">
                  {fmtD(prazos.proximas_ferias_inicio)} → {fmtD(prazos.proximas_ferias_fim)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

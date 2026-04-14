import Link from 'next/link'

const FALTAS_TIPO_BADGE: Record<string, string> = {
  falta_injustificada: 'bg-red-100 text-red-700',
  falta_justificada: 'bg-orange-100 text-orange-700',
  atestado_medico: 'bg-blue-100 text-blue-700',
  atestado_acidente: 'bg-blue-100 text-blue-700',
  licenca_maternidade: 'bg-green-100 text-green-700',
  licenca_paternidade: 'bg-green-100 text-green-700',
  folga_compensatoria: 'bg-gray-100 text-gray-600',
  feriado: 'bg-gray-100 text-gray-600',
  suspensao: 'bg-red-100 text-red-700',
  outro: 'bg-gray-100 text-gray-600',
}

const FALTAS_TIPO_LABEL: Record<string, string> = {
  falta_injustificada: 'FALTA', falta_justificada: 'JUST.',
  atestado_medico: 'ATESTADO', atestado_acidente: 'ACIDENTE',
  licenca_maternidade: 'LIC. MAT.', licenca_paternidade: 'LIC. PAT.',
  folga_compensatoria: 'FOLGA', feriado: 'FERIADO',
  suspensao: 'SUSPENSAO', outro: 'OUTRO',
}

interface TabPontoProps {
  efetivo30: any[] | null
  faltas: any[] | null
  diasTrabalhados30: number
  fmtD: (d: string | null | undefined) => string
}

export default function TabPonto({ efetivo30, faltas, diasTrabalhados30, fmtD }: TabPontoProps) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ponto — últimos 30 dias</h2>
          <span className="text-[11px] text-gray-500">{diasTrabalhados30} dias presentes</span>
        </div>
        {efetivo30 && efetivo30.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {efetivo30.map((e: any, i: number) => (
              <div key={i} className="w-9 h-9 rounded-lg bg-green-100 text-green-700 text-[11px] font-bold flex items-center justify-center"
                title={`${fmtD(e.data)} · ${e.obras?.nome || ''}`}>
                {new Date(e.data + 'T12:00').getDate()}
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-gray-400 italic">Nenhum registro.</p>}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Faltas e atestados</h2>
          <Link href="/faltas/nova" className="text-[11px] text-brand hover:underline">+ Registrar</Link>
        </div>
        {faltas && faltas.length > 0 ? (
          <div className="space-y-1">
            {faltas.map((ft: any) => (
              <div key={ft.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${FALTAS_TIPO_BADGE[ft.tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                    {FALTAS_TIPO_LABEL[ft.tipo] ?? ft.tipo}
                  </span>
                  <span className="text-xs text-gray-500">{fmtD(ft.data)}</span>
                </div>
                <span className="text-xs text-gray-400 truncate max-w-[250px]">{ft.observacao || ''}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-gray-400 italic">Nenhuma falta ou atestado.</p>}
      </div>
    </div>
  )
}

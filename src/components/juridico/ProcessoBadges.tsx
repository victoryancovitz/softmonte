import type { ProcessoStatus, ProcessoPrognostico, ProcessoTipo } from '@/types/juridico'

const STATUS_STYLES: Record<ProcessoStatus, string> = {
  inicial: 'bg-slate-100 text-slate-700',
  instrucao: 'bg-blue-100 text-blue-700',
  sentenca: 'bg-indigo-100 text-indigo-700',
  recurso: 'bg-purple-100 text-purple-700',
  execucao: 'bg-orange-100 text-orange-700',
  acordo: 'bg-emerald-100 text-emerald-700',
  arquivado: 'bg-zinc-200 text-zinc-600',
  extinto: 'bg-zinc-300 text-zinc-500',
}
const STATUS_LABELS: Record<ProcessoStatus, string> = {
  inicial: 'Inicial', instrucao: 'Instrução', sentenca: 'Sentença', recurso: 'Recurso',
  execucao: 'Execução', acordo: 'Acordo', arquivado: 'Arquivado', extinto: 'Extinto',
}

export function ProcessoStatusBadge({ status }: { status: ProcessoStatus }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] || 'bg-gray-100'}`}>{STATUS_LABELS[status] || status}</span>
}

const PROG_STYLES: Record<ProcessoPrognostico, string> = {
  provavel: 'bg-red-100 text-red-700', possivel: 'bg-amber-100 text-amber-700',
  remoto: 'bg-emerald-100 text-emerald-700', nao_avaliado: 'bg-slate-100 text-slate-600',
}
const PROG_LABELS: Record<ProcessoPrognostico, string> = {
  provavel: 'Provável', possivel: 'Possível', remoto: 'Remoto', nao_avaliado: 'Não avaliado',
}

export function PrognosticoBadge({ prognostico, hidden }: { prognostico: ProcessoPrognostico; hidden?: boolean }) {
  if (hidden) return null
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PROG_STYLES[prognostico] || 'bg-gray-100'}`}>{PROG_LABELS[prognostico] || prognostico}</span>
}

const TIPO_STYLES: Record<ProcessoTipo, string> = {
  trabalhista: 'bg-orange-100 text-orange-700', civel: 'bg-sky-100 text-sky-700',
  tributario: 'bg-violet-100 text-violet-700', administrativo: 'bg-cyan-100 text-cyan-700',
  criminal: 'bg-rose-100 text-rose-700',
}
const TIPO_LABELS: Record<ProcessoTipo, string> = {
  trabalhista: 'Trabalhista', civel: 'Cível', tributario: 'Tributário',
  administrativo: 'Administrativo', criminal: 'Criminal',
}

export function TipoProcessoBadge({ tipo }: { tipo: ProcessoTipo }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_STYLES[tipo] || 'bg-gray-100'}`}>{TIPO_LABELS[tipo] || tipo}</span>
}

export function formatTipoDesligamento(tipo: string): string {
  const MAP: Record<string, string> = {
    demissao_sem_justa_causa: 'Sem Justa Causa',
    sem_justa_causa: 'Sem Justa Causa',
    demissao_por_justa_causa: 'Por Justa Causa',
    justa_causa: 'Por Justa Causa',
    pedido_demissao: 'Pedido de Demissão',
    termino_contrato: 'Término de Contrato',
    aposentadoria: 'Aposentadoria',
    falecimento: 'Falecimento',
    acordo_mutual: 'Acordo Mútuo',
    acordo: 'Acordo Mútuo',
  }
  return MAP[tipo] ?? tipo.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function formatStatus(status: string): string {
  const MAP: Record<string, string> = {
    ativo: 'Ativo', em_aberto: 'Em Aberto', pago: 'Pago',
    cancelado: 'Cancelado', concluido: 'Concluído',
    em_andamento: 'Em Andamento', pausado: 'Pausado',
    provisionado: 'Provisão', atrasado: 'Atrasado',
    pendente: 'Pendente', aberto: 'Aberto', fechado: 'Fechado',
    enviado: 'Enviado', aprovado: 'Aprovado',
  }
  return MAP[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

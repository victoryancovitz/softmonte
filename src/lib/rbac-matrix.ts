/**
 * Matriz central de permissões por ação/módulo.
 *
 * Use sempre uma constante daqui em vez de hardcodar arrays nos route handlers.
 * Mantém consistência e facilita auditoria.
 *
 * Fonte de verdade do role do usuário: tabela `user_roles` (ver project_softmonte memory).
 *
 * Roles disponíveis (app_role enum):
 *   admin, rh, financeiro, juridico, engenharia, compras, cliente, diretoria
 */

export const RBAC = {
  // Acesso amplo — ações que tocam o sistema todo
  ADMIN_ONLY: ['admin'] as const,
  ADMIN_DIRETORIA: ['admin', 'diretoria'] as const,

  // RH
  RH: ['admin', 'rh'] as const,
  RH_AMPLO: ['admin', 'diretoria', 'rh'] as const,

  // Financeiro
  FINANCEIRO: ['admin', 'financeiro'] as const,
  FINANCEIRO_AMPLO: ['admin', 'diretoria', 'financeiro'] as const,
  FINANCEIRO_E_RH: ['admin', 'rh', 'financeiro'] as const,

  // Operacional — quem mexe em obra/BM/RDO
  OPERACIONAL: ['admin', 'diretoria', 'engenharia', 'encarregado'] as const,
  // Quem pode VER boletins / relatórios cross-módulo
  RELATORIOS: ['admin', 'financeiro', 'encarregado', 'engenheiro', 'rh'] as const,

  // Assistant/Chat — qualquer um que opera o sistema (exclui só cliente/funcionario externo)
  ASSISTANT: ['admin', 'financeiro', 'rh', 'encarregado', 'engenheiro'] as const,

  // Mensageria (WhatsApp, notificações)
  WHATSAPP_SEND: ['admin', 'diretoria', 'rh'] as const,
} as const

export type RbacGroup = keyof typeof RBAC

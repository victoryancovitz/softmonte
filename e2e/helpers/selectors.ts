/** Seletores reutilizáveis para componentes da plataforma */

export const sel = {
  // Toast (Sonner)
  toast: '[data-sonner-toast]',
  toastSuccess: '[data-sonner-toast][data-type="success"]',
  toastError: '[data-sonner-toast][data-type="error"]',
  toastWarning: '[data-sonner-toast][data-type="warning"]',

  // Botões comuns
  btnSalvar: 'button:has-text("Salvar")',
  btnCancelar: 'button:has-text("Cancelar")',
  btnAvancar: 'button:has-text("Salvar e avançar"), button:has-text("Avançar")',
  btnFechar: 'button:has-text("Fechar")',
  btnExcluir: 'button:has-text("Excluir"), button:has-text("Desativar")',
  btnConfirmar: 'button:has-text("Confirmar")',

  // Modals
  modal: '[role="dialog"], .fixed.inset-0',
  modalContent: '[role="dialog"] > div, .fixed.inset-0 > div',

  // Topbar
  topbar: 'header, nav',
  userMenu: '[data-testid="user-menu"], button[aria-label="Menu do usuário"]',

  // Tabela
  tableRow: 'tbody tr',
  tableCell: 'td',

  // Select de obra (primeiro select na maioria das páginas)
  selectObra: 'select:first-of-type',

  // Wizard
  wizardStepper: '[data-testid="stepper"], .flex.items-center.gap',
  wizardStep: (n: number) => `[data-step="${n}"], button:has-text("${n}")`,

  // Inputs
  inputNome: 'input[name="nome"], input[placeholder*="nome" i]',
  inputCpf: 'input[name="cpf"], input[placeholder*="CPF" i]',
  inputEmail: 'input[name="email"], input[type="email"]',
  inputSalario: 'input[name="salario_base"], input[placeholder*="salário" i]',

  // Empty states
  emptyState: '[class*="empty"], div:has-text("Nenhum")',

  // IA
  iaButton: 'button:has-text("✨"), [aria-label*="Assistente"]',
  iaDrawer: 'aside[role="dialog"]',
}

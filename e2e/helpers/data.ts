/** Gerador de dados fake para testes E2E */

let counter = 0

export const fake = {
  /** Nome prefixado com TESTE_ para fácil cleanup */
  nome: () => `TESTE_${++counter}_${Date.now().toString(36).slice(-4).toUpperCase()}`,

  /** CPF matematicamente válido (usado em testes de criação) */
  cpfValido: () => '529.982.247-25',

  /** CPF formatado diferente para testes de duplicidade */
  cpfValidoAlt: () => '861.945.710-69',

  /** CPF inválido (dígito verificador errado) */
  cpfInvalido: () => '123.456.789-00',

  /** Email de teste com timestamp */
  email: (sufixo?: string) => `teste+${sufixo ?? Date.now()}@tecnomonte.com.br`,

  /** Data de hoje no formato YYYY-MM-DD */
  hoje: () => new Date().toISOString().split('T')[0],

  /** Data no passado */
  nascimento: () => '1990-05-15',

  /** Cargo aleatório dentre os existentes */
  cargo: () => {
    const cargos = ['AJUDANTE', 'SOLDADOR', 'CALDEIREIRO', 'ELETRICISTA', 'MONTADOR']
    return cargos[Math.floor(Math.random() * cargos.length)]
  },

  /** Salário base para testes CLT */
  salario: () => 3500,

  /** Dados de edge case para segurança */
  edge: {
    xss: '<script>alert("xss")</script>',
    xssImg: '<img src=x onerror=alert(1)>',
    sqlInjection: "' OR 1=1--",
    sqlInjectionEmail: "' OR 1=1--@x.com",
    unicode: 'JOSE D\'AVILA N MARTINEZ',
    longo: 'A'.repeat(500),
    vazio: '',
    soEspacos: '   ',
  },
}

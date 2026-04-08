# Testes automatizados

A plataforma usa **Vitest** + **@testing-library/react** + **jsdom**.

## Setup

Dependências já em `package.json`:
```bash
npm install
```

## Rodar

```bash
npm test             # roda uma vez
npm run test:watch   # modo watch (reroda em mudanças)
npm run test:ui      # interface web do vitest
```

## Estrutura

Os testes ficam ao lado do código em pastas `__tests__/`:

```
src/
├── lib/
│   ├── rate-limit.ts
│   ├── __tests__/
│   │   ├── rate-limit.test.ts
│   │   └── impact.test.ts
│   └── ...
└── components/
    ├── __tests__/
    └── ...
```

## O que já existe

- `rate-limit.test.ts` — garante que o rate limiter respeita limites e isola buckets
- `impact.test.ts` — smoke test do helper de cálculo de impacto

## Próximos testes críticos (a adicionar conforme prioridade)

### Unitários (lib/)
- [ ] `require-role.test.ts` — cobrir todos os paths de autenticação/autorização
- [ ] `logger.test.ts` — formato de saída
- [ ] `impact.test.ts` — testar cada regra (funcao, obra, funcionario, etc.)

### Funções Postgres (via pgTAP ou integração)
- [ ] `calcular_rescisao` — cenários: sem justa causa, justa causa, fim contrato, comum acordo
- [ ] `calcular_horas_ponto` — 7 casos já validados manualmente na sessão de desenvolvimento
- [ ] `aplicar_correcao_salarial` — dry run vs apply

### Componentes (components/)
- [ ] `ImpactConfirmDialog` — carrega impactos, bloqueia até digitar "EXCLUIR"
- [ ] `QuickCreateSelect` — renderiza lista, abre modal, cria entidade
- [ ] `FuncionarioHistoricoSalarial` — timeline ordenada, cores por motivo
- [ ] `PontoCellEditor` — modo simples vs detalhado
- [ ] `PagamentosExtrasFuncionario` — CRUD + detecção de habitualidade

### E2E (Playwright — adicionar quando necessário)
- [ ] Fluxo de admissão completo
- [ ] Fluxo de fechar folha → lançamento no financeiro
- [ ] Fluxo de desligamento → criação automática de rescisão
- [ ] Fluxo de importação biométrica com XLSX

## Convenções

- Um `describe` por função/componente
- Nome do teste em português, começando com verbo
- Mocks de Supabase: usar objeto plain com funções `from/select/eq/etc.` que retornam Promises
- Preferir testar comportamento (o que acontece) ao invés de implementação (como acontece)

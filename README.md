# Softmonte

Plataforma de gestão operacional para a Tecnomonte (montagem industrial de tanques e equipamentos).
Centraliza obras, funcionários, ponto, boletins de medição, folha de pagamento, rescisões, financeiro e relatórios gerenciais.

## Stack

- **Next.js 14** (App Router, Server Components, Route Handlers)
- **React 18** + **TypeScript** (strict mode)
- **Tailwind CSS**
- **Supabase** (PostgreSQL 17 + Auth + Storage + RLS)
- **ExcelJS / JSZip** para import/export
- **Lucide icons** + **Serwist** (PWA)
- Deploy em **Vercel** (push em `main` → auto-deploy)

## Setup local

### 1. Requisitos
- Node.js 20+
- npm ou pnpm
- Acesso a um projeto Supabase (dev ou o próprio prod se autorizado)

### 2. Instalação
```bash
git clone https://github.com/victoryancovitz/softmonte.git
cd softmonte
npm install
cp .env.example .env.local
# preencha .env.local com os valores reais
npm run dev
```

Abrir http://localhost:3000.

### 3. Variáveis de ambiente

Ver `.env.example` na raiz. Obrigatórias:

| Variável | Obrigatório | Onde usar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | Cliente + servidor |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Cliente + servidor (RLS aplicada) |
| `SUPABASE_SERVICE_ROLE_KEY` | Opcional | Apenas server-side em rotas `/api/*` que precisam bypass de RLS |
| `ANTHROPIC_API_KEY` | Opcional | Assistente IA em `/assistente` |
| `NEXT_PUBLIC_APP_URL` | Opcional | Links em emails e PWA manifest |

### 4. Scripts
```bash
npm run dev     # dev server (localhost:3000)
npm run build   # produção
npm run start   # rodar build local
npm run lint    # next lint
```

## Arquitetura

### Módulos principais

| Módulo | Rota | Conteúdo |
|---|---|---|
| Dashboard | `/dashboard` | KPIs operacionais + alertas |
| Executivo | `/executivo` | Margem × alvo, cashflow 30d, rescisões |
| Engenharia | `/obras`, `/boletins` | Obras, contratos, BMs |
| Administrativo | `/funcionarios`, `/rh/*`, `/ponto`, `/faltas`, `/documentos`, `/alocacao` | RH completo |
| Compras | `/estoque`, `/compras/*` | Almoxarifado e fornecedores |
| Financeiro | `/financeiro`, `/relatorios/*`, `/forecast` | Lançamentos, DRE, cashflow, forecast |
| Cadastros | `/cadastros/*`, `/clientes`, `/tipos-contrato` | Tabelas auxiliares |
| Portal | `/portal/*` | Self-service do funcionário |

### Padrões de código

- **Server components por padrão**, client components (`'use client'`) só quando precisar de `useState`/`useEffect` ou eventos
- **RLS ativa em todas as tabelas** — não usar service_role_key no cliente
- **Middleware** em `src/middleware.ts` redireciona rotas não autenticadas para `/login`
- **Layouts protetores**: `/admin/*` usa `requireRole(['admin'])` via `src/lib/require-role.ts`
- **Error boundary**: `src/app/(dashboard)/error.tsx` captura erros de render
- **Toast**: único provider em `src/components/Toast.tsx` (43 imports)
- **Delete confirmations**: padrão em `src/components/ImpactConfirmDialog.tsx` e `DeleteEntityButton.tsx` — ver comentário no topo de `DeleteActions.tsx`

### Estrutura de pastas

```
src/
├── app/
│   ├── (dashboard)/        # rotas protegidas
│   │   ├── layout.tsx      # Topbar + ModuleTabs
│   │   ├── error.tsx       # error boundary
│   │   ├── loading.tsx     # loading skeleton global
│   │   └── [módulos]/
│   ├── api/                # route handlers
│   │   ├── chat/           # proxy Anthropic (rate-limited)
│   │   ├── importar/       # import em massa
│   │   ├── boletins/       # export Excel/PDF
│   │   └── notificacoes/
│   ├── login/
│   └── layout.tsx          # root
├── components/             # componentes reutilizáveis
│   ├── Topbar.tsx          # nav principal + MODULE_TABS export
│   ├── ModuleTabs.tsx      # sub-tabs por módulo
│   ├── ImpactConfirmDialog.tsx
│   ├── DeleteEntityButton.tsx
│   ├── Toast.tsx
│   └── ...
├── lib/
│   ├── supabase.ts         # cliente browser
│   ├── supabase-server.ts  # cliente server
│   ├── get-role.ts
│   ├── require-role.ts     # helpers auth
│   ├── rate-limit.ts       # rate limiter in-process
│   ├── logger.ts           # wrappers console + futuro Sentry
│   ├── impact.ts           # regras de impacto para delete dialogs
│   └── types/db.ts         # tipos das principais entidades
└── middleware.ts
```

## Banco de dados

Ver [`docs/SCHEMA.md`](./docs/SCHEMA.md) para visão geral das tabelas, views, funções e triggers.

Schema atual (via `information_schema`):
- **57 tabelas** (funcionarios, obras, alocacoes, efetivo_diario, faltas, boletins_medicao, bm_itens, folha_fechamentos, folha_itens, rescisoes, pagamentos_extras, correcoes_salariais, funcionario_historico_salarial, financeiro_lancamentos, forecast_contrato, contrato_composicao, etc.)
- **26 views** analíticas (vw_dre_obra, vw_dre_obra_mes, vw_custo_funcionario, vw_custo_funcionario_mes, vw_cashflow_projetado, vw_absenteismo, vw_bm_orcado_real, vw_forecast_geral, vw_rescisoes_mes, vw_rescisoes_previstas, vw_pagamentos_extras_mes, vw_alertas_habitualidade, vw_financeiro_resumo_mensal, etc.)
- **28 funções** (calcular_rescisao, calcular_horas_ponto, aplicar_correcao_salarial, gerar_pagamentos_recorrentes, etc.)
- **34 triggers** (auditoria, validação de período, enforcement de regras CLT)

### Schema recreation

O schema foi evoluído organicamente via Supabase MCP durante o desenvolvimento. Para exportar o schema completo para um novo projeto:

```bash
# 1. Conecte-se ao Supabase
pg_dump -h db.wzmkifutluyqzqefrbpp.supabase.co \
        -U postgres \
        -d postgres \
        --schema=public \
        --schema-only \
        --no-owner \
        > supabase/migrations/001_initial_schema.sql

# 2. Aplique em outro projeto
psql -h NOVO_HOST -U postgres -d postgres -f supabase/migrations/001_initial_schema.sql
```

> ⚠️ **Atenção**: As migrations não foram versionadas incrementalmente durante o desenvolvimento. Para aplicar alterações manuais, usar `supabase/migrations/` com naming `NNN_description.sql`.

## Deploy

- **Vercel** está configurado com auto-deploy do branch `main`
- Build command: `next build`
- Output: `.next/`
- Env vars gerenciadas no dashboard do Vercel (copiar de `.env.example`)
- Preview deploys automáticos em PRs

## Observabilidade

- Logs runtime: https://vercel.com/victoryancovitzs-projects/softmonte
- Logs Postgres: Supabase dashboard → Database → Logs
- Não há Sentry configurado (pendente — ver `src/lib/logger.ts` preparado)

## Contribuindo

1. Abra branch a partir de `main`
2. Faça as alterações, commite com mensagens descritivas
3. Rode `npm run build` localmente pra garantir que compila
4. Push + PR
5. Após merge em `main`, deploy automático no Vercel

### Manual de uso

A plataforma tem um manual interno em `/manual` com descrição de cada funcionalidade por módulo.

## Suporte

- **Tecnomonte**: Av. Pio XII, 33 — Nova Paulínia/SP — CEP 13140-289 — CNPJ 31.045.857/0001-51
- **Tech lead**: Victor Yancovitz (<victor_by@hotmail.com>)

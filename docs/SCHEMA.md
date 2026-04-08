# Schema de banco — Softmonte

Snapshot descritivo do schema Supabase `public`. Mantido à mão porque o schema evolui via MCP — não tem arquivos de migration incrementais.

## Visão geral

- **57 tabelas** base
- **26 views** analíticas (todas com `security_invoker=true` desde 2026-04-08)
- **28 funções** (incluindo 3 core: `calcular_rescisao`, `calcular_horas_ponto`, `aplicar_correcao_salarial`)
- **34 triggers** (auditoria, enforcement de regras CLT, logging automático de mudanças salariais)

## Domínios

### 1. Pessoas
- `funcionarios` — cadastro mestre (salário, admissão, contrato, benefícios, etc.)
- `funcao_id` → `funcoes` (catálogo de cargos com salário base, piso CLT, CBO, jornada padrão, periculosidade/insalubridade padrão)
- `alocacoes` — vínculo funcionário × obra (um ativo por vez, enforced via trigger)
- `vinculos_funcionario` — histórico de vínculos anteriores na empresa (pelo CPF)
- `funcionario_historico_salarial` — trilha imutável de mudanças salariais
- `profiles` (Supabase Auth) — usuários da plataforma com `role`

### 2. Obras & Contratos
- `obras` — obras com escopo completo: contrato, modelo_cobranca (hh_diaria|hh_hora_efetiva|hh_220), escala de trabalho, percentuais de HE
- `clientes` — clientes faturados
- `tipos_contrato` — templates de contrato (HH-Diária, HH-Hora Efetiva, HH-220, Parada Programada, Manutenção por Demanda, Fabricação e Montagem)
- `contrato_composicao` — funções contratadas × valor/hora × quantidade por obra
- `aditivos` — aditivos contratuais
- `forecast_contrato` — receita prevista/realizada mensal por obra

### 3. Operação
- `efetivo_diario` — ponto diário (status do dia + horas + pontos do relógio biométrico se aplicável)
- `faltas` — ausências e atestados
- `banco_horas` — banco de horas lançamentos
- `ferias` — férias gozadas/vendidas
- `boletins_medicao` (bm) — BMs emitidos
- `bm_itens` — linhas do BM (função × tipo_hora × quantidade × valor)
- `bm_documentos` — anexos do BM

### 4. RH
- `admissoes_workflow` — checklist de admissão em andamento
- `desligamentos_workflow` — checklist de desligamento (cria rescisão automaticamente ao concluir)
- `rescisoes` — cálculo CLT completo + status rascunho→homologada→paga
- `folha_fechamentos` + `folha_itens` — fechamento mensal imutável por obra
- `correcoes_salariais` — acordos coletivos/dissídios/méritos aplicados em massa
- `pagamentos_extras` — bônus, comissões, PLR, pagamento por fora (com flags `entra_dre` / `entra_base_legal` / `tributado`)
- `treinamentos` — NRs e treinamentos obrigatórios
- `documentos` — documentos pessoais do funcionário
- `documentos_gerados` — advertências e termos emitidos

### 5. Financeiro
- `financeiro_lancamentos` — receitas e despesas (origem: manual, importado, provisionado, bm_aprovado, folha_fechamento, rescisao, conciliacao_ofx, pagamento_extra)
- `contas_correntes` — contas bancárias
- `categorias` — categorias financeiras
- `ofx_imports` + `ofx_transacoes` — conciliação bancária via OFX

### 6. Almoxarifado & Compras
- `estoque_itens`, `estoque_movimentacoes`
- `fornecedores`, `cotacoes`, `cotacao_itens`, `pedidos`, `pedido_itens`

### 7. Auxiliar
- `notificacoes`, `convites`, `audit_log`, `modelos_documento`, `ponto_fechamentos`

## Views críticas

| View | Propósito |
|---|---|
| `vw_dre_obra` | DRE consolidado por obra |
| `vw_dre_obra_mes` | DRE mês a mês com pagamentos extras |
| `vw_custo_funcionario` | Custo mensal teórico por funcionário |
| `vw_custo_funcionario_mes` | Custo real mês a mês com faltas e HE |
| `vw_cashflow_projetado` | Fluxo de caixa 90 dias |
| `vw_bm_orcado_real` | Comparativo BM × custo real |
| `vw_absenteismo` | Taxa de faltas por funcionário/mês |
| `vw_rescisoes_mes` / `vw_rescisoes_previstas` | Rescisões mensais + previstas |
| `vw_pagamentos_extras_mes` / `vw_pagamentos_extras_func_12m` | Extras mensais e rolling 12m |
| `vw_alertas_habitualidade` | Detecta bônus recorrentes (risco CLT) |
| `vw_financeiro_resumo_mensal` | Receita/despesa/aberto agregados |
| `vw_financeiro_por_categoria` | Despesas por categoria |
| `vw_forecast_geral` | Forecast rollup por obra |
| `vw_prazos_legais` | Prazos de experiência, férias, rescisão |
| `vw_alertas` | Alertas operacionais (ASO vencendo, NR vencendo, etc.) |
| `vw_contas_saldo` | Saldo atual das contas bancárias |

## Funções críticas

| Função | Assinatura | Descrição |
|---|---|---|
| `calcular_rescisao` | `(funcionario_id uuid, data_desligamento date, tipo text, aviso_tipo text) → jsonb` | Aplica CLT completa (avos, INSS/IRRF 2026, multa FGTS 40%, média de bônus 12m na base de cálculo) |
| `calcular_horas_ponto` | `(entrada, saida_almoco, volta_almoco, saida, escala_entrada, escala_saida, almoco_min, tolerancia_min, tipo_dia) → jsonb` | Calcula horas normais/extras/atraso do dia aplicando tolerância CLT, almoço mínimo, escala por dia da semana |
| `aplicar_correcao_salarial` | `(correcao_id uuid, dry_run boolean) → table` | Preview ou apply de reajuste em massa |
| `gerar_pagamentos_recorrentes` | `() → table(criados int)` | Materializa próximos meses de pagamentos_extras com recorrente=true |

## Triggers principais

- `trg_audit_*` em `folha_fechamentos`, `rescisoes` — auto-set de updated_at/updated_by
- `trg_funcionarios_log_salary` — toda mudança de `salario_base` grava em `funcionario_historico_salarial`
- `trg_pe_defaults` — defaults por tipo em `pagamentos_extras` (entra_dre, entra_base_legal, tributado)
- `enforce_efetivo_periodo_funcionario` — bloqueia ponto fora do período admissão → deleted_at
- `enforce_alocacao_unica` — bloqueia múltiplas alocações ativas
- `enforce_bm_aprovado_imutavel` — bloqueia edição de BMs aprovados
- `enforce_obra_ativa_para_lancamento` — bloqueia lançamento em obra cancelada
- `enforce_ponto_fechamento` — bloqueia ponto em mês já fechado

## RLS

Todas as tabelas têm RLS ativada. As policies atuais são permissivas (`USING (true)` para authenticated users) — o enforcement de autorização é feito:
1. Em rotas server-side via `requireRole()` de `src/lib/require-role.ts`
2. Em API routes via `requireRoleApi()` da mesma lib
3. No middleware para rotas não autenticadas

**TODO**: Refinar policies RLS por role quando o modelo de permissões estiver estabilizado.

## Como exportar o schema completo

```bash
# Requer psql instalado e acesso ao banco
pg_dump \
  -h db.wzmkifutluyqzqefrbpp.supabase.co \
  -U postgres \
  -d postgres \
  --schema=public \
  --schema-only \
  --no-owner \
  --no-acl \
  > supabase/migrations/001_initial_schema.sql
```

## Disaster Recovery

- **Backups**: Supabase faz backup automático diário do banco
- **Storage**: bucket `documentos` precisa de backup manual (ou migração para outro provider)
- **Restore testado?**: ❌ Não testado (TODO)

Em caso de necessidade de restore:
1. Solicitar snapshot ao suporte Supabase
2. Criar novo projeto
3. Aplicar snapshot SQL
4. Atualizar env vars no Vercel
5. Re-upload dos arquivos de storage

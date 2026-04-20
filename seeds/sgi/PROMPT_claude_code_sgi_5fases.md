# PROMPT — SGI Administrativo: 5 módulos novos (templates, EPI, OS NR-01, SGI cliente, CBO) + integração com wizard

> **Instrução ao Claude Code:** este é um trabalho grande, em 5 commits sequenciais. Cada fase tem um seed JSON já pronto em `~/softmonte-git/seeds/sgi/` — use sempre os seeds como fonte; não redigite texto. Pare entre as fases pra commitar e reportar o que criou. Só avance após ver o checkpoint verde.

---

## 0. CONTEXTO

Os arquivos que a Tecnomonte mantém em Excel/Word (SGI — Sistema de Gestão Integrada) viram 5 módulos no Softmonte, todos na aba **Administrativo**. Cada módulo é independente em schema mas se amarra no wizard de admissão pra automatizar os 8 checkboxes da "parte da empresa" do checklist oficial de registro (o PDF "DOCUMENTOS NECESSÁRIOS PARA REGISTRO DE FUNCIONÁRIOS"):

1. **Templates de documentos** → gera Termos 1/2, Autorização de Salário, Declaração Portuária, etc.
2. **Catálogo EPI + kits por função** → gera a Ficha de EPI com o kit correto pronto
3. **OS NR-01 por função** → gera a Ordem de Serviço NR-01 individual do funcionário
4. **Checklist SGI por cliente** → valida que funcionário atende pré-requisitos do cliente (AGEO/Cesari) antes da alocação
5. **CBO das funções** → enriquece `funcoes` com descrição oficial CODESP

**Princípio geral:** aditivo, nada quebra. Wizard de admissão atual continua funcionando; cada módulo só acrescenta um ponto de integração.

**Seeds disponíveis** (todos em `~/softmonte-git/seeds/sgi/`):
- `01_templates_documentos.json` (5 templates + dados da empresa Tecnomonte)
- `02_epi_catalogo_kits.json` (28 itens de catálogo + 19 kits por função)
- `03_os_nr01_modelos.json` (15 funções com atividades, riscos, EPIs, medidas)
- `04_sgi_checklists_cliente.json` (AGEO real + Cesari placeholder)
- `05_funcoes_cbo_codesp.json` (18 funções com CBO oficial)

---

## 1. PRÉ-REQUISITOS (antes de tocar Fase 1)

```bash
ls -lh ~/softmonte-git/seeds/sgi/
# Esperado: 5 .json totalizando ~100KB
```

```sql
-- Via Supabase MCP (project wzmkifutluyqzqefrbpp):
-- Descobrir que tabelas relacionadas já existem
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
  AND (table_name ILIKE '%documento%' OR table_name ILIKE '%modelo%'
       OR table_name ILIKE '%template%' OR table_name ILIKE '%epi%'
       OR table_name ILIKE '%nr%' OR table_name ILIKE '%treinamento%'
       OR table_name ILIKE '%sgi%' OR table_name ILIKE '%checklist%'
       OR table_name ILIKE '%os_%' OR table_name ILIKE '%funcao%')
ORDER BY table_name;

-- Ver estrutura atual de funcoes (vai receber colunas cbo e descricao)
\d public.funcoes

-- Ver estrutura de documentos (vai ganhar relação com documento_modelo)
\d public.documentos
```

**Pare aqui e reporte** os nomes de tabela que encontrou + sugestão de nomenclatura pras tabelas novas. Eu aprovo e você segue.

---

## 2. FASE 1 — Templates de documentos

**Commit:** `feat(admin): modelos de documentos preenchíveis + gerador PDF`

### Schema
```sql
CREATE TABLE documento_modelo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,                    -- 'termo_anuencia_he_recibo'
  titulo text NOT NULL,
  descricao text,
  categoria text NOT NULL,                       -- 'trabalhista' | 'financeiro' | 'rescisao' | 'administrativo'
  aplicavel_a text NOT NULL,                     -- 'funcionario_ativo' | 'funcionario_inativo'
  gerar_em_admissao boolean DEFAULT false,
  gerar_em_rescisao boolean DEFAULT false,
  sob_demanda boolean DEFAULT false,
  corpo_markdown text NOT NULL,                  -- template com {{placeholders}}
  placeholders_obrigatorios text[],              -- derivado do corpo
  versao int DEFAULT 1,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz
);

-- Ligação do documento gerado com seu modelo
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS documento_modelo_id uuid REFERENCES documento_modelo(id);
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS gerado_automaticamente boolean DEFAULT false;
```

### Seed
Rodar script de seed a partir de `seeds/sgi/01_templates_documentos.json` — inserir os 5 templates com ON CONFLICT (slug) DO UPDATE.

### Páginas
- `/admin/documentos/modelos` — listagem + CRUD (diretoria, rh podem criar; outros só leem)
- `/admin/documentos/modelos/[slug]/editar` — editor Markdown com preview e painel de placeholders detectados

### Server action
```typescript
// src/app/(dashboard)/admin/documentos/modelos/actions.ts
export async function gerarDocumentoDoModelo(input: {
  modelo_slug: string
  funcionario_id: string
  variaveis_extras?: Record<string, string>  // autorizado.nome, desconto.valor, etc.
}): Promise<{ documento_id: string, pdf_url: string }>
```

Função interna `mergeTemplate(corpo, context)` substitui `{{...}}` pelos valores de:
- `funcionario.*` — lido da tabela `funcionarios` + formatações (`cpf_formatado` aplica máscara)
- `empresa.*` — lido de `empresa_config` (singleton)
- `data_hoje_br`, `data_hoje_extenso` — gerados no momento
- `variaveis_extras.*` — passadas pelo caller (autorizado, desconto, encomenda, etc.)

### Geração de PDF
Usar `@react-pdf/renderer` ou `pdf-lib`. Layout simples: cabeçalho com logo Tecnomonte + CNPJ, corpo Markdown renderizado, linha de assinatura, rodapé com data de geração e hash SHA-256 do conteúdo.

Salvar o PDF em `funcionarios-docs/{funcionario_id}/gerados/{slug}_{timestamp}.pdf`, criar linha em `documentos` com `tipo='TERMO_ANUENCIA'`/`'TERMO_AUTORIZACAO_SALARIO'`/etc conforme slug, `documento_modelo_id` apontando pro template usado, e `gerado_automaticamente=true`.

### Checkpoint Fase 1
```sql
SELECT slug, titulo, gerar_em_admissao, gerar_em_rescisao FROM documento_modelo ORDER BY slug;
-- Esperado: 5 linhas, slugs termo_anuencia_he_recibo / termo_autorizacao_pagamento_salario / declaracao_sem_vinculo_portuaria / autorizacao_desconto_folha / procuracao_retirada_encomenda
```
UI: navegar em `/admin/documentos/modelos`, ver 5 modelos listados, abrir "Termo de Anuência", clicar "Prévia com dados de teste" e ver o PDF renderizado com placeholders substituídos.

---

## 3. FASE 2 — Catálogo de EPI + Kits por função

**Commit:** `feat(admin): catalogo EPI + kits por funcao`

### Schema
```sql
CREATE TABLE epi_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ca text,                                       -- Certificado de Aprovação (nullable para uniformes)
  slug_interno text UNIQUE,                      -- 'calca_brim', 'camisa_manga_longa', etc.
  descricao text NOT NULL,
  categoria text NOT NULL,                       -- 'protecao_cabeca' | 'protecao_pes' | 'uniforme' | etc.
  tipo_tamanho text NOT NULL,                    -- 'unico' | 'numeracao_bota' | 'pp_p_m_g_gg_xg'
  unidade text DEFAULT 'UND',
  valor_ref_unitario numeric(10,2),
  validade_ca_ate date,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT epi_identificador CHECK (ca IS NOT NULL OR slug_interno IS NOT NULL)
);

CREATE TABLE epi_kit_funcao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcao_id uuid NOT NULL REFERENCES funcoes(id),
  epi_catalogo_id uuid NOT NULL REFERENCES epi_catalogo(id),
  quantidade int NOT NULL DEFAULT 1,
  ordem int DEFAULT 0,
  obrigatorio boolean DEFAULT true,
  observacao text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (funcao_id, epi_catalogo_id)
);

-- Ligação da ficha de EPI gerada ao kit de origem
ALTER TABLE epi_entregas ADD COLUMN IF NOT EXISTS origem_kit_funcao_id uuid REFERENCES funcoes(id);
```

### Seed
A partir de `seeds/sgi/02_epi_catalogo_kits.json`:
1. Inserir os 28 itens em `epi_catalogo` (upsert por CA ou slug_interno).
2. Para cada kit em `kits_por_funcao`, resolver `funcao_id` pelo título (exato) e inserir N linhas em `epi_kit_funcao`.

> **Atenção:** o JSON usa `ca_ou_slug` — se é numérico, procura por `ca`; se texto (ex "calca_brim"), procura por `slug_interno`.

### Páginas
- `/admin/sst/epi/catalogo` — listagem + CRUD do catálogo (TST, almoxarife, diretoria)
- `/admin/sst/epi/kits` — listagem por função com visualização "kit completo" (igual layout da ficha em papel)
- `/admin/sst/epi/kits/[funcao]/editar` — drag-drop pra reordenar, editar quantidade, marcar obrigatório/opcional

### Server action
```typescript
export async function obterKitPadraoFuncao(funcao_id: string): Promise<{
  funcao: string
  itens: Array<{ catalogo_id, descricao, ca, quantidade, obrigatorio, tipo_tamanho }>
}>
```

### Integração com entrega de EPI
No fluxo existente de entrega de EPI (`/rh/epi/entrega/nova`), quando o usuário seleciona o funcionário:
1. Sistema chama `obterKitPadraoFuncao(funcionario.funcao_id)`.
2. Pré-preenche a lista de itens a entregar.
3. Para itens com `tipo_tamanho='numeracao_bota'` ou `'pp_p_m_g_gg_xg'`, pede o tamanho (usa `funcionarios.epi_bota_numero` e `funcionarios.epi_uniforme_tamanho` como default se já cadastrado).
4. RH ajusta/adiciona/remove, confirma → gera a Ficha de EPI em PDF (layout fiel ao modelo Excel da Tecnomonte) e salva em `documentos` com tipo `FICHA_EPI`.

### Checkpoint Fase 2
```sql
SELECT (SELECT count(*) FROM epi_catalogo) as itens_catalogo,
       (SELECT count(*) FROM epi_kit_funcao) as links_kit,
       (SELECT count(DISTINCT funcao_id) FROM epi_kit_funcao) as funcoes_com_kit;
-- Esperado: 28, ~250, 19
```
UI: `/admin/sst/epi/kits/CALDEIREIRO` mostra 17 itens; `/admin/sst/epi/kits/AJUDANTE` mostra 13 itens.

---

## 4. FASE 3 — OS NR-01 por função

**Commit:** `feat(admin): OS NR-01 modelos por funcao + geracao automatica`

### Schema
```sql
CREATE TABLE os_nr01_modelo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcao_id uuid UNIQUE NOT NULL REFERENCES funcoes(id),
  setor_default text DEFAULT 'PRODUÇÃO',
  atividades_descricao text NOT NULL,
  risco_quimico text,
  risco_fisico text,
  risco_biologico text,
  risco_ergonomico text,
  risco_acidentes text,
  epis_recomendados text[] NOT NULL DEFAULT '{}',
  medidas_preventivas text[] NOT NULL DEFAULT '{}',
  orientacoes_seguranca text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

CREATE TABLE os_nr01_emitida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id),
  modelo_id uuid REFERENCES os_nr01_modelo(id),
  -- Snapshot do conteúdo no momento da emissão (imutável após assinatura)
  atividades_descricao text NOT NULL,
  risco_quimico text,
  risco_fisico text,
  risco_biologico text,
  risco_ergonomico text,
  risco_acidentes text,
  epis_recomendados text[] NOT NULL,
  medidas_preventivas text[] NOT NULL,
  orientacoes_seguranca text[] NOT NULL,
  data_emissao date NOT NULL DEFAULT current_date,
  data_assinatura date,
  documento_id uuid REFERENCES documentos(id),    -- PDF gerado
  status text NOT NULL DEFAULT 'rascunho',        -- 'rascunho' | 'emitida' | 'assinada' | 'cancelada'
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
```

### Seed
A partir de `seeds/sgi/03_os_nr01_modelos.json`:
- Para cada um dos 15 modelos, fazer match com `funcoes.titulo` (normalizar caixa).
- Inserir com `ON CONFLICT (funcao_id) DO UPDATE`.

### Páginas
- `/admin/sst/os-nr01/modelos` — lista, editor rich-text por função
- `/admin/sst/os-nr01/emitidas` — histórico de OS emitidas por funcionário, filtro por função/obra
- `/admin/sst/os-nr01/emitidas/[id]` — visualização + PDF

### Server action
```typescript
export async function gerarOsNr01ParaFuncionario(funcionario_id: string): Promise<{
  os_emitida_id: string
  status: 'rascunho' | 'emitida'
}>
```

### Integração com wizard (modo automático-mas-editável)
Na **última etapa** do wizard de admissão, exibir um card "Ordem de Serviço NR-01" já preenchida a partir do modelo da função, com:
- Atividades (editável inline em `<textarea>`)
- Riscos (5 campos, editáveis)
- EPIs recomendados (chips removíveis + adicionar)
- Medidas preventivas (lista)
- Orientações de segurança (lista)
- Botão "Confirmar e gerar OS"

Se o usuário clicar "Confirmar", cria `os_nr01_emitida` com status `'emitida'`, gera PDF, salva em `documentos` com `tipo='OS_NR01'`, vincula ao funcionário. Se clicar "Pular" (só a diretoria pode), a OS fica como `'rascunho'` e é sinalizada no perfil do funcionário como pendente.

### Checkpoint Fase 3
```sql
SELECT f.titulo, m.atividades_descricao IS NOT NULL AS tem_atividades,
       array_length(m.epis_recomendados, 1) as n_epis
FROM funcoes f
LEFT JOIN os_nr01_modelo m ON m.funcao_id=f.id
WHERE f.titulo IN ('AJUDANTE','CALDEIREIRO','ELETRICISTA','ENCARREGADO','MECANICO','SOLDADOR ER');
-- Esperado: todas com tem_atividades=true; Soldador ER pode precisar usar modelo de "SOLDADOR MIG" se o título específico não existir no seed (documentar e usar fallback)
```

---

## 5. FASE 4 — Checklist SGI por cliente

**Commit:** `feat(admin): SGI checklist por cliente + validacao na alocacao`

### Schema
```sql
CREATE TABLE sgi_checklist_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  codigo text NOT NULL,                            -- 'SGI.02.210' (AGEO), 'SGI-CESARI-001'
  titulo text NOT NULL,
  observacoes text[],
  placeholder boolean DEFAULT false,               -- true = ainda não recebemos o oficial do cliente
  ativo boolean DEFAULT true,
  nrs_disponiveis text[] NOT NULL,                 -- lista geral do checklist
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (cliente_id, codigo)
);

CREATE TABLE sgi_checklist_funcao_req (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sgi_checklist_id uuid NOT NULL REFERENCES sgi_checklist_cliente(id) ON DELETE CASCADE,
  funcao_id uuid NOT NULL REFERENCES funcoes(id),
  nrs_obrigatorias text[] NOT NULL,
  observacao text,
  UNIQUE (sgi_checklist_id, funcao_id)
);
```

### Seed
A partir de `seeds/sgi/04_sgi_checklists_cliente.json`:
1. Criar o cliente `Terminais AGEO S/A` se não existir (pode não estar em `clientes`). Se não houver, inserir com CNPJ placeholder e marcar `observacao: 'Cadastro automático via seed SGI'`.
2. Inserir checklist AGEO com seus 29 requisitos_por_funcao (resolvendo funcao_id pelo título).
3. Inserir checklist Cesari como placeholder (mesmo catálogo, mas `placeholder=true`).

### Páginas
- `/admin/sgi/checklists` — lista de checklists por cliente
- `/admin/sgi/checklists/[cliente_slug]` — editor: lista de funções com NRs marcadas (visual tipo planilha)
- `/admin/sgi/validacao/[funcionario_id]` — mostra todas as obras/clientes em que o funcionário atende/não atende os requisitos

### Server action
```typescript
export async function validarFuncionarioParaCliente(input: {
  funcionario_id: string
  cliente_id: string
}): Promise<{
  atende: boolean
  nrs_exigidas: string[]
  nrs_atendidas: string[]
  nrs_faltantes: string[]
  nrs_vencidas: Array<{ codigo: string, venceu_em: string }>
}>
```

### Integração com wizard (na etapa de Alocação)
Quando o RH escolhe a obra na etapa de alocação:
1. Sistema identifica o cliente da obra.
2. Chama `validarFuncionarioParaCliente(funcionario_id, cliente_id)`.
3. Se `atende=false`, mostra **banner vermelho** listando NRs faltantes e bloqueia (soft) o botão "Finalizar admissão" — diretoria pode ignorar com justificativa.
4. Se checklist do cliente é `placeholder=true`, mostra um aviso amarelo "Checklist deste cliente ainda não foi confirmado oficialmente".

### Checkpoint Fase 4
```sql
SELECT c.nome AS cliente, scc.codigo, scc.placeholder,
       count(sfr.id) AS funcoes_mapeadas
FROM sgi_checklist_cliente scc
JOIN clientes c ON c.id=scc.cliente_id
LEFT JOIN sgi_checklist_funcao_req sfr ON sfr.sgi_checklist_id=scc.id
GROUP BY c.nome, scc.codigo, scc.placeholder;
-- Esperado: AGEO com 29, Cesari com 29 placeholder=true
```

UI: alocar HENRIQUE OLIVEIRA ALMEIDA (SOLDADOR ER) na obra Cesari-HH → ver banner "Checklist placeholder". Hipotético: alocar na AGEO → ver banner vermelho listando NR-18, NR-20, NR-33, NR-35 (o que ele tem da Fase 3 do import Cesari bate com o requisito? checar).

---

## 6. FASE 5 — CBO CODESP + integrações finais do wizard

**Commit:** `feat(admin): CBO CODESP + integracao completa wizard admissao`

### Schema (migração pequena)
```sql
ALTER TABLE funcoes
  ADD COLUMN IF NOT EXISTS cbo_codigo text,
  ADD COLUMN IF NOT EXISTS descricao_cbo text;
CREATE INDEX IF NOT EXISTS idx_funcoes_cbo ON funcoes(cbo_codigo);
```

### Seed
De `seeds/sgi/05_funcoes_cbo_codesp.json`, fazer UPDATE em `funcoes` por match de `titulo` (normalizado: upper, trim, sem acentos). Funções não encontradas no seed ficam com `cbo_codigo=NULL` e são logadas.

### Integrações que amarram as 4 fases anteriores no wizard

Modificar o componente `WizardAdmissaoFuncionario`:

**Etapa "Função" (já existe):**
- Ao selecionar função, mostrar tooltip com `descricao_cbo` (Fase 5).

**Etapa "EPI" (existente ou nova):**
- Chamar `obterKitPadraoFuncao()` (Fase 2) e pré-preencher a lista.
- Se função não tem kit, botão "Cadastrar kit padrão pra essa função" que abre modal inline.

**Etapa "Alocação":**
- Chamar `validarFuncionarioParaCliente()` (Fase 4), mostrar status.

**Etapa "Revisão" (nova seção "Documentos a gerar"):**
- Checklist interativo:
  - ☑ Ficha de EPI (Fase 2)
  - ☑ OS NR-01 (Fase 3) — com botão "Prévia/editar antes de gerar"
  - ☑ Termo de Anuência HE em recibo (Fase 1, `gerar_em_admissao=true`)
  - ☐ Termo de Autorização de Salário (só se marcar "conta terceiros" no passo bancário)
  - ☑ Contrato de experiência (se existir template — não está no seed, criar placeholder)
- Ao clicar "Finalizar admissão", rodar tudo em transação. Se qualquer PDF falhar, logar mas não abortar (RH pode regerar depois).

**Nova aba no perfil do funcionário (`/rh/funcionarios/[id]`):**
- Aba "Documentos da empresa" lista o que foi gerado (OS NR-01, termos, ficha EPI, etc.) com status (emitido/assinado/pendente) e botões "Regenerar", "Download", "Marcar como assinado".

### Checkpoint final Fase 5
Fluxo end-to-end: cadastrar um funcionário de teste via wizard → selecionar SOLDADOR ER → alocar em Cesari → no passo Revisão deve pré-gerar:
- 1 Ficha de EPI com 14 itens
- 1 OS NR-01 com atividades de soldador, riscos químico/físico/acidentes, 12 EPIs
- 1 Termo de Anuência preenchido
- Banner "Checklist Cesari ainda é placeholder — validar depois"

Tudo com PDFs gerados, documentos no bucket e registros em tabelas. Excluir depois.

---

## 7. PEGADINHAS E RESTRIÇÕES (do handoff)

- Enum `func_status`: não tem `'ativo'` — usar `'alocado'`.
- `documentos.tipo`: string em UPPER (`'ASO'`, `'FICHA_EPI'`, `'OS_NR01'`, `'TERMO_ANUENCIA'`, etc.). Se criar valores novos e `tipo` for enum real, fazer `ALTER TYPE ... ADD VALUE` em migration separada antes do seed.
- `alocacoes` não tem `deleted_at` — usar `data_fim IS NULL`.
- `funcoes.titulo` é a chave primária de match em 4 das 5 fases. **Normalize sempre** antes de comparar (`upper(unaccent(trim(titulo)))`).
- Storage bucket `funcionarios-docs` pode não existir ainda — criar como private, RLS ligado, no primeiro upload da Fase 1.
- Todo PDF gerado precisa ter `hash_sha256` e `ip_geracao` salvos em `documentos` — é o padrão de cadeia de custódia já usado pro WhatsApp RH (reaproveitar a mesma função utilitária se existir).
- Não tocar em `banco_horas` (tem GENERATED columns) nem em `empresa_config` (singleton).

---

## 8. PROTOCOLO DE COMMIT

- Cada fase = 1 commit com prefixo `feat(admin):`, `feat(sst):` ou `feat(sgi):` conforme módulo.
- Dentro da fase, se precisar de mais commits atômicos (schema em um, seed em outro, UI em outro), use sufixos `part 1/3`, `part 2/3`, etc.
- Só avance para a próxima fase depois do checkpoint SQL passar.
- Entre Fase 4 e 5, **pare e me reporte** — a Fase 5 mexe no wizard de admissão, que é código crítico. Quero ver o plano de edição antes.

---

## 9. DEPOIS DESSAS 5 FASES

Esse trabalho destrava:
- Import dos 15 ativos Cesari com OS NR-01 gerada automaticamente e Ficha de EPI fiel ao kit de cada função.
- Validação de que o funcionário pode entrar na obra (Cesari hoje placeholder, AGEO real).
- Passo 13 (RH→Financeiro) fica mais fácil porque o custo de cada entrega de EPI bate com o catálogo real.
- Quando quiser rodar o prompt de import Cesari que fizemos antes, ele agora consegue usar as server actions dos wizards reais em vez de fingir.

Boa, toca o serviço 🚀

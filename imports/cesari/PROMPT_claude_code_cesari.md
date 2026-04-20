# PROMPT — Ingestão oficial de funcionários Cesari HH (15 ativos + 5 inativos + docs)

> **Instrução ao Claude Code:** este prompt é o plano de trabalho completo. Execute as fases na ordem, com commits incrementais (um por fase). Em cada fase, antes de avançar, imprima um sumário de verificação (contagens, IDs, amostras). **Se encontrar qualquer tabela/coluna/enum que não bater com o plano, pare e reporte** — é sinal que algum passo anterior do roadmap ainda não está aplicado.

---

## 0. CONTEXTO E OBJETIVO

Importar o quadro real de funcionários da obra **CESARI - HH** (empresa Cesari Engenharia, cliente âncora do 1º tri/2026), a partir de:

1. `~/softmonte-git/imports/cesari/cesari_funcionarios.json` — planilha ATIVA estruturada (15 ativos + 5 inativos, todos os 45 campos cadastrais extraídos).
2. `~/softmonte-git/imports/cesari/JANEIRO.zip` — pastas com DOCS PESSOAIS, DOCS POSTAGEM, DOCS P ASSINAR de 7 admitidos em 21.01.
3. `~/softmonte-git/imports/cesari/FEVEREIRO.zip` — idem, 6 admitidos entre 04.02 e data a definir.

O cadastro deve **reusar a mesma camada de server actions/validators dos wizards existentes** (`/rh/admissao/wizard`, `/obras/wizard`, `/rh/epi/entrega`, `/rh/documentos/upload`, `/rh/treinamentos/registrar`). Não quero um SQL direto que burle validações — se o wizard faz `safeParse` + server action + trigger, o importador precisa fazer o mesmo caminho, apenas em batch.

Resultado final esperado:

- **Obra "CESARI - HH"** criada com CC próprio gerado pela trigger, cliente "Cesari Engenharia" cadastrado.
- **15 funcionários ativos** com `func_status='alocado'`, alocação aberta na obra Cesari, ASO admissional registrado, ficha de EPI com bota+uniforme, treinamentos NR vinculados, documentos em `storage.objects` sob `funcionarios/{id}/...`.
- **5 funcionários inativos** com `func_status='inativo'`, alocação fechada com `data_fim`, rescisão registrada com motivo correto.
- **Base pronta** para rodar a folha de março/abril sobre quadro real, testar DRE por obra Cesari, testar Passo 13 (integração RH→Financeiro) com lançamentos reais de custo ASO/EPI/uniforme.

---

## 1. PRÉ-REQUISITOS A VERIFICAR ANTES DE COMEÇAR

Execute em sequência e reporte:

```bash
# 1.1 Confirmar arquivos locais
ls -lh ~/softmonte-git/imports/cesari/
# Esperado: JANEIRO.zip (~137MB), FEVEREIRO.zip (~60MB), cesari_funcionarios.json (~26KB)

# 1.2 Status do deploy e build
# Via Vercel MCP: list_deployments com 'since' dos últimos 2 dias
# Se o último READY ainda for 4f863d8 (import planilha) e houver deploys ERROR de 0605dc1/99b1bb5,
# APLIQUE O HOTFIX DO QuickCreateSelect ANTES de prosseguir (adicionar 'fornecedor' ao tipo QuickCreateType
# em src/components/ui/QuickCreateSelect.tsx + config com table='fornecedores', createFields=[nome, cnpj, categoria]).
# Esse hotfix é pré-requisito para o modal de lançamentos financeiros voltar a funcionar e para o deploy
# verde — não da Fase 2 em si, mas eu quero fechar todas as frentes.

# 1.3 Sanity no banco (Supabase MCP, project_id wzmkifutluyqzqefrbpp)
# Rodar e me mostrar o resultado:
SELECT 
  (SELECT count(*) FROM obras) as obras,
  (SELECT count(*) FROM funcionarios) as funcionarios,
  (SELECT count(*) FROM alocacoes WHERE data_fim IS NULL) as alocacoes_ativas,
  (SELECT count(*) FROM clientes) as clientes,
  (SELECT count(*) FROM funcoes) as funcoes;

# Listar as funções já cadastradas (preciso saber o que já tem pra não duplicar):
SELECT id, codigo_cbo, titulo, salario_base FROM funcoes ORDER BY titulo;

# Listar tabelas relacionadas a EPI, NR, ASO, documentos:
SELECT table_name FROM information_schema.tables 
WHERE table_schema='public' 
  AND (table_name ILIKE '%epi%' OR table_name ILIKE '%nr%' 
       OR table_name ILIKE '%aso%' OR table_name ILIKE '%documento%'
       OR table_name ILIKE '%treinamento%' OR table_name ILIKE '%rescis%')
ORDER BY table_name;

# Enum func_status (pra confirmar valores válidos):
SELECT enum_range(NULL::func_status);

# Ver se existe bucket de storage pra funcionários:
SELECT id, name, public FROM storage.buckets;
```

**Pare aqui e me reporte.** Só avance pra Fase 1 depois que eu confirmar que os pré-requisitos estão OK e aprovar os nomes exatos de tabela que você descobrir (ex: se for `treinamentos_nr` ou `nrs_realizadas`).

---

## 2. ESTRUTURA DOS ZIPS

Cada funcionário nos ZIPs tem 3 pastas:

```
{NOME COMPLETO}/
├── DOCS PESSOAIS/
│   ├── RG.pdf | RG.jpeg
│   ├── CTPSContratosDigitais_{CPF}_{DATA}.pdf
│   ├── COMP DE ENDEREÇO.{jpeg|pdf}
│   ├── TITULO.{jpeg|pdf}
│   ├── VACINA F AMARELA.pdf
│   ├── COVID.{jpeg|pdf}
│   ├── Reservista.pdf (alguns)
│   ├── CNH.pdf (alguns)
│   ├── conta bancaria.{jpeg|pdf}
│   ├── Certidão de nascimento.pdf (alguns)
│   ├── comprovante de escolaridade.pdf (alguns)
│   └── Certificado {função específica}.pdf (eletricistas têm NR10)
│
├── DOCS POSTAGEM/     ← docs oficiais pós-admissão (para arquivo e protocolo RH)
│   ├── ASO {NOME} - TECNOMONTE.pdf           → tabela documentos tipo='ASO'
│   ├── eSocial_{NOME}.pdf                     → documentos tipo='ESOCIAL'
│   ├── REGISTRO - {NOME}.pdf                  → documentos tipo='REGISTRO' (contrato de trabalho)
│   ├── FICHA DE EPI.pdf                       → documentos tipo='FICHA_EPI' + registro em epi_entregas
│   ├── NR01.pdf, NR06.pdf, NR10.pdf, NR12.pdf,
│   │   NR18.pdf, NR18 TRABALHO QUENTE.pdf,
│   │   NR20.pdf, NR33.pdf, NR35.pdf           → cada um gera 1 registro de treinamento NR
│   ├── CTPSContratosDigitais_{CPF}_{DATA}.pdf (redundante)
│   ├── RG.pdf (redundante)
│   └── COVID.jpeg, VACINA F AMARELA.pdf (redundante)
│
└── DOCS P ASSINAR/    ← cópias que aguardavam assinatura (ficaram assinadas)
    ├── Anuência de NR 35 E 33 - {NOME} ASS.pdf
    ├── CERTIFICADOS NRS {NOME} ASS.pdf
    └── (eletricistas) CARTA DE CAPACITAÇÃO NR 10 TECNOMONTE.pdf
```

**Funcionários com pasta completa nos ZIPs (13 ao todo):**

| JANEIRO 21.01 (7) | FEVEREIRO (6) |
|---|---|
| HENRIQUE DE OLIVEIRA ALMEIDA | LEONARDO GOMES COUTO (04.02) |
| MATHEUS ANDRE SILVA ALVES FERNANDES | MARCEL KESLLEY DE OLIVEIRA LOURENÇO (11.02) |
| MATHEUS BARBOSA DE MIRANDA | MARCOS VINICIUS RAMOS GIMENES (11.02) |
| NICOLAS SANTOS ASSIS | ADEMIR BENEDITO DE JESUS JUNIOR (S DATA) |
| PABLO GUILHERME GOMES PEREIRA | CARLOS AUGUSTO RODRIGUES (S DATA) |
| PEDRO LUCAS SANTOS RAMOS | LUCIANO DA SILVA OLIVEIRA (S DATA) |
| RODRIGO ALEXANDRE DE AMORIM | |

**Funcionários SEM docs nos ZIPs** (admissões de março/abril — cadastrar só dados da planilha, marcar `docs_pendentes=true` se existir o campo, senão deixar observação no funcionário): DONIZETE FELIPE RIBEIRO, ELIELTON LIMA ALVES DA SILVA, ROMILDO PIRES DE SOUZA JUNIOR, KAIO EDUARDO SANTOS DA COSTA, SILAS LINS MACEDO DE SOUZA, ROBSON FERNANDES LIMA, JHONATAN BARBOSA DO CARMO.

**Atenção na fuzzy-match do nome pasta ↔ planilha:**
- Planilha diz "HENRIQUE OLIVEIRA ALMEIDA", pasta diz "HENRIQUE DE OLIVEIRA ALMEIDA" → normalizar removendo " DE ", " DA ", " DO " e comparar.
- "LEONARDO GOMES DO COUTO" (planilha) ↔ "LEONARDO GOMES COUTO" (pasta).
- "MARCEL KESLLEY DE OLVEIRA LOURENCO" (planilha com erro de digitação) ↔ "MARCEL KESLLEY DE OLIVEIRA LOURENÇO" (pasta).
- "CARLOS AUGUSTRO RODRIGUES" (pasta, com erro) — não está na planilha ATIVOS nem INATIVOS; provavelmente é admissão que não seguiu. **Pule esse** e me reporte.

Use o **CPF** como chave primária de match sempre que possível; o CPF está no nome dos arquivos CTPS (`CTPSContratosDigitais_XXX.XXX.XXX-XX_*.pdf`).

---

## 3. FASES DE EXECUÇÃO

### FASE 1 — Entidades base (1 commit: `feat(cesari): entidades base Cesari`)

1. **Cliente** — `INSERT INTO clientes (nome, cnpj?)` com nome "CESARI" ou "Cesari Engenharia" se não existir. Se a tabela tiver mais campos obrigatórios e você não tiver o dado, use `NULL` e marque TODO no commit message.
2. **Obra** — usar a mesma server action do wizard de obras (`src/app/(dashboard)/obras/wizard/actions.ts` ou similar). Nome: `CESARI - HH`, código: `CESARI-2026`, cliente_id acima, status inicial `em_andamento`, data_inicio `2026-01-21` (primeira admissão). A trigger deve gerar o CC automaticamente — confirme que `centros_custo` ganhou 1 linha com `tipo='obra'` e `parent_id` apontando pro CC Administrativo Matriz.
3. **Funções** — para cada função da lista abaixo, se não existir em `funcoes`, criar via a action do wizard de funções (com código CBO correto):

| Função (planilha) | CBO sugerido | Salário base (já vem da planilha) |
|---|---|---|
| AJUDANTE | 7170-20 (Ajudante de obras) | R$ 2.339,91 |
| CALDEIREIRO | 7243-15 | R$ 3.268,02 (existem 2 com salário de ajudante) |
| ELETRICISTA | 7156-10 | R$ 3.268,02 |
| ENCARREGADO | 7102-05 (Encarregado geral de obras) | R$ 5.046,72 |
| MECANICO | 7257-10 (Mecânico montador) | R$ 2.941,12 |
| SOLDADOR ER | 7243-10 (Soldador) | R$ 3.268,02 |

> "SOLDADOR ER" = Soldador Eletrodo Revestido. Registrar assim mesmo, sem abreviar.

**Ponto de checagem Fase 1:**
```sql
SELECT * FROM clientes WHERE nome ILIKE '%cesari%';
SELECT * FROM obras WHERE nome ILIKE '%cesari%';
SELECT * FROM centros_custo WHERE tipo='obra' AND codigo LIKE '%CESARI%';
SELECT id, codigo_cbo, titulo FROM funcoes WHERE titulo IN ('AJUDANTE','CALDEIREIRO','ELETRICISTA','ENCARREGADO','MECANICO','SOLDADOR ER');
```

---

### FASE 2 — Cadastro dos 15 ATIVOS via wizard (1 commit: `feat(cesari): 15 funcionários ativos cadastrados`)

**Localize o arquivo que implementa o wizard de admissão** (provavelmente `src/app/(dashboard)/rh/funcionarios/wizard/actions.ts` ou `/rh/admissao/`). A server action principal deve ser algo tipo `criarFuncionarioAdmissao(data: WizardData)`. Importe-a e chame em batch a partir de um script novo:

```
scripts/import-cesari-ativos.ts
```

que:
1. Lê `imports/cesari/cesari_funcionarios.json` e itera sobre `payload.ativos`.
2. Para cada item, monta o objeto `WizardData` usando o mapping abaixo.
3. Chama a server action; se falhar, captura erro, loga e continua (sem abortar).
4. No final, imprime tabela resumo: `{nome, cpf, funcionario_id, alocacao_id, status}`.

**Mapeamento JSON → campos do wizard** (ajuste conforme os nomes reais do seu schema; estes são os pontos mínimos a cobrir):

| JSON | Tabela / Campo |
|---|---|
| `nome` | `funcionarios.nome_completo` |
| `cpf` | `funcionarios.cpf` (já vem só dígitos) |
| `data_nascimento` | `funcionarios.data_nascimento` |
| `rg` + `rg_data_expedicao` | `funcionarios.rg`, `funcionarios.rg_expedicao` |
| `naturalidade` (ex "CUBATÃO-SP") | split em `naturalidade_cidade` + `naturalidade_uf` |
| `estado_civil` | `funcionarios.estado_civil` (mapear "SOLTEIRO"→'solteiro', etc. — depende do enum) |
| `nome_pai`, `nome_mae` | `funcionarios.nome_pai`, `.nome_mae` (se `nome_pai == 'X'` → deixar `NULL`) |
| `raca_cor` | `funcionarios.raca_cor` (enum: preta, parda, branca, amarela, indigena) |
| `ctps`, `ctps_uf` (ambos podem ser "DIGITAL") | `funcionarios.ctps_numero`, `.ctps_uf` |
| `pis` | `funcionarios.pis` (remover zeros espúrios do Excel tipo `"2037350000000000065536"` → usar regex para pegar os 11 dígitos válidos, ou deixar como texto mesmo e marcar TODO) |
| `titulo_eleitor` | `funcionarios.titulo_eleitor` |
| `telefone` | `funcionarios.telefone` (formato livre) |
| `endereco`, `cidade_uf`, `cep` | `funcionarios.endereco`, `.cidade`, `.uf`, `.cep` (split "CUBATÃO-SP") |
| `banco_nome`, `banco_ag_conta`, `pix` | `funcionarios.banco`, `.agencia_conta`, `.chave_pix` (ou tabela `funcionarios_bancarios` se houver separada) |
| `funcao` (string) | `funcionarios.funcao_id` (lookup pelo título) |
| `salario_base` | `funcionarios.salario` (sobrescreve o default da função) |
| `data_admissao` | `funcionarios.data_admissao` |
| `periodo_experiencia` ("45 DIAS") | `funcionarios.contrato_experiencia_dias=45` |
| `prazo_experiencia_1`, `prazo_experiencia_2` | `funcionarios.contrato_venc_1`, `.contrato_venc_2` |
| **STATUS** | `funcionarios.status = 'alocado'` (NÃO usar 'ativo' — enum não existe) |
| `epi_bota_numero` | 👉 Fase 3 |
| `epi_uniforme_tamanho` | 👉 Fase 3 |
| `observacao` (ex "NÃO RENOVAR 20.04") | `funcionarios.observacoes` concatenado |

**Alocação:**
- Criar uma linha em `alocacoes` por funcionário com `obra_id` da Cesari, `data_inicio = data_admissao`, `data_fim = NULL`.

**Contrato de experiência (Passo 13 futuro):**
- Se `prazo_experiencia_2` existir, registrar em `contratos_experiencia` (se a tabela existir) com duas fases. Se não existir a tabela, gravar só as datas no próprio funcionário.

**Custos admissionais (para Passo 13):**
- Preencher `funcionarios.custo_aso_admissional`, `.custo_epi`, `.custo_uniforme`, `.custo_outros_admissao` com **0** por enquanto (Passo 13 ainda não foi executado, campos existem mas ficariam parados com valor fake — usar 0 é mais honesto). Se o Victor tiver passado valor estimado no futuro, atualizamos.

**Ponto de checagem Fase 2:**
```sql
SELECT f.id, f.nome_completo, f.cpf, f.salario, fn.titulo as funcao, f.status,
       a.data_inicio, o.nome as obra
FROM funcionarios f
LEFT JOIN funcoes fn ON fn.id=f.funcao_id
LEFT JOIN alocacoes a ON a.funcionario_id=f.id AND a.data_fim IS NULL
LEFT JOIN obras o ON o.id=a.obra_id
WHERE o.nome='CESARI - HH'
ORDER BY fn.titulo, f.nome_completo;
-- Esperado: 15 linhas, todas com status='alocado' e obra='CESARI - HH'
```

---

### FASE 3 — Upload de documentos, EPIs e NRs (1 commit: `feat(cesari): docs + EPIs + treinamentos NR`)

Agora para cada um dos 13 funcionários com pasta nos ZIPs:

**3.1 Descompactar:**
```bash
cd ~/softmonte-git/imports/cesari
mkdir -p unzipped
unzip -o JANEIRO.zip -d unzipped/
unzip -o FEVEREIRO.zip -d unzipped/
```

**3.2 Upload para Supabase Storage:**

Se o bucket `funcionarios-docs` (ou equivalente) não existir, crie-o como **private** (RLS ligado). Estrutura de pastas:

```
funcionarios-docs/
  {funcionario_id}/
    pessoais/{nome_arquivo_original.ext}
    postagem/{nome_arquivo_original.ext}
    para_assinar/{nome_arquivo_original.ext}
```

Use client Supabase com `service_role_key` (lê de `.env.local`), faz `storage.from('funcionarios-docs').upload(path, fileBuffer, {contentType})`.

**3.3 Inserir registros em `documentos`:**

Para cada arquivo enviado, criar linha em `documentos` com:
- `funcionario_id` correto
- `tipo` = mapeamento abaixo
- `nome_arquivo` = nome original
- `storage_path` = caminho no bucket
- `data_emissao` = tentar parsear da metadata ou do nome do arquivo (ex CTPS: `CTPSContratosDigitais_CPF_12-01-2026.pdf` → 12/01/2026)
- `data_validade` = para ASO, somar 12 meses à data_emissao (periódico anual)
- `valido` = true

**Regra de mapeamento `filename → tipo`:**

| Padrão do nome do arquivo | `documentos.tipo` |
|---|---|
| começa com `ASO ` | `'ASO'` (maiúsculo, confirmado no handoff) |
| começa com `eSocial_` | `'ESOCIAL'` |
| começa com `REGISTRO` | `'REGISTRO'` (contrato de trabalho) |
| `CTPSContratos` | `'CTPS'` |
| `FICHA DE EPI` | `'FICHA_EPI'` |
| `NR01`, `NR06`, `NR10`, `NR12`, `NR18*`, `NR20`, `NR33`, `NR35` | `'TREINAMENTO_NR'` (além disso, ver 3.5) |
| `Anuência` ou `Anuencia` | `'ANUENCIA_NR'` |
| `RG` | `'RG'` |
| `CNH` | `'CNH'` |
| `TITULO` | `'TITULO_ELEITOR'` |
| `COMP` + `ENDEREÇO` | `'COMPROVANTE_ENDERECO'` |
| `VACINA` ou `COVID` | `'CARTAO_VACINAL'` |
| `Reservista` | `'RESERVISTA'` |
| `Certidão de nascimento` | `'CERTIDAO_NASCIMENTO'` |
| `comprovante de escolaridade` | `'ESCOLARIDADE'` |
| `CONTA BANCARIA` ou `conta bancaria` | `'COMPROVANTE_BANCARIO'` |
| `foto` | `'FOTO_3X4'` |
| Outros | `'OUTROS'` (logar para revisão manual) |

Se o enum `documentos.tipo` não tiver um desses valores, **pare e reporte** — eu decido se crio novo enum ou uso `'OUTROS'`. Não invente migration sem me consultar.

**3.4 Ficha de EPI (entrega inicial):**

Para os 15 ativos (inclusive os sem pasta nos ZIPs), registrar entrega inicial em `epi_entregas` (ou nome análogo):
- `funcionario_id`
- `data_entrega` = `data_admissao`
- `itens`: bota (tamanho = `epi_bota_numero`) + uniforme (tamanho = `epi_uniforme_tamanho`) + capacete + luva + óculos (itens padrão — se houver catálogo `epi_catalogo`, buscar o item padrão da função; senão, inserir como texto livre)
- `assinado` = true (a ficha assinada está em DOCS POSTAGEM como PDF, linkar via `documento_id` do item 3.3)

**3.5 Treinamentos NR:**

Para cada PDF `NR*.pdf` em DOCS POSTAGEM, criar linha em `treinamentos_nr` (ou `funcionario_nrs`):
- `funcionario_id`
- `nr_codigo` (string tipo "NR-01", "NR-35") — padronizar com hífen
- `data_realizacao` = tentar ler do PDF, senão usar `integracao_data` (da planilha) ou `data_admissao`
- `validade` = data + regras padrão (NR-35 tem validade 2 anos, NR-10 2 anos, NR-33 1 ano, NR-06/12/18/20 1 ano por padrão interno)
- `certificado_documento_id` = id do registro em `documentos` do próprio PDF

**Eletricistas (Matheus André e Rodrigo Amorim) têm NR-10**, os demais não. Respeite o que está na pasta.

**NR-18 Trabalho Quente** é uma variação/complemento da NR-18 geral — registre como NR-18 principal e NR-18-TQ separado se o schema permitir, senão concatena.

**Ponto de checagem Fase 3:**
```sql
SELECT f.nome_completo, 
       count(DISTINCT d.id) as docs,
       count(DISTINCT t.id) as treinamentos_nr,
       count(DISTINCT e.id) as entregas_epi
FROM funcionarios f
LEFT JOIN documentos d ON d.funcionario_id=f.id
LEFT JOIN treinamentos_nr t ON t.funcionario_id=f.id
LEFT JOIN epi_entregas e ON e.funcionario_id=f.id
WHERE f.id IN (SELECT funcionario_id FROM alocacoes WHERE obra_id=(SELECT id FROM obras WHERE nome='CESARI - HH'))
GROUP BY f.id, f.nome_completo
ORDER BY f.nome_completo;
-- Esperado: 13 funcionários com docs>0, todos os 15 com entregas_epi=1.
-- Eletricistas + soldadores devem ter ≥6 treinamentos_nr cada (NR01, NR06, NR12, NR18, NR18TQ, NR20, NR33, NR35 + NR10 p/ elétricos).
```

---

### FASE 4 — Inativos com rescisão (1 commit: `feat(cesari): 5 desligamentos com motivo`)

Para cada item de `payload.inativos`:

1. Criar o funcionário (mesmo fluxo da Fase 2).
2. Criar a alocação com `data_inicio=data_admissao`, `data_fim=data_desligamento`.
3. Mudar `funcionarios.status='inativo'`.
4. Criar registro em `rescisoes` (se a tabela existir) com:
   - `motivo_desligamento` → mapear para enum local:
     - `PEDIDO DE DEMISSÃO` → `'pedido_demissao'`
     - `JUSTA CAUSA` → `'justa_causa'`
     - `TERMINO DE CONTRATO` → `'termino_contrato'` (ou `'contrato_experiencia_vencido'` se houver)
   - `data_rescisao = data_desligamento`
   - Valores a receber: **deixar NULL por enquanto** — cálculo de rescisão é Passo 13.

5. **NICOLAS SANTOS ASSIS** (inativo por justa causa) tem pasta completa nos ZIPs — subir os docs igual Fase 3 mesmo sendo inativo, para manter histórico. Idem **MARCEL KESLLEY**. Os demais inativos (Sidnei, Silvio, Kevyn) não têm pasta.

**Ponto de checagem Fase 4:**
```sql
SELECT f.nome_completo, f.cpf, f.status, a.data_inicio, a.data_fim, r.motivo
FROM funcionarios f
JOIN alocacoes a ON a.funcionario_id=f.id
LEFT JOIN rescisoes r ON r.funcionario_id=f.id
WHERE a.obra_id=(SELECT id FROM obras WHERE nome='CESARI - HH')
  AND f.status='inativo';
-- Esperado: 5 linhas.
```

---

### FASE 5 — Validação final e relatório (1 commit: `docs(cesari): relatório de importação`)

Gerar `imports/cesari/RELATORIO.md` com:

1. Resumo numérico: X ativos criados, Y inativos, Z documentos uploadados, W treinamentos NR, P entregas EPI.
2. Tabela dos 20 funcionários com: nome, CPF, função, status, #docs.
3. Lista de **itens pendentes** (docs faltando, campos que ficaram NULL, inconsistências planilha vs pasta).
4. Lista de **funções/enums que precisaram ser criados/modificados**, se houver.
5. SQLs executados (DDL + DML) em apêndice.

Depois rodar:
```sql
-- Dashboard rápido
SELECT 
  (SELECT count(*) FROM funcionarios WHERE status='alocado') as ativos_total,
  (SELECT count(*) FROM funcionarios WHERE status='inativo') as inativos_total,
  (SELECT count(*) FROM alocacoes a JOIN obras o ON o.id=a.obra_id WHERE o.nome='CESARI - HH' AND data_fim IS NULL) as alocados_cesari,
  (SELECT count(*) FROM documentos) as docs_total,
  (SELECT count(*) FROM documentos WHERE tipo='ASO') as aso_total,
  (SELECT count(*) FROM documentos WHERE tipo='FICHA_EPI') as ficha_epi_total;
```

E mostrar screenshot (Chrome MCP) de:
- `/rh/funcionarios` filtrado pela obra Cesari — deve listar 15 pessoas.
- `/rh/funcionarios/{id_do_henrique}` — deve mostrar aba de documentos com ≥20 arquivos, aba de EPIs com bota 43/uniforme G, aba de treinamentos com NR01, 06, 12, 18, 18-TQ, 20, 33, 35.
- `/obras/{id_cesari}` — deve mostrar aba de equipe com 15 alocados.

---

## 4. PEGADINHAS CONHECIDAS (do handoff do chat anterior)

- `alocacoes` **NÃO tem** `deleted_at` → use `data_fim IS NULL` para ativas.
- `banco_horas` tem GENERATED columns → nunca incluir em INSERT (não deve aparecer nessa importação, mas atenção).
- `notificacoes.destinatario_id` referencia `auth.users.id` direto (não `profiles`).
- `empresa_config` é singleton — não mexer.
- **enum `func_status`**: `pendente | em_admissao | alocado | disponivel | afastado | inativo`. **Não tem `'ativo'`**. Para quem está trabalhando na obra: use `'alocado'`.
- **enum `ferias.status`**: `pendente | programada | aprovada | realizada | cancelada` (não mexe agora, só lembrete).
- **enum `faltas.tipo`**: `falta_injustificada | falta_justificada | atestado_medico | atestado_de_acompanhamento`.
- **`documentos.tipo`**: `'ASO'` é maiúsculo.
- **Campo `cargo` vs `funcao_id`**: `funcao_id` é a CBO (usada para EPI/NR/composição BM), `cargo` é texto livre CTPS. Neste import, deixe `cargo` = mesma string da `funcao` (AJUDANTE, CALDEIREIRO, etc.) pra ficar fiel ao que vai na CTPS.

---

## 5. PROTOCOLO DE EXECUÇÃO

1. **Antes da Fase 1**, responda com:
   - Resultado dos pré-requisitos da seção 1 (contagens, nomes de tabelas descobertas, enums).
   - Plano resumido de como vai implementar cada fase (linhas de código estimadas, arquivos que vai criar/editar).
   - Pedido de go/no-go ao Victor.

2. **A cada fase completada**, faça `git add -A && git commit -m "..."` com a mensagem que indiquei, e imprima o resultado da query de checagem correspondente. **Não avance sem minha aprovação entre fases 1↔2 e 4↔5** (2→3 e 3→4 pode seguir direto se o checkpoint passar).

3. **Se algo quebrar** (server action validator recusa, trigger falha, enum não bate), pare, mostre o erro cru do PostgREST/Supabase, sugira 2 alternativas, espere minha decisão.

4. **Não faça `DELETE` nem `TRUNCATE`** em nenhuma tabela deste projeto. Se precisar refazer, use `ON CONFLICT (cpf) DO UPDATE` em `funcionarios`.

5. **Deploy**: após a Fase 5, o `main` ainda pode estar com o hotfix QuickCreate pendente. Resolva isso como último passo (é pequeno) pra voltar o Vercel ao verde.

---

## 6. O QUE EU VOU VALIDAR DEPOIS DE VOCÊ TERMINAR

- Folha piloto março/2026 sobre os 15 ativos + rescisões dos 5 → verificar se os valores batem.
- Passo 11 (processos trabalhistas) — Nicolas com justa causa é candidato forte a ação trabalhista, vai servir de teste depois.
- Passo 13 (integração RH→Financeiro) — vai gerar lançamentos de ASO/EPI/uniforme admissionais retroativos para Cesari → bom teste de volume.
- DRE por obra — Cesari vai ter mão de obra real pela primeira vez.

Boa, manda ver 🚀

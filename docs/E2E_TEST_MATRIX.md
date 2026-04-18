# Softmonte — Matriz E2E Completa de Testes

**Gerado em:** 18/04/2026
**Plataforma:** 114 rotas · 96 tabelas · 42 views · 69k linhas
**Ambiente:** https://softmonte.vercel.app
**Credencial admin:** diretoria@tecnomonte.com.br / Softmonte@2026

---

## PRIORIDADES

- **P0** — Bloqueia uso ou causa perda de dados / risco de segurança
- **P1** — Degrada experiência significativamente
- **P2** — Cosmético ou edge case raro

---

## BLOCO A — AUTENTICAÇÃO E SESSÃO

| ID | Fluxo | Pré-condição | Passos | Dados | Resultado esperado | P | Tipo |
|----|-------|-------------|--------|-------|-------------------|---|------|
| A01 | Login válido | Usuário existe | 1. Abrir /login 2. Preencher email+senha 3. Clicar Entrar | diretoria@tecnomonte.com.br / Softmonte@2026 | Redireciona para /diretoria, topbar mostra nome | P0 | Funcional |
| A02 | Login senha errada | Usuário existe | 1. Preencher email correto 2. Senha "abc123" 3. Entrar | diretoria@... / abc123 | Toast "E-mail ou senha incorretos", não redireciona | P0 | Funcional |
| A03 | Login email inexistente | — | Email: naoexiste@x.com, senha qualquer | naoexiste@x.com / abc | Toast de erro, campo não limpa | P0 | Funcional |
| A04 | Login campo vazio | — | 1. Deixar email vazio 2. Clicar Entrar | (vazio) | Validação HTML5 bloqueia | P1 | Validação |
| A05 | Sessão expirada | Logado há 24h+ | 1. Abrir /funcionarios 2. Aguardar expiração | — | Redireciona para /login com toast "Sessão expirada" | P0 | Segurança |
| A06 | URL protegida sem login | Não logado | 1. Abrir /diretoria direto | — | Redireciona para /login | P0 | Segurança |
| A07 | Logout | Logado | 1. Clicar avatar 2. Clicar Sair | — | Redireciona para /login, cookie removido | P0 | Funcional |
| A08 | Forgot password | Email existe | 1. /forgot-password 2. Digitar email 3. Enviar | diretoria@tecnomonte.com.br | Toast "Email enviado" | P1 | Funcional |
| A09 | Login XSS | — | Email: `<script>alert(1)</script>@x.com` | XSS | Não executa script, mostra erro normal | P0 | Segurança |
| A10 | Login SQL injection | — | Email: `' OR 1=1--@x.com` Senha: `' OR 1=1--` | SQL injection | Não autentica, erro normal | P0 | Segurança |
| A11 | Duplo clique Entrar | Credenciais corretas | 1. Preencher 2. Clicar 2x rápido | — | Não cria sessão duplicada, 1 redirect | P1 | UI |
| A12 | Duas abas, logout em uma | Logado em 2 abas | 1. Aba A: logout 2. Aba B: clicar ação | — | Aba B redireciona para login | P1 | Sessão |

---

## BLOCO B — PERMISSÕES POR ROLE

| ID | Fluxo | Dados | Resultado esperado | P | Tipo |
|----|-------|-------|-------------------|---|------|
| B01 | Encarregado acessa /ponto | Login encarregado@tecnomonte.com.br | Carrega normalmente | P0 | Permissão |
| B02 | Encarregado acessa /financeiro/dre | Login encarregado | Redireciona para /dashboard | P0 | Permissão |
| B03 | Encarregado acessa /rh/folha | Login encarregado | Redireciona para /dashboard | P0 | Permissão |
| B04 | Encarregado acessa /diretoria | Login encarregado | Redireciona para /dashboard | P0 | Permissão |
| B05 | Encarregado acessa /admin/usuarios | Login encarregado | Redireciona | P0 | Permissão |
| B06 | Funcionário acessa /portal | Login funcionario@... | Carrega portal, mostra só dados próprios | P0 | Permissão |
| B07 | Funcionário acessa /funcionarios | Login funcionário | Redireciona para /portal | P0 | Permissão |
| B08 | RH acessa /rh/folha | Login rh@... | Carrega | P0 | Permissão |
| B09 | RH acessa /financeiro/dre | Login rh | Redireciona | P1 | Permissão |
| B10 | Admin acessa /cadastros/merge | Login diretoria | Carrega | P0 | Permissão |
| B11 | Encarregado acessa /cadastros/merge via URL | Login encarregado | Redireciona | P0 | Segurança |
| B12 | IDOR: trocar ID na URL /funcionarios/[id] | Login encarregado, usar ID de outro func | Dados visíveis (RLS permite?) ou bloqueado | P0 | Segurança |

---

## BLOCO C — CRUD FUNCIONÁRIOS

| ID | Fluxo | Passos | Dados | Resultado esperado | P | Tipo |
|----|-------|--------|-------|-------------------|---|------|
| C01 | Criar com dados mínimos | /funcionarios/novo → nome + cargo | Nome: "TESTE SILVA", Cargo: "AJUDANTE" | Salva com status='pendente', modal aparece | P0 | Funcional |
| C02 | Criar com CPF válido | Preencher CPF | 123.456.789-09 | Salva, CPF normalizado para 12345678909 | P0 | Funcional |
| C03 | Criar com CPF duplicado | Segundo func com mesmo CPF | 123.456.789-09 | Toast "Este CPF já está cadastrado" | P0 | Validação |
| C04 | Criar sem nome (obrigatório) | Deixar nome vazio, preencher resto | nome="" | Validação HTML5 ou toast de erro | P0 | Validação |
| C05 | Criar com CPF inválido (10 dígitos) | CPF: 12345678 | 12345678 | Aceita? Deveria rejeitar | P1 | Validação |
| C06 | Criar com data nascimento futura | data_nascimento: 2030-01-01 | 2030-01-01 | Deveria alertar ou aceitar | P2 | Validação |
| C07 | Editar nome | /funcionarios/[id]/editar → mudar nome | "TESTE SILVA" → "TESTE SANTOS" | Nome atualizado em todas as telas | P0 | Funcional |
| C08 | Editar sem alterar nada e salvar | Abrir editar → salvar sem mudança | — | Redireciona sem erro | P1 | Edge case |
| C09 | Soft-delete funcionário | Botão Desativar no perfil | — | deleted_at preenchido, some da listagem, aparece com filtro "Desligados" | P0 | Funcional |
| C10 | Criar com caracteres especiais | Nome: "JOSÉ D'ÁVILA Ñ MARTÍNEZ" | Acentos/apóstrofo | Salva e exibe corretamente | P1 | Validação |
| C11 | Criar com XSS no nome | Nome: `<img src=x onerror=alert(1)>` | XSS | Texto exibido como texto, não executa | P0 | Segurança |
| C12 | Criar com salário 0 | salario_base: 0 | 0 | Aceita (pode não ter salário definido) | P2 | Edge case |
| C13 | Criar com salário negativo | salario_base: -1500 | -1500 | Deveria rejeitar | P1 | Validação |
| C14 | Reativar CPF histórico | Criar func com CPF de func deletado | CPF existente em soft-deleted | Banner "Reaproveitar dados?" aparece | P1 | Funcional |
| C15 | Editar status para 'pendente' | /editar → status dropdown | pendente | Atualiza, badge muda para amber | P1 | Funcional |

---

## BLOCO D — WIZARD DE ADMISSÃO (8 etapas)

| ID | Fluxo | Passos | Dados | Resultado esperado | P | Tipo |
|----|-------|--------|-------|-------------------|---|------|
| D01 | Etapa 1: mínimo viável | Nome + CPF + data nasc → Avançar | TESTE / 12345678909 / 1990-01-01 | Avança para etapa 2, toast "Pessoal salvo!" | P0 | Funcional |
| D02 | Etapa 1: avançar sem CPF | Só nome + nasc → Avançar | Nome preenchido, CPF vazio | Erro "CPF é obrigatório", não avança | P0 | Validação |
| D03 | Etapa 1: CEP autocomplete | Digitar CEP 13010-111 → sair do campo | 13010-111 | Endereço + cidade preenchidos automaticamente via ViaCEP | P1 | Integração |
| D04 | Etapa 2: dropdown função | Abrir etapa 2 | — | Dropdown mostra 15+ funções cadastradas | P0 | Funcional |
| D05 | Etapa 2: criar função (+) | Clicar + ao lado de Função → preencher → criar | CALDEIREIRO OFFSHORE | Função criada, selecionada no dropdown, cargo preenchido | P0 | Funcional |
| D06 | Etapa 2: toggle Obra vs Adm | Clicar "Administrativo" | — | Select de CCs aparece em vez de Obras | P1 | Funcional |
| D07 | Etapa 2: sem obra e sem CC | Avançar sem selecionar nenhum | — | Erro "Selecione uma obra ou centro de custo" | P0 | Validação |
| D08 | Etapa 2: tipo vínculo temporário | Selecionar "Experiência 45+45" + data admissão | admissao: 2026-04-18 | prazo1 = 2026-06-02, prazo2 = 2026-07-17 calculados auto | P1 | Funcional |
| D09 | Etapa 2: preview CLT | Preencher salário 3500 + insalubridade 20% | 3500 / 20% | Preview: bruto ~R$4.200, líquido ~R$3.600, custo empresa ~R$6.700 | P1 | Cálculo |
| D10 | Stepper: voltar para etapa 1 | Estar na etapa 3 → clicar etapa 1 no stepper | — | Retorna para etapa 1 com dados preservados | P0 | UI |
| D11 | Stepper: pular para etapa futura | Estar na etapa 2 → clicar etapa 5 | — | Não avança (etapas futuras bloqueadas) | P1 | UI |
| D12 | Salvar rascunho | Preencher parcial → "Salvar rascunho" | — | Toast "Rascunho salvo!", dados persistem no localStorage | P1 | Funcional |
| D13 | Reabrir wizard | Fechar → reabrir | — | Dados do localStorage restaurados | P1 | Funcional |
| D14 | Etapa 5: NRs sem função | funcao_id não preenchido | — | Mostra só NRs obrigatórias para todos (não crasheia) | P1 | Edge case |
| D15 | Etapa 6: EPI sem kit | Função sem kit EPI cadastrado | — | Empty state "Nenhum kit EPI" + "Não se aplica" | P1 | Funcional |
| D16 | Etapa 8: conclusão completa | Completar 8 etapas + Concluir | — | Status='alocado', alocação criada, notificação para diretoria, redirect perfil | P0 | Funcional |
| D17 | Modal: scroll funciona | Etapa 2 com muitos campos | Viewport 1280×800 | Todos os campos visíveis com scroll, footer visível | P0 | UI |
| D18 | Mobile: wizard 390px | Viewport 390×844 | — | Botão "Salvar e avançar" visível, stepper não transborda | P1 | Responsivo |
| D19 | URL direta wizard sem func_id | /rh/admissoes/wizard (sem query params) | — | Cria novo funcionário do zero | P1 | Edge case |
| D20 | URL wizard com func_id | /rh/admissoes/wizard?funcionario_id=X | func existente | Dados pré-preenchidos | P0 | Funcional |

---

## BLOCO E — PONTO (Controle de Frequência)

| ID | Fluxo | Passos | Dados | Resultado esperado | P | Tipo |
|----|-------|--------|-------|-------------------|---|------|
| E01 | Auto-selecionar obra única | Apenas 1 obra ativa | Abrir /ponto | Obra auto-selecionada, badge "📍 {nome}" | P1 | UX |
| E02 | Lançar presença | Clicar célula dia 15 do funcionário | — | Modal abre, selecionar "Presente", salvar | P0 | Funcional |
| E03 | Lançar falta | Clicar célula → "Falta injustificada" | — | Célula muda para vermelho "F" | P0 | Funcional |
| E04 | Lançar em fim de semana | Clicar célula de sábado | — | Célula desabilitada (cinza "-") | P1 | Validação |
| E05 | Lançar antes da admissão | Func admitido dia 15, clicar dia 10 | — | Célula bloqueada (cinza) | P1 | Validação |
| E06 | Fechar mês | Botão "🔒 Fechar ponto do mês" | — | Modal de confirmação (não window.confirm), fecha, banner "Ponto fechado" | P0 | Funcional |
| E07 | Editar após fechar | Ponto fechado → clicar célula | — | Se admin: permite com banner "auditado". Se outro: bloqueado | P0 | Permissão |
| E08 | Reabrir mês | Admin → "🔓 Reabrir ponto" | — | Confirmação → remove fechamento → editável | P0 | Funcional |
| E09 | Excedente de contrato | 4 soldadores presentes com 3 contratados | — | Badge vermelho "!" no dia com tooltip | P1 | Funcional |
| E10 | "Lançar dia rápido" | Botão ⚡ → marcar 10 funcs presente no dia 16 | — | 10 registros criados, grade atualiza | P0 | Funcional |

---

## BLOCO F — FOLHA DE PAGAMENTO

| ID | Fluxo | Passos | Dados | Resultado esperado | P | Tipo |
|----|-------|--------|-------|-------------------|---|------|
| F01 | Fechar folha | Selecionar obra + mês → Fechar | Obra Cesari, Abril 2026 | folha_fechamentos criado, itens por func, lançamentos financeiros | P0 | Funcional |
| F02 | Fechar folha duplicada | Fechar mesmo mês 2x | — | Toast "Já existe fechamento para este mês" | P0 | Validação |
| F03 | Folha sem dados de ponto | Mês sem nenhum ponto lançado | — | Toast "Sem dados de custo para esse período" | P0 | Validação |
| F04 | Folha com func salário zero | Func com salário=0 no mês | — | Toast warning "X funcionários com salário zerado excluídos" | P1 | Validação |
| F05 | Composição divergente | Mais funcs que o contrato | — | Modal amber com excedentes listados + opções: Cancelar / Criar aditivo / Fechar mesmo assim | P0 | Funcional |
| F06 | Reverter folha | Botão "Reverter" na listagem | — | Soft-delete do fechamento + lançamentos | P0 | Funcional |
| F07 | Holerite individual | /rh/folha/[id]/holerite/[funcId] | — | PDF com cálculos CLT corretos (INSS progressivo, IRRF) | P0 | Funcional |
| F08 | Cálculo INSS progressivo | Salário R$ 3.500 | — | INSS ~R$ 333,29 (faixas progressivas) | P0 | Cálculo |

---

## BLOCO G — BOLETIM DE MEDIÇÃO (BM)

| ID | Fluxo | Passos | Dados | Resultado esperado | P | Tipo |
|----|-------|--------|-------|-------------------|---|------|
| G01 | Criar BM | /boletins/nova → obra + datas → Preview → Salvar | Cesari, 01-30/04 | BM criado com itens por função, status='aberto' | P0 | Funcional |
| G02 | BM sem funcionários no período | Obra sem ponto no período | — | Preview vazio com aviso | P1 | Edge case |
| G03 | Aprovar BM | BM aberto → "Aprovar" | — | Status='aprovado', lançamento financeiro tipo='receita' criado | P0 | Funcional |
| G04 | Aprovar BM → verifica lançamento | Após aprovar | — | /financeiro mostra lançamento com origem='bm_aprovado' | P0 | Consistência |
| G05 | Exportar Excel | BM aprovado → "Exportar Excel" | — | Download .xlsx com dados corretos | P1 | Funcional |
| G06 | BM com capitalização diferente | Func cargo "Soldador ER" vs composição "SOLDADOR ER" | — | Match funciona (UPPER TRIM) | P0 | Consistência |
| G07 | Editar BM aprovado | Tentar editar itens de BM aprovado | — | Bloqueado ou avisado | P1 | Validação |

---

## BLOCO H — FORECAST

| ID | Fluxo | Passos | Dados | Resultado esperado | P | Tipo |
|----|-------|--------|-------|-------------------|---|------|
| H01 | Gerar forecast | /forecast → clicar obra → "Gerar Forecast" | Obra com composição | Forecast gerado com fator pro-rata por dias úteis | P0 | Funcional |
| H02 | Meses parciais | Obra início 21/01, fim 20/07 | — | Jan ~38%, Jul ~61%, meses cheios 100% | P0 | Cálculo |
| H03 | Regerar | Forecast existente → "Regerar" | — | Hard DELETE antigo → INSERT novo (sem soft-delete) | P1 | Funcional |
| H04 | Limpar | "Limpar forecast" | — | Hard DELETE, lista vazia | P1 | Funcional |
| H05 | Obra sem composição | Gerar para obra sem contrato_composicao | — | Toast "Obra sem composição de funções" | P1 | Validação |
| H06 | Toggle checks | Marcar bm_emitido, bm_aprovado | — | Checkbox persiste sem erro | P1 | Funcional |
| H07 | Coluna dias úteis | Verificar coluna "Dias úteis" na tabela | — | Jan: 8/21, Fev: 18/18, etc. | P1 | UI |

---

## BLOCO I — DESLIGAMENTO

| ID | Fluxo | Passos | Dados | Resultado esperado | P | Tipo |
|----|-------|--------|-------|-------------------|---|------|
| I01 | Iniciar desligamento | /rh/desligamentos/novo → func → tipo → salvar | Sem justa causa, hoje | Workflow criado, func continua ativo | P0 | Funcional |
| I02 | Wizard 8 etapas | /rh/desligamentos/novo/wizard | — | 8 etapas com stepper, sem window.confirm | P0 | Funcional |
| I03 | Concluir desligamento | Todas etapas OK → Concluir | — | Modal confirmação → func.status='inativo', alocações encerradas, rescisão auto | P0 | Funcional |
| I04 | Func desligado no ponto | Após desligamento → abrir /ponto | — | Func NÃO aparece (alocacao.ativo=false) | P0 | Consistência |
| I05 | Perfil desligado | /funcionarios/[id] de func inativo | — | Banner "🚫 Funcionário desligado" com "Reabrir admissão" | P1 | UI |
| I06 | Desligamento duplicado | Iniciar 2 desligamentos para mesmo func | — | Toast "Já possui desligamento em andamento" | P1 | Validação |

---

## BLOCO J — FINANCEIRO

| ID | Fluxo | Passos | Dados | Resultado esperado | P | Tipo |
|----|-------|--------|-------|-------------------|---|------|
| J01 | Criar lançamento | /financeiro → modal → tipo despesa → salvar | Aluguel, R$8.500, Matriz | Lançamento criado com CC badge roxo | P0 | Funcional |
| J02 | Filtrar por CC | Select "Todos os CCs" → Matriz | — | Só lançamentos da Matriz | P1 | Funcional |
| J03 | DRE por obra | /financeiro/dre → tab "Por Obra" | — | Tabela com Receita/CPV/Suporte/Resultado/Margem | P0 | Funcional |
| J04 | DRE consolidada | Tab "Consolidado" | — | Receita → CPV → Lucro Bruto → SG&A → EBITDA → LL | P0 | Funcional |
| J05 | Valor zero | Criar lançamento com valor=0 | R$ 0 | Rejeita (CHECK constraint valor > 0) | P1 | Validação |
| J06 | Valor negativo | valor=-100 | -100 | Rejeita | P1 | Validação |
| J07 | QuickCreate CC | Clicar (+) no campo CC → criar CC | ADM-TEST | CC criado, selecionado automaticamente | P1 | Funcional |

---

## BLOCO K — RDO (Diário de Obra)

| ID | Fluxo | Passos | Dados | Resultado esperado | P | Tipo |
|----|-------|--------|-------|-------------------|---|------|
| K01 | Criar RDO | /obras/[id]?tab=diario → Novo RDO | Data hoje, efetivo 5 | RDO salvo com 7 seções | P0 | Funcional |
| K02 | Importar Excel | Importar Excel → AGEO detectado | .xlsx AGEO | Preview 3 abas, confirmar importa | P1 | Integração |
| K03 | Workflow aprovação | Rascunho → Revisado → Aprovado | — | Status bar atualiza, botões mudam | P1 | Funcional |
| K04 | Assinatura digital | RDO aprovado → Assinar (Tecnomonte) | Nome + cargo + canvas | PNG salvo no Storage, timestamp registrado | P1 | Funcional |
| K05 | Exportar PDF | RDO → Exportar PDF | — | PDF abre com fotos, assinaturas, template Tecnomonte | P1 | Funcional |
| K06 | Ocorrência com claim | Adicionar ocorrência tipo "Obstrução contratante" + gera_claim | — | Banner vermelho "Impacto contratual" | P1 | Funcional |

---

## BLOCO L — CENTROS DE CUSTO

| ID | Fluxo | Passos | Dados | Resultado esperado | P | Tipo |
|----|-------|--------|-------|-------------------|---|------|
| L01 | Criar CC administrativo | /cc/estrutura → Nova Unidade | Matriz Campinas, escritório | Código ADM-001 gerado, card aparece | P0 | Funcional |
| L02 | Custos fixos gerar | /cc/custos-fixos → Gerar Lançamentos | Abril 2026 | X lançamentos em financeiro_lancamentos | P1 | Funcional |
| L03 | Transferir equipamento | /cc/equipamentos → Transferir | De Matriz → Cesari | cc_equipamentos_alocacao, anterior fechado | P1 | Funcional |
| L04 | Merge CC duplicado | /cadastros/merge → CC → origem ≠ destino → MESCLAR | — | FKs migradas, origem soft-deleted, log criado | P0 | Funcional |
| L05 | Merge com auto-referência | Tentar merge origem = destino | — | Erro (não permite) | P1 | Validação |
| L06 | DRE por CC | /financeiro/dre → tab "Por CC" | — | Tabela CC/Receitas/Despesas/Resultado | P1 | Funcional |
| L07 | Rateio configurar | /cc/rateio → método por_receita → Salvar | — | UPSERT cc_rateio_config | P1 | Funcional |

---

## BLOCO M — ASSISTENTE IA

| ID | Fluxo | Passos | Dados | Resultado esperado | P | Tipo |
|----|-------|--------|-------|-------------------|---|------|
| M01 | Abrir drawer | Clicar ✨ bottom-right | — | Drawer abre pela direita, sugestões visíveis | P1 | UI |
| M02 | Consulta simples | "Liste os funcionários ativos" | — | Resposta com dados reais do banco | P1 | Funcional |
| M03 | Navegação wizard | "Admite o Pablo" → busca → card azul | — | Card clicável com link para wizard | P1 | Funcional |
| M04 | Upload documento | Arrastar PDF → "Analise" | PDF qualquer | Análise retorna resumo do documento | P2 | Funcional |
| M05 | Minimizar → reabrir | Clicar (—) → clicar ✨ de novo | — | Conversa anterior preservada | P1 | UI |
| M06 | Scroll body bloqueado | Drawer aberto → scrollar | — | Fundo não scrolla | P1 | UI |
| M07 | Fechar e reabrir | X → ✨ | — | Conversa ainda lá (não zera) | P1 | UI |

---

## BLOCO N — WHATSAPP

| ID | Fluxo | Passos | Dados | Resultado esperado | P | Tipo |
|----|-------|--------|-------|-------------------|---|------|
| N01 | Página config | /configuracoes/whatsapp | — | Formulário carrega, toggle ativo/inativo | P1 | Funcional |
| N02 | Painel vazio | /rh/whatsapp sem envios | — | Empty state com "Nenhum envio" | P1 | UI |
| N03 | Confirmar token inválido | /confirmar/TOKEN_INVALIDO | — | "Este link é inválido ou expirou" | P0 | Validação |
| N04 | Confirmar CPF errado 3x | Token válido + 3 CPFs errados | — | Bloqueado após 3ª tentativa | P0 | Segurança |
| N05 | API send sem auth | POST /api/whatsapp/send sem cookie | — | 401 Não autenticado | P0 | Segurança |
| N06 | Webhook sem assinatura | POST /api/whatsapp/webhook sem X-Twilio-Signature | — | 200 (mas deve ignorar) ou 403 | P1 | Segurança |

---

## BLOCO O — RESPONSIVIDADE E UI

| ID | Fluxo | Dados | Resultado esperado | P | Tipo |
|----|-------|-------|-------------------|---|------|
| O01 | Mobile 390px: login | — | Campos e botão visíveis, sem scroll horizontal | P1 | Responsivo |
| O02 | Mobile: menu hamburger | — | Menu lateral abre, navegação funciona | P1 | Responsivo |
| O03 | Mobile: wizard | — | Modal centrado, footer visível, scroll interno | P0 | Responsivo |
| O04 | Desktop 1920px: tabelas | — | Sem scroll horizontal desnecessário | P2 | Responsivo |
| O05 | Dropdown "Mais ▾" | /funcionarios → clicar "Mais" | — | Dropdown fixed aparece com 10+ itens | P0 | UI |
| O06 | Zoom 200% | Chrome zoom 200% | — | Layout não quebra | P2 | Acessibilidade |

---

## BLOCO P — PERFORMANCE E ESCALA

| ID | Fluxo | Dados | Resultado esperado | P | Tipo |
|----|-------|-------|-------------------|---|------|
| P01 | Listagem 100+ funcs | 100 funcionários cadastrados | Carrega < 3s, paginação funciona | P1 | Performance |
| P02 | BM com 30 funcs | Obra com 30 funcionários alocados | Preview gera < 5s | P1 | Performance |
| P03 | DRE com 1000+ lançamentos | Financeiro com muitos registros | Carrega < 5s | P2 | Performance |
| P04 | API assistant streaming | Pergunta complexa | Resposta inicia < 3s, stream fluido | P2 | Performance |

---

## BLOCO Q — CONSISTÊNCIA CROSS-MÓDULO

| ID | Fluxo | Passos | Resultado esperado | P | Tipo |
|----|-------|--------|-------------------|---|------|
| Q01 | Admitir → aparece no ponto | Wizard completo com obra | Func aparece no grid do ponto da obra | P0 | Consistência |
| Q02 | Fechar folha → lançamento financeiro | Folha Abril → financeiro | Lançamentos com tipo='despesa', origem='folha_fechamento' | P0 | Consistência |
| Q03 | Aprovar BM → receita no financeiro | BM aprovado | Lançamento receita no financeiro + forecast bm_aprovado=true | P0 | Consistência |
| Q04 | Desligar → sai do ponto | Concluir desligamento | Func não aparece mais no ponto | P0 | Consistência |
| Q05 | Editar nome → atualiza em tudo | Mudar nome do func | Listagem, perfil, ponto, folha — todos mostram novo nome | P1 | Consistência |
| Q06 | Criar CC → aparece na obra | Criar CC tipo obra | Seção CC na página da obra mostra o CC | P1 | Consistência |
| Q07 | Custo fixo gerar → financeiro | Gerar lançamentos CC | Aparecem em /financeiro com badge do CC | P1 | Consistência |
| Q08 | Merge CC → FKs migradas | Merge CC A → B | Lançamentos de A agora mostram B | P0 | Consistência |

---

## PLANO DE EXECUÇÃO

### Fase 1 — Smoke Test (30 min)
- A01, B01-B02, C01, D01-D04, E01-E02, F01, G01, H01, J01, O05
- Objetivo: verificar que nada está 100% quebrado

### Fase 2 — Fluxos críticos (2h)
- D01-D20 (wizard completo), E01-E10 (ponto), F01-F08 (folha)
- G01-G07 (BM), Q01-Q08 (consistência cross-módulo)

### Fase 3 — Validações e edge cases (2h)
- C01-C15, J05-J07, H05-H07, I06, L05, N03-N06

### Fase 4 — Permissões e segurança (1h)
- B01-B12, A05-A12, N04-N06

### Fase 5 — Responsividade e performance (1h)
- O01-O06, P01-P04

### Candidatos a automatizar (Playwright):
- A01-A03, B01-B05, C01-C03, D01-D02, E01-E02, G01, O05, Q01

### Dados de seed necessários:
- 1 obra ativa com composição (15 funções)
- 15+ funcionários alocados
- Ponto lançado para 1 mês completo
- 1 BM gerado
- 1 CC administrativo com custos fixos
- 1 func com status='pendente' para wizard

### Riscos recomendados para atenção extra:
1. **Wizard admissão Steps 5-8** — componentes grandes, menos testados
2. **Cálculos CLT** — INSS progressivo + IRRF com dependentes
3. **Forecast pro-rata** — dias úteis com feriados móveis (Carnaval/Corpus Christi)
4. **BM HH** — cruzamento funcao_id vs cargo em capitalização diferente
5. **Merge** — cascata em 6+ tabelas sem rollback se uma falhar

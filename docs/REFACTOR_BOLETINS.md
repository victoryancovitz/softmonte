# Plano de refatoração: `boletins/[id]/page.tsx`

**Status atual**: 978 linhas (era 991, -13 após extração segura de constantes)

## O que já foi extraído
- `src/lib/bm-constants.ts`: TIPOS_DOC_BM, BM_STATUS_BADGE, BM_STATUS_ORDER, BM_TIPO_HORA_LABEL, BM_TIPO_HORA_COLOR

## Próximas extrações (cada uma = 1 commit separado, com testes manuais)

### 1. `components/BmHeader.tsx` (~100 linhas)
Hero card no topo: número do BM, status, datas, obra, valor aprovado, badges, botões de status (fechar/enviar/aprovar).

**Props**: `bm, totalHH, onStatusChange, onDelete`

### 2. `components/BmItensTable.tsx` (~250 linhas)
Tabela de itens (funcão × tipo_hora × quantidade × valor) com modo view e modo edit. Toda a lógica de `editandoItens`, `salvandoItens`, `bmItens` vai pra cá.

**Props**: `bmId, itensIniciais, readOnly, onSaved`

### 3. `components/BmExportActions.tsx` (~60 linhas)
Botões "Exportar Excel" e "Imprimir PDF" com lógica de download e mailto.

**Props**: `bmId, bmNumero, obraNome`

### 4. `components/BmEmailDialog.tsx` (~150 linhas)
Dialog de envio por email com seleção de destinatários, contatos do cliente, observação, geração de mailto link, baixar anexo.

**Props**: `open, onClose, bm, clienteData, onEnviado`

### 5. `components/BmRevisaoDialog.tsx` (~80 linhas)
Registro de revisão solicitada pelo cliente.

**Props**: `open, onClose, bmId, onRegistrada`

### Resultado esperado
- Main page: ~250 linhas (só orquestração + estado + useEffect loader)
- 5 componentes extraídos (total ~640 linhas)
- Total similar, mas cada arquivo testável isoladamente e muito mais legível

## Como fazer com segurança

1. Copiar a página atual para `boletins/[id]/page.old.tsx` como backup
2. Extrair UM componente por vez
3. Rodar `npm run build` a cada extração
4. Testar manualmente o fluxo completo (carregar, editar itens, exportar, enviar email, mudar status)
5. Commit separado para cada componente
6. Depois de todos passarem, deletar o backup

## Riscos
- Estado compartilhado entre seções (ex: `bm` usado em quase todas) — pode exigir lift up ou context
- `exportExcel` e `handleAbrirMailto` compartilham lógica de download — extrair helper comum
- Mutations em `boletins_medicao` precisam re-chamar `loadBM()` — passar callback ao invés de estado

## Não fazer se
- Há bug crítico aberto nessa tela → priorizar correção antes
- Nenhum outro dev pode testar no mesmo dia → fica arriscado se você precisar reverter rápido

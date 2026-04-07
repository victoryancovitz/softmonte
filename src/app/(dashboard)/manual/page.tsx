'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Search, ChevronDown, ChevronRight, BookOpen, Building2, Users, Clock,
  FileText, DollarSign, Package, ClipboardList, Shield, UserPlus, UserMinus,
  Truck, ShoppingCart, BarChart3, TrendingUp, Settings, MessageSquare,
  Calendar, AlertTriangle, Star, Upload, Wallet,
  Database, History, PieChart, Building, Briefcase, FolderCog, ListChecks,
  HardHat,
} from 'lucide-react'

type Secao = {
  id: string
  grupo: string
  icon: any
  titulo: string
  desc: string
  link?: string
  conteudo: { subtitulo: string; texto: string; dica?: string }[]
}

const MANUAL: Secao[] = [
  // ─────────────── INÍCIO ───────────────
  {
    id: 'dashboard', grupo: 'Início', icon: BarChart3, titulo: 'Dashboard', desc: 'Tela inicial role-based', link: '/dashboard',
    conteudo: [
      { subtitulo: 'O que é', texto: 'Tela inicial com KPIs, alertas e atalhos. O conteúdo muda conforme o perfil de acesso (role): admin vê tudo, outros roles veem apenas o que interessa à sua função.' },
      { subtitulo: 'KPIs operacionais (todos os roles operacionais)', texto: 'Obras ativas, efetivo hoje, HH do mês e BMs abertos. Linha inferior mostra alertas: contratos vencidos, vencendo 30d, documentos vencendo, BMs aguardando retorno.' },
      { subtitulo: 'KPIs financeiros (admin e financeiro)', texto: 'Saldo em contas correntes, receita do mês, despesa do mês e valor em aberto. Cards clicáveis que levam às telas correspondentes.' },
      { subtitulo: 'KPIs de RH (admin e RH)', texto: 'Admissões em andamento, desligamentos em andamento, documentos vencidos e contratos vencendo em 30 dias.' },
      { subtitulo: 'Obras ativas + alertas', texto: 'Cards de obras com barra de progresso calculada pela data início/fim. Feed lateral de alertas ordenados por urgência (vermelho < 7d, laranja 8-20d, amarelo 21-30d).' },
      { subtitulo: 'Ações rápidas (filtradas por role)', texto: 'Até 4 atalhos que variam conforme o perfil: admin/encarregado vê "Lançar ponto" e "Novo BM", RH vê "Novo funcionário" e "Admissões", financeiro vê "Novo lançamento", "Contas correntes" e "Forecast".', dica: 'A saudação muda conforme o horário (Bom dia / Boa tarde / Boa noite) no fuso de São Paulo.' },
    ]
  },

  // ─────────────── ENGENHARIA ───────────────
  {
    id: 'obras', grupo: 'Engenharia', icon: Building2, titulo: 'Obras', desc: 'Gestão de obras e contratos', link: '/obras',
    conteudo: [
      { subtitulo: 'Listagem', texto: 'Tabela com todas as obras ativas (canceladas/encerradas não aparecem). Status com badge colorido. Busca por nome/cliente.' },
      { subtitulo: 'Detalhe da obra', texto: 'Abas: Geral (KPIs + informações + composição contratual + aditivos), Equipe, Efetivo, Boletins, Financeiro, Documentos, Cronograma, Diário, RNC.' },
      { subtitulo: 'Contrato expandido', texto: 'A tela de editar obra tem 40+ campos contratuais: identificação, datas, valor total/mensal, HH contratados, margem alvo, forma e prazo de pagamento, índice de reajuste, banco/agência/conta, horário de trabalho, dias úteis/mês, contatos contratante e contratada.' },
      { subtitulo: 'Salvar como template', texto: 'Botão "📋 Salvar como template de contrato" transforma a composição contratual + campos da obra em um tipo de contrato reutilizável. Pede um nome e cria entrada em Tipos de Contrato.' },
      { subtitulo: 'Regra Cesari (bm_dia_unico)', texto: 'Checkbox na aba Contrato para obras que cobram dia-pessoa × carga horária fixa (9h), independente se é sábado/domingo — todos viram "hora normal". Útil para contratos antigos estilo Cesari. Para novas obras, deixe desmarcado.' },
      { subtitulo: 'Modelo de cobrança', texto: 'Campo modelo_cobranca aceita "dia_pessoa" (padrão, Cesari) ou "horas_reais" (nova obra). No modo horas_reais, o BM soma as horas efetivamente lançadas no ponto em vez de aplicar a carga fixa.' },
      { subtitulo: 'Cronograma e RNC', texto: 'Cronograma em 2 níveis (fase → atividade) com datas planejadas/reais e % físico. RNCs (registros de não conformidade) com tipo, impacto e fluxo aberta → em tratamento → fechada.', dica: 'Antes de encerrar uma obra, verifique se todos os BMs foram aprovados e se não há pendências financeiras.' },
    ]
  },
  {
    id: 'boletins', grupo: 'Engenharia', icon: FileText, titulo: 'Boletins de Medição (BM)', desc: 'Criação, aprovação e exportação', link: '/boletins',
    conteudo: [
      { subtitulo: 'Fluxo completo', texto: 'Criar → Fechar → Enviar ao cliente → Aprovar (ou Revisão). A listagem agrupa em 3 seções: Em andamento, Aguardando aprovação (badge pulsante), Aprovados.' },
      { subtitulo: 'Novo BM + preview', texto: 'Selecione obra e período. Ao clicar "Pré-visualizar", o sistema lê o efetivo_diario do período e monta a tabela por função com 12 colunas: Nº, Função, Efetivo, DIA HN, DIA HE 70%, DIA HE 100%, HH Normal, HH HE 70%, HH HE 100%, R$/HH (Normal/70/100) e Valor Total.' },
      { subtitulo: 'Validações do BM', texto: 'Bloqueia obras canceladas/encerradas, períodos sobrepostos com outros BMs da mesma obra, data inicial futura, BMs sem dias-pessoa registrados. Revalida status da obra contra o banco no momento de salvar.' },
      { subtitulo: 'Composição editável', texto: 'Na tela de detalhe do BM, botão "✏ Editar" permite alterar o número de dias de cada item. HH e valor total são recalculados ao vivo. Botão fica indisponível quando BM está aprovado (protegido por trigger no banco também).' },
      { subtitulo: 'Exportar Excel', texto: 'Botão "Exportar Excel" gera um arquivo .xlsx com 3 abas: "Resumo de Horas" (cabeçalho navy com logo Tecnomonte real, tabela pivot de 12 colunas, total geral), "Lançamentos" (matriz função × dia do período com sábados em amarelo e domingos/feriados em vermelho) e "Calendário" (um funcionário por linha com "P" nos dias presentes).' },
      { subtitulo: 'Exportar PDF', texto: 'Botão "Exportar PDF" abre uma pré-visualização em A4 landscape que dispara o diálogo de impressão automaticamente. Escolha "Salvar como PDF" no diálogo do navegador. O nome do arquivo já vem sugerido no formato BMxx_Obra.pdf.' },
      { subtitulo: 'Envio por email', texto: 'Na seção "Envio ao Cliente" (BM status=fechado), o sistema busca automaticamente os contatos do cliente. Ao clicar "Enviar BM por Email", o Excel é baixado e o mailto: é aberto com destinatários, assunto e corpo pré-preenchidos. Após enviar, confirme no sistema.' },
      { subtitulo: 'Aprovar BM', texto: 'Botão "Aprovar BM" exige valor > 0. Cria automaticamente uma receita no financeiro (tipo=receita, origem=bm_aprovado). Se a criação da receita falhar, o BM é revertido para "enviado" automaticamente (transação garantida).' },
      { subtitulo: 'Fluxo de revisão', texto: 'Se o cliente solicitar ajustes, clique "Revisão" e informe o motivo. O BM volta para "aberto" em modo edição, um banner vermelho aparece com a solicitação, e você pode corrigir a composição. Ao terminar, clique "✓ Correção feita — pronto para reenviar" e o BM volta para "fechado" para reenvio.' },
      { subtitulo: 'Excluir BM', texto: 'Modal customizado: se o BM já foi aprovado, pergunta se deseja excluir também o lançamento financeiro. Se a receita já está marcada como "pago", a exclusão do lançamento é bloqueada (precisa estornar no financeiro primeiro).', dica: 'BM aprovado é imutável — trigger no banco bloqueia INSERT/UPDATE/DELETE em bm_itens quando status=aprovado, exceto para role admin.' },
    ]
  },

  // ─────────────── ADMINISTRATIVO ───────────────
  {
    id: 'funcionarios', grupo: 'Administrativo', icon: Users, titulo: 'Funcionários', desc: 'Cadastro, ficha completa e multi-seleção', link: '/funcionarios',
    conteudo: [
      { subtitulo: 'Listagem', texto: 'Toggle entre Cards e Tabela (persiste em localStorage). Filtros: busca por nome/CPF/ID Ponto/cargo, status (ativos/desligados/disponível/alocado/afastado), cargo, intervalo de data de admissão. Ordenação clicável por cabeçalho na tabela.' },
      { subtitulo: 'Multi-seleção + ações em lote', texto: 'Checkboxes em cada card/linha. Ao selecionar 1 ou mais funcionários, aparece uma barra sticky com ações: Marcar disponível / Marcar alocado / Marcar afastado / 🗑 Desligar (soft delete em lote).' },
      { subtitulo: 'Nova ficha do funcionário', texto: 'A ficha pública tem seções separadas: Dados Cadastrais (documentos, endereço, banco), Obras (alocações ativas e encerradas), Contrato (tipo de vínculo, admissão, prazos de experiência, renovação), Remuneração (salário, adicionais, benefícios), Prazos Legais (experiência, férias, faltas), Faltas e Atestados, Ponto dos últimos 30 dias, Documentos, Histórico na empresa e Advertências/Termos.' },
      { subtitulo: 'Seção Contrato', texto: 'Consolida: tipo de vínculo (indeterminado, experiência 45+45, 30+60, 90, determinado 6m/12m, temporário), data de admissão, 1º e 2º prazo de experiência com badge de status, política de renovação (NÃO RENOVAR com motivo).' },
      { subtitulo: 'Seção Remuneração', texto: 'Mostra salário base, insalubridade (% e R$), periculosidade, salário bruto, benefícios individualizados (VT, VR × 21 dias, VA, plano de saúde, outros) e total mensal estimado. Observação: não inclui encargos patronais (veja Editar para o custo completo).' },
      { subtitulo: 'Editar funcionário', texto: 'Formulário com seções: Identificação, Função e Contrato (tipo vínculo, datas, prazos com validação), Remuneração CLT (salário, insalubridade 0/10/20/30/40%, periculosidade 30%, horas/mês, benefícios), Dados Pessoais complementares (data nascimento, naturalidade, estado civil, raça/cor, nome pai/mãe, endereço, título eleitor), Bancários e EPI, Renovação de contrato.' },
      { subtitulo: 'Preview de custo CLT', texto: 'Na tela de editar, ao preencher o salário base, um card mostra em tempo real: salário total, encargos (37,4%), provisões (21%), benefícios, custo total/mês e custo/hora real calculado (custo_total ÷ horas_mes).' },
      { subtitulo: 'Validações', texto: 'prazo1 deve ser ≥ admissao; prazo2 deve ser ≥ prazo1; marcar "NÃO RENOVAR" exige preencher o motivo na observação.', dica: 'O campo nome e cargo convertem automaticamente para maiúsculas ao salvar.' },
    ]
  },
  {
    id: 'alocacao', grupo: 'Administrativo', icon: ClipboardList, titulo: 'Alocação de Equipes', desc: 'Vincular funcionários a obras', link: '/alocacao',
    conteudo: [
      { subtitulo: 'Nova alocação', texto: 'Selecione funcionário ativo + obra ativa + data de início + data de fim prevista (opcional). O cargo na obra é pré-preenchido com o cargo do funcionário.' },
      { subtitulo: 'Bloqueio de múltiplas alocações', texto: 'Um funcionário só pode ter UMA alocação ativa por vez. Se tentar criar uma segunda, o sistema bloqueia o submit e exige que a anterior seja encerrada primeiro. A regra é reforçada por trigger no banco.' },
      { subtitulo: 'Revalidação no submit', texto: 'Ao salvar, o sistema revalida contra o banco: funcionário ainda não está arquivado, obra ainda está ativa, não há outra alocação ativa. Previne condição de corrida.' },
      { subtitulo: 'Encerrar', texto: 'Botão "Encerrar" na listagem finaliza a alocação (define data_fim e ativo=false). Se o funcionário não tem outras alocações ativas, o status volta para "disponível".', dica: 'Alocar em obra cancelada/encerrada é bloqueado tanto no front quanto no banco.' },
    ]
  },
  {
    id: 'ponto', grupo: 'Administrativo', icon: Calendar, titulo: 'Ponto', desc: 'Hub central de lançamento, edição, importação e fechamento', link: '/ponto',
    conteudo: [
      { subtitulo: 'Tela única', texto: 'Toda a operação de ponto acontece aqui: criar lançamentos diários, editar, importar folha em lote, fechar mês, ver histórico de alterações. Grid calendário com funcionários nas linhas e dias do mês nas colunas.' },
      { subtitulo: 'Cores das células', texto: 'P (verde) = presente, F (vermelho) = falta injustificada, A (azul, * se tem anexo) = atestado, J (âmbar) = falta justificada, L (rosa) = licença, X (cinza) = folga/abono, S (vermelho) = suspensão, · (branco) = pendente, cinza = fim de semana.' },
      { subtitulo: 'Clique na célula', texto: 'Abre o editor detalhado (PontoCellEditor) com status pré-selecionado, campo de observação, upload de atestado (quando aplicável), campo opcional de horas trabalhadas e exclusão. Todas alterações são auditadas (quem/quando/campos).' },
      { subtitulo: 'Horas trabalhadas', texto: 'Campo opcional que aparece ao marcar "Presente". Usado por obras cobradas por hora real (modelo_cobranca="horas_reais"). Para obras no modelo dia-pessoa fixo (Cesari), deixe em branco — o sistema usa a carga horária padrão do contrato.' },
      { subtitulo: '⚡ Lançar dia rápido', texto: 'Botão que abre modal para marcar presença de vários funcionários de uma vez no mesmo dia. Selecione a data, marque quem trabalhou (ou use "Marcar todos"), defina horas comuns se for contrato hora-real, clique Salvar. Sobrescreve os lançamentos existentes do dia.' },
      { subtitulo: '📥 Importar folha', texto: 'Upload de planilha .xlsx com lançamentos do período. O parser detecta automaticamente as colunas "Matrícula/ID Ponto/Nome" e "Data" (formato dd/mm/aaaa ou aaaa-mm-dd). Coluna Tipo é opcional (inferida do dia da semana). Preview mostra linhas válidas × com erro, opção "sobrescrever" apaga o período antes de reimportar.' },
      { subtitulo: '🔒 Fechar ponto do mês', texto: 'Admin/encarregado/engenheiro clica para encerrar o mês. Depois de fechado, ninguém mais pode editar lançamentos do período (exceto admin via reabertura). Banner amarelo mostra "quem fechou" e "quando". Garantido por trigger no banco (efetivo_diario rejeita INSERT/UPDATE/DELETE em período fechado).' },
      { subtitulo: '🔓 Reabrir ponto', texto: 'Só admin. Apaga o registro de fechamento e libera novamente para edição.' },
      { subtitulo: '🔍 Histórico de alterações', texto: 'Só admin. Painel com as últimas 100 edições em efetivo_diario (vindas do audit_log): quem, quando, ação (criar/alterar/excluir) e campos alterados.' },
      { subtitulo: 'Bloqueios de período do vínculo', texto: 'O editor mostra banner vermelho e desabilita o botão Salvar quando a data está antes da admissão ou depois do desligamento do funcionário. Regra também garantida no banco (trigger trg_efetivo_periodo).', dica: 'Fluxo recomendado: encarregados lançam dia a dia no mesmo /ponto; no fim do mês, admin revisa, importa folha se necessário, e fecha o ponto — aí o BM do período é gerado a partir desses dados travados.' },
    ]
  },
  {
    id: 'faltas', grupo: 'Administrativo', icon: AlertTriangle, titulo: 'Faltas & Atestados', desc: 'Registro de ausências', link: '/faltas',
    conteudo: [
      { subtitulo: 'Tipos', texto: 'Falta injustificada, falta justificada, atestado médico, atestado acidente, licença maternidade/paternidade, folga compensatória, feriado, suspensão, outro.' },
      { subtitulo: 'Registrar', texto: 'Selecione funcionário (só ativos), obra, data, tipo e dias descontados. Para atestados: campos extras de CID, médico e CRM. Upload de arquivo (PDF ou imagem, até 10MB).' },
      { subtitulo: 'Validações', texto: 'Bloqueia registro em funcionário arquivado. Bloqueia data anterior à admissão. Valida extensão do arquivo (PDF/JPG/PNG/WebP) e tamanho.', dica: 'Faltas são cruzadas com o ponto — a mesma ocorrência aparece no grid do /ponto e na ficha do funcionário.' },
    ]
  },
  {
    id: 'rh-banco', grupo: 'Administrativo', icon: Clock, titulo: 'Banco de Horas', desc: 'Saldo mensal por funcionário', link: '/rh/banco-horas',
    conteudo: [
      { subtitulo: 'Visão', texto: 'Tabela com HH contrato, HH trabalhado, HH extras, HH faltas, HH compensadas, saldo mês e saldo acumulado. Cores: verde (0-20h), amarelo (20-40h), vermelho (>40h ou negativo).' },
      { subtitulo: 'Edição inline', texto: 'Clique em qualquer campo numérico para editar direto na célula. O saldo é recalculado automaticamente.' },
      { subtitulo: 'Fechar mês', texto: 'Marca todos os registros como fechados e propaga o saldo acumulado para o próximo mês.' },
    ]
  },
  {
    id: 'rh-ferias', grupo: 'Administrativo', icon: Calendar, titulo: 'Férias', desc: 'Programação e controle CLT', link: '/rh/ferias',
    conteudo: [
      { subtitulo: 'Situação', texto: 'Mostra cada funcionário com admissão, anos de empresa, dias de direito, dias gozados, status. Alerta vermelho para >24 meses sem férias (vencidas — risco de pagamento em dobro).' },
      { subtitulo: 'Fluxo', texto: 'Pendente → Programada (definir datas) → Aprovada → Realizada. Cada etapa tem botão de ação.' },
      { subtitulo: 'Abono pecuniário', texto: 'Ao programar, informe dias vendidos. O sistema calcula os dias restantes de gozo.' },
    ]
  },
  {
    id: 'rh-treinamentos', grupo: 'Administrativo', icon: Shield, titulo: 'Treinamentos NR', desc: 'Controle de validade', link: '/rh/treinamentos',
    conteudo: [
      { subtitulo: 'Por funcionário', texto: 'Accordion com cada funcionário mostrando seus treinamentos. Ícones: verde (OK), amarelo (vencendo em 60d), vermelho (vencido), cinza (não possui).' },
      { subtitulo: 'Vencimentos', texto: 'Lista ordenada por urgência: vencidos primeiro, depois vencendo em 30d, 60d.' },
      { subtitulo: 'Registro em lote', texto: 'Selecione vários funcionários + tipo de treinamento + data. O sistema calcula a data de vencimento pela validade do tipo (ex: NR-35 = 24 meses).', dica: 'Tipos (NR-06, NR-10, NR-12, NR-18, NR-33, NR-35, CIPA) já vêm pré-cadastrados.' },
    ]
  },
  {
    id: 'rh-admissoes', grupo: 'Administrativo', icon: UserPlus, titulo: 'Admissões', desc: 'Wizard de admissão', link: '/rh/admissoes',
    conteudo: [
      { subtitulo: 'Wizard de 5 etapas', texto: 'Dados iniciais (função, salário, admissão, tipo vínculo, turno) → Documentação (checklist CTPS, RG, CPF, PIS, reservista, conta, foto 3x4) → Exame admissional (data, médico, laudo, ASO + validade) → EPI & NR (lista de EPIs entregues + treinamentos NR) → eSocial (S-2200 enviado + recibo + data).' },
      { subtitulo: 'Validações', texto: 'Não permite abrir admissão para funcionário que já está ativo (status disponível/alocado/afastado) ou arquivado (deleted_at). Se o funcionário tem nao_renovar=true, pede confirmação explícita.' },
      { subtitulo: 'Nova admissão', texto: '/rh/admissoes/novo — cria o workflow com as 10 etapas (além das 5 do wizard há: CTPS, Contrato assinado, Dados bancários, Integração SST, Uniforme) todas como "pendente". O wizard depois permite marcar cada uma.', dica: 'Crie a admissão antes mesmo do funcionário começar, para acompanhar o andamento da documentação.' },
    ]
  },
  {
    id: 'rh-desligamentos', grupo: 'Administrativo', icon: UserMinus, titulo: 'Desligamentos', desc: 'Wizard de saída com CLT Art. 482', link: '/rh/desligamentos',
    conteudo: [
      { subtitulo: 'Checklist', texto: '9 etapas: Aviso prévio, Devolução EPI, Devolução ferramentas, Exame demissional, Baixa CTPS, Cálculo rescisão, Homologação, eSocial S-2299, Acerto banco de horas.' },
      { subtitulo: 'Tipos de desligamento', texto: 'Sem justa causa, por justa causa, pedido de demissão, término de contrato, redução de equipe, transferência, falecimento. O tipo afeta o cálculo da rescisão.' },
      { subtitulo: 'Motivo de justa causa (CLT Art. 482)', texto: 'Quando "justa causa" é selecionado, aparece dropdown com 14 motivos legais: ato de improbidade, incontinência, negociação habitual, condenação criminal, desídia, embriaguez em serviço, violação de segredo, ato de indisciplina, abandono de emprego, ofensas físicas, ofensas à honra, jogos de azar, ato atentatório à segurança nacional, perda da habilitação, "outro motivo (descrever)".' },
      { subtitulo: 'Bloqueios', texto: 'Não permite abrir desligamento para funcionário já arquivado.' },
      { subtitulo: 'Conclusão', texto: 'Ao concluir, funcionário é marcado como inativo, soft-deletado (deleted_at) e todas as alocações ativas são encerradas. Saldo de banco de horas e férias proporcionais ficam visíveis para cálculo.' },
    ]
  },
  {
    id: 'documentos', grupo: 'Administrativo', icon: Shield, titulo: 'Documentos', desc: 'ASO, NRs, RG, CPF, contratos, atestados', link: '/documentos',
    conteudo: [
      { subtitulo: 'Tipos suportados', texto: 'ASO, NR, CIPA, RG, CPF, PIS, CTPS, contrato, admissão, registro, EPI, holerite, ponto, atestado, termo, férias, benefício, eSocial, declaração, comprovante, outro.' },
      { subtitulo: 'Documento não vence', texto: 'Checkbox "Documento não vence" para RG, CPF, diploma, certidão de nascimento etc. Quando marcado, o campo de data de vencimento fica desabilitado e o documento não gera alertas. Badge exibe "∞ Não vence" em azul.' },
      { subtitulo: 'Alertas de vencimento', texto: 'Badge VENCIDO (vermelho), Xd (amarelo para <30 dias), OK (verde). Cards de alerta no topo somam docs vencidos e vencendo em 30 dias.' },
      { subtitulo: 'Upload', texto: 'Aceita PDF, JPG, JPEG, PNG, WebP. O arquivo vai para o bucket "documentos" em funcionarios/{id}/{tipo}/timestamp_nome.ext.' },
      { subtitulo: 'Gerar documento', texto: 'Botão "Gerar Documento" acessa o gerador de templates: selecione modelo (termo, advertência, comunicado, EPI), escolha 1+ funcionários, preencha campos variáveis e imprima/salve PDF com timbrado Tecnomonte. Documentos gerados ficam salvos na seção "Advertências e Termos" da ficha.' },
    ]
  },
  {
    id: 'rastreio', grupo: 'Administrativo', icon: AlertTriangle, titulo: 'Vencimentos', desc: 'Rastreio consolidado', link: '/rastreio',
    conteudo: [
      { subtitulo: 'Visão', texto: 'Consolidado de documentos e treinamentos vencendo nos próximos 60 dias. Separado em 3 níveis: vencidos, vencendo em 30d e vencendo em 60d.' },
      { subtitulo: 'Filtros', texto: 'Por obra, por status (vencido/atenção). Documentos sem vencimento (RG, CPF etc.) são automaticamente ignorados.' },
    ]
  },

  // ─────────────── COMPRAS ───────────────
  {
    id: 'estoque', grupo: 'Compras', icon: Package, titulo: 'Almoxarifado', desc: 'EPIs, ferramentas e materiais', link: '/estoque',
    conteudo: [
      { subtitulo: 'Categorias', texto: 'EPI (capacetes, luvas, botas), Ferramenta (discos, esmerilhadeiras), Consumível (eletrodos, arame, gás), Material (chapas, tubos).' },
      { subtitulo: 'Movimentações', texto: 'Entrada (compra) e Saída (entrega para obra). Cada movimentação registra quantidade, obra e motivo.' },
      { subtitulo: 'Alerta de mínimo', texto: 'Itens com quantidade ≤ quantidade_minima aparecem no dashboard como "Estoque crítico".' },
    ]
  },
  {
    id: 'fornecedores', grupo: 'Compras', icon: Truck, titulo: 'Fornecedores', desc: 'Cadastro e avaliação', link: '/compras/fornecedores',
    conteudo: [
      { subtitulo: 'Cadastro', texto: 'Cards com nome, categoria (EPI, Ferramentas, Consumível, Material, Transporte, Serviços, Alimentação), avaliação 1-5 estrelas, contato e email.' },
      { subtitulo: 'Avaliação', texto: 'Avalie de 1 a 5 estrelas. A nota é referência nas cotações.' },
    ]
  },
  {
    id: 'cotacoes', grupo: 'Compras', icon: ShoppingCart, titulo: 'Cotações', desc: 'Processo de compra com comparativo', link: '/compras/cotacoes',
    conteudo: [
      { subtitulo: 'Criar cotação', texto: 'Selecione obra, descreva a necessidade, adicione itens com quantidade, marque urgência e prazo de resposta.' },
      { subtitulo: 'Comparativo', texto: 'Adicione fornecedores convidados com o valor cotado. O menor preço é destacado.' },
      { subtitulo: 'Aprovação', texto: 'Selecione o fornecedor escolhido, informe valor aprovado e motivo. Status vira "aprovada".' },
      { subtitulo: 'Excluir', texto: 'Botão lixeira em cada linha faz soft delete (preserva histórico).' },
    ]
  },
  {
    id: 'pedidos', grupo: 'Compras', icon: Briefcase, titulo: 'Pedidos', desc: 'Requisições de material', link: '/compras/pedidos',
    conteudo: [
      { subtitulo: 'O que é', texto: 'Lista de requisições feitas pelas obras com status (pendente/aprovado/entregue/cancelado), prioridade e data.' },
    ]
  },

  // ─────────────── FINANCEIRO ───────────────
  {
    id: 'financeiro', grupo: 'Financeiro', icon: DollarSign, titulo: 'Lançamentos', desc: 'Fluxo de caixa, receitas e despesas', link: '/financeiro',
    conteudo: [
      { subtitulo: 'KPIs (6 cards)', texto: 'Receita recebida, receita em aberto, despesa paga, despesa em aberto, provisões futuras, resultado total.' },
      { subtitulo: 'Gráfico de fluxo', texto: 'Barras de receita × despesa mês a mês + linha de acumulado.' },
      { subtitulo: 'Despesas por categoria', texto: 'Barra horizontal mostrando a distribuição (Salário Base, FGTS, VT, Treinamentos, Rescisões, EPI, etc).' },
      { subtitulo: 'Tabs', texto: '"Fluxo mensal" (tabela mês a mês com resultado acumulado) e "Lançamentos" (lista individual dos lançamentos).' },
      { subtitulo: 'Novo lançamento', texto: 'Tipo (receita/despesa), obra, categoria, valor (sempre > 0), status, datas, conta corrente (FK), flag de provisão.' },
      { subtitulo: 'Validações', texto: 'Valor deve ser > 0 (CHECK constraint). Algumas categorias críticas (Salário Base, FGTS, VT, Receitas) exigem obra vinculada. Obra cancelada não aceita novos lançamentos (trigger no banco).' },
      { subtitulo: 'Excluir', texto: 'Soft delete com registro de quem excluiu e quando. Se foi criado por aprovação de BM, o BM mostra essa associação.', dica: 'Ao aprovar um BM, a receita é criada automaticamente aqui com origem "bm_aprovado".' },
    ]
  },
  {
    id: 'contas-correntes', grupo: 'Financeiro', icon: Wallet, titulo: 'Contas Correntes', desc: 'Cadastro de contas e transferências', link: '/financeiro/contas',
    conteudo: [
      { subtitulo: 'Visão', texto: 'Cards de cada conta com saldo atual calculado (saldo_inicial + receitas pagas − despesas pagas). Total geral no topo somando todas as contas ativas.' },
      { subtitulo: 'Nova conta', texto: 'Modal com nome, tipo (Conta Corrente / Poupança / Caixa / Aplicação), banco, agência, conta, saldo inicial e data do saldo inicial.' },
      { subtitulo: '⇄ Transferir entre contas', texto: 'Modal de transferência: seleciona origem, destino, valor, data e descrição. O sistema cria 2 lançamentos automaticamente — uma despesa na origem e uma receita no destino, ambas marcadas como "pago" e categoria "Transferência".' },
      { subtitulo: 'Editar / Excluir', texto: 'Botões em cada card. Excluir é soft delete — lançamentos vinculados mantêm o histórico.' },
      { subtitulo: 'Uso em lançamentos', texto: 'Em /financeiro/novo, o campo "Conta corrente" é um select das contas cadastradas. Saldo da conta atualiza automaticamente quando o lançamento vira "pago".' },
    ]
  },
  {
    id: 'relatorios', grupo: 'Financeiro', icon: BarChart3, titulo: 'Relatórios', desc: 'Visão consolidada', link: '/relatorios',
    conteudo: [
      { subtitulo: 'Disponíveis', texto: '5 relatórios: Status dos Contratos HH, DRE por Obra, Banco de Horas Consolidado, Treinamentos e Conformidade, Análise de Produtividade.' },
      { subtitulo: 'Exportar', texto: 'Cada relatório tem "Exportar Excel" (CSV) e "Imprimir" (janela do navegador).' },
      { subtitulo: 'Dados em tempo real', texto: 'Nenhum cache — sempre mostra a versão mais atual do banco.' },
    ]
  },
  {
    id: 'margem', grupo: 'Financeiro', icon: PieChart, titulo: 'Relatório de Margem', desc: 'DRE por contrato com drill-down', link: '/relatorios/margem',
    conteudo: [
      { subtitulo: 'DRE por obra', texto: 'Cada contrato mostra receita mensal contratada, custo MO real, margem bruta e % margem com status colorido (verde = acima do alvo, amarelo = ok, vermelho = abaixo).' },
      { subtitulo: 'Drill-down', texto: 'Expanda um contrato para ver os funcionários alocados com custo/hora real, billing rate, margem/hora e margem %.' },
      { subtitulo: 'Base de cálculo', texto: 'Usa as views vw_dre_obra e vw_custo_funcionario que cruzam contrato_composicao × hh_lancamentos × custo_total dos funcionários (salário + encargos + provisões + benefícios).' },
    ]
  },
  {
    id: 'forecast', grupo: 'Financeiro', icon: TrendingUp, titulo: 'Forecast', desc: 'Previsão de receita mês a mês', link: '/forecast',
    conteudo: [
      { subtitulo: 'Dashboard', texto: 'KPIs: receita total prevista, realizada, a receber, meses restantes médio. Tabela por contrato com diferença colorida (verde = acima, vermelho = abaixo do previsto).' },
      { subtitulo: 'Detalhe mensal', texto: 'Clique em um contrato para ver mês a mês: receita prevista vs realizada, com checkboxes para acompanhar o fluxo BM emitido → BM aprovado → NF emitida → Pagamento recebido. Alterações salvam na hora.', dica: 'Use o forecast para identificar meses com déficit de caixa antes deles acontecerem.' },
    ]
  },

  // ─────────────── CADASTROS ───────────────
  {
    id: 'cadastros', grupo: 'Cadastros', icon: Database, titulo: 'Visão Geral', desc: 'Hub de todos os cadastros', link: '/cadastros',
    conteudo: [
      { subtitulo: 'Dashboard', texto: 'Cards com contador de cada cadastro: Funções, Obras, Funcionários, Categorias Financeiras, Documentos, Itens de Estoque.' },
      { subtitulo: 'Ações rápidas', texto: 'Atalhos de criação: novo funcionário, nova obra, nova função, nova alocação, novo documento, importar CSV.' },
    ]
  },
  {
    id: 'funcoes', grupo: 'Cadastros', icon: HardHat, titulo: 'Funções', desc: 'Cargos e custos de hora', link: '/cadastros/funcoes',
    conteudo: [
      { subtitulo: 'O que é', texto: 'Lista de funções/cargos da empresa com custo/hora padrão. Usada em: cadastro de funcionário, composição de contrato, cálculo de BM.' },
      { subtitulo: 'Nova função', texto: 'Nome, descrição, salário base de referência, custo/hora padrão.' },
    ]
  },
  {
    id: 'categorias', grupo: 'Cadastros', icon: ListChecks, titulo: 'Categorias Financeiras', desc: 'Classificação de lançamentos', link: '/cadastros/categorias',
    conteudo: [
      { subtitulo: 'O que é', texto: 'Categorias usadas em /financeiro/novo para classificar receitas e despesas. Ativas por padrão.' },
    ]
  },
  {
    id: 'clientes', grupo: 'Cadastros', icon: Building, titulo: 'Clientes', desc: 'Cadastro com múltiplos contatos', link: '/clientes',
    conteudo: [
      { subtitulo: 'Cadastro', texto: 'Nome, razão social, CNPJ, endereço, cidade, estado. Emails por setor: principal, medição (BM), fiscal, RH.' },
      { subtitulo: 'Contatos', texto: 'Lista dinâmica com nome, função, email (mailto clicável) e WhatsApp. Adicione quantos precisar.' },
      { subtitulo: 'Integração', texto: 'Os emails de medição são sugeridos automaticamente ao enviar BM. As obras do cliente aparecem na ficha.' },
    ]
  },
  {
    id: 'tipos-contrato', grupo: 'Cadastros', icon: FileText, titulo: 'Tipos de Contrato', desc: 'Templates reutilizáveis', link: '/tipos-contrato',
    conteudo: [
      { subtitulo: 'O que é', texto: 'Templates de contrato HH reutilizáveis. Cada tipo define margem alvo, prazo mínimo, prazo de pagamento, índice de reajuste, dias úteis/mês, se trabalha sábado, carga horária/dia e o horário.' },
      { subtitulo: 'Composição padrão', texto: 'Funções, quantidades, horas/mês, custo/hora de venda e multiplicadores de HE (70% e 100%).' },
      { subtitulo: 'Como criar', texto: 'Pode criar manualmente ou, na tela de editar uma obra existente, usar o botão "📋 Salvar como template de contrato".' },
      { subtitulo: 'Usar', texto: 'Ao criar uma obra nova, selecione o tipo e os campos + composição são pré-preenchidos.' },
    ]
  },

  // ─────────────── ADMINISTRATIVO DO SISTEMA (avatar dropdown) ───────────────
  {
    id: 'usuarios', grupo: 'Sistema', icon: Users, titulo: 'Usuários & Convites', desc: 'Gestão de acesso ao sistema', link: '/admin/usuarios',
    conteudo: [
      { subtitulo: 'Roles', texto: '8 perfis disponíveis: admin (acesso total), encarregado (operação), engenheiro (BMs + ponto), rh, financeiro, almoxarife, funcionário, visualizador (somente leitura).' },
      { subtitulo: 'RLS por role', texto: 'Todo acesso ao banco passa por Row-Level Security. Cada role tem policies específicas para SELECT/INSERT/UPDATE/DELETE em cada tabela.' },
      { subtitulo: 'Convites em lote', texto: 'Cole vários emails (vírgula ou um por linha), escolha o role e módulos, gere um link individual para cada. Na tela de sucesso, copie links individualmente ou todos de uma vez.' },
      { subtitulo: 'Validade do convite', texto: 'Indeterminado, dias fixos (1d-1ano), data específica, ou vinculado ao contrato do funcionário (calcula automaticamente admissão + período).' },
      { subtitulo: 'Editar usuário', texto: 'Alterar role, módulos permitidos, toggle ativo/bloqueado sem excluir a conta.', dica: 'Se um usuário recém-convidado não consegue acessar nada, verifique se tem linha na tabela profiles com role preenchida — sem profile, todas as policies negam.' },
    ]
  },
  {
    id: 'auditoria', grupo: 'Sistema', icon: History, titulo: 'Auditoria do Sistema', desc: 'Trilha de quem fez o quê', link: '/admin/usuarios/auditoria',
    conteudo: [
      { subtitulo: 'O que é', texto: 'Registro completo de todas as alterações (INSERT/UPDATE/DELETE) em tabelas críticas: boletins_medicao, bm_itens, efetivo_diario, financeiro_lancamentos, funcionarios, obras, hh_lancamentos. Populado automaticamente por triggers Postgres.' },
      { subtitulo: 'Filtros', texto: 'Por usuário, por entidade, por ação (criar/alterar/excluir), intervalo de datas.' },
      { subtitulo: 'Detalhes registrados', texto: 'Data/hora, usuário, role, tabela, ação, campos alterados.', dica: 'Acesso: no canto superior direito, clique no avatar → "Auditoria do sistema". Só admin vê.' },
    ]
  },
  {
    id: 'importar-csv', grupo: 'Sistema', icon: Upload, titulo: 'Importar dados', desc: 'CSV de funcionários e efetivo', link: '/importar',
    conteudo: [
      { subtitulo: 'O que é', texto: 'Importação em massa via CSV com preview antes de confirmar. Suporta funcionários e efetivo.' },
      { subtitulo: 'Fluxo', texto: 'Upload do CSV → preview dos registros parseados → clique em importar. Duplicatas são detectadas.' },
    ]
  },
  {
    id: 'importar-drive', grupo: 'Sistema', icon: FolderCog, titulo: 'Importar docs do drive', desc: 'Upload de .zip com pastas de funcionários', link: '/admin/importar-drive',
    conteudo: [
      { subtitulo: 'O que é', texto: 'Upload de um arquivo .zip exportado do OneDrive/Google Drive contendo pastas de funcionários. O sistema identifica cada arquivo pelo nome, classifica por tipo (ASO, RG, CPF, CTPS, NR, contrato, EPI, holerite, etc) e vincula ao funcionário correto por matching fuzzy do caminho da pasta.' },
      { subtitulo: 'Processamento', texto: 'Tudo acontece no navegador (descompactação, classificação, preview). Nada é enviado até você clicar em "Importar".' },
      { subtitulo: 'Preview', texto: 'Mostra resumo por funcionário (chips clicáveis para filtrar) + lista detalhada de cada arquivo. Você vê quais serão vinculados a quem antes de confirmar.' },
      { subtitulo: 'Vencimento automático', texto: '1 ano para ASO, NR, EPI, atestado, férias; 10 anos para RG, CPF, CTPS, PIS e docs pessoais. Pode ser ajustado individualmente depois na ficha.' },
    ]
  },
  {
    id: 'assistente', grupo: 'Sistema', icon: MessageSquare, titulo: 'Assistente IA', desc: 'Chat com Claude sobre seus dados', link: '/assistente',
    conteudo: [
      { subtitulo: 'O que é', texto: 'Chat com IA (Claude) que tem acesso ao contexto do sistema em tempo real: obras, funcionários, financeiro, BMs.' },
      { subtitulo: 'Exemplos', texto: '"Mostre um resumo da obra Cesari", "Quais funcionários têm contrato vencendo?", "Qual é o resultado financeiro atual?".' },
      { subtitulo: 'Arquivos', texto: 'Envie TXT, CSV, JSON para análise. A IA lê o conteúdo e fornece insights.', dica: 'Requer ANTHROPIC_API_KEY configurada no Vercel.' },
    ]
  },
  {
    id: 'configuracoes', grupo: 'Sistema', icon: Settings, titulo: 'Empresa / Configurações', desc: 'Dados da empresa', link: '/configuracoes',
    conteudo: [
      { subtitulo: 'Dados', texto: 'Razão social, nome fantasia, CNPJ, inscrição estadual, endereço completo, telefone.' },
      { subtitulo: 'Emails', texto: 'Email principal, financeiro e RH da empresa (usados em rodapés de documentos gerados).' },
      { subtitulo: 'Banco', texto: 'Banco principal, agência, conta e chave PIX.' },
    ]
  },
]

const GRUPOS_ORDEM = ['Início', 'Engenharia', 'Administrativo', 'Compras', 'Financeiro', 'Cadastros', 'Sistema']

export default function ManualPage() {
  const [busca, setBusca] = useState('')
  const [abertos, setAbertos] = useState<Set<string>>(new Set())

  const filtrados = busca
    ? MANUAL.filter(s =>
        s.titulo.toLowerCase().includes(busca.toLowerCase()) ||
        s.desc.toLowerCase().includes(busca.toLowerCase()) ||
        s.conteudo.some(c =>
          c.subtitulo.toLowerCase().includes(busca.toLowerCase()) ||
          c.texto.toLowerCase().includes(busca.toLowerCase())
        )
      )
    : MANUAL

  function toggle(id: string) {
    setAbertos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function expandirTodos() {
    setAbertos(new Set(MANUAL.map(s => s.id)))
  }

  // Agrupa
  const porGrupo: Record<string, Secao[]> = {}
  filtrados.forEach(s => {
    if (!porGrupo[s.grupo]) porGrupo[s.grupo] = []
    porGrupo[s.grupo].push(s)
  })

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-6 h-6 text-brand" />
          <h1 className="text-2xl font-bold font-display text-brand">Manual do Softmonte</h1>
        </div>
        <p className="text-sm text-gray-500">
          Guia completo da plataforma — {MANUAL.length} módulos · {MANUAL.reduce((s, m) => s + m.conteudo.length, 0)} tópicos
        </p>
      </div>

      {/* Busca */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar no manual... (ex: BM, férias, NR-35, contas correntes)"
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white" />
      </div>

      {/* Ações */}
      <div className="flex gap-2 mb-4">
        <button onClick={expandirTodos} className="text-xs text-brand hover:underline">Expandir todos</button>
        <span className="text-gray-300">·</span>
        <button onClick={() => setAbertos(new Set())} className="text-xs text-gray-500 hover:underline">Recolher todos</button>
        {busca && (
          <>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-400">{filtrados.length} resultado(s)</span>
          </>
        )}
      </div>

      {/* Seções agrupadas */}
      <div className="space-y-6">
        {GRUPOS_ORDEM.filter(g => porGrupo[g]?.length > 0).map(grupo => (
          <div key={grupo}>
            <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 px-1">
              {grupo}
            </h2>
            <div className="space-y-2">
              {porGrupo[grupo].map(secao => {
                const Icon = secao.icon
                const isOpen = abertos.has(secao.id) || !!busca
                return (
                  <div key={secao.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <button onClick={() => toggle(secao.id)}
                      className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors text-left">
                      <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-brand" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{secao.titulo}</span>
                          {secao.link && (
                            <Link href={secao.link} onClick={e => e.stopPropagation()}
                              className="text-[10px] text-brand bg-brand/10 px-2 py-0.5 rounded hover:bg-brand/20 transition-colors">
                              Abrir →
                            </Link>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{secao.desc}</p>
                      </div>
                      {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 pt-0 border-t border-gray-100">
                        <div className="space-y-4 mt-4">
                          {secao.conteudo.map((item, i) => (
                            <div key={i}>
                              <h3 className="text-sm font-semibold text-gray-800 mb-1">{item.subtitulo}</h3>
                              <p className="text-sm text-gray-600 leading-relaxed">{item.texto}</p>
                              {item.dica && (
                                <div className="mt-2 flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                                  <Star className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                                  <p className="text-xs text-amber-800">{item.dica}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {filtrados.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Nenhum resultado para "{busca}"</p>
          <button onClick={() => setBusca('')} className="mt-2 text-sm text-brand hover:underline">Limpar busca</button>
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100 text-center text-xs text-gray-400">
        Softmonte · Tecnomonte Fabricação, Montagem e Manutenção Industrial<br/>
        Manual reescrito em abril/2026 · {MANUAL.length} módulos · {MANUAL.reduce((s, m) => s + m.conteudo.length, 0)} tópicos
      </div>
    </div>
  )
}

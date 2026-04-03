'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Search, ChevronDown, ChevronRight, BookOpen, Building2, Users, Clock,
  FileText, DollarSign, Package, ClipboardList, Shield, UserPlus, UserMinus,
  Truck, ShoppingCart, BarChart3, TrendingUp, Settings, MessageSquare,
  Calendar, AlertTriangle, CheckSquare, Printer, Mail, Star, HardHat
} from 'lucide-react'

type Secao = {
  id: string
  icon: any
  titulo: string
  desc: string
  link?: string
  conteudo: { subtitulo: string; texto: string; dica?: string }[]
}

const MANUAL: Secao[] = [
  {
    id: 'dashboard', icon: BarChart3, titulo: 'Dashboard', desc: 'Visão geral do sistema', link: '/dashboard',
    conteudo: [
      { subtitulo: 'O que é', texto: 'A tela inicial mostra um resumo de toda a operação: KPIs operacionais (obras ativas, efetivo, HH, BMs), alertas (contratos vencidos, docs vencendo) e ações rápidas.' },
      { subtitulo: 'KPIs', texto: 'A primeira linha (azul) mostra dados operacionais: obras ativas, efetivo do dia, HH do mês e BMs em aberto. A segunda linha mostra alertas por cor: vermelho = vencidos, amarelo = atenção.' },
      { subtitulo: 'Obras ativas', texto: 'Cards com nome, cliente, localização e barra de progresso calculada automaticamente pela data início/fim.' },
      { subtitulo: 'Alertas', texto: 'Feed lateral com indicadores coloridos: vermelho (<7 dias), laranja (8-20d), amarelo (21-30d). Cada alerta é clicável.', dica: 'A saudação muda conforme o horário: Bom dia (6-12h), Boa tarde (12-18h), Boa noite (18-6h) no fuso de São Paulo.' },
    ]
  },
  {
    id: 'obras', icon: Building2, titulo: 'Obras', desc: 'Gestão de obras e contratos HH', link: '/obras',
    conteudo: [
      { subtitulo: 'Listagem', texto: 'Tabela com todas as obras. Linhas clicáveis — clique em qualquer coluna para abrir o detalhe. Status com badge colorido (Ativo, Pausado, Concluído, Cancelado).' },
      { subtitulo: 'Detalhe da obra (9 abas)', texto: 'Geral: KPIs + informações + composição contratual + aditivos. Equipe: cards dos funcionários alocados. Efetivo: registros diários dos últimos 30 dias. Boletins: lista de BMs. Financeiro: receita × despesa × margem. Documentos: docs dos funcionários alocados. Cronograma: etapas hierárquicas com barras de progresso. Diário: registros diários com clima e ocorrências. RNC: não conformidades com impacto e status.' },
      { subtitulo: 'Contrato HH', texto: 'Na aba Geral, a seção "Composição Contratual" mostra função, qtd contratada, horas/mês e custo/hora. A seção "Aditivos" mostra o histórico com tipo, status e impacto.' },
      { subtitulo: 'Cronograma', texto: 'Etapas em 2 níveis: Fase (nível 0) e Atividade (nível 1). Cada uma com datas planejadas/reais, % físico e status. Marcos são destacados.', dica: 'O % físico geral da obra aparece nos KPIs do dashboard.' },
      { subtitulo: 'Diário de obra', texto: 'Registre diariamente: clima (sol/nublado/chuva), efetivo presente, serviços executados e ocorrências. Útil para memória e disputas contratuais.' },
      { subtitulo: 'RNC', texto: 'Registros de Não Conformidade com tipo (qualidade/segurança/material/prazo), impacto (baixo a crítico), ação corretiva e responsável. Fluxo: aberta → em tratamento → fechada.' },
      { subtitulo: 'Encerrar/Cancelar', texto: 'Botões disponíveis apenas para admin. Encerrar muda status para "concluído", cancelar para "cancelado".', dica: 'Antes de encerrar uma obra, verifique se todos os BMs foram aprovados e se não há pendências financeiras.' },
    ]
  },
  {
    id: 'funcionarios', icon: Users, titulo: 'Funcionários', desc: 'Cadastro e gestão de equipe', link: '/funcionarios',
    conteudo: [
      { subtitulo: 'Visualização', texto: 'Toggle entre Cards e Tabela (botão no topo). Cards mostram avatar com iniciais, status, cargo e prazo contratual. Tabela mostra matrícula, VT e prazo.' },
      { subtitulo: 'Badges de prazo', texto: 'VENCIDO (vermelho): contrato já expirou. Xd (amarelo): vence em X dias. Sem badge: prazo ok.' },
      { subtitulo: 'Perfil do funcionário', texto: 'Dados cadastrais, obras alocadas, faltas e atestados, ponto dos últimos 30 dias, documentos com status de vencimento, advertências e termos gerados.' },
      { subtitulo: 'Novo funcionário', texto: 'Formulário com seções: Identificação (nome, matrícula, CPF), Função e custos (cargo, custo/hora), Datas contratuais, Dados bancários, EPI.' },
      { subtitulo: 'Desativar', texto: 'Botão "Desativar funcionário" no perfil (admin only). Faz soft delete: muda status para inativo, não apaga dados.', dica: 'O campo nome converte automaticamente para maiúsculas.' },
    ]
  },
  {
    id: 'boletins', icon: FileText, titulo: 'Boletins de Medição (BM)', desc: 'Fluxo completo de medição', link: '/boletins',
    conteudo: [
      { subtitulo: 'Fluxo do BM', texto: 'Criar → Fechar → Enviar ao cliente → Aprovar (ou Revisão). A listagem agrupa em 3 seções: Em andamento, Aguardando aprovação (badge pulsante), Aprovados.' },
      { subtitulo: 'Detalhe do BM', texto: 'KPIs: pessoas-dia, dias úteis, sábados, dom/feriado + valor previsto/aprovado com % de margem. Tabela resumo por função. Timeline visual de status.' },
      { subtitulo: 'Envio por email', texto: 'Na seção "Envio ao Cliente", o sistema busca automaticamente os contatos do cliente. Ao clicar "Enviar BM por Email", abre o mailto: com destinatários, assunto e corpo preenchidos. Após enviar no seu email, confirme no sistema.' },
      { subtitulo: 'Aprovação', texto: 'Botão "Aprovar BM" permite informar o valor e criar automaticamente uma receita no financeiro. "Aprovar sem receita" apenas muda o status.' },
      { subtitulo: 'Revisão', texto: 'Se o cliente solicitar ajustes, use "Revisão" com o motivo. O BM volta para status "fechado" e o histórico registra.', dica: 'BMs enviados há mais de 7 dias mostram badge vermelho de urgência na listagem.' },
    ]
  },
  {
    id: 'efetivo', icon: CheckSquare, titulo: 'Efetivo Diário', desc: 'Registro de presença por obra', link: '/efetivo',
    conteudo: [
      { subtitulo: 'Como usar', texto: 'Selecione a obra e a data. A lista de funcionários alocados aparece agrupada por cargo. Clique no círculo para marcar presença (verde) ou ausência.' },
      { subtitulo: 'Ações', texto: '"Marcar todos" marca todos como presentes. "Limpar" remove todas as marcações. O botão X ao lado de cada funcionário remove a presença individual.' },
      { subtitulo: 'Observações', texto: 'Para cada funcionário presente, é possível adicionar uma observação (ex: "saiu mais cedo", "chegou 14h").', dica: 'A data padrão é sempre hoje. O tipo de dia (útil, sábado, dom/feriado) é detectado automaticamente.' },
    ]
  },
  {
    id: 'ponto', icon: Calendar, titulo: 'Controle de Ponto', desc: 'Grid calendário mensal', link: '/ponto',
    conteudo: [
      { subtitulo: 'Visão', texto: 'Grid com funcionários nas linhas e dias do mês nas colunas. Cada célula é colorida: P (verde) = presente, F (vermelho) = falta, A (azul) = atestado, L (verde claro) = licença, S (vermelho) = suspensão, - (cinza) = fim de semana/feriado.' },
      { subtitulo: 'Filtros', texto: 'Selecione obra + mês/ano. Os dados são cruzados de efetivo_diario (presenças) e faltas (ausências).' },
      { subtitulo: 'Totais', texto: 'Resumo por funcionário: dias presentes, faltas, atestados. Cards de resumo geral no rodapé.' },
    ]
  },
  {
    id: 'faltas', icon: AlertTriangle, titulo: 'Faltas & Atestados', desc: 'Registro de ausências', link: '/faltas',
    conteudo: [
      { subtitulo: 'Tipos', texto: 'Falta Injustificada (vermelho), Falta Justificada (laranja), Atestado Médico (azul), Atestado Acidente (azul), Licença Maternidade/Paternidade (verde), Folga Compensatória, Feriado, Suspensão (vermelho), Outro.' },
      { subtitulo: 'Registrar', texto: 'Selecione funcionário, obra, data, tipo e dias descontados. Para atestados: campos adicionais de CID, médico e CRM.' },
      { subtitulo: 'KPIs', texto: 'Faltas injustificadas do mês, atestados do mês, total no mês, total geral.', dica: 'Faltas ficam registradas no perfil do funcionário e aparecem no grid de ponto.' },
    ]
  },
  {
    id: 'hh', icon: Clock, titulo: 'Gestão de HH', desc: 'Horas-homem por funcionário', link: '/hh',
    conteudo: [
      { subtitulo: 'O que é', texto: 'Lançamentos mensais de horas normais, extras e noturnas por funcionário e obra. KPIs: total normais, extras, noturnas e custo estimado.' },
      { subtitulo: 'Custo', texto: 'O custo é calculado automaticamente: normais × custo_hora, extras × 1.7, noturnas × 1.4. Se o funcionário não tem custo_hora, aparece aviso.' },
      { subtitulo: 'Auditoria', texto: 'Cada lançamento tem status: pendente ou aprovado. Admin pode excluir lançamentos.', dica: 'Os dados de HH alimentam os relatórios de produtividade e o valor previsto dos BMs.' },
    ]
  },
  {
    id: 'financeiro', icon: DollarSign, titulo: 'Financeiro', desc: 'Fluxo de caixa e lançamentos', link: '/financeiro',
    conteudo: [
      { subtitulo: 'Visão geral', texto: '6 KPIs: receita recebida, receita em aberto, despesa paga, despesa em aberto, provisões futuras, resultado total. Gráfico de barras receita × despesa com linha de acumulado.' },
      { subtitulo: 'Despesas por categoria', texto: 'Barra horizontal mostrando distribuição: Salário Base, FGTS, VT, Treinamentos, EPI, Rescisões, etc.' },
      { subtitulo: 'Tabs', texto: '"Fluxo mensal" mostra mês a mês com receita, despesa, resultado e acumulado. "Lançamentos" lista todos os lançamentos individuais.' },
      { subtitulo: 'Provisões', texto: 'Toggle "Incluir provisões" controla se salários futuros, 13º e férias entram no cálculo.', dica: 'Ao aprovar um BM, a receita é criada automaticamente aqui com origem "bm_aprovado".' },
    ]
  },
  {
    id: 'documentos', icon: Shield, titulo: 'Documentos', desc: 'ASO, NRs e vencimentos', link: '/documentos',
    conteudo: [
      { subtitulo: 'Controle', texto: 'Lista todos os documentos (ASO, NR-10, NR-35, etc.) com emissão, vencimento e status. Badges: VENCIDO (vermelho), Xd (amarelo para <30 dias), OK (verde).' },
      { subtitulo: 'Alertas', texto: 'Cards de alerta no topo: documentos vencidos e vencendo em 30 dias.' },
      { subtitulo: 'Gerar documento', texto: 'Botão "Gerar Documento" acessa o gerador de templates. Selecione modelo (termo, advertência, comunicado), escolha funcionários, preencha campos variáveis e imprima/salve PDF com timbrado Tecnomonte.' },
      { subtitulo: 'Registro', texto: 'Documentos gerados ficam salvos no perfil do funcionário na seção "Advertências e Termos".', dica: 'O gerador suporta seleção múltipla: gere o mesmo documento para vários funcionários de uma vez.' },
    ]
  },
  {
    id: 'alocacao', icon: ClipboardList, titulo: 'Alocação', desc: 'Vincular funcionários a obras', link: '/alocacao',
    conteudo: [
      { subtitulo: 'Como funciona', texto: 'A alocação vincula um funcionário a uma obra com cargo e data de início. O status do funcionário muda automaticamente para "alocado".' },
      { subtitulo: 'Encerrar', texto: 'Botão "Encerrar" na listagem finaliza a alocação (data_fim = hoje). Se o funcionário não tem outras alocações ativas, volta para "disponível".' },
      { subtitulo: 'Conflitos', texto: 'Ao alocar, o sistema detecta se o funcionário já está alocado em outra obra e mostra aviso.', dica: 'A página de alocação sincroniza automaticamente o status dos funcionários ao carregar.' },
    ]
  },
  {
    id: 'estoque', icon: Package, titulo: 'Estoque', desc: 'EPIs, ferramentas e materiais', link: '/estoque',
    conteudo: [
      { subtitulo: 'Categorias', texto: 'EPI (capacetes, luvas, botas), Ferramenta (discos, esmerilhadeiras), Consumível (eletrodos, arame, gás), Material (chapas, tubos).' },
      { subtitulo: 'Movimentações', texto: 'Entrada (compra) e Saída (entrega para obra). Cada movimentação registra quantidade, obra, motivo.' },
      { subtitulo: 'Alerta', texto: 'Itens com quantidade ≤ quantidade_minima aparecem no dashboard como "Estoque crítico".', dica: 'Use o botão "Zerar estoque" para fazer uma saída total, útil em inventários.' },
    ]
  },
  {
    id: 'rh-banco', icon: Clock, titulo: 'Banco de Horas', desc: 'Saldos por funcionário', link: '/rh/banco-horas',
    conteudo: [
      { subtitulo: 'Visão', texto: 'Tabela com HH contrato, trabalhado, extras, faltas, compensadas, saldo do mês e saldo acumulado. Cores: verde (0-20h), amarelo (20-40h), vermelho (>40h ou negativo).' },
      { subtitulo: 'Edição inline', texto: 'Clique em qualquer campo numérico para editar diretamente na tabela. O saldo é recalculado automaticamente.' },
      { subtitulo: 'Fechar mês', texto: 'Botão "Fechar mês" marca todos os registros como fechados. Não permite mais edição.', dica: 'Ao fechar, o saldo acumulado é propagado automaticamente para o próximo mês.' },
    ]
  },
  {
    id: 'rh-ferias', icon: Calendar, titulo: 'Férias', desc: 'Programação e controle', link: '/rh/ferias',
    conteudo: [
      { subtitulo: 'Situação', texto: 'Mostra cada funcionário com: admissão, anos de empresa, dias direito, dias gozados, status. Alerta vermelho para >24 meses sem férias (vencidas).' },
      { subtitulo: 'Fluxo', texto: 'Pendente → Programada (definir datas) → Aprovada → Realizada. Cada etapa é um botão de ação.' },
      { subtitulo: 'Abono', texto: 'Ao programar, informe dias vendidos (abono pecuniário). O sistema calcula os dias restantes.', dica: 'O filtro "Férias Vencidas" mostra rapidamente quem precisa sair de férias urgentemente.' },
    ]
  },
  {
    id: 'rh-treinamentos', icon: Shield, titulo: 'Treinamentos NR', desc: 'Controle de validade', link: '/rh/treinamentos',
    conteudo: [
      { subtitulo: 'Por funcionário', texto: 'Accordion com cada funcionário mostrando seus treinamentos. Ícones: verde (OK), amarelo (vencendo em 60d), vermelho (vencido), cinza (não possui).' },
      { subtitulo: 'Vencimentos', texto: 'Lista ordenada por urgência: vencidos primeiro, depois vencendo em 30d, 60d.' },
      { subtitulo: 'Registro em lote', texto: 'Selecione vários funcionários + tipo de treinamento + data. O sistema calcula automaticamente a data de vencimento pela validade do tipo (ex: NR-35 = 24 meses).', dica: 'Os tipos de treinamento (NR-06, NR-10, NR-18, NR-33, NR-35, etc.) já vêm pré-cadastrados.' },
    ]
  },
  {
    id: 'rh-admissoes', icon: UserPlus, titulo: 'Admissões', desc: 'Checklist de admissão', link: '/rh/admissoes',
    conteudo: [
      { subtitulo: 'Checklist', texto: '10 etapas: Documentos pessoais, Exame admissional (ASO), CTPS, Contrato assinado, Dados bancários, EPI entregue, Treinamentos NR, Integração SST, Uniforme, eSocial.' },
      { subtitulo: 'Progresso', texto: 'Barra visual mostra % concluído. Cada etapa tem checkbox, data e campo de observação.' },
      { subtitulo: 'Conclusão', texto: 'Quando 100% concluído, o botão "Concluir Admissão" atualiza o status do funcionário para ativo.', dica: 'Crie a admissão antes mesmo do funcionário começar, para acompanhar o andamento da documentação.' },
    ]
  },
  {
    id: 'rh-desligamentos', icon: UserMinus, titulo: 'Desligamentos', desc: 'Checklist de saída', link: '/rh/desligamentos',
    conteudo: [
      { subtitulo: 'Checklist', texto: '9 etapas: Aviso prévio, Devolução EPI, Devolução ferramentas, Exame demissional, Baixa CTPS, Cálculo rescisão, Homologação, eSocial, Acerto banco de horas.' },
      { subtitulo: 'Tipos', texto: 'Sem justa causa, Justa causa, Pedido de demissão, Término de contrato, Acordo. O tipo afeta o cálculo da rescisão.' },
      { subtitulo: 'Conclusão', texto: 'Ao concluir, o funcionário é marcado como inativo e todas as alocações ativas são encerradas.', dica: 'O sistema mostra o saldo de banco de horas e dias de férias proporcionais a pagar/descontar.' },
    ]
  },
  {
    id: 'fornecedores', icon: Truck, titulo: 'Fornecedores', desc: 'Cadastro e avaliação', link: '/compras/fornecedores',
    conteudo: [
      { subtitulo: 'Cadastro', texto: 'Cards com nome, categoria (EPI, Ferramentas, Consumível, Material, Transporte, Serviços, Alimentação), avaliação 1-5 estrelas, contato e email.' },
      { subtitulo: 'Avaliação', texto: 'Avalie fornecedores de 1 a 5 estrelas. A avaliação é usada como referência nas cotações.' },
      { subtitulo: 'Ativo/Inativo', texto: 'Toggle para desativar fornecedores que não são mais utilizados sem perder o histórico.' },
    ]
  },
  {
    id: 'cotacoes', icon: ShoppingCart, titulo: 'Cotações', desc: 'Processo de compra', link: '/compras/cotacoes',
    conteudo: [
      { subtitulo: 'Criar cotação', texto: 'Selecione obra, descreva o que precisa, adicione itens com quantidade, marque urgência e prazo de resposta.' },
      { subtitulo: 'Comparativo', texto: 'Adicione fornecedores convidados com o valor cotado de cada um. O menor preço é destacado.' },
      { subtitulo: 'Aprovação', texto: 'Selecione o fornecedor escolhido, informe o valor aprovado e o motivo da escolha. Status muda para "aprovada".' },
    ]
  },
  {
    id: 'forecast', icon: TrendingUp, titulo: 'Forecast', desc: 'Previsão de receita', link: '/forecast',
    conteudo: [
      { subtitulo: 'Dashboard', texto: 'KPIs: receita total prevista, realizada, a receber, meses restantes médio. Tabela por contrato com diferença colorida (verde = acima, vermelho = abaixo do previsto).' },
      { subtitulo: 'Detalhe mensal', texto: 'Clique em um contrato para ver o detalhamento mês a mês: receita prevista vs realizada, com checkboxes para acompanhar o fluxo: BM emitido → BM aprovado → NF emitida → Pagamento recebido.' },
      { subtitulo: 'Checkboxes', texto: 'Clique diretamente nos checkboxes para marcar/desmarcar. As alterações são salvas instantaneamente.', dica: 'Use o forecast para acompanhar o fluxo de caixa futuro e identificar meses com déficit.' },
    ]
  },
  {
    id: 'relatorios', icon: BarChart3, titulo: 'Relatórios', desc: 'Visão consolidada', link: '/relatorios',
    conteudo: [
      { subtitulo: 'Disponíveis', texto: '5 relatórios: Status dos Contratos HH, DRE por Obra, Banco de Horas Consolidado, Treinamentos e Conformidade, Análise de Produtividade.' },
      { subtitulo: 'Exportar', texto: 'Cada relatório tem botão "Exportar Excel" (gera CSV) e "Imprimir" (abre janela de impressão do navegador).' },
      { subtitulo: 'Dados', texto: 'Todos os dados são em tempo real, buscados diretamente do banco. Não há cache — sempre mostra a versão mais atual.' },
    ]
  },
  {
    id: 'clientes', icon: Building2, titulo: 'Clientes', desc: 'Cadastro com contatos', link: '/clientes',
    conteudo: [
      { subtitulo: 'Cadastro', texto: 'Nome, CNPJ, cidade, estado. Emails por setor: principal, medição (BM), fiscal, RH.' },
      { subtitulo: 'Contatos', texto: 'Lista dinâmica de contatos com nome, email (clicável mailto:), função e WhatsApp. Adicione quantos precisar.' },
      { subtitulo: 'Integração', texto: 'Os emails de medição são usados automaticamente ao enviar BMs. As obras vinculadas aparecem no detalhe do cliente.' },
    ]
  },
  {
    id: 'tipos-contrato', icon: FileText, titulo: 'Tipos de Contrato', desc: 'Modelos de contrato HH', link: '/tipos-contrato',
    conteudo: [
      { subtitulo: 'O que é', texto: 'Templates reutilizáveis para criação de obras. Cada tipo define: margem alvo, prazo mínimo, prazo de pagamento, dias úteis/mês, se trabalha sábado.' },
      { subtitulo: 'Composição', texto: 'Cada tipo tem uma composição padrão: funções, quantidades, horas/mês, custo/hora de venda e multiplicadores de hora extra (70% e 100%).' },
      { subtitulo: 'Usar', texto: 'Botão "Usar este tipo" redireciona para a criação de nova obra com os dados pré-preenchidos.' },
    ]
  },
  {
    id: 'configuracoes', icon: Settings, titulo: 'Configurações', desc: 'Dados da empresa', link: '/configuracoes',
    conteudo: [
      { subtitulo: 'Dados', texto: 'Razão social, nome fantasia, CNPJ, inscrição estadual, endereço completo, telefone.' },
      { subtitulo: 'Emails', texto: 'Email principal, financeiro e RH da empresa.' },
      { subtitulo: 'Banco', texto: 'Banco principal, agência, conta e chave PIX. Usados em documentos e relatórios.' },
    ]
  },
  {
    id: 'usuarios', icon: Users, titulo: 'Usuários & Convites', desc: 'Gestão de acesso', link: '/admin/usuarios',
    conteudo: [
      { subtitulo: 'Roles', texto: '7 perfis: Administrador (acesso total), Encarregado (obras e equipe), RH, Financeiro, Almoxarife, Funcionário (próprios dados), Visualizador (somente leitura).' },
      { subtitulo: 'Convites', texto: 'Crie convites com role, módulos permitidos e mensagem personalizada. O sistema gera um link único que o convidado usa para criar a conta.' },
      { subtitulo: 'Página de convite', texto: 'Página pública com visual especial: card de boas-vindas com iniciais, role, módulos e botão de criar conta com barra de força de senha.' },
      { subtitulo: 'Gerenciar', texto: 'Edite role e módulos de cada usuário. Toggle ativo/bloqueado para suspender acesso sem excluir.', dica: 'Convites expiram após o prazo definido (1-30 dias). Convites não usados podem ser revogados.' },
    ]
  },
  {
    id: 'assistente', icon: MessageSquare, titulo: 'Assistente IA', desc: 'Chat com inteligência artificial', link: '/assistente',
    conteudo: [
      { subtitulo: 'O que é', texto: 'Chat com IA (Claude) que tem acesso ao contexto do sistema em tempo real: obras, funcionários, financeiro, BMs.' },
      { subtitulo: 'Exemplos', texto: '"Mostre um resumo da obra Cesari", "Quais funcionários têm contrato vencendo?", "Qual é o resultado financeiro atual?".' },
      { subtitulo: 'Arquivos', texto: 'Envie arquivos (TXT, CSV, JSON) para análise. A IA lê o conteúdo e fornece insights.', dica: 'Requer ANTHROPIC_API_KEY configurada nas variáveis de ambiente do Vercel. Se não configurada, aparece mensagem orientando.' },
    ]
  },
]

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

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="w-6 h-6 text-brand" />
          <h1 className="text-2xl font-bold font-display text-brand">Manual do Softmonte</h1>
        </div>
        <p className="text-sm text-gray-500">Guia completo de uso da plataforma — {MANUAL.length} módulos documentados</p>
      </div>

      {/* Busca */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar no manual... (ex: BM, férias, NR-35, efetivo)"
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

      {/* Seções */}
      <div className="space-y-2">
        {filtrados.map(secao => {
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

      {filtrados.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Nenhum resultado para "{busca}"</p>
          <button onClick={() => setBusca('')} className="mt-2 text-sm text-brand hover:underline">Limpar busca</button>
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100 text-center text-xs text-gray-400">
        Softmonte v1.0 — Tecnomonte Fabricação e Montagens de Tanques Industriais Ltda<br/>
        Manual atualizado em abril/2026 · {MANUAL.length} módulos · {MANUAL.reduce((s, m) => s + m.conteudo.length, 0)} tópicos
      </div>
    </div>
  )
}

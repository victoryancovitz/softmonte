/**
 * Adaptador para a API Secullum Ponto Web (Integração Externa).
 *
 * Baseado no exemplo oficial em C#:
 * https://github.com/Secullum/PontoWebIntegracaoExternaExemplo
 *
 * Fluxo:
 *  1. POST /Token (grant_type=password, client_id=3) → access_token
 *  2. GET  /ContasSecullumExterno/ListarBancos      → identificador do banco
 *  3. Chamadas à API com headers:
 *      Authorization: Bearer {access_token}
 *      secullumidbancoselecionado: {identificador}
 *
 * IMPORTANTE: usado APENAS server-side. Nunca exponha as credenciais
 * no cliente (nada de NEXT_PUBLIC_).
 */

const ENDERECO_AUTENTICADOR = 'https://autenticador.secullum.com.br'
const ENDERECO_PONTOWEB = 'https://pontowebintegracaoexterna.secullum.com.br/IntegracaoExterna'
const CLIENT_ID_PONTOWEB = '3'

export interface SecullumSession {
  accessToken: string
  bancoId: string
  bancoNome: string
}

export interface SecullumBatida {
  /** Id interno da marcação na Secullum (pra idempotência) */
  id?: number | string
  funcionarioId?: number
  funcionarioPis?: string
  funcionarioCpf?: string
  funcionarioNome?: string
  /** Data/hora completa da batida */
  dataHora?: string
  data?: string // yyyy-MM-dd
  hora?: string // HH:mm ou HH:mm:ss
  /** Origem (equipamento, manual, etc) */
  origem?: string
  [k: string]: any // permite campos extras da API que ainda não mapeamos
}

export interface SecullumFuncionario {
  id?: number
  nome?: string
  cpf?: string
  pis?: string
  matricula?: string
  numeroFolha?: string
  [k: string]: any
}

class SecullumError extends Error {
  status?: number
  body?: any
  constructor(msg: string, status?: number, body?: any) {
    super(msg)
    this.name = 'SecullumError'
    this.status = status
    this.body = body
  }
}

/**
 * Faz login na conta Secullum e seleciona o primeiro banco do cliente Ponto Web (clienteId=3).
 * Retorna o token + id do banco pra usar nas demais chamadas.
 */
export async function autenticar(usuario: string, senha: string): Promise<SecullumSession> {
  // --- 1. POST /Token
  const tokenBody = new URLSearchParams({
    grant_type: 'password',
    username: usuario,
    password: senha,
    client_id: CLIENT_ID_PONTOWEB,
  })

  const tokenResp = await fetch(`${ENDERECO_AUTENTICADOR}/Token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  })

  if (!tokenResp.ok) {
    const txt = await tokenResp.text().catch(() => '')
    throw new SecullumError(
      `Falha ao autenticar na Secullum (${tokenResp.status}). Verifique SECULLUM_USUARIO / SECULLUM_SENHA.`,
      tokenResp.status,
      txt,
    )
  }

  const tokenJson = (await tokenResp.json()) as { access_token?: string; error?: string }
  const accessToken = tokenJson.access_token
  if (!accessToken) {
    throw new SecullumError('Resposta de /Token sem access_token', tokenResp.status, tokenJson)
  }

  // --- 2. GET /ContasSecullumExterno/ListarBancos
  const bancosResp = await fetch(`${ENDERECO_AUTENTICADOR}/ContasSecullumExterno/ListarBancos/`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!bancosResp.ok) {
    const txt = await bancosResp.text().catch(() => '')
    throw new SecullumError(
      `Falha ao listar bancos Secullum (${bancosResp.status})`,
      bancosResp.status,
      txt,
    )
  }

  const bancos = (await bancosResp.json()) as Array<{
    id?: number | string
    nome?: string
    clienteId?: string | number
    identificador?: string
  }>

  // Filtra apenas bancos do cliente Ponto Web (clienteId "3")
  const bancosPontoWeb = bancos.filter(b => String(b.clienteId) === CLIENT_ID_PONTOWEB)
  if (bancosPontoWeb.length === 0) {
    throw new SecullumError(
      'Nenhum banco Ponto Web encontrado para este usuário. Verifique se a conta tem acesso ao módulo.',
      200,
      bancos,
    )
  }

  const banco = bancosPontoWeb[0]
  const identificador = banco.identificador || ''
  // O C# oficial usa Guid.Parse(identificador).ToString("N") — formato sem hífens.
  const bancoId = identificador.replace(/-/g, '')

  return {
    accessToken,
    bancoId,
    bancoNome: banco.nome || '',
  }
}

/** Request autenticado à API do Ponto Web (após ter a session). */
async function apiPontoWeb<T = any>(
  session: SecullumSession,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${ENDERECO_PONTOWEB}${path.startsWith('/') ? '' : '/'}${path}`

  const resp = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      secullumidbancoselecionado: session.bancoId,
      'Content-Type': 'application/json; charset=utf-8',
      'Accept-Language': 'pt-BR',
      ...(init.headers || {}),
    },
  })

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new SecullumError(
      `Secullum API ${resp.status} em ${path}: ${txt.slice(0, 500)}`,
      resp.status,
      txt,
    )
  }

  // Alguns endpoints retornam vazio em OK
  const text = await resp.text()
  if (!text) return null as any
  try {
    return JSON.parse(text) as T
  } catch {
    return text as any
  }
}

export interface ListarBatidasFiltro {
  dataInicio: string // yyyy-MM-dd
  dataFim: string // yyyy-MM-dd
  horaInicio?: string // HH:mm
  horaFim?: string // HH:mm
  funcionarioPis?: string
  funcionarioCpf?: string
  empresaDocumento?: string
}

/**
 * GET /Batidas — retorna as marcações brutas do período.
 */
export async function listarBatidas(
  session: SecullumSession,
  filtro: ListarBatidasFiltro,
): Promise<SecullumBatida[]> {
  const qs = new URLSearchParams()
  qs.set('dataInicio', filtro.dataInicio)
  qs.set('dataFim', filtro.dataFim)
  if (filtro.horaInicio) qs.set('horaInicio', filtro.horaInicio)
  if (filtro.horaFim) qs.set('horaFim', filtro.horaFim)
  if (filtro.funcionarioPis) qs.set('funcionarioPis', filtro.funcionarioPis)
  if (filtro.funcionarioCpf) qs.set('funcionarioCpf', filtro.funcionarioCpf)
  if (filtro.empresaDocumento) qs.set('empresaDocumento', filtro.empresaDocumento)

  const data = await apiPontoWeb<SecullumBatida[]>(session, `/Batidas?${qs.toString()}`)
  return Array.isArray(data) ? data : []
}

/**
 * GET /Funcionarios — por PIS ou CPF (um dos dois obrigatório).
 */
export async function listarFuncionarios(
  session: SecullumSession,
  query: { pis?: string; cpf?: string },
): Promise<SecullumFuncionario[]> {
  let path: string
  if (query.cpf) {
    path = `/Funcionarios/Cpf?cpf=${encodeURIComponent(query.cpf)}`
  } else if (query.pis) {
    path = `/Funcionarios?pis=${encodeURIComponent(query.pis)}`
  } else {
    throw new SecullumError('listarFuncionarios requer pis ou cpf')
  }
  const data = await apiPontoWeb<SecullumFuncionario[]>(session, path)
  return Array.isArray(data) ? data : []
}

/**
 * GET /Funcionarios (sem filtros) — retorna a lista completa de funcionários
 * do banco selecionado. Confirmado na doc oficial (pg 26).
 */
export async function listarTodosFuncionarios(
  session: SecullumSession,
): Promise<SecullumFuncionario[]> {
  const data = await apiPontoWeb<SecullumFuncionario[]>(session, '/Funcionarios')
  return Array.isArray(data) ? data : []
}

/**
 * Helper: autentica usando as variáveis de ambiente e retorna a session.
 * Lança erro se as env vars não estiverem configuradas.
 */
export async function autenticarViaEnv(): Promise<SecullumSession> {
  const usuario = process.env.SECULLUM_USUARIO
  const senha = process.env.SECULLUM_SENHA
  if (!usuario || !senha) {
    throw new SecullumError(
      'SECULLUM_USUARIO e SECULLUM_SENHA precisam estar definidas no ambiente (server-side).',
    )
  }
  return autenticar(usuario, senha)
}

export { SecullumError }

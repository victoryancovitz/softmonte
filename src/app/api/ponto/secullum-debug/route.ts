/**
 * GET /api/ponto/secullum-debug
 *
 * Endpoint de diagnóstico: autentica no Secullum, lista TODOS os bancos
 * do usuário, tenta chamar um endpoint leve (/Departamentos) com 2 formatos
 * de secullumidbancoselecionado (com e sem hífens) pra descobrir qual
 * formato/banco a conta aceita.
 *
 * Retorna JSON detalhado. Usar APENAS pra troubleshooting — remover depois.
 */
import { NextResponse } from 'next/server'
import { requireRoleApi } from '@/lib/require-role'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ENDERECO_AUTENTICADOR = 'https://autenticador.secullum.com.br'
const ENDERECO_PONTOWEB = 'https://pontowebintegracaoexterna.secullum.com.br/IntegracaoExterna'
const CLIENT_ID = '3'

async function probe(accessToken: string, bancoHeader: string, label: string) {
  const url = `${ENDERECO_PONTOWEB}/Departamentos`
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        secullumidbancoselecionado: bancoHeader,
        'Content-Type': 'application/json; charset=utf-8',
        'Accept-Language': 'pt-BR',
      },
    })
    const bodyText = await r.text().catch(() => '')
    return {
      label,
      bancoHeader,
      status: r.status,
      ok: r.ok,
      body_preview: bodyText.slice(0, 400),
    }
  } catch (e: any) {
    return {
      label,
      bancoHeader,
      error: e?.message || String(e),
    }
  }
}

export async function GET() {
  const roleErr = await requireRoleApi(['admin', 'rh'])
  if (roleErr) return roleErr

  const usuario = process.env.SECULLUM_USUARIO
  const senha = process.env.SECULLUM_SENHA
  if (!usuario || !senha) {
    return NextResponse.json({ error: 'SECULLUM_USUARIO/SECULLUM_SENHA ausentes' }, { status: 500 })
  }

  // 1. Token
  const tokenResp = await fetch(`${ENDERECO_AUTENTICADOR}/Token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      username: usuario,
      password: senha,
      client_id: CLIENT_ID,
    }).toString(),
  })
  const tokenBodyText = await tokenResp.text()
  if (!tokenResp.ok) {
    return NextResponse.json({
      step: 'token',
      ok: false,
      status: tokenResp.status,
      body: tokenBodyText,
    })
  }
  let tokenJson: any
  try { tokenJson = JSON.parse(tokenBodyText) } catch { tokenJson = { raw: tokenBodyText } }
  const accessToken = tokenJson.access_token
  if (!accessToken) {
    return NextResponse.json({
      step: 'token',
      ok: false,
      reason: 'access_token ausente',
      body: tokenJson,
    })
  }

  // 2. ListarBancos
  const bancosResp = await fetch(`${ENDERECO_AUTENTICADOR}/ContasSecullumExterno/ListarBancos/`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const bancosText = await bancosResp.text()
  if (!bancosResp.ok) {
    return NextResponse.json({
      step: 'listarBancos',
      ok: false,
      status: bancosResp.status,
      body: bancosText,
    })
  }
  let bancosJson: any[] = []
  try { bancosJson = JSON.parse(bancosText) } catch { /* noop */ }

  // 3. Para cada banco com clienteId=3, tenta probe com os 3 formatos possíveis
  const bancosPontoWeb = Array.isArray(bancosJson)
    ? bancosJson.filter(b => String(b.clienteId) === CLIENT_ID)
    : []

  const probes: any[] = []
  for (const b of bancosPontoWeb.slice(0, 5)) { // limita a 5 pra não estourar
    const identificador = String(b.identificador || '')
    const semHifens = identificador.replace(/-/g, '')
    const idNumerico = String(b.id || '')

    const r1 = await probe(accessToken, identificador, `identificador com hífens (${b.nome})`)
    const r2 = await probe(accessToken, semHifens, `identificador sem hífens (${b.nome})`)
    const r3 = await probe(accessToken, idNumerico, `id numérico (${b.nome})`)

    probes.push({
      banco: {
        id: b.id,
        identificador: b.identificador,
        clienteId: b.clienteId,
        nome: b.nome,
        plano: b.plano,
        documento: b.documento,
        razaoSocial: b.razaoSocial,
        limitePessoas: b.limitePessoas,
        quantidadePessoas: b.quantidadePessoas,
      },
      formatos: [r1, r2, r3],
    })
  }

  return NextResponse.json({
    ok: true,
    usuario,
    totalBancos: Array.isArray(bancosJson) ? bancosJson.length : 0,
    totalBancosPontoWeb: bancosPontoWeb.length,
    tokenInfo: {
      tem_access_token: !!accessToken,
      token_preview: accessToken.slice(0, 20) + '…',
    },
    probes,
  })
}

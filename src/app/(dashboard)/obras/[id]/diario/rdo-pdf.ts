import { gerarPDFHTML } from '@/lib/pdf-template'

interface ExportInput {
  obraNome: string
  data: string
  numeroRdo: number
  engenheiro: string
  horasTrab: string
  status: string
  clima: Record<string, string>
  efetivo: Array<{ tipo: string; funcao: string; quantidade: number; horas_trabalhadas: number; hora_entrada?: string; hora_saida?: string }>
  atividades: Array<{ item?: number; projeto?: string; local?: string; encarregado?: string; pt?: string; descricao?: string; total_hh?: number }>
  fotos: Array<{ numero: number; legenda: string; url: string }>
  equipamentos: Array<{ descricao: string; quantidade: number }>
  ocorrencias?: Array<{ tipo: string; descricao: string; responsavel?: string; impacto_hh?: number; acao_tomada?: string; gera_claim?: boolean }>
  obsContratada: string
  obsFiscalizacao: string
  totalHH: number
  historico?: Array<{ status_de?: string | null; status_para: string; feito_por_nome?: string; feito_em?: string }>
  assinaturaResp?: { nome: string; cargo: string; url: string; em: string } | null
  assinaturaFiscal?: { nome: string; empresa: string; url: string; em: string } | null
}

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function exportarRdoPDF(d: ExportInput) {
  const dataBr = new Date(d.data + 'T12:00').toLocaleDateString('pt-BR')
  const direta = d.efetivo.filter(e => e.tipo === 'direta')
  const indireta = d.efetivo.filter(e => e.tipo === 'indireta')

  const climaRows = Object.entries(d.clima).map(([key, cond]) => {
    const [turno, ...horaParts] = key.split('-')
    return `<tr><td>${esc(turno === '1turno' ? '1º Turno' : '2º Turno')}</td><td>${esc(horaParts.join('-'))}</td><td>${esc(cond)}</td></tr>`
  }).join('')

  const efetivoHTML = (rows: typeof d.efetivo) => rows.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#999">—</td></tr>' :
    rows.map(r => `<tr><td>${esc(r.funcao)}</td><td>${r.quantidade}</td><td>${esc(r.hora_entrada ?? '—')}</td><td>${esc(r.hora_saida ?? '—')}</td><td>${r.horas_trabalhadas}h</td></tr>`).join('')

  const atividadesHTML = d.atividades.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:#999">Nenhuma atividade registrada</td></tr>' :
    d.atividades.map(a => `<tr>
      <td>${a.item ?? '—'}</td>
      <td>${esc(a.projeto ?? '—')}</td>
      <td>${esc(a.local ?? '—')}</td>
      <td>${esc(a.encarregado ?? '—')}</td>
      <td>${esc(a.descricao ?? '—')}</td>
      <td>${a.total_hh ?? 0}h</td>
    </tr>`).join('')

  const fotosHTML = d.fotos.length === 0 ? '' : `
    <h3 style="margin-top:20px;">Fotos</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      ${d.fotos.map(f => `
        <div style="border:1px solid #ccc;padding:6px;">
          <img src="${esc(f.url)}" style="width:100%;max-height:200px;object-fit:cover;" />
          <p style="font-size:10px;margin-top:4px;">${f.numero}. ${esc(f.legenda || '—')}</p>
        </div>
      `).join('')}
    </div>
  `

  const equipHTML = d.equipamentos.length === 0 ? '' : `
    <h3 style="margin-top:16px;">Equipamentos</h3>
    <table><thead><tr><th>Descrição</th><th>Qtd</th></tr></thead><tbody>
    ${d.equipamentos.map(e => `<tr><td>${esc(e.descricao)}</td><td>${e.quantidade}</td></tr>`).join('')}
    </tbody></table>
  `

  const body = `
    <p style="font-size:9px;color:#666;margin-bottom:8px;">Data: ${dataBr} · Nº RDO: ${d.numeroRdo || '—'} · Status: ${esc(d.status)}</p>
    <table style="margin-bottom:12px;">
      <tr><td style="width:30%;font-weight:600;">Obra</td><td>${esc(d.obraNome)}</td></tr>
      <tr><td style="font-weight:600;">Engenheiro responsável</td><td>${esc(d.engenheiro || '—')}</td></tr>
      <tr><td style="font-weight:600;">Horas trabalhadas (dia)</td><td>${esc(d.horasTrab)}h</td></tr>
      <tr><td style="font-weight:600;">Total HH do efetivo</td><td>${d.totalHH.toFixed(1)}h</td></tr>
    </table>

    ${climaRows ? `<h3>Condições climáticas</h3>
    <table><thead><tr><th>Turno</th><th>Hora</th><th>Condição</th></tr></thead><tbody>${climaRows}</tbody></table>` : ''}

    <h3>MO Direta</h3>
    <table><thead><tr><th>Função</th><th>Qtd</th><th>Entrada</th><th>Saída</th><th>HH</th></tr></thead>
    <tbody>${efetivoHTML(direta)}</tbody></table>

    <h3 style="margin-top:12px;">MO Indireta</h3>
    <table><thead><tr><th>Função</th><th>Qtd</th><th>Entrada</th><th>Saída</th><th>HH</th></tr></thead>
    <tbody>${efetivoHTML(indireta)}</tbody></table>

    <h3 style="margin-top:12px;">Atividades executadas</h3>
    <table><thead><tr><th>#</th><th>Projeto</th><th>Local</th><th>Encarregado</th><th>Descrição</th><th>HH</th></tr></thead>
    <tbody>${atividadesHTML}</tbody></table>

    ${equipHTML}
    ${fotosHTML}

    ${d.ocorrencias && d.ocorrencias.length > 0 ? `
      <h3 style="margin-top:16px;color:#c00;">Ocorrências / Impedimentos</h3>
      <table style="border:1px solid #c00;">
        <thead style="background:#fee;"><tr><th>Tipo</th><th>Descrição</th><th>Responsável</th><th>Impacto HH</th><th>Ação</th><th>Claim</th></tr></thead>
        <tbody>
          ${d.ocorrencias.map(o => `<tr>
            <td>${esc(o.tipo)}</td>
            <td>${esc(o.descricao ?? '—')}</td>
            <td>${esc(o.responsavel ?? '—')}</td>
            <td>${o.impacto_hh ?? 0}h</td>
            <td>${esc(o.acao_tomada ?? '—')}</td>
            <td>${o.gera_claim ? '⚠ Sim' : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    ` : ''}

    <h3 style="margin-top:16px;">Observações</h3>
    <p><strong>Contratada:</strong> ${esc(d.obsContratada || '—').replace(/\n/g, '<br/>')}</p>
    <p><strong>Fiscalização:</strong> ${esc(d.obsFiscalizacao || '—').replace(/\n/g, '<br/>')}</p>

    <div style="display:flex;justify-content:space-between;margin-top:40px;font-size:10px;gap:20px;">
      <div style="width:48%;text-align:center;">
        <div style="border:1px solid #ddd;padding:8px;min-height:80px;">
          ${d.assinaturaResp ? `<img src="${esc(d.assinaturaResp.url)}" style="max-height:60px;" />` : '<span style="color:#999;">Não assinado</span>'}
        </div>
        <div style="border-top:1px solid #000;padding-top:4px;margin-top:4px;">
          <strong>CONTRATADA (Tecnomonte)</strong>
          ${d.assinaturaResp ? `<br/><span style="font-size:9px;">${esc(d.assinaturaResp.nome)} · ${esc(d.assinaturaResp.cargo)}<br/>${new Date(d.assinaturaResp.em).toLocaleString('pt-BR')}</span>` : ''}
        </div>
      </div>
      <div style="width:48%;text-align:center;">
        <div style="border:1px solid #ddd;padding:8px;min-height:80px;">
          ${d.assinaturaFiscal ? `<img src="${esc(d.assinaturaFiscal.url)}" style="max-height:60px;" />` : '<span style="color:#999;">Não assinado</span>'}
        </div>
        <div style="border-top:1px solid #000;padding-top:4px;margin-top:4px;">
          <strong>FISCALIZAÇÃO (Cliente)</strong>
          ${d.assinaturaFiscal ? `<br/><span style="font-size:9px;">${esc(d.assinaturaFiscal.nome)} · ${esc(d.assinaturaFiscal.empresa)}<br/>${new Date(d.assinaturaFiscal.em).toLocaleString('pt-BR')}</span>` : ''}
        </div>
      </div>
    </div>

    ${d.historico && d.historico.length > 0 ? `
      <h3 style="margin-top:24px;font-size:10px;color:#666;">Histórico de aprovação</h3>
      <table style="font-size:8px;">
        <thead><tr><th>De</th><th>Para</th><th>Por</th><th>Em</th></tr></thead>
        <tbody>
          ${d.historico.map(h => `<tr>
            <td>${esc(h.status_de ?? '—')}</td>
            <td>${esc(h.status_para)}</td>
            <td>${esc(h.feito_por_nome ?? '—')}</td>
            <td>${h.feito_em ? new Date(h.feito_em).toLocaleString('pt-BR') : '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    ` : ''}
  `

  const html = gerarPDFHTML({
    titulo: `RDO Nº ${d.numeroRdo || '—'} — ${dataBr}`,
    logoUrl: '/logo_tecnomonte.png',
  }, body)

  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close() }
}

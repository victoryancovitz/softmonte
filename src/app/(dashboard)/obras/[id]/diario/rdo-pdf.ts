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
  obsContratada: string
  obsFiscalizacao: string
  totalHH: number
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

    <h3 style="margin-top:16px;">Observações</h3>
    <p><strong>Contratada:</strong> ${esc(d.obsContratada || '—').replace(/\n/g, '<br/>')}</p>
    <p><strong>Fiscalização:</strong> ${esc(d.obsFiscalizacao || '—').replace(/\n/g, '<br/>')}</p>

    <div style="display:flex;justify-content:space-between;margin-top:60px;font-size:10px;">
      <div style="border-top:1px solid #000;padding-top:4px;width:45%;text-align:center;">Responsável Tecnomonte</div>
      <div style="border-top:1px solid #000;padding-top:4px;width:45%;text-align:center;">Fiscalização</div>
    </div>
  `

  const html = gerarPDFHTML({
    titulo: `RDO Nº ${d.numeroRdo || '—'} — ${dataBr}`,
    logoUrl: '/logo_tecnomonte.png',
  }, body)

  const win = window.open('', '_blank')
  if (win) { win.document.write(html); win.document.close() }
}

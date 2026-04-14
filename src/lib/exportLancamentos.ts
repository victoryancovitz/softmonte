const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function exportarExcel(lancamentos: any[], nomeArquivo = 'lancamentos') {
  const headers = ['Data Competência','Vencimento','Descrição','Fornecedor','Tipo','Categoria','Centro de Custo','Obra','Valor','Status','Nº Documento','Observação']
  const rows = lancamentos.map(l => [
    l.data_competencia || '', l.data_vencimento || '', (l.nome || '').replace(/"/g, '""'),
    (l.fornecedor || '').replace(/"/g, '""'), l.tipo === 'receita' ? 'Receita' : 'Despesa',
    l.categoria || '', l.centro_custo || '', l.obras?.nome || '',
    Number(l.valor).toFixed(2), l.status === 'pago' ? 'Pago' : 'Em aberto',
    l.numero_documento || '', (l.observacao || '').replace(/"/g, '""'),
  ])
  const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${nomeArquivo}-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export function exportarPDF(lancamentos: any[], titulo = 'Lançamentos Financeiros') {
  const totalReceita = lancamentos.filter(l => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0)
  const totalDespesa = lancamentos.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0)

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${titulo}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #333; }
  h1 { font-size: 16px; margin-bottom: 4px; }
  .subtitle { color: #888; font-size: 11px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
  td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; }
  .receita { color: #15803d; }
  .despesa { color: #b91c1c; }
  .total-row { font-weight: bold; background: #f9fafb; }
  .footer { margin-top: 12px; font-size: 10px; color: #9ca3af; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>${titulo}</h1>
<div class="subtitle">Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} — ${lancamentos.length} lançamentos</div>
<table>
<thead><tr><th>Data</th><th>Descrição</th><th>Fornecedor</th><th>Tipo</th><th>Categoria</th><th>Valor</th><th>Status</th></tr></thead>
<tbody>
${lancamentos.map(l => `<tr>
  <td>${l.data_competencia || '—'}</td>
  <td>${l.nome || '—'}</td>
  <td>${l.fornecedor || '—'}</td>
  <td class="${l.tipo}">${l.tipo === 'receita' ? 'Receita' : 'Despesa'}</td>
  <td>${l.categoria || '—'}</td>
  <td class="${l.tipo}">${l.tipo === 'receita' ? '+' : '-'}${fmt(Number(l.valor))}</td>
  <td>${l.status === 'pago' ? 'Pago' : l.status === 'em_aberto' ? 'Em aberto' : l.status}</td>
</tr>`).join('\n')}
<tr class="total-row"><td colspan="5" style="text-align:right">Total Receita:</td><td class="receita">+${fmt(totalReceita)}</td><td></td></tr>
<tr class="total-row"><td colspan="5" style="text-align:right">Total Despesa:</td><td class="despesa">-${fmt(totalDespesa)}</td><td></td></tr>
<tr class="total-row"><td colspan="5" style="text-align:right">Saldo:</td><td class="${totalReceita - totalDespesa >= 0 ? 'receita' : 'despesa'}">${fmt(totalReceita - totalDespesa)}</td><td></td></tr>
</tbody></table>
<div class="footer">Softmonte — Relatório financeiro</div>
<script>window.print()</script>
</body></html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

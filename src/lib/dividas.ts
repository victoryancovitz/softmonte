export function gerarTabelaAmortizacao(params: {
  valor: number; taxaMensal: number; nParcelas: number
  dataInicio: string; sistema: 'price' | 'sac' | 'bullet'
  diaVencimento?: number
}) {
  const { valor, taxaMensal: i, nParcelas: n, dataInicio, sistema } = params
  const parcelas: Array<{
    numero: number; data_vencimento: string; valor_amortizacao: number
    valor_juros: number; valor_total: number; saldo_antes: number; saldo_depois: number
  }> = []
  let saldo = valor
  const pmt = sistema === 'price' ? valor * (i * Math.pow(1+i, n)) / (Math.pow(1+i, n) - 1) : 0
  const amortSac = sistema === 'sac' ? valor / n : 0

  for (let k = 1; k <= n; k++) {
    const venc = new Date(dataInicio + 'T12:00')
    venc.setMonth(venc.getMonth() + (k - 1))
    if (params.diaVencimento) venc.setDate(params.diaVencimento)
    const juros = Math.round(saldo * i * 100) / 100
    let amort: number, total: number
    if (sistema === 'price') { amort = Math.round((pmt - juros) * 100) / 100; total = Math.round(pmt * 100) / 100 }
    else if (sistema === 'sac') { amort = Math.round(amortSac * 100) / 100; total = Math.round((amort + juros) * 100) / 100 }
    else { amort = k === n ? saldo : 0; total = Math.round((amort + juros) * 100) / 100 }
    const saldoAntes = saldo
    saldo = Math.max(0, Math.round((saldo - amort) * 100) / 100)
    parcelas.push({ numero: k, data_vencimento: venc.toISOString().slice(0, 10), valor_amortizacao: amort, valor_juros: juros, valor_total: total, saldo_antes: saldoAntes, saldo_depois: saldo })
  }
  return parcelas
}

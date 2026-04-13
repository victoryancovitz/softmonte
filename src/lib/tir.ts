export function calcularTIR(fluxos: number[], precisao = 0.0001): number | null {
  if (fluxos.length < 2) return null
  let taxa = 0.1
  for (let i = 0; i < 1000; i++) {
    const vpl = fluxos.reduce((acc, fc, t) => acc + fc / Math.pow(1 + taxa, t), 0)
    const dvpl = fluxos.reduce((acc, fc, t) => acc - t * fc / Math.pow(1 + taxa, t + 1), 0)
    if (Math.abs(dvpl) < 1e-10) break
    const novaTaxa = taxa - vpl / dvpl
    if (Math.abs(novaTaxa - taxa) < precisao) return novaTaxa
    taxa = novaTaxa
    if (taxa < -0.99 || taxa > 10) return null
  }
  return taxa
}

export function anualizarTaxa(taxaMensal: number): number {
  return Math.pow(1 + taxaMensal, 12) - 1
}

export function interpretarTIR(tirAnual: number | null): { label: string; cor: string; benchmark: string } {
  if (tirAnual === null) return { label: '—', cor: 'text-gray-400', benchmark: '' }
  if (tirAnual < 0) return { label: 'Negativa', cor: 'text-red-700', benchmark: 'Destruindo valor' }
  if (tirAnual < 0.105) return { label: 'Abaixo do CDI', cor: 'text-orange-600', benchmark: `CDI ~10,5% a.a.` }
  if (tirAnual < 0.30) return { label: 'Adequada', cor: 'text-amber-600', benchmark: 'Acima do CDI' }
  if (tirAnual < 1.0) return { label: 'Boa', cor: 'text-green-600', benchmark: 'Acima da média do setor' }
  return { label: 'Excelente', cor: 'text-green-700', benchmark: 'Retorno excepcional' }
}

export function interpretarRetorno(pct: number | null): { label: string; cor: string; benchmark: string } {
  if (pct === null) return { label: '—', cor: 'text-gray-400', benchmark: '' }
  if (pct < 0) return { label: 'Negativo', cor: 'text-red-700', benchmark: 'Destruindo valor' }
  if (pct < 15) return { label: 'Baixo', cor: 'text-orange-600', benchmark: 'Abaixo do custo de oportunidade' }
  if (pct < 30) return { label: 'Adequado', cor: 'text-amber-600', benchmark: 'Acima do CDI, dentro do setor' }
  if (pct < 60) return { label: 'Bom', cor: 'text-green-600', benchmark: 'Acima da média do setor' }
  return { label: 'Excelente', cor: 'text-green-700', benchmark: 'Retorno excepcional' }
}

export function interpretarFCFY(pct: number | null): { label: string; cor: string } {
  if (pct === null) return { label: '—', cor: 'text-gray-400' }
  if (pct < 0) return { label: 'Negativo', cor: 'text-red-700' }
  if (pct < 5) return { label: 'Baixo', cor: 'text-orange-600' }
  if (pct < 10) return { label: 'Razoável', cor: 'text-amber-600' }
  return { label: 'Atrativo', cor: 'text-green-700' }
}

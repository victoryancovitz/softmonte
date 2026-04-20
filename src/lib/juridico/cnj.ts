export function validarCNJ(cnj: string): boolean {
  const digitos = cnj.replace(/\D/g, '')
  if (digitos.length !== 20) return false
  const nnnnnnn = digitos.slice(0, 7)
  const dd = digitos.slice(7, 9)
  const aaaa = digitos.slice(9, 13)
  const j = digitos.slice(13, 14)
  const tr = digitos.slice(14, 16)
  const oooo = digitos.slice(16, 20)
  const base17 = nnnnnnn + aaaa + j + tr + oooo
  // Módulo 97 sem BigInt (compatível com ES2017)
  // Dividir em partes para evitar overflow de Number
  let r = 0
  for (const c of base17 + '00') {
    r = (r * 10 + parseInt(c)) % 97
  }
  const ddCalc = 98 - r
  return ddCalc === parseInt(dd)
}

export function formatarCNJ(cnj: string): string {
  const d = cnj.replace(/\D/g, '').padStart(20, '0').slice(0, 20)
  return `${d.slice(0,7)}-${d.slice(7,9)}.${d.slice(9,13)}.${d.slice(13,14)}.${d.slice(14,16)}.${d.slice(16,20)}`
}

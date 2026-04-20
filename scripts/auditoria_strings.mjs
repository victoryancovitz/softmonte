import { readdir, readFile, writeFile } from 'fs/promises'
import { join, extname } from 'path'

const PADROES = [
  { regex: /\bfuncionario\b(?![_a-zA-Z])/gi, correto: 'funcionário' },
  { regex: /\bfuncao\b(?![_a-zA-Z])/gi, correto: 'função' },
  { regex: /\bdescricao\b(?![_a-zA-Z])/gi, correto: 'descrição' },
  { regex: /\bcompetencia\b(?![_a-zA-Z])/gi, correto: 'competência' },
  { regex: /\brecorrencia\b(?![_a-zA-Z])/gi, correto: 'recorrência' },
  { regex: /\bobservacao\b(?![_a-zA-Z])/gi, correto: 'observação' },
  { regex: /\bnumero\b(?![_a-zA-Z])/gi, correto: 'número' },
  { regex: /\bcodigo\b(?![_a-zA-Z])/gi, correto: 'código' },
  { regex: /\bresponsavel\b(?![_a-zA-Z])/gi, correto: 'responsável' },
  { regex: /\bhistorico\b(?![_a-zA-Z])/gi, correto: 'histórico' },
  { regex: /console\.(log|debug)\(/g, correto: '(remover)' },
]

const IGNORAR = ['node_modules', '.next', '.git', 'dist', 'scripts/auditoria']

async function scanear(dir) {
  const resultados = []
  const entradas = await readdir(dir, { withFileTypes: true })
  for (const e of entradas) {
    if (IGNORAR.some(i => e.name.includes(i))) continue
    const caminho = join(dir, e.name)
    if (e.isDirectory()) {
      resultados.push(...await scanear(caminho))
    } else if (['.ts', '.tsx'].includes(extname(e.name))) {
      const texto = await readFile(caminho, 'utf-8')
      const linhas = texto.split('\n')
      for (const pad of PADROES) {
        for (let i = 0; i < linhas.length; i++) {
          const linha = linhas[i]
          if (/\/\/|\/\*|\*\//.test(linha.slice(0, 10))) continue // skip comments
          if (linha.includes('from ') || linha.includes('import ')) continue
          const clone = new RegExp(pad.regex.source, pad.regex.flags)
          let match
          while ((match = clone.exec(linha)) !== null) {
            // Skip if inside identifier (has _ before/after)
            const before = linha[match.index - 1]
            const after = linha[match.index + match[0].length]
            if (before === '_' || before === '.' || after === '_' || after === '(') continue
            resultados.push({
              arquivo: caminho.replace(process.cwd() + '/', ''),
              linha: i + 1,
              encontrado: match[0],
              correto: pad.correto,
            })
          }
        }
      }
    }
  }
  return resultados
}

const res = await scanear('./src')
console.log(`Total: ${res.length} ocorrências`)
const byFile = {}
res.forEach(r => { byFile[r.arquivo] = (byFile[r.arquivo] || 0) + 1 })
Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([f, n]) => console.log(`  ${n}× ${f}`))
await writeFile('auditoria_strings.json', JSON.stringify(res, null, 2))
console.log('Relatório: auditoria_strings.json')

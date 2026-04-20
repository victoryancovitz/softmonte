import { test, Page } from '@playwright/test'

const URL = 'https://softmonte.vercel.app'

async function login(page: Page) {
  await page.goto(URL + '/login')
  await page.waitForSelector('input[type="email"]', { timeout: 15000 })
  await page.fill('input[type="email"]', 'diretoria@tecnomonte.com.br')
  await page.fill('input[type="password"]', 'Softmonte@2026')
  await page.click('button:has-text("Entrar")')
  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 20000 })
  await page.waitForTimeout(2000)
}

async function fecharFolha(page: Page, obraFragment: string, mesLabel: string): Promise<boolean> {
  await page.goto(URL + '/rh/folha')
  await page.waitForTimeout(3000)

  // Selecionar obra
  const selectObra = page.locator('select').first()
  const options = await selectObra.locator('option').allTextContents()
  const idx = options.findIndex(o => o.includes(obraFragment))
  if (idx < 0) return false
  await selectObra.selectOption({ index: idx })
  await page.waitForTimeout(1000)

  // Selecionar mês
  const selects = page.locator('select')
  const selectCount = await selects.count()
  for (let i = 1; i < selectCount; i++) {
    const opts = await selects.nth(i).locator('option').allTextContents()
    if (opts.some(o => o.includes('Janeiro') || o.includes('Março'))) {
      const mesIdx = opts.findIndex(o => o === mesLabel)
      if (mesIdx >= 0) {
        await selects.nth(i).selectOption({ index: mesIdx })
      }
      break
    }
  }
  await page.waitForTimeout(1000)

  // Clicar Fechar folha
  const btnFechar = page.locator('button:has-text("Fechar folha")')
  if (await btnFechar.count() === 0) return false

  await btnFechar.click()
  await page.waitForTimeout(3000)

  // Modal de divergência?
  const body = await page.textContent('body') ?? ''
  if (body.includes('Divergencia') || body.includes('mesmo assim')) {
    const btnMesmo = page.locator('button:has-text("Fechar folha mesmo assim")')
    if (await btnMesmo.count() > 0) {
      await btnMesmo.click()
      await page.waitForTimeout(30000)
    }
  } else {
    await page.waitForTimeout(25000)
  }

  return true
}

// Fragmentos de nome para cada obra
const OBRAS = [
  'Braskem — Instru', 'Braskem — Parada', 'Cefértil — Apoio', 'Cefértil — Elétrica',
  'Cefértil — TQ', 'CSN — Alto', 'CSN — Coqueria', 'CSN — Pintura',
  'Klabin — Andaimes', 'Klabin — Secador', 'Replan — Caldeira', 'Replan — Mecânica',
  'Replan — Tubulação', 'Suzano — Caldeiraria', 'Suzano — Isolamento',
  'Usiminas — Laminação', 'Usiminas — Parada', 'Vale — Caldeiraria',
  'Vale — Correia', 'Vale — Elétrica',
]

const MESES = ['Janeiro', 'Fevereiro', 'Março']

// Criar testes sequenciais — 60 folhas
for (const mes of MESES) {
  for (const obra of OBRAS) {
    test(`FOLHA ${mes} — ${obra}`, async ({ page }) => {
      test.setTimeout(120000)
      await login(page)
      const ok = await fecharFolha(page, obra, mes)
      if (ok) {
        console.log(`  ✅ ${mes} — ${obra}`)
      } else {
        console.log(`  ⚠️ ${mes} — ${obra} — botão não encontrado`)
      }
    })
  }
}

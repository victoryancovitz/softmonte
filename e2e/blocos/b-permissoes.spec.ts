import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'

test.describe('BLOCO B — Permissões por Role', () => {
  test('B01 Diretoria acessa /diretoria', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/diretoria')
    await page.waitForTimeout(3000)
    // Deve carregar sem redirecionar
    await expect(page).toHaveURL(/\/diretoria/)
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')
  })

  test('B02 Diretoria acessa /rh/folha', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/rh/folha')
    await page.waitForTimeout(3000)
    await expect(page).toHaveURL(/\/rh\/folha/)
  })

  test('B03 Diretoria acessa /financeiro', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/financeiro')
    await page.waitForTimeout(3000)
    await expect(page).toHaveURL(/\/financeiro/)
  })

  test('B10 Diretoria acessa /cadastros/merge', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/cadastros/merge')
    await page.waitForTimeout(3000)
    await expect(page).toHaveURL(/\/cadastros\/merge/)
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')
  })

  // --- Testes que dependem de contas de encarregado/rh existirem ---
  // Se as contas não existem, estes testes serão marcados como skip

  test('B04 Encarregado NÃO acessa /financeiro/dre', async ({ page }) => {
    test.skip() // TODO: precisa conta encarregado@tecnomonte.com.br criada
    await loginAs(page, 'encarregado')
    await page.goto(BASE + '/financeiro/dre')
    await page.waitForTimeout(3000)
    await expect(page).toHaveURL(/\/(dashboard|ponto|login)/)
  })

  test('B05 Encarregado NÃO acessa /rh/folha', async ({ page }) => {
    test.skip() // TODO: precisa conta encarregado
    await loginAs(page, 'encarregado')
    await page.goto(BASE + '/rh/folha')
    await page.waitForTimeout(3000)
    await expect(page).toHaveURL(/\/(dashboard|ponto|login)/)
  })

  test('B08 RH acessa /rh/folha', async ({ page }) => {
    test.skip() // TODO: precisa conta rh@tecnomonte.com.br
    await loginAs(page, 'rh')
    await page.goto(BASE + '/rh/folha')
    await page.waitForTimeout(3000)
    await expect(page).toHaveURL(/\/rh\/folha/)
  })

  test('B09 RH NÃO acessa /financeiro/dre', async ({ page }) => {
    test.skip() // TODO: precisa conta rh
    await loginAs(page, 'rh')
    await page.goto(BASE + '/financeiro/dre')
    await page.waitForTimeout(3000)
    await expect(page).toHaveURL(/\/(dashboard|rh)/)
  })

  test('B11 Encarregado NÃO acessa /cadastros/merge', async ({ page }) => {
    test.skip() // TODO: precisa conta encarregado
    await loginAs(page, 'encarregado')
    await page.goto(BASE + '/cadastros/merge')
    await page.waitForTimeout(3000)
    await expect(page).toHaveURL(/\/(dashboard|ponto|login)/)
  })
})

import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'

test.describe('BLOCO Q — Consistência Cross-Módulo', () => {
  // TODO: Q01 Admitir → aparece no ponto
  // TODO: Q02 Fechar folha → lançamento financeiro
  // TODO: Q03 Aprovar BM → receita no financeiro
  // TODO: Q04 Desligar → sai do ponto
  // TODO: Q05 Editar nome → atualiza em tudo
  // TODO: Q06 Criar CC → aparece na obra
  // TODO: Q07 Custo fixo gerar → financeiro
  // TODO: Q08 Merge CC → FKs migradas

  test('Q01 Dashboard diretoria carrega sem erro', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/diretoria')
    await page.waitForTimeout(4000)
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')
  })
})

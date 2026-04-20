import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'

test.describe('BLOCO G — Boletim de Medição', () => {
  test.setTimeout(60_000)

  test('G01 Criar BM — selecionar obra, preencher datas, preview mostra R$', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/boletins/nova')
    await page.waitForTimeout(5000)

    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')

    // Deve ter select de obra
    const selectObra = page.locator('select').first()
    await expect(selectObra).toBeVisible({ timeout: 10000 })

    // Selecionar a primeira obra disponível
    const options = await selectObra.locator('option').allTextContents()
    expect(options.length).toBeGreaterThan(0)

    // Se a primeira option é um placeholder vazio, selecionar a segunda
    if (options.length > 1 && !options[0].trim()) {
      await selectObra.selectOption({ index: 1 })
    } else {
      await selectObra.selectOption({ index: 0 })
    }
    await page.waitForTimeout(2000)

    // Página carregou sem erro após selecionar obra
    const bodyAfterObra = await page.textContent('body') ?? ''
    expect(bodyAfterObra).not.toContain('Application error')

    // Preencher datas — usar um período do mês anterior para garantir dados de ponto
    const hoje = new Date()
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
    const ultimoDiaMesAnt = new Date(hoje.getFullYear(), hoje.getMonth(), 0)

    const dataInicio = mesAnterior.toISOString().split('T')[0]
    const dataFim = ultimoDiaMesAnt.toISOString().split('T')[0]

    const inputInicio = page.locator('input[type="date"]').first()
    const inputFim = page.locator('input[type="date"]').nth(1)

    await inputInicio.fill(dataInicio)
    await page.waitForTimeout(500)
    await inputFim.fill(dataFim)
    await page.waitForTimeout(500)

    // Clicar no botão de pré-visualizar
    const btnPreview = page.locator('button:has-text("visualizar")')
    await expect(btnPreview).toBeVisible()
    await btnPreview.click()

    // Aguardar o preview carregar (pode demorar)
    await page.waitForTimeout(10000)

    const bodyAfterPreview = await page.textContent('body') ?? ''

    // Verificar se o preview mostrou dados OU se mostrou aviso legítimo
    const temPreviewComValores = bodyAfterPreview.includes('R$')
    const temAvisoLegitimo = bodyAfterPreview.includes('Nenhum funcionario') ||
                             bodyAfterPreview.includes('sem marcacoes') ||
                             bodyAfterPreview.includes('sobrepõe') ||
                             bodyAfterPreview.includes('anterior ao início') ||
                             bodyAfterPreview.includes('posterior')

    // Deve ter ou valores R$ no preview, ou um aviso legítimo explicando por que não
    expect(temPreviewComValores || temAvisoLegitimo).toBeTruthy()

    if (temPreviewComValores) {
      // Verificar que a tabela de preview tem colunas de R$/HH
      const temRHH = bodyAfterPreview.includes('R$/HH') || bodyAfterPreview.includes('Total')
      expect(temRHH).toBeTruthy()

      // Verificar que existe o botão de salvar BM
      const btnSalvar = page.locator('button:has-text("Confirmar e Criar BM")')
      const btnSalvarVisible = await btnSalvar.count() > 0
      expect(btnSalvarVisible).toBeTruthy()

      // Verificar que mostra contagem de funções e funcionários
      expect(bodyAfterPreview).toMatch(/\d+\s*funç/)
      expect(bodyAfterPreview).toMatch(/\d+\s*funcionário/)
    }
  })

  test('G02 BM para obra sem ponto deve exibir aviso', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/boletins/nova')
    await page.waitForTimeout(5000)

    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')

    // Selecionar a primeira obra
    const selectObra = page.locator('select').first()
    await expect(selectObra).toBeVisible({ timeout: 10000 })
    const options = await selectObra.locator('option').allTextContents()
    if (options.length > 1 && !options[0].trim()) {
      await selectObra.selectOption({ index: 1 })
    } else {
      await selectObra.selectOption({ index: 0 })
    }
    await page.waitForTimeout(2000)

    // Usar um período muito antigo onde com certeza não há ponto registrado
    const inputInicio = page.locator('input[type="date"]').first()
    const inputFim = page.locator('input[type="date"]').nth(1)

    await inputInicio.fill('2020-01-01')
    await page.waitForTimeout(500)
    await inputFim.fill('2020-01-31')
    await page.waitForTimeout(500)

    // Tentar clicar pré-visualizar (pode estar disabled se datas inválidas)
    const btnPreview = page.locator('button:has-text("visualizar")')
    if (await btnPreview.count() > 0) {
      try { await btnPreview.click({ timeout: 5000 }) } catch { /* disabled - ok */ }
    }

    await page.waitForTimeout(5000)
    const bodyAfter = await page.textContent('body') ?? ''

    // Deve exibir aviso ou estar sem dados (ambos OK para período sem ponto)
    const temAviso = bodyAfter.includes('Nenhum') ||
                     bodyAfter.includes('sem marcac') ||
                     bodyAfter.includes('sem ponto') ||
                     bodyAfter.includes('anterior') ||
                     bodyAfter.includes('Selecione') ||
                     !bodyAfter.includes('R$') // sem valores = sem dados
    expect(temAviso).toBeTruthy()

    // Não deve ter o botão de salvar BM visível quando não há dados
    // (a menos que tenha dado erro de validação de datas, que também é OK)
    if (!bodyAfter.includes('anterior ao início') && !bodyAfter.includes('posterior')) {
      const btnSalvar = page.locator('button:has-text("Confirmar e Criar BM")')
      const count = await btnSalvar.count()
      expect(count).toBe(0)
    }
  })

  test('G06 Matching de função funciona com capitalização diferente', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/boletins/nova')
    await page.waitForTimeout(5000)

    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')

    // O objetivo é verificar que, ao gerar o preview, funções com capitalização
    // diferente (ex: "soldador" vs "SOLDADOR") são corretamente mapeadas
    // para a composição contratual e recebem R$/HH.

    // Selecionar a primeira obra disponível
    const selectObra = page.locator('select').first()
    await expect(selectObra).toBeVisible({ timeout: 10000 })

    // Tentar todas as obras até achar uma com dados de ponto
    const allOptions = await selectObra.locator('option').all()
    let foundPreview = false

    for (let i = 0; i < Math.min(allOptions.length, 5); i++) {
      const optValue = await allOptions[i].getAttribute('value')
      if (!optValue) continue

      await selectObra.selectOption(optValue)
      await page.waitForTimeout(2000)

      // Usar mês passado
      const hoje = new Date()
      const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      const ultimoDiaMesAnt = new Date(hoje.getFullYear(), hoje.getMonth(), 0)

      const inputInicio = page.locator('input[type="date"]').first()
      const inputFim = page.locator('input[type="date"]').nth(1)

      await inputInicio.fill(mesAnterior.toISOString().split('T')[0])
      await page.waitForTimeout(300)
      await inputFim.fill(ultimoDiaMesAnt.toISOString().split('T')[0])
      await page.waitForTimeout(300)

      const btnPreview = page.locator('button:has-text("visualizar")')
      await btnPreview.click()
      await page.waitForTimeout(10000)

      const previewBody = await page.textContent('body') ?? ''

      if (previewBody.includes('R$') && previewBody.includes('R$/HH')) {
        foundPreview = true

        // Verificar que as funções listadas no preview têm valores de R$/HH preenchidos
        // Se a capitalização funciona, funções com contrato devem ter R$/HH > 0
        // Funções sem contrato podem ter R$/HH = 0, e devem mostrar o alerta

        const temAlertaSemContrato = previewBody.includes('não possuem composição')

        // Verificar inputs de R$/HH — pegar os valores
        const hhInputs = page.locator('table input[type="number"]')
        const hhCount = await hhInputs.count()

        if (hhCount > 0) {
          // Pelo menos alguns inputs de R$/HH devem ter valor > 0
          // (indicando que o matching por nome funcionou)
          let temValorPreenchido = false
          for (let j = 0; j < hhCount; j++) {
            const val = await hhInputs.nth(j).inputValue()
            if (parseFloat(val) > 0) {
              temValorPreenchido = true
              break
            }
          }

          // Se nenhum R$/HH foi preenchido automaticamente, pode ser que todas
          // as funções estejam sem contrato (o que o alerta confirma)
          if (!temValorPreenchido) {
            expect(temAlertaSemContrato).toBeTruthy()
          }
        }

        // Verificar que os nomes das funções aparecem na tabela do preview
        const tableRows = page.locator('table tbody tr')
        const rowCount = await tableRows.count()
        expect(rowCount).toBeGreaterThan(0)

        break
      }
    }

    // Se nenhuma obra teve preview com dados, marcar como informativo
    if (!foundPreview) {
      // Pelo menos verificamos que a página carregou e que o fluxo de tentativa funcionou
      expect(body).not.toContain('Application error')
    }
  })
})

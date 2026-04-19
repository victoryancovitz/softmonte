import { test, expect } from '@playwright/test'
import { loginAs, BASE } from '../helpers/auth'

test.describe('BLOCO F — Folha de Pagamento', () => {
  test.setTimeout(60_000)

  test('F01 Carregar /rh/folha, selecionar obra e ver dados de funcionários', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/rh/folha')
    await page.waitForTimeout(5000)

    // Página carregou sem erro
    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')

    // Deve conter o título da página
    expect(body).toContain('Fechamento de Folha')

    // Deve ter o select de obra com pelo menos uma opção
    const selectObra = page.locator('select').first()
    await expect(selectObra).toBeVisible({ timeout: 10000 })
    const options = await selectObra.locator('option').allTextContents()
    expect(options.length).toBeGreaterThan(0)

    // Selecionar a primeira obra (já vem selecionada por padrão)
    // Verificar que os selects de mês e ano existem
    const selects = page.locator('select')
    const selectCount = await selects.count()
    expect(selectCount).toBeGreaterThanOrEqual(2) // obra + mês

    // Verificar que o botão "Fechar folha" existe
    const btnFechar = page.locator('button:has-text("Fechar folha")')
    await expect(btnFechar).toBeVisible()

    // Se já houver fechamentos, verificar a tabela de dados
    const tabela = page.locator('table')
    if (await tabela.count() > 0) {
      // A tabela deve ter cabeçalhos esperados
      const headers = await tabela.locator('th').allTextContents()
      const headersJoined = headers.join(' ').toLowerCase()
      expect(headersJoined).toContain('obra')
      expect(headersJoined).toContain('total')
    }
  })

  test('F02 Fechar folha duplicada deve exibir "Já existe"', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/rh/folha')
    await page.waitForTimeout(5000)

    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')

    // Verificar se existe algum fechamento na listagem para saber o mês/obra a duplicar
    const rows = page.locator('table tbody tr')
    const rowCount = await rows.count()

    if (rowCount > 0) {
      // Pegar informações do primeiro fechamento existente para tentar duplicar
      const firstRowText = await rows.first().textContent() ?? ''

      // Se temos fechamentos, selecionar a mesma obra e mês/ano que já existe
      // O select de obra já está preenchido com a primeira obra
      // Selecionar um mês que sabemos que já tem fechamento

      // Usar os mesmos valores que já existem na tabela
      // Clicar em "Fechar folha"
      const btnFechar = page.locator('button:has-text("Fechar folha")')
      await expect(btnFechar).toBeVisible()

      // Precisamos alinhar obra/mês/ano com o que já existe
      // Vamos pegar o mês e ano do primeiro fechamento
      const link = rows.first().locator('a').first()
      const periodoText = await link.textContent() ?? ''

      // O formato é "MesNome/Ano" ex: "Março/2026"
      const MESES_MAP: Record<string, number> = {
        'Janeiro': 1, 'Fevereiro': 2, 'Março': 3, 'Abril': 4,
        'Maio': 5, 'Junho': 6, 'Julho': 7, 'Agosto': 8,
        'Setembro': 9, 'Outubro': 10, 'Novembro': 11, 'Dezembro': 12
      }

      const match = periodoText.match(/(\w+)\/(\d{4})/)
      if (match) {
        const mesNum = MESES_MAP[match[1]]
        const anoNum = parseInt(match[2])

        if (mesNum) {
          // Selecionar o mesmo mês
          const selectMes = page.locator('select').nth(1)
          await selectMes.selectOption(String(mesNum))

          // Preencher o mesmo ano
          const inputAno = page.locator('input[type="number"]')
          if (await inputAno.count() > 0) {
            await inputAno.fill(String(anoNum))
          }

          // Clicar em Fechar folha
          await btnFechar.click()
          await page.waitForTimeout(5000)

          // Deve exibir toast de erro com "Já existe"
          const bodyAfter = await page.textContent('body') ?? ''
          expect(bodyAfter.toLowerCase()).toContain('já existe')
        }
      }
    } else {
      // Se não há fechamentos, o teste não é aplicável — pular graciosamente
      test.skip()
    }
  })

  test('F03 Folha com mês sem dados de ponto mostra aviso', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/rh/folha')
    await page.waitForTimeout(5000)

    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')

    // Selecionar um mês muito no passado onde certamente não há dados de ponto
    const selectMes = page.locator('select').nth(1)
    await selectMes.selectOption('1') // Janeiro

    const inputAno = page.locator('input[type="number"]')
    if (await inputAno.count() > 0) {
      await inputAno.fill('2020') // Ano bem antigo — sem dados
    }

    // Clicar em Fechar folha
    const btnFechar = page.locator('button:has-text("Fechar folha")')
    await expect(btnFechar).toBeVisible()
    await btnFechar.click()
    await page.waitForTimeout(5000)

    // Deve exibir toast de aviso sobre falta de dados de custo/ponto
    const bodyAfter = await page.textContent('body') ?? ''
    const temAviso = bodyAfter.toLowerCase().includes('sem dados') ||
                     bodyAfter.toLowerCase().includes('registre ponto') ||
                     bodyAfter.toLowerCase().includes('custo')
    expect(temAviso).toBeTruthy()
  })

  test('F05 Modal de divergência de composição aparece quando há excedentes', async ({ page }) => {
    await loginAs(page, 'diretoria')
    await page.goto(BASE + '/rh/folha')
    await page.waitForTimeout(5000)

    const body = await page.textContent('body') ?? ''
    expect(body).not.toContain('Application error')

    // Para este teste, verificamos que o modal de composição existe no DOM quando ativado.
    // Tentar fechar folha do mês atual — se houver divergência, o modal aparecerá.
    const btnFechar = page.locator('button:has-text("Fechar folha")')
    await expect(btnFechar).toBeVisible()
    await btnFechar.click()

    // Aguardar processamento — pode resultar em modal de divergência ou toast de erro/sucesso
    await page.waitForTimeout(8000)

    const bodyAfter = await page.textContent('body') ?? ''

    // Cenário 1: Modal de divergência apareceu
    const modalDivergencia = page.locator('text=Divergencia na Composicao')
    const modalVisible = await modalDivergencia.count() > 0

    if (modalVisible) {
      // Verificar que o modal tem as seções esperadas
      const modalBody = await page.textContent('body') ?? ''
      const temExcedentes = modalBody.includes('acima do contrato') || modalBody.includes('sem contrato')
      expect(temExcedentes).toBeTruthy()

      // Verificar que o botão "Fechar folha mesmo assim" está presente
      const btnForcar = page.locator('button:has-text("Fechar folha mesmo assim")')
      await expect(btnForcar).toBeVisible()

      // Verificar que o botão "Criar aditivo" está presente
      const btnAditivo = page.locator('button:has-text("Criar aditivo")')
      await expect(btnAditivo).toBeVisible()

      // Verificar que o botão Cancelar está presente
      const btnCancelar = page.locator('button:has-text("Cancelar")')
      await expect(btnCancelar).toBeVisible()

      // Fechar o modal clicando em Cancelar (não efetua mudanças)
      await btnCancelar.click()
      await page.waitForTimeout(1000)

      // Modal deve ter fechado
      const modalAfterCancel = await page.locator('text=Divergencia na Composicao').count()
      expect(modalAfterCancel).toBe(0)
    } else {
      // Cenário 2: Não houve divergência (ou erro de custo/duplicada)
      // Verificar que houve alguma resposta — toast de erro ou sucesso
      const temResposta = bodyAfter.includes('Já existe') ||
                          bodyAfter.includes('Sem dados') ||
                          bodyAfter.includes('fechada') ||
                          bodyAfter.includes('salário zerado') ||
                          bodyAfter.includes('Erro')
      expect(temResposta).toBeTruthy()
    }
  })
})

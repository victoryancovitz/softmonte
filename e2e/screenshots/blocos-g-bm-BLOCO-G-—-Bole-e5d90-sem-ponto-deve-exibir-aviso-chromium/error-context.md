# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: blocos/g-bm.spec.ts >> BLOCO G — Boletim de Medição >> G02 BM para obra sem ponto deve exibir aviso
- Location: e2e/blocos/g-bm.spec.ts:88:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('button:has-text("visualizar")')
    - locator resolved to <button disabled type="button" class="px-6 py-2.5 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-dark disabled:opacity-50">Pré-visualizar horas do ponto</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
      - waiting 100ms
    92 × waiting for element to be visible, enabled and stable
       - element is not enabled
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "SOFTMONTE" [ref=e5] [cursor=pointer]:
          - /url: /diretoria
          - img [ref=e6]
          - generic [ref=e10]: SOFTMONTE
        - navigation [ref=e11]:
          - button "Diretoria" [ref=e13] [cursor=pointer]:
            - text: Diretoria
            - img [ref=e14]
          - button "Engenharia" [ref=e17] [cursor=pointer]:
            - text: Engenharia
            - img [ref=e18]
          - button "Administrativo" [ref=e22] [cursor=pointer]:
            - text: Administrativo
            - img [ref=e23]
          - button "Compras" [ref=e26] [cursor=pointer]:
            - text: Compras
            - img [ref=e27]
          - button "Financeiro" [ref=e30] [cursor=pointer]:
            - text: Financeiro
            - img [ref=e31]
          - button "CC" [ref=e34] [cursor=pointer]:
            - text: CC
            - img [ref=e35]
          - button "Cadastros" [ref=e38] [cursor=pointer]:
            - text: Cadastros
            - img [ref=e39]
        - generic [ref=e41]:
          - generic [ref=e42]: Engenharia
          - button "4" [ref=e45] [cursor=pointer]:
            - img [ref=e46]
            - generic [ref=e48]: "4"
          - button "V" [ref=e50] [cursor=pointer]
      - generic [ref=e52]:
        - generic [ref=e53]: Engenharia
        - generic [ref=e54]: ›
        - generic [ref=e55]: Boletins de Medição
    - navigation [ref=e57]:
      - generic [ref=e58]:
        - link "Obras" [ref=e59] [cursor=pointer]:
          - /url: /obras
        - link "Boletins de Medição" [ref=e60] [cursor=pointer]:
          - /url: /boletins
          - text: Boletins de Medição
    - main [ref=e62]:
      - generic [ref=e63]:
        - generic [ref=e64]:
          - button "Voltar" [ref=e65] [cursor=pointer]:
            - img [ref=e66]
          - link "Boletins" [ref=e68] [cursor=pointer]:
            - /url: /boletins
          - generic [ref=e69]: /
          - generic [ref=e70]: Novo BM
        - generic [ref=e71]:
          - heading "Novo Boletim de Medição" [level=1] [ref=e72]
          - generic [ref=e73]:
            - generic [ref=e74]:
              - generic [ref=e75]: Obra *
              - combobox [ref=e76]:
                - option "Selecione a obra..." [selected]
                - option "HH Braskem — Instrumentação — BRASKEM POLÍMEROS"
                - option "HH Braskem — Parada PP3 — BRASKEM POLÍMEROS"
                - option "HH Cefértil — Apoio Rotina — CEFÉRTIL FERTILIZANTES"
                - option "HH Cefértil — Elétrica — CEFÉRTIL FERTILIZANTES"
                - option "HH Cefértil — TQ-301 — CEFÉRTIL FERTILIZANTES"
                - option "HH CSN — Alto-Forno 3 — CSN COMPANHIA SIDERÚRGICA"
                - option "HH CSN — Coqueria — CSN COMPANHIA SIDERÚRGICA"
                - option "HH CSN — Pintura Estrutural — CSN COMPANHIA SIDERÚRGICA"
                - option "HH Klabin — Andaimes — KLABIN EMBALAGENS"
                - option "HH Klabin — Secador — KLABIN EMBALAGENS"
                - option "HH Replan — Caldeira U-100 — PETROBRÁS REPLAN"
                - option "HH Replan — Mecânica Bombas — PETROBRÁS REPLAN"
                - option "HH Replan — Tubulação U-200 — PETROBRÁS REPLAN"
                - option "HH Suzano — Caldeiraria L2 — SUZANO CELULOSE"
                - option "HH Suzano — Isolamento — SUZANO CELULOSE"
                - option "HH Usiminas — Laminação — USIMINAS SIDERÚRGICA"
                - option "HH Usiminas — Parada Geral — USIMINAS SIDERÚRGICA"
                - option "HH Vale — Caldeiraria Pesada — VALE MINERAÇÃO"
                - option "HH Vale — Correia TC-04 — VALE MINERAÇÃO"
                - option "HH Vale — Elétrica SE-03 — VALE MINERAÇÃO"
            - generic [ref=e77]:
              - generic [ref=e78]:
                - generic [ref=e79]: Período de *
                - textbox [ref=e80]: 2020-01-01
              - generic [ref=e81]:
                - generic [ref=e82]: Período até *
                - textbox [active] [ref=e83]: 2020-01-31
            - generic [ref=e84]:
              - generic [ref=e85]: Observação (opcional)
              - textbox "Observações sobre este boletim..." [ref=e86]
            - generic [ref=e87]:
              - text: Período de
              - strong [ref=e88]: 31 dias
            - generic [ref=e89]:
              - button "Pré-visualizar horas do ponto" [disabled] [ref=e90]
              - link "Cancelar" [ref=e91] [cursor=pointer]:
                - /url: /boletins
      - generic [ref=e92]:
        - button "🧙 1" [ref=e93] [cursor=pointer]:
          - generic [ref=e94]: 🧙
          - generic [ref=e95]: "1"
        - button "×" [ref=e96] [cursor=pointer]
      - button "Assistente IA Softmonte" [ref=e97] [cursor=pointer]:
        - generic [ref=e98]: ✨
  - alert [ref=e99]
```

# Test source

```ts
  19  |     // Selecionar a primeira obra disponível
  20  |     const options = await selectObra.locator('option').allTextContents()
  21  |     expect(options.length).toBeGreaterThan(0)
  22  | 
  23  |     // Se a primeira option é um placeholder vazio, selecionar a segunda
  24  |     if (options.length > 1 && !options[0].trim()) {
  25  |       await selectObra.selectOption({ index: 1 })
  26  |     } else {
  27  |       await selectObra.selectOption({ index: 0 })
  28  |     }
  29  |     await page.waitForTimeout(2000)
  30  | 
  31  |     // Deve mostrar o próximo número de BM
  32  |     const bodyAfterObra = await page.textContent('body') ?? ''
  33  |     expect(bodyAfterObra).toMatch(/BM\s+\d+/)
  34  | 
  35  |     // Preencher datas — usar um período do mês anterior para garantir dados de ponto
  36  |     const hoje = new Date()
  37  |     const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  38  |     const ultimoDiaMesAnt = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
  39  | 
  40  |     const dataInicio = mesAnterior.toISOString().split('T')[0]
  41  |     const dataFim = ultimoDiaMesAnt.toISOString().split('T')[0]
  42  | 
  43  |     const inputInicio = page.locator('input[type="date"]').first()
  44  |     const inputFim = page.locator('input[type="date"]').nth(1)
  45  | 
  46  |     await inputInicio.fill(dataInicio)
  47  |     await page.waitForTimeout(500)
  48  |     await inputFim.fill(dataFim)
  49  |     await page.waitForTimeout(500)
  50  | 
  51  |     // Clicar no botão de pré-visualizar
  52  |     const btnPreview = page.locator('button:has-text("visualizar")')
  53  |     await expect(btnPreview).toBeVisible()
  54  |     await btnPreview.click()
  55  | 
  56  |     // Aguardar o preview carregar (pode demorar)
  57  |     await page.waitForTimeout(10000)
  58  | 
  59  |     const bodyAfterPreview = await page.textContent('body') ?? ''
  60  | 
  61  |     // Verificar se o preview mostrou dados OU se mostrou aviso legítimo
  62  |     const temPreviewComValores = bodyAfterPreview.includes('R$')
  63  |     const temAvisoLegitimo = bodyAfterPreview.includes('Nenhum funcionario') ||
  64  |                              bodyAfterPreview.includes('sem marcacoes') ||
  65  |                              bodyAfterPreview.includes('sobrepõe') ||
  66  |                              bodyAfterPreview.includes('anterior ao início') ||
  67  |                              bodyAfterPreview.includes('posterior')
  68  | 
  69  |     // Deve ter ou valores R$ no preview, ou um aviso legítimo explicando por que não
  70  |     expect(temPreviewComValores || temAvisoLegitimo).toBeTruthy()
  71  | 
  72  |     if (temPreviewComValores) {
  73  |       // Verificar que a tabela de preview tem colunas de R$/HH
  74  |       const temRHH = bodyAfterPreview.includes('R$/HH') || bodyAfterPreview.includes('Total')
  75  |       expect(temRHH).toBeTruthy()
  76  | 
  77  |       // Verificar que existe o botão de salvar BM
  78  |       const btnSalvar = page.locator('button:has-text("Confirmar e Criar BM")')
  79  |       const btnSalvarVisible = await btnSalvar.count() > 0
  80  |       expect(btnSalvarVisible).toBeTruthy()
  81  | 
  82  |       // Verificar que mostra contagem de funções e funcionários
  83  |       expect(bodyAfterPreview).toMatch(/\d+\s*funç/)
  84  |       expect(bodyAfterPreview).toMatch(/\d+\s*funcionário/)
  85  |     }
  86  |   })
  87  | 
  88  |   test('G02 BM para obra sem ponto deve exibir aviso', async ({ page }) => {
  89  |     await loginAs(page, 'diretoria')
  90  |     await page.goto(BASE + '/boletins/nova')
  91  |     await page.waitForTimeout(5000)
  92  | 
  93  |     const body = await page.textContent('body') ?? ''
  94  |     expect(body).not.toContain('Application error')
  95  | 
  96  |     // Selecionar a primeira obra
  97  |     const selectObra = page.locator('select').first()
  98  |     await expect(selectObra).toBeVisible({ timeout: 10000 })
  99  |     const options = await selectObra.locator('option').allTextContents()
  100 |     if (options.length > 1 && !options[0].trim()) {
  101 |       await selectObra.selectOption({ index: 1 })
  102 |     } else {
  103 |       await selectObra.selectOption({ index: 0 })
  104 |     }
  105 |     await page.waitForTimeout(2000)
  106 | 
  107 |     // Usar um período muito antigo onde com certeza não há ponto registrado
  108 |     const inputInicio = page.locator('input[type="date"]').first()
  109 |     const inputFim = page.locator('input[type="date"]').nth(1)
  110 | 
  111 |     await inputInicio.fill('2020-01-01')
  112 |     await page.waitForTimeout(500)
  113 |     await inputFim.fill('2020-01-31')
  114 |     await page.waitForTimeout(500)
  115 | 
  116 |     // Clicar no botão de pré-visualizar
  117 |     const btnPreview = page.locator('button:has-text("visualizar")')
  118 |     await expect(btnPreview).toBeVisible()
> 119 |     await btnPreview.click()
      |                      ^ Error: locator.click: Test timeout of 60000ms exceeded.
  120 | 
  121 |     // Aguardar processamento
  122 |     await page.waitForTimeout(8000)
  123 | 
  124 |     const bodyAfter = await page.textContent('body') ?? ''
  125 | 
  126 |     // Deve exibir aviso sobre ausência de dados
  127 |     const temAviso = bodyAfter.includes('Nenhum funcionario') ||
  128 |                      bodyAfter.includes('sem marcacoes') ||
  129 |                      bodyAfter.includes('alocacoes') ||
  130 |                      bodyAfter.includes('anterior ao início')
  131 |     expect(temAviso).toBeTruthy()
  132 | 
  133 |     // Não deve ter o botão de salvar BM visível quando não há dados
  134 |     // (a menos que tenha dado erro de validação de datas, que também é OK)
  135 |     if (!bodyAfter.includes('anterior ao início') && !bodyAfter.includes('posterior')) {
  136 |       const btnSalvar = page.locator('button:has-text("Confirmar e Criar BM")')
  137 |       const count = await btnSalvar.count()
  138 |       expect(count).toBe(0)
  139 |     }
  140 |   })
  141 | 
  142 |   test('G06 Matching de função funciona com capitalização diferente', async ({ page }) => {
  143 |     await loginAs(page, 'diretoria')
  144 |     await page.goto(BASE + '/boletins/nova')
  145 |     await page.waitForTimeout(5000)
  146 | 
  147 |     const body = await page.textContent('body') ?? ''
  148 |     expect(body).not.toContain('Application error')
  149 | 
  150 |     // O objetivo é verificar que, ao gerar o preview, funções com capitalização
  151 |     // diferente (ex: "soldador" vs "SOLDADOR") são corretamente mapeadas
  152 |     // para a composição contratual e recebem R$/HH.
  153 | 
  154 |     // Selecionar a primeira obra disponível
  155 |     const selectObra = page.locator('select').first()
  156 |     await expect(selectObra).toBeVisible({ timeout: 10000 })
  157 | 
  158 |     // Tentar todas as obras até achar uma com dados de ponto
  159 |     const allOptions = await selectObra.locator('option').all()
  160 |     let foundPreview = false
  161 | 
  162 |     for (let i = 0; i < Math.min(allOptions.length, 5); i++) {
  163 |       const optValue = await allOptions[i].getAttribute('value')
  164 |       if (!optValue) continue
  165 | 
  166 |       await selectObra.selectOption(optValue)
  167 |       await page.waitForTimeout(2000)
  168 | 
  169 |       // Usar mês passado
  170 |       const hoje = new Date()
  171 |       const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  172 |       const ultimoDiaMesAnt = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
  173 | 
  174 |       const inputInicio = page.locator('input[type="date"]').first()
  175 |       const inputFim = page.locator('input[type="date"]').nth(1)
  176 | 
  177 |       await inputInicio.fill(mesAnterior.toISOString().split('T')[0])
  178 |       await page.waitForTimeout(300)
  179 |       await inputFim.fill(ultimoDiaMesAnt.toISOString().split('T')[0])
  180 |       await page.waitForTimeout(300)
  181 | 
  182 |       const btnPreview = page.locator('button:has-text("visualizar")')
  183 |       await btnPreview.click()
  184 |       await page.waitForTimeout(10000)
  185 | 
  186 |       const previewBody = await page.textContent('body') ?? ''
  187 | 
  188 |       if (previewBody.includes('R$') && previewBody.includes('R$/HH')) {
  189 |         foundPreview = true
  190 | 
  191 |         // Verificar que as funções listadas no preview têm valores de R$/HH preenchidos
  192 |         // Se a capitalização funciona, funções com contrato devem ter R$/HH > 0
  193 |         // Funções sem contrato podem ter R$/HH = 0, e devem mostrar o alerta
  194 | 
  195 |         const temAlertaSemContrato = previewBody.includes('não possuem composição')
  196 | 
  197 |         // Verificar inputs de R$/HH — pegar os valores
  198 |         const hhInputs = page.locator('table input[type="number"]')
  199 |         const hhCount = await hhInputs.count()
  200 | 
  201 |         if (hhCount > 0) {
  202 |           // Pelo menos alguns inputs de R$/HH devem ter valor > 0
  203 |           // (indicando que o matching por nome funcionou)
  204 |           let temValorPreenchido = false
  205 |           for (let j = 0; j < hhCount; j++) {
  206 |             const val = await hhInputs.nth(j).inputValue()
  207 |             if (parseFloat(val) > 0) {
  208 |               temValorPreenchido = true
  209 |               break
  210 |             }
  211 |           }
  212 | 
  213 |           // Se nenhum R$/HH foi preenchido automaticamente, pode ser que todas
  214 |           // as funções estejam sem contrato (o que o alerta confirma)
  215 |           if (!temValorPreenchido) {
  216 |             expect(temAlertaSemContrato).toBeTruthy()
  217 |           }
  218 |         }
  219 | 
```
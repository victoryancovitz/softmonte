/**
 * Unified Tecnomonte PDF template
 * Wraps any document body in the branded header/footer layout.
 *
 * TODO: logo URL currently defaults to /logo_tecnomonte.png in /public.
 *       A future admin "Logo Upload" section could update this dynamically.
 */

export interface PDFTemplateOptions {
  titulo: string
  numero?: string
  logoUrl?: string
  empresa?: {
    razao_social: string
    cnpj: string
    endereco: string
    cidade: string
    estado: string
    cep: string
    telefone: string
  }
}

export function gerarPDFHTML(options: PDFTemplateOptions, bodyHTML: string): string {
  const { titulo, numero, logoUrl, empresa } = options
  const now = new Date().toLocaleString('pt-BR')

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>${titulo}</title>
<style>
  @page { size: A4 portrait; margin: 20mm 15mm 25mm 15mm; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 10px; color: #333; margin: 0; padding: 0; }
  .header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 12px; }
  .logo { width: 160px; height: auto; }
  .empresa-info { flex: 1; }
  .empresa-nome { font-size: 16px; font-weight: 800; color: #00215B; letter-spacing: 0.5px; }
  .empresa-sub { font-size: 9px; color: #00215B; font-weight: 600; margin-top: 2px; }
  .empresa-dados { font-size: 7.5px; color: #666; margin-top: 6px; line-height: 1.5; }
  .gold-line { border: none; border-top: 2px solid #c8960c; margin: 10px 0; }
  .navy-line { border: none; border-top: 1px solid #00215B; margin: 8px 0; }
  .doc-title { display: flex; justify-content: space-between; align-items: baseline; }
  .doc-title h1 { font-size: 13px; font-weight: 800; color: #00215B; text-transform: uppercase; margin: 0; }
  .doc-title .numero { font-size: 10px; color: #00215B; }
  .footer { position: fixed; bottom: 0; left: 0; right: 0; padding: 8px 15mm; border-top: 1px solid #00215B; display: flex; justify-content: space-between; font-size: 7px; color: #666; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th { background: #00215B; color: white; padding: 5px 6px; font-size: 8px; text-align: left; text-transform: uppercase; }
  td { padding: 4px 6px; border-bottom: 1px solid #eee; font-size: 9px; }
  tr:nth-child(even) td { background: #f5f5f5; }
  .section-title { font-size: 10px; font-weight: 700; color: #00215B; text-transform: uppercase; margin: 12px 0 6px; letter-spacing: 0.5px; }
  .info-row { display: flex; gap: 20px; padding: 6px 8px; background: #f5f5f5; border-radius: 4px; margin-bottom: 8px; font-size: 9px; }
  .info-row span { display: flex; gap: 4px; }
  .info-row strong { color: #00215B; }
  .termo-box { border: 1px solid #ddd; padding: 10px 12px; background: #fffef5; font-size: 8px; line-height: 1.5; text-align: justify; margin: 8px 0; }
  .assinatura-area { margin-top: 20px; display: flex; justify-content: space-between; }
  .assinatura-line { border-top: 1px solid #333; width: 45%; padding-top: 4px; font-size: 8px; text-align: center; }
  .receita { color: #15803d; }
  .despesa { color: #b91c1c; }
  .total-row { font-weight: bold; background: #f9fafb; }
  @media print { button { display: none; } }
</style>
</head><body>

<!-- HEADER -->
<div class="header">
  ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Tecnomonte" />` : `<div style="width:160px;height:50px;background:#00215B;color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;border-radius:4px;">TECNOMONTE</div>`}
  <div class="empresa-info">
    <div class="empresa-nome">TECNOMONTE</div>
    <div class="empresa-sub">FABRICAÇÃO, MONTAGEM E MANUTENÇÃO INDUSTRIAL</div>
    <div class="empresa-dados">
      CNPJ: ${empresa?.cnpj || '31.045.857/0001-51'}<br>
      ${empresa?.endereco || 'Av. Pio XII, 33'} — ${empresa?.cidade || 'Paulínia'}/${empresa?.estado || 'SP'} · CEP ${empresa?.cep || '13140-289'}<br>
      ${empresa?.telefone || '(14) 3732-5000'}
    </div>
  </div>
</div>

<hr class="gold-line">

<div class="doc-title">
  <h1>${titulo}</h1>
  ${numero ? `<span class="numero">Nº ${numero}</span>` : ''}
</div>

<hr class="navy-line">

<!-- BODY -->
${bodyHTML}

<!-- FOOTER -->
<div class="footer">
  <span>Tecnomonte © ${new Date().getFullYear()} · CNPJ ${empresa?.cnpj || '31.045.857/0001-51'}</span>
  <span>Documento gerado pelo Softmonte em ${now}</span>
</div>

<script>window.print()</script>
</body></html>`
}

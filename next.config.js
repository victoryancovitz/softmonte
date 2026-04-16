const withSerwist = require("@serwist/next").default

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      { source: '/financeiro/fluxo', destination: '/financeiro/cashflow', permanent: true },
      { source: '/financeiro/margem', destination: '/financeiro/dre', permanent: true },
      { source: '/cadastros/clientes', destination: '/clientes', permanent: true },
      { source: '/engenharia', destination: '/obras', permanent: false },
      { source: '/compras', destination: '/almoxarifado', permanent: false },
      { source: '/rh', destination: '/rh/admissoes', permanent: false },
      { source: '/administrativo/funcionarios', destination: '/funcionarios', permanent: false },
      { source: '/financeiro/forecast', destination: '/forecast', permanent: false },
      { source: '/administrativo', destination: '/funcionarios', permanent: false },
    ]
  },
}

module.exports = withSerwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
})(nextConfig)

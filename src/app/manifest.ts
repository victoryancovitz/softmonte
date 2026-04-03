import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Softmonte — Gestão de Obras',
    short_name: 'Softmonte',
    description: 'Gestão de contratos HH, equipes e obras da Tecnomonte',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#00215B',
    theme_color: '#00215B',
    orientation: 'natural',
    icons: [
      { src: '/icon-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { src: '/icon-512x512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }
}

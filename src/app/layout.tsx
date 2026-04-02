import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Softmonte | Tecnomonte — Gestão de Obras & HH',
  description: 'Plataforma interna Tecnomonte — Gestão de obras, funcionários, HH e financeiro',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#F4F6FA] text-gray-900 antialiased">{children}</body>
    </html>
  )
}

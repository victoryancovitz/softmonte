import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Softmonte — Gestão de Obras & HH',
  description: 'Plataforma de gestão de funcionários, alocação, estoque e HH',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  )
}

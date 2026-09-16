import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lavandería VIP',
  description: 'CRM interno y backend del agente de WhatsApp',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}

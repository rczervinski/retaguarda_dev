import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SidebarProvider } from '@/contexts/SidebarContext'
import ExportQueue from '@/components/ui/ExportQueue'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Retaguarda - Sistema de Gestão',
  description: 'Sistema moderno de gestão empresarial',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <SidebarProvider>
          <div className="min-h-screen bg-gray-50">
            {children}
          </div>
          {/* Global, discrete export queue tray */}
          <ExportQueue />
        </SidebarProvider>
      </body>
    </html>
  )
}

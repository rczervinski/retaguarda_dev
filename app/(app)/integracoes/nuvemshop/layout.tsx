"use client";
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NuvemshopLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const base = '/integracoes/nuvemshop'
  const tabs = [
    { name: 'Painel', href: `${base}/painel` },
    { name: 'Configurações', href: `${base}/configuracoes` },
  ]
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Integrações • Nuvemshop</h1>
      </div>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {tabs.map((t) => {
            const active = pathname?.startsWith(t.href)
            return (
              <Link
                key={t.href}
                href={t.href}
                className={
                  active
                    ? 'border-b-2 border-blue-600 text-blue-600 px-1 pb-2 text-sm font-medium'
                    : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 px-1 pb-2 text-sm'
                }
              >
                {t.name}
              </Link>
            )
          })}
        </nav>
      </div>
      <div>{children}</div>
    </div>
  )
}

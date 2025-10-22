'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type ChartPoint = { name: string; vendas: number; month: number; year: number }

export function SalesChart() {
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true); setErro(null)
      try {
        const res = await fetch('/api/dashboard/sales-by-month')
        const json = await res.json()
        if (!json.success) throw new Error(json.error || 'Falha ao carregar gráfico')
        setData(json.data || [])
      } catch (e: any) {
        setErro(e.message)
      } finally { setLoading(false) }
    }
    load()
  }, [])

  // Width class based on number of months to avoid squishing; horizontal scroll available
  const months = data?.length || 0
  const widthClass = months > 14
    ? 'w-[1600px]'
    : months > 12
      ? 'w-[1300px]'
      : months > 10
        ? 'w-[1100px]'
        : months > 8
          ? 'w-[900px]'
          : 'w-[700px]'

  // Localize label to pt-BR abbreviations using month number
  const mesesPt = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const chartData = (data || []).map(d => ({ ...d, name: mesesPt[(d.month || 1) - 1] }))

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendas dos Últimos Meses</h3>
      {erro && <div className="text-xs text-red-600 mb-2">{erro}</div>}
      <div className="h-80 overflow-x-auto">
        <div className={`h-full ${widthClass}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: 12, right: 24, top: 12, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => v.toLocaleString('pt-BR')} />
              <Tooltip formatter={(value: any, name: any) => [
                  name === 'vendas' ? (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : value,
                  name === 'vendas' ? 'Vendas' : name
                ]}
              />
              <Line type="monotone" dataKey="vendas" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

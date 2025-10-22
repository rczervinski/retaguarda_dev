import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { DashboardStats } from '@/components/dashboard/DashboardStats'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { SalesChart } from '@/components/dashboard/SalesChart'
import { RecentLocalSales } from '@/components/dashboard/RecentLocalSales'
import { TestSyncButton } from '@/components/dashboard/TestSyncButton'

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header />
        
        {/* Dashboard Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          <div className="max-w-7xl mx-auto">
            {/* Welcome Section */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Dashboard
              </h1>
              <p className="text-gray-600">
                Bem-vindo ao novo sistema de retaguarda. Aqui você encontra um resumo das principais informações.
              </p>
            </div>

            {/* Stats Cards */}
            <DashboardStats />

            {/* Ações rápidas */}
            <div className="mb-8">
              <QuickActions />
            </div>

            {/* Charts and Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <SalesChart />
              <RecentActivity />
            </div>

            {/* Vendas locais recentes + Teste de Sync como último botão */}
            <div className="mt-8">
              <RecentLocalSales />
              <div className="mt-4">
                <TestSyncButton />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}


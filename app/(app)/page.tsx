import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { SalesChart } from '@/components/dashboard/SalesChart';

export default function DashboardHome() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Bem-vindo ao novo sistema de retaguarda. Aqui você encontra um resumo das principais informações.</p>
      </div>
      <DashboardStats />
      <div className="my-8">
        <QuickActions />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <SalesChart />
        <RecentActivity />
      </div>
    </>
  );
}

"use client";

import { useEffect, useState } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';

interface NuvemEventoRaw {
  id: number;
  event: string;
  product_id?: number;
  codigo_interno?: number;
  received_at: string;
  payload?: any;
}

interface ActivityItem {
  id: string | number;
  type: string; // 'nuvemshop' | outros
  message: string;
  time: string; // relativo
  user: string;
  at: Date;
}

function timeAgo(d: Date) {
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s atrás`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m atrás`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h atrás`;
  const day = Math.floor(hr / 24);
  return `${day}d atrás`;
}

export function RecentActivity() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true); setErro(null);
      try {
        // Buscar eventos NuvemShop
        const res = await fetch('/api/nuvemshop/dashboard/eventos');
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Falha eventos');
        const eventos: NuvemEventoRaw[] = json.data || [];
        // Coletar códigos internos para nomes
        const codigosSet = new Set<string>();
        eventos.forEach(e => { if (e.codigo_interno) codigosSet.add(String(e.codigo_interno)); });
        const codigos = Array.from(codigosSet);
        let nomes: Record<string,string> = {};
        if (codigos.length) {
          try {
            const nomeRes = await fetch('/api/nuvemshop/dashboard/produtos-nomes', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ codigos }) });
            const nomeJson = await nomeRes.json();
            if (nomeJson.success) nomes = nomeJson.nomes || {};
          } catch {}
        }
        const fmtDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        const map: ActivityItem[] = eventos.slice(0,25).map(ev => {
          const at = new Date(ev.received_at);
            const nome = (ev.codigo_interno && nomes[String(ev.codigo_interno)]) || `#${ev.codigo_interno || ev.product_id || '?'}`;
            let base: string;
            if (ev.event === 'local/product_created') base = `CRIOU o produto ${nome}`;
            else if (ev.event === 'local/product_updated') base = `ATUALIZOU o produto ${nome}`;
            else if (ev.event === 'local/product_deleted') base = `DELETOU o produto ${nome}`;
            else if (ev.event === 'remote/product_deleted') base = `NUVEMSHOP removeu o produto ${nome}`;
            else base = `Evento ${ev.event} (${nome})`;
            const message = `${base} em ${fmtDate.format(at)} na plataforma NUVEMSHOP`;
            return {
              id: `nuv-${ev.id}`,
              type: 'nuvemshop',
              message,
              time: timeAgo(at),
              user: 'NuvemShop',
              at
            };
        });

        // Placeholder de outras atividades (poderia vir de outro endpoint futuramente)
        setItems(map);
      } catch (e:any) {
        setErro(e.message);
      } finally { setLoading(false); }
    }
    load();
  }, []);

  const ordered = [...items].sort((a,b)=> b.at.getTime() - a.at.getTime()).slice(0,30);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Atividades E-commerce Recentes</h3>
        <ClockIcon className="w-5 h-5 text-gray-400" />
      </div>
      {erro && <div className="text-xs text-red-600">{erro}</div>}
      {loading && <div className="text-xs text-gray-500">Carregando...</div>}
      {!loading && !erro && (
        <div className="space-y-4 max-h-72 overflow-y-auto pr-2">{/* ~288px fixed height + scroll */}
          {ordered.map(activity => (
            <div key={activity.id} className="flex items-start space-x-3">
              <div className="flex-shrink-0 text-lg">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 break-words">{activity.message}</p>
                <div className="flex items-center mt-1 text-xs text-gray-500">
                  <span>{activity.user}</span>
                  <span className="mx-1">•</span>
                  <span>{activity.time}</span>
                </div>
              </div>
            </div>
          ))}
          {ordered.length === 0 && <div className="text-xs text-gray-500">Sem eventos.</div>}
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <button onClick={()=> location.reload()} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
          Recarregar
        </button>
      </div>
    </div>
  );
}
const getActivityIcon = (type: string) => {
  switch (type) {
    case 'produto':
      return '📦'
    case 'sync':
      return '🔄'
    case 'venda':
      return '🛒'
    case 'cliente':
      return '👤'
    case 'nuvemshop':
      return '🛍️'
    default:
      return '📋'
  }
}

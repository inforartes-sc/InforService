/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Client, Service, Payment, PaymentStatus, ServiceStatus } from '../types';
import { 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  ArrowUpRight 
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { motion } from 'motion/react';

interface DashboardProps {
  clients: Client[];
  services: Service[];
  payments: Payment[];
  onNavigate: (tab: string) => void;
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899'];

export default function Dashboard({ clients, services, payments, onNavigate }: DashboardProps) {
  // --- METRICS CALCULATION ---
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // Valor recebido hoje
  const receivedToday = payments
    .filter(p => (p.status === PaymentStatus.PAGO || p.status === PaymentStatus.PARCIAL) && p.paymentDate?.startsWith(todayStr))
    .reduce((acc, p) => acc + (p.status === PaymentStatus.PARCIAL ? (p.paidAmount || 0) : (p.paidAmount || p.amount)), 0);

  // Valor recebido no mês
  const receivedThisMonth = payments
    .filter(p => {
      if ((p.status !== PaymentStatus.PAGO && p.status !== PaymentStatus.PARCIAL) || !p.paymentDate) return false;
      const d = new Date(p.paymentDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((acc, p) => acc + (p.status === PaymentStatus.PARCIAL ? (p.paidAmount || 0) : (p.paidAmount || p.amount)), 0);

  // Valor pendente (A receber em aberto que não venceu)
  const pendingValue = payments
    .filter(p => (p.status === PaymentStatus.PENDENTE || p.status === PaymentStatus.PARCIAL) && new Date(p.dueDate) >= new Date(todayStr))
    .reduce((acc, p) => {
      const remaining = p.status === PaymentStatus.PARCIAL ? (p.amount - (p.paidAmount || 0)) : p.amount;
      return acc + remaining;
    }, 0);

  // Serviços realizados
  const servicesCompleted = services.filter(s => s.status === ServiceStatus.FINALIZADO).length;

  // Serviços aguardando pagamento
  const servicesAwaitingPayment = services.filter(s => s.status === ServiceStatus.AGUARDANDO).length;

  // Clientes cadastrados
  const totalClients = clients.length;

  // Pagamentos vencidos
  const overdueValue = payments
    .filter(p => p.status === PaymentStatus.VENCIDO || ((p.status === PaymentStatus.PENDENTE || p.status === PaymentStatus.PARCIAL) && new Date(p.dueDate) < new Date(todayStr)))
    .reduce((acc, p) => {
      const remaining = p.status === PaymentStatus.PARCIAL ? (p.amount - (p.paidAmount || 0)) : p.amount;
      return acc + remaining;
    }, 0);

  // Próximos recebimentos (Payments of the next 30 days)
  const nextReceivables = payments
    .filter(p => (p.status === PaymentStatus.PENDENTE || p.status === PaymentStatus.PARCIAL) && new Date(p.dueDate) >= new Date(todayStr))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  // --- CHARTS DATA GENERATION ---

  // 1. Recebimentos por mês (faturamento consolidado de pagos)
  const monthlyRevenueMap: { [key: string]: { pago: number; pendente: number } } = {};
  const monthsAbbr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Initialize last 6 months
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const mLabel = `${monthsAbbr[d.getMonth()]}/${String(d.getFullYear()).substring(2)}`;
    monthlyRevenueMap[mLabel] = { pago: 0, pendente: 0 };
  }

  payments.forEach(p => {
    const pDate = p.paymentDate ? new Date(p.paymentDate) : new Date(p.dueDate);
    const mLabel = `${monthsAbbr[pDate.getMonth()]}/${String(pDate.getFullYear()).substring(2)}`;
    if (monthlyRevenueMap[mLabel] !== undefined) {
      if (p.status === PaymentStatus.PAGO) {
        monthlyRevenueMap[mLabel].pago += p.paidAmount || p.amount;
      } else if (p.status === PaymentStatus.PARCIAL) {
        const paid = p.paidAmount || 0;
        const remaining = Math.max(0, p.amount - paid);
        monthlyRevenueMap[mLabel].pago += paid;
        monthlyRevenueMap[mLabel].pendente += remaining;
      } else {
        monthlyRevenueMap[mLabel].pendente += p.amount;
      }
    }
  });

  const monthlyRevenueData = Object.entries(monthlyRevenueMap).map(([month, val]) => ({
    name: month,
    Pago: parseFloat(val.pago.toFixed(2)),
    Pendente: parseFloat(val.pendente.toFixed(2))
  }));

  // 2. Serviços realizados por categoria
  const categoryCount: { [key: string]: number } = {};
  services.forEach(s => {
    const cat = s.category || 'Outros';
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });
  const servicesByCategoryData = Object.entries(categoryCount).map(([cat, count]) => ({
    name: cat,
    Quantidade: count
  })).sort((a, b) => b.Quantidade - a.Quantidade).slice(0, 6);

  // 3. Pagamentos por forma de pagamento
  const methodValue: { [key: string]: number } = {};
  payments.filter(p => p.status === PaymentStatus.PAGO || p.status === PaymentStatus.PARCIAL).forEach(p => {
    const method = p.paymentMethod || 'Outro';
    const valuePaid = p.status === PaymentStatus.PARCIAL ? (p.paidAmount || 0) : (p.paidAmount || p.amount);
    methodValue[method] = (methodValue[method] || 0) + valuePaid;
  });
  const paymentsByMethodData = Object.entries(methodValue).map(([method, val]) => ({
    name: method,
    value: parseFloat(val.toFixed(2))
  }));

  // 4. Clientes que mais contrataram serviços
  const clientServiceCount: { [key: string]: { name: string; count: number; totalSpent: number } } = {};
  services.forEach(s => {
    const client = clients.find(c => c.id === s.clientId);
    const cName = client ? client.name : 'Cliente Excluído';
    if (!clientServiceCount[s.clientId]) {
      clientServiceCount[s.clientId] = { name: cName, count: 0, totalSpent: 0 };
    }
    clientServiceCount[s.clientId].count += 1;
    clientServiceCount[s.clientId].totalSpent += s.finalValue;
  });
  const topClientsData = Object.values(clientServiceCount)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight font-sans">
            Dashboard Financeiro
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visão geral em tempo real dos pagamentos e serviços prestados.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold bg-white border border-slate-200 px-3 py-2 rounded-xl text-slate-600 shadow-sm self-start">
          <Calendar className="w-4 h-4 text-indigo-500" />
          <span>Hoje: {new Date().toLocaleDateString('pt-BR', { dateStyle: 'long' })}</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Recebido Hoje</span>
            <span className="text-2xl font-extrabold text-slate-900 block font-mono">
              R$ {receivedToday.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> Faturamento diário
            </span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <DollarSign className="w-6 h-6" />
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Recebido no Mês</span>
            <span className="text-2xl font-extrabold text-slate-900 block font-mono">
              R$ {receivedThisMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-indigo-600 font-medium flex items-center gap-0.5">
              Mês corrente
            </span>
          </div>
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Previsão Pendente</span>
            <span className="text-2xl font-extrabold text-slate-900 block font-mono">
              R$ {pendingValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-amber-600 font-medium flex items-center gap-0.5">
              A vencer
            </span>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-2">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Total Inadimplência</span>
            <span className="text-2xl font-extrabold text-rose-600 block font-mono">
              R$ {overdueValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-rose-600 font-medium">
              Vencidos acumulados
            </span>
          </div>
          <div className="p-3 bg-rose-50 rounded-xl text-rose-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </motion.div>
      </div>

      {/* Extra KPI Badges for general indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-100/60 p-4 rounded-2xl border border-slate-200/50">
        <div className="flex items-center gap-3.5 bg-white p-3 rounded-xl border border-slate-200/40">
          <div className="p-2 bg-slate-50 rounded-lg text-slate-600">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">Serviços Realizados</span>
            <span className="text-lg font-bold text-slate-800">{servicesCompleted} finalizados</span>
          </div>
        </div>

        <div className="flex items-center gap-3.5 bg-white p-3 rounded-xl border border-slate-200/40">
          <div className="p-2 bg-slate-50 rounded-lg text-slate-600">
            <Clock className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">Aguardando Pagamento</span>
            <span className="text-lg font-bold text-slate-800">{servicesAwaitingPayment} O.S. abertas</span>
          </div>
        </div>

        <div className="flex items-center gap-3.5 bg-white p-3 rounded-xl border border-slate-200/40">
          <div className="p-2 bg-slate-50 rounded-lg text-slate-600">
            <Users className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-medium">Clientes Cadastrados</span>
            <span className="text-lg font-bold text-slate-800">{totalClients} ativos</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recebimentos por mês & Evolução do Faturamento */}
        <div className="lg:col-span-2 bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-sans">Evolução do Faturamento e Recebimentos</h3>
              <p className="text-xs text-slate-400">Valores faturados (pagos) vs. provisão pendente nos últimos meses.</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenueData}>
                <defs>
                  <linearGradient id="colorPago" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPendente" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => [`R$ ${value.toLocaleString('pt-BR')}`]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', marginTop: '10px' }} />
                <Area type="monotone" dataKey="Pago" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPago)" />
                <Area type="monotone" dataKey="Pendente" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorPendente)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pagamentos por forma de pagamento */}
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-sans">Formas de Pagamento</h3>
            <p className="text-xs text-slate-400">Distribuição financeira dos pagamentos confirmados.</p>
          </div>
          <div className="h-60 flex items-center justify-center">
            {paymentsByMethodData.length === 0 ? (
              <span className="text-xs text-slate-400">Nenhum pagamento registrado</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentsByMethodData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {paymentsByMethodData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`R$ ${value.toLocaleString('pt-BR')}`]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs max-h-24 overflow-y-auto">
            {paymentsByMethodData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-slate-600 truncate">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Serviços mais realizados */}
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-sans">Serviços por Categoria</h3>
            <p className="text-xs text-slate-400">Quantidade de ordens de serviços registradas por área de atuação.</p>
          </div>
          <div className="h-64">
            {servicesByCategoryData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">Nenhum serviço registrado</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={servicesByCategoryData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="Quantidade" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Clientes que mais contrataram serviços */}
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-sans">Clientes que mais Contrataram</h3>
            <p className="text-xs text-slate-400 font-sans">Maiores faturamentos consolidados por cliente cadastrado.</p>
          </div>
          <div className="space-y-3.5">
            {topClientsData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-slate-400 text-xs">Nenhum cliente com serviços vinculados</div>
            ) : (
              topClientsData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold font-sans">
                      {index + 1}
                    </span>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block truncate max-w-xs">{item.name}</span>
                      <span className="text-[10px] text-slate-400 font-sans">{item.count} serviços contratados</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-800 font-mono">
                      R$ {item.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[9px] text-emerald-500 flex items-center gap-0.5 justify-end">
                      Ativo <ArrowUpRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Próximos Recebimentos List */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-sans">Agenda Próximos Recebimentos</h3>
            <p className="text-xs text-slate-400 font-sans">As 5 parcelas a vencer com datas de vencimento mais próximas.</p>
          </div>
          <button 
            onClick={() => onNavigate('payments')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer flex items-center gap-1 font-sans"
          >
            Ver todos <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr className="bg-slate-50/50">
                <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Cliente</th>
                <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Parcela</th>
                <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Vencimento</th>
                <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Forma de Pagamento</th>
                <th scope="col" className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Valor</th>
                <th scope="col" className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {nextReceivables.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">Nenhum recebimento pendente para os próximos dias.</td>
                </tr>
              ) : (
                nextReceivables.map((p) => {
                  const client = clients.find(c => c.id === p.clientId);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-800 block truncate max-w-xs">{client ? client.name : 'Cliente Excluído'}</span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500">
                        {p.installmentNumber} / {p.totalInstallments}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-600 font-mono">
                        {new Date(p.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500">
                        {p.paymentMethod}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs font-bold text-slate-800 font-mono">
                        R$ {p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-600 border border-amber-100">
                          A vencer
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Payment, Client, Service, PaymentStatus } from '../types';
import { 
  FileText, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  BarChart, 
  Calendar, 
  Download, 
  Eye, 
  HelpCircle,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';

interface ReportsProps {
  payments: Payment[];
  clients: Client[];
  services: Service[];
}

export default function Reports({ payments, clients, services }: ReportsProps) {
  const [reportType, setReportType] = useState<string>('recebimentos');
  const [selectedYear, setSelectedYear] = useState<string>('2026');

  // --- STATS COMPUTING ---
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Recebimentos
  const totalReceived = payments
    .filter(p => p.status === PaymentStatus.PAGO)
    .reduce((sum, p) => sum + (p.paidAmount || p.amount), 0);

  // 2. Inadimplência (Overdue total)
  const totalOverdue = payments
    .filter(p => p.status === PaymentStatus.VENCIDO || (p.status === PaymentStatus.PENDENTE && new Date(p.dueDate) < new Date(todayStr)))
    .reduce((sum, p) => sum + p.amount, 0);

  const totalOutstanding = payments
    .filter(p => p.status === PaymentStatus.PENDENTE && new Date(p.dueDate) >= new Date(todayStr))
    .reduce((sum, p) => sum + p.amount, 0);

  const delinquencyRate = payments.length > 0
    ? (totalOverdue / (totalReceived + totalOverdue + totalOutstanding)) * 100
    : 0;

  // CSV Exporter Helper
  const downloadCSV = (title: string, headers: string[], rows: string[][]) => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // UTF-8 BOM
    csvContent += headers.join(",") + "\r\n";
    rows.forEach(row => {
      const sanitizedRow = row.map(val => `"${val.replace(/"/g, '""')}"`);
      csvContent += sanitizedRow.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export flows based on tab
  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    if (format === 'pdf') {
      alert('Relatório formatado com sucesso! Iniciando visualização de impressão nativa.');
      window.print();
      return;
    }

    if (reportType === 'recebimentos') {
      const headers = ['ID Parcela', 'Cliente', 'Data de Vencimento', 'Data de Pagamento', 'Valor Parcela', 'Valor Recebido', 'Forma', 'Status'];
      const rows = payments.map(p => {
        const client = clients.find(c => c.id === p.clientId);
        return [
          p.id,
          client?.name || 'Excluído',
          p.dueDate,
          p.paymentDate || '-',
          p.amount.toFixed(2),
          (p.paidAmount || 0).toFixed(2),
          p.paymentMethod,
          p.status
        ];
      });
      downloadCSV('relatorio_recebimentos', headers, rows);
    } else if (reportType === 'inadimplencia') {
      const headers = ['ID Parcela', 'Cliente', 'Telefone', 'WhatsApp', 'Data de Vencimento', 'Valor em Atraso', 'Status'];
      const overdueList = payments.filter(p => p.status === PaymentStatus.VENCIDO || (p.status === PaymentStatus.PENDENTE && new Date(p.dueDate) < new Date(todayStr)));
      const rows = overdueList.map(p => {
        const client = clients.find(c => c.id === p.clientId);
        return [
          p.id,
          client?.name || 'Excluído',
          client?.phone || '-',
          client?.whatsapp || '-',
          p.dueDate,
          p.amount.toFixed(2),
          'VENCIDO'
        ];
      });
      downloadCSV('relatorio_inadimplencia', headers, rows);
    } else if (reportType === 'faturamento') {
      const headers = ['Mês', 'Faturado Pago (R$)', 'Pendente a Receber (R$)', 'Inadimplência (R$)'];
      const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      const rows = months.map((m, idx) => {
        const monthPayments = payments.filter(p => {
          const d = new Date(p.dueDate);
          return d.getMonth() === idx;
        });
        const pago = monthPayments.filter(p => p.status === PaymentStatus.PAGO).reduce((s, p) => s + (p.paidAmount || p.amount), 0);
        const atrasado = monthPayments.filter(p => p.status === PaymentStatus.VENCIDO || (p.status === PaymentStatus.PENDENTE && new Date(p.dueDate) < new Date(todayStr))).reduce((s, p) => s + p.amount, 0);
        const pendente = monthPayments.filter(p => p.status === PaymentStatus.PENDENTE && new Date(p.dueDate) >= new Date(todayStr)).reduce((s, p) => s + p.amount, 0);
        return [m, pago.toFixed(2), pendente.toFixed(2), atrasado.toFixed(2)];
      });
      downloadCSV('relatorio_faturamento_anual', headers, rows);
    } else {
      // Clientes
      const headers = ['Nome Cliente', 'CPF/CNPJ', 'Email', 'Telefone', 'Total Gasto (R$)', 'Serviços Contratados'];
      const rows = clients.map(c => {
        const clientServices = services.filter(s => s.clientId === c.id);
        const totalSpent = clientServices.reduce((sum, s) => sum + s.finalValue, 0);
        return [
          c.name,
          c.cpfCnpj,
          c.email,
          c.phone,
          totalSpent.toFixed(2),
          clientServices.length.toString()
        ];
      });
      downloadCSV('relatorio_carteira_clientes', headers, rows);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight font-sans">Relatórios Gerenciais</h1>
          <p className="text-sm text-slate-500 mt-1">Análises contábeis de faturamento, inadimplência e exportações homologadas.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => handleExport('csv')}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Download className="w-4 h-4 text-slate-400" /> Exportar CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-md transition-colors"
          >
            <FileText className="w-4 h-4" /> Exportar PDF / Imprimir
          </button>
        </div>
      </div>

      {/* Stats indicators banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/60 font-sans">
        <div className="p-3.5 bg-white border border-slate-100 rounded-xl">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Faturamento Líquido Realizado</span>
          <span className="text-lg font-black text-emerald-600 block mt-1">
            R$ {totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-400">Total liquidado em conta</span>
        </div>

        <div className="p-3.5 bg-white border border-slate-100 rounded-xl">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Inadimplência Consolidada</span>
          <span className="text-lg font-black text-rose-600 block mt-1">
            R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-rose-500 font-semibold flex items-center gap-0.5 mt-0.5">
            Taxa de atraso: {delinquencyRate.toFixed(1)}%
          </span>
        </div>

        <div className="p-3.5 bg-white border border-slate-100 rounded-xl">
          <span className="text-[10px] font-bold text-slate-400 block uppercase">Contas Pendentes (A Receber)</span>
          <span className="text-lg font-black text-indigo-600 block mt-1">
            R$ {totalOutstanding.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-slate-400">Previsão de carteira ativa</span>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-1 p-3">
          <button
            onClick={() => setReportType('recebimentos')}
            className={`px-4 py-2 text-xs font-bold rounded-xl cursor-pointer transition-all ${
              reportType === 'recebimentos' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Faturamento Recebido
          </button>
          <button
            onClick={() => setReportType('inadimplencia')}
            className={`px-4 py-2 text-xs font-bold rounded-xl cursor-pointer transition-all ${
              reportType === 'inadimplencia' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Inadimplência (Atrasos)
          </button>
          <button
            onClick={() => setReportType('faturamento')}
            className={`px-4 py-2 text-xs font-bold rounded-xl cursor-pointer transition-all ${
              reportType === 'faturamento' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Fechamento Mensal/Anual
          </button>
          <button
            onClick={() => setReportType('clientes')}
            className={`px-4 py-2 text-xs font-bold rounded-xl cursor-pointer transition-all ${
              reportType === 'clientes' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Clientes mais Ativos
          </button>
        </div>

        {/* Report contents table list */}
        <div className="p-4 overflow-x-auto">
          {reportType === 'recebimentos' && (
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left font-sans">
                  <th scope="col" className="px-4 py-3">Cliente</th>
                  <th scope="col" className="px-4 py-3">Data Vencimento</th>
                  <th scope="col" className="px-4 py-3">Data Recebimento</th>
                  <th scope="col" className="px-4 py-3 text-right">Valor Nominal</th>
                  <th scope="col" className="px-4 py-3 text-right">Valor Líquido Recebido</th>
                  <th scope="col" className="px-4 py-3">Meio</th>
                  <th scope="col" className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {payments.filter(p => p.status === PaymentStatus.PAGO).map(p => {
                  const client = clients.find(c => c.id === p.clientId);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/20">
                      <td className="px-4 py-3 font-bold text-slate-800">{client ? client.name : 'Excluído'}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono">{new Date(p.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono font-bold">
                        {p.paymentDate ? new Date(p.paymentDate + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 font-mono">R$ {p.amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 font-mono">R$ {(p.paidAmount || p.amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-500">{p.paymentMethod}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-bold rounded-full">RECEBIDO</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {reportType === 'inadimplencia' && (
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left font-sans">
                  <th scope="col" className="px-4 py-3">Cliente Devedor</th>
                  <th scope="col" className="px-4 py-3">Contato WhatsApp</th>
                  <th scope="col" className="px-4 py-3">Vencimento</th>
                  <th scope="col" className="px-4 py-3 text-right">Valor em Atraso</th>
                  <th scope="col" className="px-4 py-3">Dias em Atraso</th>
                  <th scope="col" className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {payments
                  .filter(p => p.status === PaymentStatus.VENCIDO || (p.status === PaymentStatus.PENDENTE && new Date(p.dueDate) < new Date(todayStr)))
                  .map(p => {
                    const client = clients.find(c => c.id === p.clientId);
                    const days = Math.floor((new Date(todayStr).getTime() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/20">
                        <td className="px-4 py-3 font-bold text-slate-800">{client ? client.name : 'Excluído'}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono">{client?.whatsapp || client?.phone || '-'}</td>
                        <td className="px-4 py-3 text-rose-600 font-mono font-bold">{new Date(p.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                        <td className="px-4 py-3 text-right font-bold text-rose-600 font-mono">R$ {p.amount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono">{days > 0 ? `${days} dias` : '1 dia'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 text-[9px] font-bold rounded-full">INADIMPLENTE</span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}

          {reportType === 'faturamento' && (
            <table className="min-w-full divide-y divide-slate-100 font-sans">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">
                  <th scope="col" className="px-4 py-3">Mês Competência ({selectedYear})</th>
                  <th scope="col" className="px-4 py-3 text-right">Volume Liquidado (Pago)</th>
                  <th scope="col" className="px-4 py-3 text-right">Volume Provisório (A Vencer)</th>
                  <th scope="col" className="px-4 py-3 text-right">Volume de Atraso</th>
                  <th scope="col" className="px-4 py-3 text-right">Previsão Contábil Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, idx) => {
                  const mPayments = payments.filter(p => {
                    const d = new Date(p.dueDate);
                    return d.getMonth() === idx;
                  });
                  const pago = mPayments.filter(p => p.status === PaymentStatus.PAGO).reduce((sum, p) => sum + (p.paidAmount || p.amount), 0);
                  const pendente = mPayments.filter(p => p.status === PaymentStatus.PENDENTE && new Date(p.dueDate) >= new Date(todayStr)).reduce((sum, p) => sum + p.amount, 0);
                  const atrasado = mPayments.filter(p => p.status === PaymentStatus.VENCIDO || (p.status === PaymentStatus.PENDENTE && new Date(p.dueDate) < new Date(todayStr))).reduce((sum, p) => sum + p.amount, 0);
                  const total = pago + pendente + atrasado;

                  return (
                    <tr key={m} className="hover:bg-slate-50/20">
                      <td className="px-4 py-3 font-semibold text-slate-700">{m}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-mono font-bold">R$ {pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right text-indigo-500 font-mono">R$ {pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right text-rose-500 font-mono">R$ {atrasado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right text-slate-800 font-mono font-bold">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {reportType === 'clientes' && (
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left font-sans">
                  <th scope="col" className="px-4 py-3">Cliente</th>
                  <th scope="col" className="px-4 py-3">CPF/CNPJ</th>
                  <th scope="col" className="px-4 py-3 text-center">Qtd Serviços Solicitados</th>
                  <th scope="col" className="px-4 py-3 text-right">Faturamento Consolidado</th>
                  <th scope="col" className="px-4 py-3 text-center">Status no Sistema</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {clients.map(c => {
                  const clientServices = services.filter(s => s.clientId === c.id);
                  const totalSpent = clientServices.reduce((sum, s) => sum + s.finalValue, 0);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/20">
                      <td className="px-4 py-3 font-bold text-slate-800">{c.name}</td>
                      <td className="px-4 py-3 text-slate-500 font-mono">{c.cpfCnpj}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-600">{clientServices.length}</td>
                      <td className="px-4 py-3 text-right font-black text-slate-800 font-mono">R$ {totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${totalSpent > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                          {totalSpent > 0 ? 'Ativo' : 'Lead'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

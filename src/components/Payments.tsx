/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Payment, Client, Service, PaymentStatus, PaymentMethod } from '../types';
import { api } from '../lib/api';
import { 
  Plus, 
  Search, 
  Filter, 
  Check, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  Edit3, 
  Trash2, 
  DollarSign, 
  X, 
  MessageSquare, 
  User, 
  FileCheck
} from 'lucide-react';
import { motion } from 'motion/react';

interface PaymentsProps {
  payments: Payment[];
  clients: Client[];
  services: Service[];
  onRefresh: () => void;
  currentUser: any;
}

export default function Payments({ payments, clients, services, onRefresh, currentUser }: PaymentsProps) {
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('Todos');
  const [selectedMethod, setSelectedMethod] = useState<string>('Todas');
  const [selectedClient, setSelectedClient] = useState<string>('Todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Editing state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  // Form edit fields
  const [amount, setAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [interest, setInterest] = useState<number>(0);
  const [penalty, setPenalty] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [observation, setObservation] = useState('');
  const [status, setStatus] = useState<PaymentStatus>(PaymentStatus.PENDENTE);

  // Confirmation of Quick Receipt modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState<Payment | null>(null);
  const [quickPaidAmount, setQuickPaidAmount] = useState<number>(0);
  const [quickPaymentMethod, setQuickPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [quickPaymentDate, setQuickPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Loading
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [showAdvancedPayments, setShowAdvancedPayments] = useState(false);

  // Set default edit fields
  const openEditModal = (p: Payment) => {
    setEditingPayment(p);
    setAmount(p.amount);
    setDueDate(p.dueDate);
    setPaymentDate(p.paymentDate || new Date().toISOString().split('T')[0]);
    setPaidAmount(p.paidAmount || p.amount);
    setInterest(p.interest || 0);
    setPenalty(p.penalty || 0);
    setDiscount(p.discount || 0);
    setPaymentMethod(p.paymentMethod || PaymentMethod.PIX);
    setObservation(p.observation || '');
    setStatus(p.status || PaymentStatus.PENDENTE);
    setShowAdvancedPayments(false);
    setErrorMsg('');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload: Partial<Payment> = {
        amount,
        dueDate,
        paymentMethod,
        observation,
        status,
        interest,
        penalty,
        discount
      };

      if (status === PaymentStatus.PAGO || status === PaymentStatus.PARCIAL) {
        payload.paymentDate = paymentDate || new Date().toISOString().split('T')[0];
        // If they enter a paidAmount >= nominal amount, it is fully PAGO
        if (paidAmount >= amount) {
          payload.status = PaymentStatus.PAGO;
          payload.paidAmount = paidAmount;
        } else {
          payload.status = PaymentStatus.PARCIAL;
          payload.paidAmount = paidAmount;
        }
      } else {
        payload.paymentDate = '';
        payload.paidAmount = 0;
      }

      await api.updatePayment(editingPayment.id, payload);
      setIsEditModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar faturamento.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open quick pay modal
  const openQuickPay = (p: Payment) => {
    setConfirmingPayment(p);
    const alreadyPaid = p.paidAmount || 0;
    const remaining = Math.max(0, p.amount - alreadyPaid);
    setQuickPaidAmount(remaining);
    setQuickPaymentMethod(p.paymentMethod || PaymentMethod.PIX);
    setQuickPaymentDate(new Date().toISOString().split('T')[0]);
    setIsConfirmModalOpen(true);
  };

  const handleQuickPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmingPayment) return;

    setSubmitting(true);
    try {
      const alreadyPaid = confirmingPayment.paidAmount || 0;
      const totalPaid = parseFloat((alreadyPaid + quickPaidAmount).toFixed(2));
      
      let finalStatus = PaymentStatus.PAGO;
      if (totalPaid < confirmingPayment.amount) {
        finalStatus = PaymentStatus.PARCIAL;
      }

      await api.updatePayment(confirmingPayment.id, {
        status: finalStatus,
        paidAmount: totalPaid,
        paymentMethod: quickPaymentMethod,
        paymentDate: quickPaymentDate
      });
      setIsConfirmModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error('Error confirming pay:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja remover esta parcela permanentemente? Isso pode distorcer o faturamento da O.S.')) return;
    try {
      await api.deletePayment(id);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Filter payments
  const filteredPayments = payments.filter(p => {
    const client = clients.find(c => c.id === p.clientId);
    const service = services.find(s => s.id === p.serviceId);
    
    const clientName = client ? client.name.toLowerCase() : '';
    const serviceNum = service ? service.serviceNumber.toLowerCase() : '';
    const query = searchQuery.toLowerCase();

    // Text search (Client Name, O.S. Number)
    const matchesSearch = clientName.includes(query) || serviceNum.includes(query) || p.observation.toLowerCase().includes(query);

    // Filter statuses
    let matchesStatus = true;
    const todayStr = new Date().toISOString().split('T')[0];
    if (selectedStatus === 'Vencidos') {
      matchesStatus = p.status === PaymentStatus.VENCIDO || ((p.status === PaymentStatus.PENDENTE || p.status === PaymentStatus.PARCIAL) && new Date(p.dueDate) < new Date(todayStr));
    } else if (selectedStatus === 'Recebidos') {
      matchesStatus = p.status === PaymentStatus.PAGO;
    } else if (selectedStatus === 'Parciais') {
      matchesStatus = p.status === PaymentStatus.PARCIAL;
    } else if (selectedStatus === 'Pendentes') {
      matchesStatus = (p.status === PaymentStatus.PENDENTE || p.status === PaymentStatus.PARCIAL) && new Date(p.dueDate) >= new Date(todayStr);
    }

    // Filter methods
    const matchesMethod = selectedMethod === 'Todas' || p.paymentMethod === selectedMethod;

    // Filter client dropdown
    const matchesClient = selectedClient === 'Todos' || p.clientId === selectedClient;

    // Filter dates
    let matchesDates = true;
    if (startDate) {
      matchesDates = matchesDates && new Date(p.dueDate) >= new Date(startDate);
    }
    if (endDate) {
      matchesDates = matchesDates && new Date(p.dueDate) <= new Date(endDate);
    }

    return matchesSearch && matchesStatus && matchesMethod && matchesClient && matchesDates;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full space-y-4 overflow-hidden">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight font-sans">Contas a Receber</h1>
          <p className="text-sm text-slate-500 mt-1">Monitore parcelamentos, confirme recebimentos e gerencie o fluxo de caixa.</p>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Pesquisar por cliente, O.S. ou observação..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-800"
            />
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="block w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-700 bg-white"
            >
              <option value="Todos">Todos os Status</option>
              <option value="Recebidos">Recebidos (Pagos)</option>
              <option value="Parciais">Parcialmente pagos</option>
              <option value="Pendentes">Pendentes (A Vencer)</option>
              <option value="Vencidos">Vencidos (Inadimplência)</option>
            </select>
          </div>

          <div>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="block w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-700 bg-white"
            >
              <option value="Todos">Filtrar por Cliente (Todos)</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Date Filters and payment methods */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-50">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase">Vencimento Início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 block w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase">Vencimento Fim</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 block w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase">Forma de Pagamento</label>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="mt-1 block w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white"
            >
              <option value="Todas">Todas as Formas</option>
              <option value="Pix">Pix</option>
              <option value="Boleto">Boleto</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Cartão de Débito">Cartão de Débito</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="Transferência Bancária">Transferência Bancária</option>
            </select>
          </div>
        </div>
      </div>

      {/* Receivables Table List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr className="bg-slate-50/50">
                <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Vencimento</th>
                <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Cliente / O.S.</th>
                <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Observação Parcela</th>
                <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Forma</th>
                <th scope="col" className="px-6 py-3.5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Valor Parcela</th>
                <th scope="col" className="px-6 py-3.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Status</th>
                <th scope="col" className="px-6 py-3.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-xs text-slate-400">
                    Nenhuma parcela correspondente aos filtros de faturamento informados.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const client = clients.find(c => c.id === p.clientId);
                  const service = services.find(s => s.id === p.serviceId);
                  const todayStr = new Date().toISOString().split('T')[0];

                  // Calculate true status dynamically if pending but overdue
                  let statusLabel: string = p.status;
                  let badgeColor = 'bg-amber-50 text-amber-600 border-amber-100';
                  if (p.status === PaymentStatus.PENDENTE && new Date(p.dueDate) < new Date(todayStr)) {
                    statusLabel = PaymentStatus.VENCIDO;
                    badgeColor = 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse';
                  } else if (p.status === PaymentStatus.PARCIAL && new Date(p.dueDate) < new Date(todayStr)) {
                    statusLabel = 'Parcial (Vencida)';
                    badgeColor = 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse';
                  } else if (p.status === PaymentStatus.PARCIAL) {
                    badgeColor = 'bg-sky-50 text-sky-600 border-sky-100';
                  } else if (p.status === PaymentStatus.PAGO) {
                    badgeColor = 'bg-emerald-50 text-emerald-600 border-emerald-100';
                  }

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-700">
                        {new Date(p.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-800 block truncate max-w-[150px]">{client ? client.name : 'Cliente Excluído'}</span>
                        <span className="text-[10px] text-indigo-600 font-mono block mt-0.5">{service ? service.serviceNumber : 'Sem O.S.'}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {p.observation || `Parcela ${p.installmentNumber} de ${p.totalInstallments}`}
                        <span className="text-[10px] text-slate-400 block mt-0.5">Nº da parcela: {p.installmentNumber} de {p.totalInstallments}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                        {p.paymentMethod}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-xs">
                        <span className="font-extrabold text-slate-800">R$ {p.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        {p.status === PaymentStatus.PAGO && p.paidAmount ? (
                          <span className="text-[9px] text-emerald-500 block">Pago: R$ {p.paidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        ) : p.status === PaymentStatus.PARCIAL && p.paidAmount ? (
                          <div className="space-y-0.5">
                            <span className="text-[9px] text-sky-600 block">Pago: R$ {p.paidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <span className="text-[9px] text-amber-500 block">Resta: R$ {(p.amount - p.paidAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeColor}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {p.status !== PaymentStatus.PAGO && (
                            <button
                              onClick={() => openQuickPay(p)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg cursor-pointer flex items-center gap-1 shadow-xs"
                              title={p.status === PaymentStatus.PARCIAL ? "Receber Restante" : "Confirmar Recebimento"}
                            >
                              <Check className="w-3 h-3" /> {p.status === PaymentStatus.PARCIAL ? "Receber +" : "Receber"}
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600 cursor-pointer"
                            title="Editar Parcela"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {['SUPER_ADMIN', 'ADMIN'].includes(currentUser?.role) && (
                            <button
                              onClick={() => handleDeletePayment(p.id)}
                              className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Excluir Parcela"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK RECEIVE CONFIRMATION MODAL */}
      {isConfirmModalOpen && confirmingPayment && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 font-sans flex items-center gap-1.5">
                <DollarSign className="w-5 h-5 text-emerald-500" /> Confirmar Recebimento
              </h3>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickPaySubmit} className="space-y-4 font-sans">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Valor Total da Parcela:</span>
                  <span className="font-bold text-slate-800">R$ {confirmingPayment.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                {confirmingPayment.paidAmount ? (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Já Recebido anteriormente:</span>
                    <span className="font-semibold text-sky-600">R$ {confirmingPayment.paidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-xs border-t border-slate-200/60 pt-1.5">
                  <span className="text-slate-600 font-medium">Saldo Restante a Receber:</span>
                  <span className="font-extrabold text-indigo-600 font-mono">
                    R$ {(confirmingPayment.amount - (confirmingPayment.paidAmount || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Valor Pago Agora (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={quickPaidAmount || ''}
                    onChange={(e) => setQuickPaidAmount(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Data de Recebimento *</label>
                  <input
                    type="date"
                    required
                    value={quickPaymentDate}
                    onChange={(e) => setQuickPaymentDate(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Forma de Pagamento *</label>
                <select
                  value={quickPaymentMethod}
                  onChange={(e: any) => setQuickPaymentMethod(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-sans"
                >
                  <option value="Pix">Pix</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Boleto">Boleto</option>
                  <option value="Transferência Bancária">Transferência Bancária</option>
                </select>
              </div>

              {quickPaidAmount < parseFloat((confirmingPayment.amount - (confirmingPayment.paidAmount || 0)).toFixed(2)) ? (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[10px] text-amber-700 space-y-1">
                  <p className="font-bold">Aviso de Recebimento Parcial:</p>
                  <p>
                    O valor pago (R$ {quickPaidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) é menor que o saldo restante. 
                    A parcela mudará para o status <strong className="underline">Parcialmente pago</strong> e restará um saldo de <strong>R$ {Math.max(0, (confirmingPayment.amount - (confirmingPayment.paidAmount || 0)) - quickPaidAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> a receber futuramente.
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl text-[10px] text-emerald-700 italic">
                  Este recebimento irá quitar integralmente o saldo restante desta parcela. O status será atualizado para <strong>Pago</strong>.
                </div>
              )}

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/50 text-[10px] text-slate-500 italic">
                Ao confirmar o recebimento, o cliente será notificado e uma confirmação automática por e-mail e WhatsApp simulado será disparada no sistema.
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer disabled:opacity-50 transition-colors ${
                    quickPaidAmount < parseFloat((confirmingPayment.amount - (confirmingPayment.paidAmount || 0)).toFixed(2))
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {submitting ? 'Confirmando...' : quickPaidAmount < parseFloat((confirmingPayment.amount - (confirmingPayment.paidAmount || 0)).toFixed(2)) ? 'Confirmar Recebimento Parcial' : 'Confirmar Quitação Total'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* COMPREHENSIVE EDIT INSTALLMENT MODAL */}
      {isEditModalOpen && editingPayment && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <h3 className="text-base font-bold text-slate-900 font-sans">
                Editar Detalhes de Parcela Financeira
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="m-6 bg-rose-50 border-l-4 border-rose-500 p-4 rounded-md">
                <p className="text-xs text-rose-700 font-medium">{errorMsg}</p>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="p-6 space-y-5 font-sans">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Valor Nominal (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount || ''}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Vencimento da Parcela *</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Forma de Pagamento *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e: any) => setPaymentMethod(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-sans"
                  >
                    <option value="Pix">Pix</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Transferência Bancária">Transferência Bancária</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Status Financeiro *</label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-sans"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Parcialmente pago">Parcialmente pago</option>
                    <option value="Pago">Pago</option>
                    <option value="Vencido">Vencido</option>
                  </select>
                </div>
              </div>

              {(status === PaymentStatus.PAGO || status === PaymentStatus.PARCIAL) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Data de Liquidação *</label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Valor Efetivo Pago (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={paidAmount || ''}
                      onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono font-bold"
                    />
                  </div>
                </motion.div>
              )}

              {/* Toggle button for advanced options */}
              {!showAdvancedPayments ? (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedPayments(true)}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer transition-all inline-flex items-center gap-1.5"
                  >
                    + Adicionar Multa, Juros ou Observações
                  </button>
                </div>
              ) : (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider font-sans">Opções de Juros, Descontos e Descrição</h4>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedPayments(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-semibold underline cursor-pointer"
                    >
                      Ocultar juros e multas
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600">Multa (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={penalty || ''}
                        onChange={(e) => setPenalty(parseFloat(e.target.value) || 0)}
                        className="mt-1 block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600">Juros Mora (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={interest || ''}
                        onChange={(e) => setInterest(parseFloat(e.target.value) || 0)}
                        className="mt-1 block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600">Desconto Extra (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={discount || ''}
                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        className="mt-1 block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Observações / Descrição da Parcela</label>
                    <input
                      type="text"
                      value={observation}
                      onChange={(e) => setObservation(e.target.value)}
                      placeholder="Ex: Parcela complementar de faturamento"
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

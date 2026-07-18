/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Service, Client, ServiceStatus, PaymentMethod } from '../types';
import { api } from '../lib/api';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  User, 
  DollarSign, 
  Clock, 
  Trash2, 
  Edit3, 
  QrCode, 
  Percent, 
  Calendar, 
  X, 
  PlusCircle, 
  FileCheck,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { motion } from 'motion/react';

interface ServicesProps {
  services: Service[];
  clients: Client[];
  onRefresh: () => void;
  currentUser: any;
  onNavigate: (tab: string) => void;
}

const CATEGORIES = ['Consultoria', 'Suporte Técnico', 'Desenvolvimento Web', 'Design Gráfico', 'Manutenção', 'Instalação', 'Treinamento', 'Outros'];

export default function Services({ services, clients, onRefresh, currentUser, onNavigate }: ServicesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedStatus, setSelectedStatus] = useState('Todos');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Form fields
  const [clientId, setClientId] = useState('');
  const [category, setCategory] = useState('Consultoria');
  const [serviceType, setServiceType] = useState('');
  const [description, setDescription] = useState('');
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDate, setExpectedDate] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [serviceValue, setServiceValue] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [additions, setAdditions] = useState<number>(0);
  const [status, setStatus] = useState<ServiceStatus>(ServiceStatus.AGUARDANDO);

  // Installment Generation Options (for creation time)
  const [generateFinancialPlan, setGenerateFinancialPlan] = useState(true);
  const [planType, setPlanType] = useState<'vista' | 'parcelado' | 'entrada_parcelado'>('vista');
  const [numberOfInstallments, setNumberOfInstallments] = useState(3);
  const [entranceValue, setEntranceValue] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [firstDueDate, setFirstDueDate] = useState('');

  // Receipt Generation Modal
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptService, setReceiptService] = useState<Service | null>(null);
  const [receiptType, setReceiptType] = useState<'receipt' | 'contract'>('receipt');
  const [receiptContent, setReceiptContent] = useState('');
  const [generatedReceipt, setGeneratedReceipt] = useState<any | null>(null);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showAdvancedServices, setShowAdvancedServices] = useState(false);

  // Calc final value automatically
  const finalValue = Math.max(0, parseFloat((serviceValue - discount + additions).toFixed(2)));

  // Sync firstDueDate on modal open or when request date changes
  useEffect(() => {
    if (!firstDueDate) {
      setFirstDueDate(requestDate);
    }
  }, [requestDate]);

  const openCreateModal = () => {
    setSelectedService(null);
    setClientId(clients[0]?.id || '');
    setCategory('Consultoria');
    setServiceType('');
    setDescription('');
    setRequestDate(new Date().toISOString().split('T')[0]);
    setExpectedDate('');
    setCompletionDate('');
    setServiceValue(0);
    setDiscount(0);
    setAdditions(0);
    setStatus(ServiceStatus.AGUARDANDO);
    setGenerateFinancialPlan(true);
    setPlanType('vista');
    setNumberOfInstallments(3);
    setEntranceValue(0);
    setPaymentMethod(PaymentMethod.PIX);
    setFirstDueDate(new Date().toISOString().split('T')[0]);
    setShowAdvancedServices(false);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setSelectedService(service);
    setClientId(service.clientId || '');
    setCategory(service.category || 'Consultoria');
    setServiceType(service.serviceType || '');
    setDescription(service.description || '');
    setRequestDate(service.requestDate || '');
    setExpectedDate(service.expectedDate || '');
    setCompletionDate(service.completionDate || '');
    setServiceValue(service.serviceValue || 0);
    setDiscount(service.discount || 0);
    setAdditions(service.additions || 0);
    setStatus(service.status || ServiceStatus.AGUARDANDO);
    setGenerateFinancialPlan(false); // don't regenerate schedule on edit
    setShowAdvancedServices(false);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !serviceType || serviceValue <= 0) {
      setErrorMsg('Preencha os dados do cliente, tipo de serviço e um valor válido.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const payload = {
      clientId,
      category,
      serviceType,
      description,
      requestDate,
      expectedDate,
      completionDate: status === ServiceStatus.FINALIZADO ? (completionDate || new Date().toISOString().split('T')[0]) : completionDate,
      serviceValue,
      discount,
      additions,
      finalValue,
      status
    };

    try {
      if (selectedService) {
        await api.updateService(selectedService.id, payload);
      } else {
        const createdSrv = await api.createService(payload);

        // Automatically trigger Payment Schedule Generation if checked
        if (generateFinancialPlan) {
          await api.generateInstallments({
            serviceId: createdSrv.id,
            clientId,
            totalValue: finalValue,
            planType,
            numberOfInstallments,
            firstDueDate,
            paymentMethod,
            entranceValue,
            observation: `Cronograma gerado via O.S. ${createdSrv.serviceNumber}`
          });
        }
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao registrar serviço.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!window.confirm('Excluir este serviço removerá também todas as parcelas e recebíveis vinculados a ele. Continuar?')) return;
    try {
      await api.deleteService(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir serviço.');
    }
  };

  // Generate Receipt/Contract logic
  const handleOpenReceiptModal = (srv: Service, type: 'receipt' | 'contract') => {
    const client = clients.find(c => c.id === srv.clientId);
    setReceiptService(srv);
    setReceiptType(type);
    setGeneratedReceipt(null);

    let defaultContent = '';
    if (type === 'receipt') {
      defaultContent = `DECLARAMOS para os devidos fins de direito que recebemos de ${client?.name || '(Cliente)'}, inscrito no CPF/CNPJ sob o nº ${client?.cpfCnpj || '(CPF/CNPJ)'}, a importância de R$ ${srv.finalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} referente à prestação de serviços de "${srv.serviceType}". Por ser verdade, firmamos o presente.`;
    } else {
      defaultContent = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS que entre si celebram de um lado como Contratada a Empresa Demo Ltda e de outro como Contratante ${client?.name || '(Cliente)'}. 
Cláusula 1ª: O objeto do presente contrato é o desenvolvimento/execução de: ${srv.serviceType}.
Cláusula 2ª: Pelo serviço ora contratado, o Contratante pagará o valor de R$ ${srv.finalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, conforme plano financeiro acordado.`;
    }

    setReceiptContent(defaultContent);
    setReceiptModalOpen(true);
  };

  const handleGenerateDocument = async () => {
    if (!receiptService) return;
    try {
      const doc = await api.generateReceipt({
        serviceId: receiptService.id,
        clientId: receiptService.clientId,
        type: receiptType,
        content: receiptContent
      });
      setGeneratedReceipt(doc);
    } catch (err) {
      console.error('Error generating document:', err);
    }
  };

  // Filter Services
  const filteredServices = services.filter(s => {
    const client = clients.find(c => c.id === s.clientId);
    const clientName = client ? client.name.toLowerCase() : '';
    const query = searchQuery.toLowerCase();

    const matchesSearch = 
      s.serviceNumber.toLowerCase().includes(query) ||
      s.serviceType.toLowerCase().includes(query) ||
      clientName.includes(query);

    const matchesCategory = selectedCategory === 'Todas' || s.category === selectedCategory;
    const matchesStatus = selectedStatus === 'Todos' || s.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full space-y-4 overflow-hidden">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight font-sans">Ordens de Serviço</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie solicitações, faturamento de projetos e gere contratos ou recibos com autenticação digital.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-md cursor-pointer transition-colors duration-150 self-start sm:self-auto font-sans"
        >
          <Plus className="w-4 h-4" /> Novo Serviço
        </button>
      </div>

      {/* Control Filter Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Pesquisar por número da O.S., tipo de serviço ou cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-800"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="block w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-700 bg-white"
            >
              <option value="Todas">Todas as Categorias</option>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="block w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-700 bg-white"
            >
              <option value="Todos">Todos os Status</option>
              <option value="Aguardando">Aguardando</option>
              <option value="Em andamento">Em andamento</option>
              <option value="Finalizado">Finalizado</option>
              <option value="Cancelado">Cancelado</option>
              <option value="Pago">Pago</option>
              <option value="Parcialmente pago">Parcialmente pago</option>
            </select>
          </div>
        </div>
      </div>

      {/* Services Table List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex-1 min-h-0 flex flex-col">
        <div className="overflow-y-auto overflow-x-hidden flex-1">
          <table className="min-w-full divide-y divide-slate-100 table-fixed">
            <colgroup>
              <col className="w-[12%]" />
              <col className="w-[20%]" />
              <col className="w-[30%]" />
              <col className="w-[18%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-50/50">
                <th scope="col" className="px-3 md:px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">O.S. / Nº</th>
                <th scope="col" className="px-3 md:px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Cliente</th>
                <th scope="col" className="px-3 md:px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Serviço / Descrição</th>
                <th scope="col" className="px-3 md:px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Solicitado / Previsto</th>
                <th scope="col" className="px-3 md:px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Valor Líquido</th>
                <th scope="col" className="px-3 md:px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Status</th>
                <th scope="col" className="px-3 md:px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 md:px-4 py-12 text-center text-xs text-slate-400">
                    Nenhum serviço encontrado com as configurações de filtros selecionadas.
                  </td>
                </tr>
              ) : (
                filteredServices.map((srv) => {
                  const client = clients.find(c => c.id === srv.clientId);
                  return (
                    <tr key={srv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <span className="text-xs font-bold text-indigo-600 font-mono block">{srv.serviceNumber}</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">{srv.category}</span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap overflow-hidden">
                        <span className="text-xs font-bold text-slate-800 block truncate max-w-[120px] lg:max-w-[160px]">{client ? client.name : 'Cliente Excluído'}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{client?.phone}</span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 overflow-hidden">
                        <span className="text-xs font-semibold text-slate-800 block truncate max-w-[180px] lg:max-w-[280px]">{srv.serviceType}</span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[180px] lg:max-w-[280px] mt-0.5">{srv.description || 'Sem descrição.'}</span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {new Date(srv.requestDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                            {srv.expectedDate && ` → ${new Date(srv.expectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap text-right font-mono">
                        <span className="text-xs font-extrabold text-slate-900 block">R$ {srv.finalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        {srv.discount > 0 && <span className="text-[9px] text-emerald-500 font-sans block">Desconto: R$ {srv.discount.toFixed(2)}</span>}
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          srv.status === ServiceStatus.PAGO ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          srv.status === ServiceStatus.EM_ANDAMENTO ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                          srv.status === ServiceStatus.CANCELADO ? 'bg-rose-50 text-rose-600 border-rose-100' :
                          'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          {srv.status}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Receipts buttons */}
                          <button
                            onClick={() => handleOpenReceiptModal(srv, 'receipt')}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-emerald-600 cursor-pointer"
                            title="Emitir Recibo Oficial"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenReceiptModal(srv, 'contract')}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-purple-600 cursor-pointer"
                            title="Gerar Contrato Simples"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(srv)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600 cursor-pointer"
                            title="Editar O.S."
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {['SUPER_ADMIN', 'ADMIN'].includes(currentUser?.role) && (
                            <button
                              onClick={() => handleDeleteService(srv.id)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Excluir O.S."
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* CREATE / EDIT SERVICES MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <h3 className="text-base font-bold text-slate-900 font-sans">
                {selectedService ? `Editar O.S. ${selectedService.serviceNumber}` : 'Registrar Nova Ordem de Serviço'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
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

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Informações Gerais */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-slate-100 pb-1.5 font-sans font-semibold">Geral</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Selecione o Cliente *</label>
                    <select
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-sans"
                    >
                      {clients.length === 0 ? (
                        <option value="">Nenhum cliente cadastrado</option>
                      ) : (
                        clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.cpfCnpj})</option>)
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Categoria do Serviço *</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-sans"
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700">Tipo / Título do Serviço *</label>
                    <input
                      type="text"
                      required
                      value={serviceType}
                      onChange={(e) => setServiceType(e.target.value)}
                      placeholder="Ex: Instalação de Servidores Linux na Nuvem"
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Datas, Status e Valor Principal */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Data de Solicitação *</label>
                    <input
                      type="date"
                      required
                      value={requestDate}
                      onChange={(e) => setRequestDate(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Status Geral *</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ServiceStatus)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-sans"
                    >
                      <option value="Aguardando">Aguardando</option>
                      <option value="Em andamento">Em andamento</option>
                      <option value="Finalizado">Finalizado</option>
                      <option value="Cancelado">Cancelado</option>
                      <option value="Pago">Pago</option>
                      <option value="Parcialmente pago">Parcialmente pago</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Valor do Serviço (R$) *</label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={serviceValue || ''}
                      onChange={(e) => setServiceValue(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono font-bold text-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* Advanced Services details toggle button */}
              {!showAdvancedServices ? (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedServices(true)}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer transition-all inline-flex items-center gap-1.5"
                  >
                    + Adicionar Prazos, Descontos e Descrição Detalhada
                  </button>
                </div>
              ) : (
                <div className="space-y-6 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider font-sans">Opções Avançadas de Prazo e Finanças</h4>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedServices(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-semibold underline cursor-pointer"
                    >
                      Ocultar opções avançadas
                    </button>
                  </div>

                  {/* Descrição Detalhada */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Descrição Detalhada</label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Escopo contratado, deliverables adicionais, prazos parciais..."
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Prazos Opcionais */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Previsão de Entrega</label>
                      <input
                        type="date"
                        value={expectedDate}
                        onChange={(e) => setExpectedDate(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Conclusão Real</label>
                      <input
                        type="date"
                        value={completionDate}
                        onChange={(e) => setCompletionDate(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Descontos / Acréscimos */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Desconto (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discount || ''}
                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Acréscimos (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={additions || ''}
                        onChange={(e) => setAdditions(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                      />
                    </div>
                    <div className="text-right flex flex-col justify-center">
                      <span className="text-[9px] text-slate-400 block font-bold uppercase">VALOR LÍQUIDO FINAL</span>
                      <span className="text-base font-extrabold text-indigo-600 font-mono">
                        R$ {finalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Automatic Financial Plan Section (Only on CREATE) */}
              {!selectedService && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="finPlan"
                      checked={generateFinancialPlan}
                      onChange={(e) => setGenerateFinancialPlan(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="finPlan" className="text-xs font-bold text-slate-800 cursor-pointer font-sans">
                      Gerar automaticamente o contas a receber (faturamento) deste serviço
                    </label>
                  </div>

                  {generateFinancialPlan && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-200/40 pt-3.5"
                    >
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Modalidade de Pagamento</label>
                        <select
                          value={planType}
                          onChange={(e: any) => setPlanType(e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                        >
                          <option value="vista">À Vista</option>
                          <option value="parcelado">Parcelado</option>
                          <option value="entrada_parcelado">Sinal + Parcelas</option>
                        </select>
                      </div>

                      {planType === 'parcelado' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Quantidade de Parcelas</label>
                          <input
                            type="number"
                            min="2"
                            max="36"
                            value={numberOfInstallments}
                            onChange={(e) => setNumberOfInstallments(parseInt(e.target.value) || 2)}
                            className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>
                      )}

                      {planType === 'entrada_parcelado' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Valor do Sinal / Entrada (R$)</label>
                            <input
                              type="number"
                              min="1"
                              step="0.01"
                              value={entranceValue || ''}
                              onChange={(e) => setEntranceValue(parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Qtd Parcelas Restantes</label>
                            <input
                              type="number"
                              min="1"
                              max="36"
                              value={numberOfInstallments}
                              onChange={(e) => setNumberOfInstallments(parseInt(e.target.value) || 1)}
                              className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Meio de Recebimento</label>
                        <select
                          value={paymentMethod}
                          onChange={(e: any) => setPaymentMethod(e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                        >
                          <option value="Pix">Pix</option>
                          <option value="Boleto">Boleto</option>
                          <option value="Cartão de Crédito">Cartão de Crédito</option>
                          <option value="Dinheiro">Dinheiro</option>
                          <option value="Transferência Bancária">Transferência Bancária</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Vencimento (1ª Parcela)</label>
                        <input
                          type="date"
                          value={firstDueDate}
                          onChange={(e) => setFirstDueDate(e.target.value)}
                          className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Botões Ação */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold text-white shadow-md disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {submitting ? 'Salvando...' : 'Salvar O.S.'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* DOCUMENT GENERATION MODAL */}
      {receiptModalOpen && receiptService && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-xl rounded-2xl shadow-2xl p-6 space-y-6"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 font-sans">
                {receiptType === 'receipt' ? 'Emissão de Recibo Autenticado' : 'Geração de Contrato de Serviço'}
              </h3>
              <button
                type="button"
                onClick={() => setReceiptModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!generatedReceipt ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 font-sans">Revise e edite o texto abaixo que constará no documento impresso oficial.</p>
                <div>
                  <textarea
                    rows={6}
                    value={receiptContent}
                    onChange={(e) => setReceiptContent(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-sans"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-3">
                  <button
                    onClick={() => setReceiptModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleGenerateDocument}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer flex items-center gap-1"
                  >
                    <QrCode className="w-4 h-4" /> Emitir com QR Code
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Print area simulation */}
                <div className="bg-slate-50 p-6 border border-slate-200 rounded-xl space-y-6 font-sans">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div>
                      <span className="text-xs font-bold text-slate-800 uppercase block">EMPRESA DEMO DE SERVIÇOS</span>
                      <span className="text-[10px] text-slate-400 font-mono block">CNPJ: 12.345.678/0001-99</span>
                    </div>
                    <div className="bg-white p-2 border border-slate-200 rounded-lg shrink-0 text-center">
                      <QrCode className="w-12 h-12 text-slate-800 mx-auto" />
                      <span className="text-[8px] text-slate-400 block mt-1">Validação Digital</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-700 leading-relaxed space-y-4">
                    <p className="whitespace-pre-line italic">"{generatedReceipt.content}"</p>
                    <div className="text-right text-[10px] text-slate-400">
                      Emitido em: {new Date(generatedReceipt.createdAt).toLocaleDateString('pt-BR')} • {new Date(generatedReceipt.createdAt).toLocaleTimeString('pt-BR')}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] font-mono text-slate-400">
                    <div>Hash de Segurança: {generatedReceipt.hash}</div>
                    <div className="text-slate-500">Documento Assinado Digitalmente</div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    Imprimir Documento
                  </button>
                  <button
                    onClick={() => setReceiptModalOpen(false)}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Client, Service, Attachment, PaymentMethod, ServiceStatus, PaymentStatus } from '../types';
import { api } from '../lib/api';
import { 
  Plus, 
  Search, 
  FileText, 
  Phone, 
  Mail, 
  MapPin, 
  Star, 
  Trash2, 
  Edit3, 
  Upload, 
  Paperclip, 
  UserPlus, 
  Calendar, 
  ChevronRight, 
  Clock, 
  CheckCircle, 
  X,
  FileSpreadsheet,
  Printer,
  MessageSquare,
  DollarSign,
  Check
} from 'lucide-react';
import { motion } from 'motion/react';

interface ClientsProps {
  clients: Client[];
  services: Service[];
  payments?: any[];
  company?: any;
  onRefresh: () => void;
  currentUser: any;
}

export default function Clients({ clients, services, payments = [], company, onRefresh, currentUser }: ClientsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [viewHistoryClient, setViewHistoryClient] = useState<Client | null>(null);
  const [viewPendingClient, setViewPendingClient] = useState<Client | null>(null);

  // Quick Receive Modal State inside Pending Drawer
  const [receiveItemModal, setReceiveItemModal] = useState<{
    type: 'payment' | 'service' | 'bulk';
    item?: any;
    clientId: string;
    title: string;
    defaultAmount: number;
  } | null>(null);

  const [receiveAmount, setReceiveAmount] = useState<number>(0);
  const [receiveMethod, setReceiveMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [receiveDate, setReceiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [receiveObs, setReceiveObs] = useState<string>('');
  const [receiveSubmitting, setReceiveSubmitting] = useState<boolean>(false);

  const handleConfirmReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveItemModal || receiveAmount <= 0) return;
    setReceiveSubmitting(true);

    try {
      if (receiveItemModal.type === 'payment') {
        const p = receiveItemModal.item;
        const previousPaid = p.paidAmount || 0;
        const newPaidAmount = previousPaid + receiveAmount;
        const isFull = newPaidAmount >= (p.amount || 0);

        await api.updatePayment(p.id, {
          paidAmount: newPaidAmount,
          status: isFull ? PaymentStatus.PAGO : PaymentStatus.PARCIAL,
          paymentDate: receiveDate,
          paymentMethod: receiveMethod,
          observation: receiveObs ? (p.observation ? `${p.observation} | ${receiveObs}` : receiveObs) : p.observation
        });

        // Check if all payments of related service are fully paid
        if (p.serviceId) {
          const servPayments = payments.filter(pm => pm.serviceId === p.serviceId);
          const otherUnpaid = servPayments.filter(pm => pm.id !== p.id && pm.status !== PaymentStatus.PAGO);
          if (isFull && otherUnpaid.length === 0) {
            await api.updateService(p.serviceId, {
              status: ServiceStatus.PAGO,
              completionDate: receiveDate
            });
          }
        }
      } else if (receiveItemModal.type === 'service') {
        const s = receiveItemModal.item;
        await api.updateService(s.id, {
          status: ServiceStatus.PAGO,
          completionDate: receiveDate
        });
      } else if (receiveItemModal.type === 'bulk') {
        await api.bulkReceivePayments({
          clientId: receiveItemModal.clientId,
          amount: receiveAmount,
          paymentDate: receiveDate,
          paymentMethod: receiveMethod
        });
      }

      setReceiveItemModal(null);
      setReceiveObs('');
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar recebimento.');
    } finally {
      setReceiveSubmitting(false);
    }
  };

  // Print formal debt statement (Extrato de Débito) for the client
  const handlePrintHistory = (client: Client) => {
    const clientServices = services.filter(s => s.clientId === client.id);
    // Open invoices: anything that isn't fully paid or cancelled
    const openInvoices = clientServices.filter(
      s => s.status !== 'Pago' && s.status !== 'Cancelado'
    );
    // Also check payments table for pending installments
    const openPayments = payments.filter(
      p => p.clientId === client.id && p.status !== 'Pago' && p.status !== 'Cancelado'
    );

    // Prefer payment records if they exist, otherwise fall back to services
    const usePayments = openPayments.length > 0;
    const totalDue = usePayments
      ? openPayments.reduce((sum, p) => sum + (p.amount || 0), 0)
      : openInvoices.reduce((sum, s) => sum + (s.finalValue || 0), 0);

    const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const companyName = company?.name || 'InforService';
    const companyCnpj = company?.cnpj || '';
    const companyPhone = company?.phone || '';
    const companyEmail = company?.email || '';
    const companyAddress = company?.address || '';

    const invoiceRows = usePayments
      ? openPayments.map((p, i) => {
          const relService = services.find(s => s.id === p.serviceId);
          const isOverdue = p.dueDate && new Date(p.dueDate + 'T23:59:59') < new Date();
          return `
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#4f46e5;font-family:monospace;font-weight:700">${relService?.serviceNumber || `FAT-${String(i + 1).padStart(3, '0')}`}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155">${relService?.serviceType || p.observation || 'Serviço'}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b">${p.installmentNumber ? `${p.installmentNumber}/${p.totalInstallments}` : '1/1'}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;color:${isOverdue ? '#dc2626' : '#64748b'};font-weight:${isOverdue ? '700' : '400'}">${p.dueDate ? new Date(p.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}${isOverdue ? ' ⚠' : ''}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:700;text-align:right;font-family:monospace;color:#1e293b">R$ ${(p.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          </tr>`;
        }).join('')
      : openInvoices.map(s => {
          const isOverdue = s.expectedDate && new Date(s.expectedDate + 'T23:59:59') < new Date();
          return `
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#4f46e5;font-family:monospace;font-weight:700">${s.serviceNumber || '-'}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155">${s.serviceType || '-'}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;color:#64748b">1/1</td>
            <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:11px;color:${isOverdue ? '#dc2626' : '#64748b'};font-weight:${isOverdue ? '700' : '400'}">${s.expectedDate ? new Date(s.expectedDate + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}${isOverdue ? ' ⚠' : ''}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:12px;font-weight:700;text-align:right;font-family:monospace;color:#1e293b">R$ ${(s.finalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
          </tr>`;
        }).join('');

    const hasItems = usePayments ? openPayments.length > 0 : openInvoices.length > 0;

    const html = `<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="UTF-8" />
<title>Extrato de Débito — ${client.name}</title>
<style>
  @page { margin: 20mm 18mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; font-size: 13px; line-height: 1.5; }

  /* Letterhead */
  .letterhead { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 3px solid #1e293b; margin-bottom: 28px; }
  .company-name { font-size: 22px; font-weight: 900; color: #1e293b; letter-spacing: -0.5px; }
  .company-details { font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.7; }
  .doc-info { text-align: right; }
  .doc-title { font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em; color: #dc2626; margin-bottom: 4px; }
  .doc-date { font-size: 11px; color: #64748b; }

  /* Client block */
  .client-block { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #1e293b; border-radius: 6px; padding: 16px 20px; margin-bottom: 24px; display: flex; justify-content: space-between; }
  .client-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #94a3b8; letter-spacing: 0.06em; margin-bottom: 6px; }
  .client-name { font-size: 18px; font-weight: 800; color: #1e293b; }
  .client-info { font-size: 11px; color: #64748b; margin-top: 3px; }
  .client-address { text-align: right; font-size: 11px; color: #64748b; line-height: 1.7; }

  /* Summary boxes */
  .summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 28px; }
  .summary-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; }
  .summary-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #94a3b8; letter-spacing: 0.06em; margin-bottom: 6px; }
  .summary-value { font-size: 15px; font-weight: 800; color: #1e293b; font-family: monospace; }
  .summary-box.highlight { background: #fef2f2; border-color: #fecaca; }
  .summary-box.highlight .summary-value { color: #dc2626; }

  /* Table */
  .section-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #1e293b; }
  thead th { color: #fff; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; padding: 10px 14px; text-align: left; }
  thead th:last-child { text-align: right; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .total-row td { background: #1e293b; color: #fff; font-weight: 800; font-size: 14px; padding: 12px 14px; }
  .total-row td:last-child { text-align: right; font-family: monospace; }

  /* Total due box */
  .total-due-box { background: #fef2f2; border: 2px solid #fca5a5; border-radius: 10px; padding: 20px 24px; margin-top: 24px; display: flex; justify-content: space-between; align-items: center; }
  .total-due-label { font-size: 13px; font-weight: 700; color: #7f1d1d; }
  .total-due-amount { font-size: 28px; font-weight: 900; color: #dc2626; font-family: monospace; }

  /* Payment info */
  .payment-section { margin-top: 24px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; }
  .payment-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; margin-bottom: 10px; }
  .payment-methods { font-size: 12px; color: #64748b; }

  /* Footer */
  .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 14px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
  .footer-note { font-size: 11px; color: #64748b; margin-top: 8px; text-align: center; font-style: italic; }
</style></head><body>

  <!-- Letterhead -->
  <div class="letterhead">
    <div>
      <div class="company-name">${companyName}</div>
      <div class="company-details">
        ${companyCnpj ? `CNPJ: ${companyCnpj}<br>` : ''}
        ${companyAddress ? `${companyAddress}<br>` : ''}
        ${companyPhone ? `Tel: ${companyPhone}` : ''}${companyEmail ? ` &bull; ${companyEmail}` : ''}
      </div>
    </div>
    <div class="doc-info">
      <div class="doc-title">Extrato de Débito</div>
      <div class="doc-date">Emitido em ${today}</div>
    </div>
  </div>

  <!-- Client info -->
  <div class="client-block">
    <div>
      <div class="client-label">Devedor / Cliente</div>
      <div class="client-name">${client.name}</div>
      <div class="client-info">${client.cpfCnpj ? `CPF/CNPJ: ${client.cpfCnpj}` : ''}${client.rg ? ` &bull; RG: ${client.rg}` : ''}</div>
      ${client.phone ? `<div class="client-info">Tel: ${client.phone}${client.whatsapp ? ` &bull; WhatsApp: ${client.whatsapp}` : ''}</div>` : ''}
      ${client.email ? `<div class="client-info">${client.email}</div>` : ''}
    </div>
    <div class="client-address">
      ${client.address ? `${client.address}${client.number ? ', ' + client.number : ''}<br>` : ''}
      ${client.bairro ? `${client.bairro}<br>` : ''}
      ${client.city ? `${client.city}${client.state ? ' - ' + client.state : ''}` : ''}
    </div>
  </div>

  <!-- Summary -->
  <div class="summary">
    <div class="summary-box">
      <div class="summary-label">Total de OS / Projetos</div>
      <div class="summary-value">${clientServices.length}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Faturas em Aberto</div>
      <div class="summary-value">${usePayments ? openPayments.length : openInvoices.length}</div>
    </div>
    <div class="summary-box highlight">
      <div class="summary-label">Total a Pagar</div>
      <div class="summary-value">R$ ${totalDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
    </div>
  </div>

  <!-- Invoice table -->
  <div class="section-title">Faturas em Aberto</div>
  ${!hasItems
    ? '<p style="color:#94a3b8;font-size:13px;text-align:center;padding:24px;border:1px dashed #e2e8f0;border-radius:8px">✓ Nenhuma fatura em aberto para este cliente.</p>'
    : `<table>
      <thead><tr>
        <th>Nº OS / Fatura</th>
        <th>Descrição do Serviço</th>
        <th>Parcela</th>
        <th>Vencimento</th>
        <th style="text-align:right">Valor (R$)</th>
      </tr></thead>
      <tbody>${invoiceRows}</tbody>
      <tfoot><tr class="total-row">
        <td colspan="4"><strong>TOTAL EM ABERTO</strong></td>
        <td>R$ ${totalDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      </tr></tfoot>
    </table>

    <div class="total-due-box">
      <div>
        <div class="total-due-label">Valor Total a Pagar</div>
        <div style="font-size:11px;color:#991b1b;margin-top:2px">${usePayments ? openPayments.length : openInvoices.length} fatura(s) em aberto</div>
      </div>
      <div class="total-due-amount">R$ ${totalDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
    </div>`
  }

  <!-- Payment instructions -->
  ${company?.paymentMethods?.length > 0 ? `
  <div class="payment-section">
    <div class="payment-title">💳 Formas de Pagamento Aceitas</div>
    <div class="payment-methods">${company.paymentMethods.join(' &bull; ')}</div>
  </div>` : ''}

  <div class="footer-note">Em caso de dúvidas, entre em contato: ${companyPhone || companyEmail || companyName}</div>

  <div class="footer">
    <span>${companyName} &mdash; Extrato de Débito</span>
    <span>Emitido em ${today}</span>
  </div>

</body></html>`;

    const win = window.open('', '_blank', 'width=960,height=800');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.onload = () => { win.print(); };
    }
  };

  // Form states
  const [name, setName] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [rg, setRg] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [cep, setCep] = useState('');
  const [address, setAddress] = useState('');
  const [number, setNumber] = useState('');
  const [bairro, setBairro] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [complement, setComplement] = useState('');
  const [notes, setNotes] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Loading & error
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle open modal for create
  const openCreateModal = () => {
    setSelectedClient(null);
    setName('');
    setCpfCnpj('');
    setRg('');
    setBirthDate('');
    setPhone('');
    setWhatsapp('');
    setEmail('');
    setCep('');
    setAddress('');
    setNumber('');
    setBairro('');
    setCity('');
    setState('');
    setComplement('');
    setNotes('');
    setIsFavorite(false);
    setAttachments([]);
    setShowAdvanced(false);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  // Handle open modal for edit
  const openEditModal = (client: Client) => {
    setSelectedClient(client);
    setName(client.name || '');
    setCpfCnpj(client.cpfCnpj || '');
    setRg(client.rg || '');
    setBirthDate(client.birthDate || '');
    setPhone(client.phone || '');
    setWhatsapp(client.whatsapp || '');
    setEmail(client.email || '');
    setCep(client.cep || '');
    setAddress(client.address || '');
    setNumber(client.number || '');
    setBairro(client.bairro || '');
    setCity(client.city || '');
    setState(client.state || '');
    setComplement(client.complement || '');
    setNotes(client.notes || '');
    setIsFavorite(client.isFavorite || false);
    setAttachments(client.attachments || []);
    setShowAdvanced(false);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  // File upload simulation (using base64)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'document' | 'contract' | 'photo') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;
      const newAttachment: Attachment = {
        id: 'att-' + Math.random().toString(36).substring(2, 9),
        name: file.name,
        type,
        url: base64Url,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        uploadedAt: new Date().toISOString()
      };
      setAttachments([...attachments, newAttachment]);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(attachments.filter(att => att.id !== id));
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setErrorMsg('Nome é campo obrigatório.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const payload = {
      name,
      cpfCnpj,
      rg,
      birthDate,
      phone,
      whatsapp,
      email,
      cep,
      address,
      number,
      bairro,
      city,
      state,
      complement,
      notes,
      attachments,
      isFavorite
    };

    try {
      if (selectedClient) {
        await api.updateClient(selectedClient.id, payload);
      } else {
        await api.createClient(payload);
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar cliente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle favorite directly
  const handleToggleFavorite = async (client: Client) => {
    try {
      await api.updateClient(client.id, { isFavorite: !client.isFavorite });
      onRefresh();
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  // Delete client (Super Admin and Admin ONLY)
  const handleDeleteClient = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja excluir este cliente definitivamente?')) return;
    try {
      await api.deleteClient(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir cliente.');
    }
  };

  // CEP Auto-Fill helper
  const handleCepLookup = async () => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setAddress(data.logradouro || '');
        setBairro(data.bairro || '');
        setCity(data.localidade || '');
        setState(data.uf || '');
      }
    } catch (err) {
      console.error('Error fetching CEP details:', err);
    }
  };

  // Filter clients
  const filteredClients = clients.filter(c => {
    const query = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      c.cpfCnpj.includes(query) ||
      c.phone.includes(query) ||
      c.email.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 font-sans tracking-tight">Clientes</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie a carteira de clientes, visualize anexos e histórico financeiro.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 shadow-md cursor-pointer transition-colors duration-150 self-start sm:self-auto font-sans"
        >
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-3.5 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Pesquisar por nome, CPF/CNPJ ou telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-800"
          />
        </div>
        <div className="text-xs text-slate-400 font-semibold font-sans">
          Mostrando {filteredClients.length} de {clients.length} clientes
        </div>
      </div>

      {/* Client Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredClients.length === 0 ? (
          <div className="md:col-span-2 lg:col-span-3 text-center bg-white p-12 rounded-2xl border border-slate-100 shadow-sm">
            <UserPlus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 font-sans">Nenhum cliente cadastrado</h3>
            <p className="text-xs text-slate-400 mt-1">Clique no botão "Novo Cliente" para criar o primeiro registro.</p>
          </div>
        ) : (
          filteredClients.map(client => {
            const clientServices = services.filter(s => s.clientId === client.id);
            const clientPayments = payments.filter(p => p.clientId === client.id);

            const openPayments = clientPayments.filter(p => p.status !== 'Pago' && p.status !== 'Cancelado');
            const todayStr = new Date().toISOString().split('T')[0];
            const overduePayments = openPayments.filter(p => p.dueDate && p.dueDate < todayStr);

            let openDebt = 0;
            let openCount = 0;
            let hasOverdue = false;

            if (clientPayments.length > 0) {
              openDebt = openPayments.reduce((sum, p) => {
                const due = (p.amount || 0) - (p.paidAmount || 0);
                return sum + Math.max(0, due);
              }, 0);
              openCount = openPayments.length;
              hasOverdue = overduePayments.length > 0;
            } else {
              const openServices = clientServices.filter(s => s.status !== 'Pago' && s.status !== 'Cancelado');
              openDebt = openServices.reduce((sum, s) => sum + (s.finalValue || 0), 0);
              openCount = openServices.length;
              hasOverdue = openServices.some(s => s.expectedDate && s.expectedDate < todayStr);
            }

            return (
              <motion.div
                key={client.id}
                whileHover={{ y: -3 }}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Top Bar: Name & Actions */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 truncate max-w-[190px] font-sans flex items-center gap-1.5">
                        {client.name}
                        {client.isFavorite && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />}
                      </h3>
                      {client.cpfCnpj ? (
                        <span className="text-[10px] text-slate-400 block font-mono mt-0.5">CPF/CNPJ: {client.cpfCnpj}</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 block font-mono mt-0.5">Sem documento</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleFavorite(client)}
                        className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-amber-500 rounded-lg cursor-pointer transition-colors"
                        title={client.isFavorite ? "Remover dos favoritos" : "Marcar como favorito"}
                      >
                        <Star className={`w-4 h-4 ${client.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                      <button
                        onClick={() => openEditModal(client)}
                        className="p-1.5 hover:bg-slate-50 text-slate-500 hover:text-indigo-600 rounded-lg cursor-pointer transition-colors"
                        title="Editar cliente"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {['SUPER_ADMIN', 'ADMIN'].includes(currentUser?.role) && (
                        <button
                          onClick={() => handleDeleteClient(client.id)}
                          className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                          title="Excluir cliente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Highlighted Balance Box: Outstanding Debt */}
                  <div className={`mt-3.5 p-3 rounded-xl border transition-all ${
                    openDebt > 0 && hasOverdue
                      ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                      : openDebt > 0
                      ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                      : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider block font-sans opacity-80">
                        {openDebt > 0 && hasOverdue ? 'Débito Vencido' : openDebt > 0 ? 'Saldo em Aberto' : 'Status Financeiro'}
                      </span>
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        openDebt > 0 && hasOverdue
                          ? 'bg-rose-600 text-white shadow-xs'
                          : openDebt > 0
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-emerald-600 text-white shadow-xs'
                      }`}>
                        {openDebt > 0 && hasOverdue ? 'Em Débito' : openDebt > 0 ? 'Pendente' : 'Quitado'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-lg font-black font-mono tracking-tight">
                        R$ {openDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] font-semibold opacity-75">
                        {openDebt > 0 ? `${openCount} fatura(s) em aberto` : 'Sem débitos pendentes'}
                      </span>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="mt-3.5 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{client.phone || '(Sem telefone)'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{client.email || '(Sem e-mail)'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{client.city ? `${client.city}${client.state ? ' - ' + client.state : ''}` : '(Sem endereço)'}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Actions & Summary */}
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-1.5">
                  <button
                    onClick={() => setViewHistoryClient(client)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer flex items-center gap-0.5 hover:underline shrink-0"
                    title="Ver histórico completo de serviços"
                  >
                    Ver Histórico <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Button to view ONLY pending/unpaid invoices */}
                  <button
                    onClick={() => setViewPendingClient(client)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer border shadow-2xs ${
                      openDebt > 0 && hasOverdue
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200/80'
                        : openDebt > 0
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200/80'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                    title="Visualizar somente faturas pendentes (não pagas)"
                  >
                    <Clock className={`w-3.5 h-3.5 ${
                      openDebt > 0 && hasOverdue ? 'text-rose-600' : openDebt > 0 ? 'text-amber-600' : 'text-slate-400'
                    }`} />
                    <span className="whitespace-nowrap">Ver Pendentes</span>
                    {openCount > 0 && (
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                        openDebt > 0 && hasOverdue ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                      }`}>
                        {openCount}
                      </span>
                    )}
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handlePrintHistory(client)}
                      className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                      title="Imprimir Extrato de Débito"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    {client.attachments && client.attachments.length > 0 && (
                      <span className="flex items-center gap-0.5 bg-slate-50 border border-slate-200/60 text-slate-500 px-1.5 py-0.5 rounded-md text-[10px]">
                        <Paperclip className="w-3 h-3 text-slate-400" />
                        {client.attachments.length}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* VIEW PENDING INVOICES DRAWER / MODAL */}
      {viewPendingClient && (() => {
        const clientServices = services.filter(s => s.clientId === viewPendingClient.id);
        const clientPayments = payments.filter(p => p.clientId === viewPendingClient.id);

        const openPayments = clientPayments.filter(p => p.status !== 'Pago' && p.status !== 'Cancelado');
        const openServices = clientServices.filter(s => s.status !== 'Pago' && s.status !== 'Cancelado');

        const todayStr = new Date().toISOString().split('T')[0];
        const usePayments = clientPayments.length > 0;

        let totalDebt = 0;
        let pendingCount = 0;
        let hasOverdue = false;

        if (usePayments) {
          totalDebt = openPayments.reduce((sum, p) => {
            const due = (p.amount || 0) - (p.paidAmount || 0);
            return sum + Math.max(0, due);
          }, 0);
          pendingCount = openPayments.length;
          hasOverdue = openPayments.some(p => p.dueDate && p.dueDate < todayStr);
        } else {
          totalDebt = openServices.reduce((sum, s) => sum + (s.finalValue || 0), 0);
          pendingCount = openServices.length;
          hasOverdue = openServices.some(s => s.expectedDate && s.expectedDate < todayStr);
        }

        const phoneClean = (viewPendingClient.whatsapp || viewPendingClient.phone || '').replace(/\D/g, '');

        const handleSendWhatsapp = () => {
          if (!phoneClean) return;
          const msg = `Olá ${viewPendingClient.name}! Consta em nosso sistema ${pendingCount} fatura(s) pendente(s) no valor total de R$ ${totalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.\n\nQualquer dúvida, estamos à disposição!`;
          window.open(`https://wa.me/55${phoneClean}?text=${encodeURIComponent(msg)}`, '_blank');
        };

        return (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="bg-white w-full max-w-lg h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between space-y-6"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2.5 py-0.5 rounded-full tracking-wider inline-block mb-1 font-sans">
                      Faturas Não Pagas / Pendentes
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 font-sans">{viewPendingClient.name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handlePrintHistory(viewPendingClient)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-semibold cursor-pointer transition-colors border border-amber-200/60"
                      title="Imprimir Extrato de Débito"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-600" /> Extrato
                    </button>
                    <button
                      onClick={() => setViewPendingClient(null)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer text-slate-500 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Summary Banner */}
                <div className={`rounded-2xl p-4 text-white shadow-md mt-5 flex items-center justify-between ${
                  hasOverdue
                    ? 'bg-gradient-to-r from-rose-600 to-red-700'
                    : totalDebt > 0
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600'
                }`}>
                  <div>
                    <span className="text-xs opacity-90 block font-medium">Total em Aberto / Não Pago</span>
                    <span className="text-2xl font-black font-mono">
                      R$ {totalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold font-mono">
                      {pendingCount} fatura(s)
                    </span>
                  </div>
                </div>

                {/* WhatsApp & Bulk Receive Quick Actions */}
                {pendingCount > 0 && (
                  <div className="mt-3 space-y-2">
                    <button
                      onClick={() => {
                        setReceiveItemModal({
                          type: 'bulk',
                          clientId: viewPendingClient.id,
                          title: `Dar Baixa Geral — ${viewPendingClient.name}`,
                          defaultAmount: totalDebt
                        });
                        setReceiveAmount(totalDebt);
                        setReceiveMethod(PaymentMethod.PIX);
                        setReceiveDate(todayStr);
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
                    >
                      <DollarSign className="w-4 h-4 text-emerald-200" /> Receber Saldo Total (Quitar TUDO — R$ {totalDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                    </button>

                    {phoneClean && (
                      <button
                        onClick={handleSendWhatsapp}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors border border-slate-200"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> Enviar Cobrança / Lembrete via WhatsApp
                      </button>
                    )}
                  </div>
                )}

                {/* Pending Invoices / Payments List */}
                <div className="mt-6">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    Faturas e Parcelas Pendentes
                  </h4>

                  {usePayments ? (
                    openPayments.length === 0 ? (
                      <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100">
                        <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-800">Nenhuma fatura pendente!</p>
                        <p className="text-xs text-slate-400 mt-1">Este cliente está em dia com todos os pagamentos.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {openPayments.map((p, i) => {
                          const relService = services.find(s => s.id === p.serviceId);
                          const isOverdue = p.dueDate && p.dueDate < todayStr;
                          const dueVal = (p.amount || 0) - (p.paidAmount || 0);

                          return (
                            <div
                              key={p.id || i}
                              className={`p-4 rounded-xl border transition-all ${
                                isOverdue
                                  ? 'bg-rose-50/60 border-rose-200'
                                  : 'bg-amber-50/40 border-amber-200'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="text-[10px] font-bold text-indigo-600 font-mono block">
                                    {relService?.serviceNumber || `FAT-${String(i + 1).padStart(3, '0')}`}
                                  </span>
                                  <h5 className="text-xs font-bold text-slate-800 mt-0.5">
                                    {relService?.serviceType || p.observation || 'Parcela de Serviço'}
                                  </h5>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    Parcela: <span className="font-semibold">{p.installmentNumber ? `${p.installmentNumber}/${p.totalInstallments}` : '1/1'}</span>
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-extrabold text-slate-900 font-mono block">
                                    R$ {dueVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold mt-1 uppercase ${
                                    isOverdue
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-amber-600 text-white'
                                  }`}>
                                    {isOverdue ? 'Vencida' : 'Pendente'}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
                                <span>
                                  Vencimento: <strong className={isOverdue ? 'text-rose-600 font-bold' : ''}>
                                    {p.dueDate ? new Date(p.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data'}
                                  </strong>
                                </span>
                                <button
                                  onClick={() => {
                                    setReceiveItemModal({
                                      type: 'payment',
                                      item: p,
                                      clientId: p.clientId,
                                      title: relService?.serviceType || p.observation || 'Parcela de Serviço',
                                      defaultAmount: dueVal
                                    });
                                    setReceiveAmount(dueVal);
                                    setReceiveMethod(PaymentMethod.PIX);
                                    setReceiveDate(todayStr);
                                  }}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                                  title="Receber este pagamento"
                                >
                                  <DollarSign className="w-3.5 h-3.5" /> Receber Pagamento
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    // Fallback to open services if no payment records exist
                    openServices.length === 0 ? (
                      <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100">
                        <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-800">Nenhuma fatura pendente!</p>
                        <p className="text-xs text-slate-400 mt-1">Este cliente não possui serviços em aberto.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {openServices.map(s => {
                          const isOverdue = s.expectedDate && s.expectedDate < todayStr;
                          return (
                            <div
                              key={s.id}
                              className={`p-4 rounded-xl border transition-all ${
                                isOverdue
                                  ? 'bg-rose-50/60 border-rose-200'
                                  : 'bg-amber-50/40 border-amber-200'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="text-[10px] font-bold text-indigo-600 font-mono block">
                                    {s.serviceNumber}
                                  </span>
                                  <h5 className="text-xs font-bold text-slate-800 mt-0.5">
                                    {s.serviceType}
                                  </h5>
                                  <p className="text-[11px] text-slate-500 mt-0.5">
                                    {s.category}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-extrabold text-slate-900 font-mono block">
                                    R$ {s.finalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold mt-1 uppercase ${
                                    isOverdue
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-amber-600 text-white'
                                  }`}>
                                    {isOverdue ? 'Vencida' : s.status}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
                                <span>
                                  Previsão: <strong className={isOverdue ? 'text-rose-600 font-bold' : ''}>
                                    {s.expectedDate ? new Date(s.expectedDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data'}
                                  </strong>
                                </span>
                                <button
                                  onClick={() => {
                                    setReceiveItemModal({
                                      type: 'service',
                                      item: s,
                                      clientId: s.clientId,
                                      title: s.serviceType || 'Serviço',
                                      defaultAmount: s.finalValue
                                    });
                                    setReceiveAmount(s.finalValue);
                                    setReceiveMethod(PaymentMethod.PIX);
                                    setReceiveDate(todayStr);
                                  }}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                                  title="Receber este pagamento"
                                >
                                  <DollarSign className="w-3.5 h-3.5" /> Receber Pagamento
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Bottom Drawer Actions */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handlePrintHistory(viewPendingClient)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-semibold font-sans cursor-pointer flex items-center justify-center gap-2 transition-colors shadow-xs"
                >
                  <Printer className="w-4 h-4" /> Imprimir Extrato Completo de Débito
                </button>
                <button
                  onClick={() => setViewPendingClient(null)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-semibold font-sans cursor-pointer transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* QUICK RECEIVE PAYMENT MODAL */}
      {receiveItemModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full font-sans">
                  Dar Baixa em Pagamento
                </span>
                <h3 className="text-base font-bold text-slate-900 font-sans mt-1">
                  {receiveItemModal.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReceiveItemModal(null)}
                className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReceive} className="space-y-4 font-sans">
              <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200/80">
                <span className="text-xs text-emerald-800 font-medium block">Valor Pendente a Receber:</span>
                <span className="text-2xl font-black text-emerald-900 font-mono">
                  R$ {receiveItemModal.defaultAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Valor Sendo Pago Agora (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  max={receiveItemModal.defaultAmount}
                  value={receiveAmount || ''}
                  onChange={(e) => setReceiveAmount(parseFloat(e.target.value) || 0)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Forma de Pagamento *</label>
                  <select
                    value={receiveMethod}
                    onChange={(e: any) => setReceiveMethod(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-sans"
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
                  <label className="block text-xs font-semibold text-slate-700">Data do Pagamento *</label>
                  <input
                    type="date"
                    required
                    value={receiveDate}
                    onChange={(e) => setReceiveDate(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Observação / Comprovante (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Pago via Chave Pix CPF"
                  value={receiveObs}
                  onChange={(e) => setReceiveObs(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-sans"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={receiveSubmitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> {receiveSubmitting ? 'Confirmando...' : 'Confirmar Recebimento'}
                </button>
                <button
                  type="button"
                  onClick={() => setReceiveItemModal(null)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* VIEW HISTORY DRAWER / MODAL */}
      {viewHistoryClient && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            className="bg-white w-full max-w-lg h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between space-y-6"
          >
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest block font-sans">Histórico do Cliente</span>
                  <h3 className="text-lg font-bold text-slate-900 font-sans">{viewHistoryClient.name}</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handlePrintHistory(viewHistoryClient)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    title="Imprimir histórico de pendências"
                  >
                    <Printer className="w-3.5 h-3.5" /> Imprimir
                  </button>
                  <button
                    onClick={() => setViewHistoryClient(null)}
                    className="p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-slate-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400 block font-medium">Total de Serviços</span>
                  <span className="text-xl font-extrabold text-slate-800 font-mono">
                    {services.filter(s => s.clientId === viewHistoryClient.id).length}
                  </span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
                  <span className="text-[10px] text-slate-400 block font-medium">Valor Consolidado</span>
                  <span className="text-xl font-extrabold text-slate-800 font-mono">
                    R$ {services.filter(s => s.clientId === viewHistoryClient.id).reduce((sum, s) => sum + s.finalValue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Service Logs */}
              <div className="mt-8">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">Ordens de Serviço e Projetos</h4>
                <div className="space-y-3">
                  {services.filter(s => s.clientId === viewHistoryClient.id).length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">Nenhum serviço registrado para este cliente.</p>
                  ) : (
                    services
                      .filter(s => s.clientId === viewHistoryClient.id)
                      .map(s => (
                        <div key={s.id} className="border border-slate-100 p-3.5 rounded-xl flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                          <div>
                            <span className="text-[10px] font-bold text-indigo-600 block font-mono">{s.serviceNumber}</span>
                            <span className="text-xs font-semibold text-slate-800 block">{s.serviceType}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{s.category} • Solicitado em {new Date(s.requestDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-slate-800 font-mono block">R$ {s.finalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold mt-1 border ${
                              s.status === 'Pago' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                              s.status === 'Cancelado' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                              'bg-amber-50 text-amber-600 border-amber-100'
                            }`}>
                              {s.status}
                            </span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Internal Notes */}
              <div className="mt-8 border-t border-slate-100 pt-6">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Observações Internas</h4>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-600 italic">
                  {viewHistoryClient.notes || 'Nenhuma observação interna cadastrada.'}
                </div>
              </div>
            </div>

            <button
              onClick={() => setViewHistoryClient(null)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-xs font-semibold font-sans cursor-pointer transition-colors"
            >
              Fechar Detalhes
            </button>
          </motion.div>
        </div>
      )}

      {/* CREATE / EDIT CLIENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <h3 className="text-base font-bold text-slate-900 font-sans">
                {selectedClient ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
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
              {/* Seção Dados Pessoais - Informações Principais */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-slate-100 pb-1.5 font-sans">Informações Principais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Nome Completo / Razão Social *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Carlos da Silva"
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">CPF / CNPJ</label>
                    <input
                      type="text"
                      value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(e.target.value)}
                      placeholder="000.000.000-00 ou 00.000.000/0001-00"
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">WhatsApp</label>
                    <input
                      type="text"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="(00) 90000-0000"
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="cliente@email.com"
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Advanced toggle button */}
              {!showAdvanced ? (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(true)}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer transition-all inline-flex items-center gap-1.5"
                  >
                    + Preencher Endereço e Detalhes Opcionais
                  </button>
                </div>
              ) : (
                <div className="space-y-6 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider font-sans">Campos Opcionais e Endereço</h4>
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 font-semibold underline cursor-pointer"
                    >
                      Ocultar campos opcionais
                    </button>
                  </div>

                  {/* RG e Data de Nascimento */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">RG / IE</label>
                      <input
                        type="text"
                        value={rg}
                        onChange={(e) => setRg(e.target.value)}
                        placeholder="Ex: 12.345.678-9"
                        className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Data de Nascimento / Fundação</label>
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Telefone Fixo</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(00) 0000-0000"
                        className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Seção Endereço */}
                  <div className="space-y-4">
                    <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans">Endereço de Correspondência</h5>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">CEP</label>
                        <input
                          type="text"
                          value={cep}
                          onChange={(e) => setCep(e.target.value)}
                          onBlur={handleCepLookup}
                          placeholder="00000-000"
                          className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700">Endereço (Rua, Av)</label>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Rua das Acácias"
                          className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Número</label>
                        <input
                          type="text"
                          value={number}
                          onChange={(e) => setNumber(e.target.value)}
                          placeholder="123"
                          className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Bairro</label>
                        <input
                          type="text"
                          value={bairro}
                          onChange={(e) => setBairro(e.target.value)}
                          placeholder="Centro"
                          className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700">Cidade</label>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="São Paulo"
                          className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Estado (UF)</label>
                        <input
                          type="text"
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          placeholder="SP"
                          className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="block text-xs font-semibold text-slate-700">Complemento</label>
                        <input
                          type="text"
                          value={complement}
                          onChange={(e) => setComplement(e.target.value)}
                          placeholder="Apto 11, Bloco B"
                          className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção Anexos e Favoritos */}
                  <div className="space-y-4">
                    <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-sans">Anexos e Extras</h5>
                    
                    {/* Favorites */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="fav"
                        checked={isFavorite}
                        onChange={(e) => setIsFavorite(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                      />
                      <label htmlFor="fav" className="text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-1">
                        <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                        Destacar como Cliente Favorito
                      </label>
                    </div>

                    {/* Upload Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div className="relative border border-dashed border-slate-200 p-3 rounded-xl hover:bg-slate-50 text-center transition-colors">
                        <input
                          type="file"
                          onChange={(e) => handleFileUpload(e, 'document')}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                        <span className="text-[10px] font-bold text-slate-600 block">Anexar Documento</span>
                        <span className="text-[8px] text-slate-400">PDF, Imagem, Docs</span>
                      </div>

                      <div className="relative border border-dashed border-slate-200 p-3 rounded-xl hover:bg-slate-50 text-center transition-colors">
                        <input
                          type="file"
                          onChange={(e) => handleFileUpload(e, 'contract')}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Paperclip className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                        <span className="text-[10px] font-bold text-slate-600 block">Anexar Contrato</span>
                        <span className="text-[8px] text-slate-400">Assinado ou Rascunho</span>
                      </div>

                      <div className="relative border border-dashed border-slate-200 p-3 rounded-xl hover:bg-slate-50 text-center transition-colors">
                        <input
                          type="file"
                          onChange={(e) => handleFileUpload(e, 'photo')}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                        <span className="text-[10px] font-bold text-slate-600 block">Anexar Foto</span>
                        <span className="text-[8px] text-slate-400">Localização, Equipamento, Perfil</span>
                      </div>
                    </div>

                    {/* Attachments List */}
                    {attachments.length > 0 && (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block font-sans">Arquivos Vinculados ({attachments.length})</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {attachments.map((att) => (
                            <div key={att.id} className="bg-white p-2 rounded-lg border border-slate-200/50 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 truncate">
                                <FileSpreadsheet className="w-4 h-4 text-indigo-500 shrink-0" />
                                <div className="truncate">
                                  <span className="font-semibold text-slate-700 block truncate max-w-[120px]">{att.name}</span>
                                  <span className="text-[9px] text-slate-400">{att.size} • {att.type}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveAttachment(att.id)}
                                className="p-1 hover:bg-slate-100 text-rose-500 rounded-md cursor-pointer shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Seção Observações */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Observações Internas (Seguras)</label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Instruções de faturamento, fuso horário, observações de contato corporativo..."
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
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
                  {submitting ? 'Salvando...' : 'Salvar Dados'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

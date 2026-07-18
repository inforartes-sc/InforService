/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Client, Service, Attachment } from '../types';
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
  FileSpreadsheet
} from 'lucide-react';
import { motion } from 'motion/react';

interface ClientsProps {
  clients: Client[];
  services: Service[];
  onRefresh: () => void;
  currentUser: any;
}

export default function Clients({ clients, services, onRefresh, currentUser }: ClientsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [viewHistoryClient, setViewHistoryClient] = useState<Client | null>(null);

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
    if (!name || !cpfCnpj) {
      setErrorMsg('Nome e CPF/CNPJ são campos obrigatórios.');
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
            const activeServices = clientServices.filter(s => s.status !== 'Finalizado' && s.status !== 'Cancelado').length;

            return (
              <motion.div
                key={client.id}
                whileHover={{ y: -3 }}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 truncate max-w-[180px] font-sans flex items-center gap-1.5">
                        {client.name}
                        {client.isFavorite && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />}
                      </h3>
                      <span className="text-[10px] text-slate-400 block font-mono mt-0.5">{client.cpfCnpj}</span>
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
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {['SUPER_ADMIN', 'ADMIN'].includes(currentUser?.role) && (
                        <button
                          onClick={() => handleDeleteClient(client.id)}
                          className="p-1.5 hover:bg-slate-50 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-slate-600">
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
                      <span className="truncate">{client.city ? `${client.city} - ${client.state}` : '(Sem endereço)'}</span>
                    </div>
                  </div>
                </div>

                {/* Footer specs */}
                <div className="border-t border-slate-50 pt-3.5 flex items-center justify-between">
                  <button
                    onClick={() => setViewHistoryClient(client)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer flex items-center gap-0.5"
                  >
                    Histórico <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 font-sans">
                    <span className="flex items-center gap-0.5 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md">
                      <Paperclip className="w-3 h-3 text-slate-400" />
                      {client.attachments?.length || 0} anexos
                    </span>
                    <span className="flex items-center gap-0.5 bg-indigo-50/50 border border-indigo-50 px-1.5 py-0.5 rounded-md text-indigo-700">
                      <Clock className="w-3 h-3 text-indigo-500" />
                      {activeServices} em aberto
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

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
                <button
                  onClick={() => setViewHistoryClient(null)}
                  className="p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
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
                    <label className="block text-xs font-semibold text-slate-700">CPF / CNPJ *</label>
                    <input
                      type="text"
                      required
                      value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(e.target.value)}
                      placeholder="000.000.000-00 ou 00.000.000/0001-00"
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">WhatsApp *</label>
                    <input
                      type="text"
                      required
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

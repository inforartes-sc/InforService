/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Company, User, UserRole } from '../types';
import { api } from '../lib/api';
import { 
  Building2, 
  Palette, 
  Percent, 
  Users, 
  Lock, 
  Settings2, 
  Plus, 
  Trash2, 
  ShieldAlert, 
  Check, 
  UserX,
  X,
  RefreshCw,
  Mail,
  Database
} from 'lucide-react';
import { motion } from 'motion/react';

interface SettingsProps {
  company: Company | null;
  onRefreshCompany: () => void;
  currentUser: User | null;
}

export default function Settings({ company, onRefreshCompany, currentUser }: SettingsProps) {
  // Company Form State
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0f172a');
  const [secondaryColor, setSecondaryColor] = useState('#4f46e5');
  const [taxes, setTaxes] = useState<number>(0);
  const [interest, setInterest] = useState<number>(0);
  const [penalty, setPenalty] = useState<number>(0);

  // Users Management State (Super Admin only)
  const [users, setUsers] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uRole, setURole] = useState<UserRole>(UserRole.USER);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Status
  const [submittingCompany, setSubmittingCompany] = useState(false);
  const [submittingUser, setSubmittingUser] = useState(false);
  const [dbActionLoading, setDbActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Load configuration and users on render
  useEffect(() => {
    if (company) {
      setName(company.name || '');
      setCnpj(company.cnpj || '');
      setPhone(company.phone || '');
      setEmail(company.email || '');
      setAddress(company.address || '');
      setPrimaryColor(company.primaryColor || '#0f172a');
      setSecondaryColor(company.secondaryColor || '#4f46e5');
      setTaxes(company.taxes || 0);
      setInterest(company.interest || 0);
      setPenalty(company.penalty || 0);
    }
  }, [company]);

  const loadUsers = async () => {
    if (currentUser?.role === UserRole.SUPER_ADMIN) {
      try {
        const list = await api.getUsers();
        setUsers(list);
      } catch (err) {
        console.error('Error loading users:', err);
      }
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentUser]);

  const handleClearDemo = async () => {
    if (!window.confirm('Tem certeza que deseja apagar todos os dados de demonstração (clientes, ordens de serviço, parcelas de faturamento, avisos)? Esta ação é irreversível e ativará o modo de banco de dados real.')) {
      return;
    }
    setDbActionLoading(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await api.clearDemoData();
      setSuccessMsg(res.message || 'Banco de dados real ativado com sucesso! Dados limpos.');
      onRefreshCompany();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao limpar dados de demonstração.');
    } finally {
      setDbActionLoading(false);
    }
  };

  const handleRestoreDemo = async () => {
    if (!window.confirm('Atenção: isto irá recarregar todos os clientes, serviços e parcelas de demonstração fictícias no banco de dados. Deseja prosseguir?')) {
      return;
    }
    setDbActionLoading(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await api.seedDemoData();
      setSuccessMsg(res.message || 'Dados de demonstração restaurados com sucesso!');
      onRefreshCompany();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao restaurar dados de demonstração.');
    } finally {
      setDbActionLoading(false);
    }
  };

  // Update Company
  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingCompany(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await api.updateCompanyConfig({
        name,
        cnpj,
        phone,
        email,
        address,
        primaryColor,
        secondaryColor,
        taxes,
        interest,
        penalty
      });
      setSuccessMsg('Configurações da empresa salvas com sucesso!');
      onRefreshCompany();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao salvar configurações.');
    } finally {
      setSubmittingCompany(false);
    }
  };

  // Open modal for user create/edit
  const openUserModal = (u?: User) => {
    if (u) {
      setEditingUserId(u.id);
      setUName(u.name);
      setUEmail(u.email);
      setUPassword('');
      setURole(u.role);
    } else {
      setEditingUserId(null);
      setUName('');
      setUEmail('');
      setUPassword('');
      setURole(UserRole.USER);
    }
    setShowUserModal(true);
  };

  // Create or Update User (Super Admin only)
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uName || !uEmail || (!editingUserId && !uPassword)) return;

    setSubmittingUser(true);
    try {
      const payload: any = { name: uName, email: uEmail, role: uRole };
      if (uPassword) payload.password = uPassword;

      if (editingUserId) {
        await api.updateUser(editingUserId, payload);
      } else {
        await api.createUser(payload);
      }
      setShowUserModal(false);
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar usuário.');
    } finally {
      setSubmittingUser(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (id: string) => {
    if (id === currentUser?.id) {
      alert('Você não pode excluir a si mesmo!');
      return;
    }
    if (!window.confirm('Deseja realmente remover este usuário do sistema? Ele perderá todos os acessos.')) return;

    try {
      await api.deleteUser(id);
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Erro ao remover usuário.');
    }
  };

  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;
  const isAdmin = currentUser?.role === UserRole.ADMIN || isSuperAdmin;

  return (
    <div className="space-y-8 font-sans">
      {/* Header Panel */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Configurações Gerais</h1>
        <p className="text-sm text-slate-500 mt-1">Configure parâmetros contábeis, taxas, dados cadastrais e permissões de acesso.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Company Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleCompanySubmit} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-50 pb-3">
              <Building2 className="w-5 h-5 text-indigo-500" /> Cadastro da Empresa e Parâmetros
            </h3>

            {successMsg && (
              <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-md">
                <p className="text-xs text-emerald-700 font-bold">{successMsg}</p>
              </div>
            )}

            {errorMsg && (
              <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-md">
                <p className="text-xs text-rose-700 font-semibold">{errorMsg}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Razão Social / Nome Fantasia *</label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">CNPJ</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Telefone Contato *</label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">E-mail Financeiro *</label>
                <input
                  type="email"
                  required
                  disabled={!isAdmin}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">Endereço Comercial Sede *</label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                />
              </div>
            </div>

            {/* Impostos e juros de mora padrão */}
            <div className="space-y-4 border-t border-slate-50 pt-4">
              <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                <Percent className="w-4 h-4" /> Parâmetros de Faturamento Padrão
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Imposto padrão ISS (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={!isAdmin}
                    value={taxes}
                    onChange={(e) => setTaxes(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Juros de Mora (% / mês)</label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={!isAdmin}
                    value={interest}
                    onChange={(e) => setInterest(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Multa por Atraso (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={!isAdmin}
                    value={penalty}
                    onChange={(e) => setPenalty(parseFloat(e.target.value) || 0)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Custom Theme Colors */}
            <div className="space-y-4 border-t border-slate-50 pt-4">
              <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                <Palette className="w-4 h-4" /> Paleta de Cores do Sistema
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Cor Primária (Sidebar / Destaque)</label>
                  <div className="flex gap-2.5 mt-1.5">
                    <input
                      type="color"
                      disabled={!isAdmin}
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="block w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Cor Secundária (Botões / Links)</label>
                  <div className="flex gap-2.5 mt-1.5">
                    <input
                      type="color"
                      disabled={!isAdmin}
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
                    />
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="block w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="flex justify-end pt-4 border-t border-slate-50">
                <button
                  type="submit"
                  disabled={submittingCompany}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 transition-colors"
                >
                  {submittingCompany ? 'Processando...' : 'Salvar Alterações'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Users list Panel */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Users className="w-5 h-5 text-indigo-500" /> Equipe / Usuários
              </h3>
              {isSuperAdmin && (
                <button
                  onClick={() => openUserModal()}
                  className="p-1 hover:bg-slate-50 text-indigo-600 hover:text-indigo-700 rounded cursor-pointer"
                  title="Novo Usuário"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {!isSuperAdmin ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/50 flex gap-2.5 text-xs text-slate-500">
                <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
                <span>Somente <strong>Super Administradores</strong> podem gerenciar os usuários e permissões de acesso da equipe.</span>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                {users.map(u => (
                  <div key={u.id} className="bg-slate-50/50 hover:bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs transition-all">
                    <div>
                      <span className="font-bold text-slate-800 block">{u.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{u.email}</span>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[8px] font-bold">
                        {u.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openUserModal(u)}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded transition-colors cursor-pointer"
                        title="Editar Usuário"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded transition-colors cursor-pointer"
                        title="Remover Usuário"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Database Controls Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-50 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 font-sans">
                <Database className="w-5 h-5 text-indigo-500" /> Banco de Dados & Modo
              </h3>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                company?.isProduction 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {company?.isProduction ? 'Produção (Real)' : 'Demonstração'}
              </span>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              {company?.isProduction ? (
                <p className="leading-relaxed text-[11px]">
                  O sistema está configurado no <strong>Modo Produção</strong>. As demonstrações fictícias foram limpas e o banco de dados está pronto para registrar informações reais da sua empresa de forma segura e limpa.
                </p>
              ) : (
                <p className="leading-relaxed text-[11px]">
                  O sistema está operando com <strong>dados de demonstração</strong> (Carlos da Silva, Acme Corp, etc.) para fins de avaliação. Clique abaixo para remover as simulações e iniciar o uso com dados reais.
                </p>
              )}

              {dbActionLoading ? (
                <div className="flex items-center gap-2 justify-center py-3">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span className="text-[11px] font-semibold text-slate-500">Processando banco de dados...</span>
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  {!company?.isProduction ? (
                    <button
                      type="button"
                      onClick={handleClearDemo}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" /> Limpar Dados de Demonstração
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRestoreDemo}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-indigo-200 hover:bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" /> Ativar Demonstração (Testes)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT USER MODAL (Super Admin only) */}
      {showUserModal && isSuperAdmin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 font-sans">
                {editingUserId ? 'Editar Usuário' : 'Novo Usuário do Sistema'}
              </h3>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={uName}
                  onChange={(e) => setUName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">E-mail de Acesso *</label>
                <input
                  type="email"
                  required
                  value={uEmail}
                  onChange={(e) => setUEmail(e.target.value)}
                  placeholder="joao@empresa.com"
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {editingUserId ? 'Nova Senha (Opcional)' : 'Senha de Acesso *'}
                </label>
                <input
                  type="password"
                  required={!editingUserId}
                  value={uPassword}
                  onChange={(e) => setUPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Perfil / Nível de Acesso *</label>
                <select
                  value={uRole}
                  onChange={(e: any) => setURole(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white font-sans"
                >
                  <option value="SUPER_ADMIN">Super Administrador (Acesso Total)</option>
                  <option value="ADMIN">Administrador (Gestão Operações)</option>
                  <option value="USER">Usuário (Lançamento O.S.)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold text-white shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submittingUser ? 'Salvando...' : 'Salvar Usuário'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

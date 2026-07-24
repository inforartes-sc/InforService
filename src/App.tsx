/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { api, getToken, removeToken, getStoredUser } from './lib/api';
import { User, Client, Service, Payment, Company, SystemNotification, UserRole } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Clients from './components/Clients';
import Services from './components/Services';
import Payments from './components/Payments';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Audit from './components/Audit';
import Calendar from './components/Calendar';

import { 
  LayoutDashboard, 
  Users, 
  FileSpreadsheet, 
  DollarSign, 
  FileText, 
  Settings2, 
  Database, 
  Calendar as CalendarIcon, 
  LogOut, 
  User as UserIcon,
  Bell, 
  Menu, 
  X, 
  Sun, 
  Moon,
  ShieldAlert,
  Server,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  // Application Data States
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);

  // Load state
  const [appLoading, setAppLoading] = useState(true);

  // Authenticate user on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      if (token) {
        try {
          const user = await api.getCurrentUser();
          setCurrentUser(user);
        } catch (err) {
          console.error('Authentication check failed:', err);
          removeToken();
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setAppLoading(false);
    };
    checkAuth();
  }, []);

  // Fetch data from server
  const fetchAllData = async () => {
    if (!currentUser) return;
    try {
      const [clientsList, servicesList, paymentsList, companyConfig, notificationsList] = await Promise.all([
        api.getClients(),
        api.getServices(),
        api.getPayments(),
        api.getCompanyConfig(),
        api.getNotifications()
      ]);

      setClients(clientsList);
      setServices(servicesList);
      setPayments(paymentsList);
      setCompany(companyConfig);
      setNotifications(notificationsList);
    } catch (err: any) {
      console.error('Error fetching application data:', err);
      if (err.message && (err.message.includes('Sessão expirada') || err.message.includes('não autorizada') || err.message.includes('Não autenticado') || err.message.includes('Token'))) {
        removeToken();
        setCurrentUser(null);
      }
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchAllData();
      // Periodically refresh notifications
      const interval = setInterval(() => {
        fetchAllData();
      }, 10000); // 10s intervals
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
    if (window.location.pathname === '/login') {
      window.history.pushState({}, '', '/');
    }
  };

  const handleLogout = () => {
    removeToken();
    setCurrentUser(null);
  };

  // Toggle Theme mode
  const toggleTheme = () => {
    setThemeMode(themeMode === 'light' ? 'dark' : 'light');
  };

  if (appLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold text-slate-500 font-sans uppercase tracking-wider">Iniciando InforService...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Navigation Items according to access levels
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'services', label: 'Ordens de Serviço', icon: FileSpreadsheet },
    { id: 'payments', label: 'Contas a Receber', icon: DollarSign },
    { id: 'calendar', label: 'Agenda', icon: CalendarIcon },
    { id: 'reports', label: 'Relatórios', icon: FileText },
    { id: 'settings', label: 'Configurações', icon: Settings2 },
  ];

  // Only show Audit log menu to Super Admin
  if (currentUser.role === UserRole.SUPER_ADMIN) {
    navItems.push({ id: 'audit', label: 'Auditoria de Logs', icon: Database });
  }

  const activeNotificationCount = notifications.length;

  return (
    <div className={`h-screen w-screen overflow-hidden flex font-sans ${themeMode === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* SIDEBAR FOR DESKTOP */}
      <aside className={`hidden md:flex flex-col justify-between w-64 border-r shrink-0 transition-all duration-300 ${
        themeMode === 'dark' 
          ? 'bg-slate-900 border-slate-800 text-slate-300' 
          : 'bg-white border-slate-200 text-slate-600'
      }`}>
        <div>
          {/* Logo Brand */}
          <div className={`p-6 border-b flex items-center justify-between ${
            themeMode === 'dark' ? 'border-slate-800' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-lg text-white">
                <Server className="w-5 h-5" />
              </div>
              <span className={`text-base font-extrabold tracking-tight ${
                themeMode === 'dark' ? 'text-white' : 'text-slate-950'
              }`}>
                InforService
              </span>
            </div>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
              themeMode === 'dark' 
                ? 'bg-slate-800 text-slate-400 border-slate-700' 
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>v1.1</span>
          </div>

          {/* Nav list */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    isActive 
                      ? themeMode === 'dark'
                        ? 'bg-indigo-950/50 text-indigo-400 border border-indigo-900/40 shadow-sm'
                        : 'bg-indigo-50 text-indigo-600 border border-indigo-100/50 shadow-xs'
                      : themeMode === 'dark'
                        ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-indigo-500' : ''}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card on bottom of Sidebar */}
        <div className={`p-4 border-t space-y-3 ${
          themeMode === 'dark' ? 'border-slate-800' : 'border-slate-200'
        }`}>
          <div className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${
            themeMode === 'dark' 
              ? 'bg-slate-800/40 border-slate-800 text-slate-300' 
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}>
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-xs">
              {currentUser.name.charAt(0)}
            </div>
            <div className="truncate text-xs">
              <span className={`font-bold block truncate ${themeMode === 'dark' ? 'text-white' : 'text-slate-900'}`}>{currentUser.name}</span>
              <span className={`text-[10px] font-mono block mt-0.5 ${themeMode === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{currentUser.role}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
              themeMode === 'dark'
                ? 'bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 border border-slate-700 hover:border-rose-900/35 text-slate-300'
                : 'bg-slate-100 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-slate-600'
            }`}
          >
            <LogOut className="w-4 h-4" /> Sair da conta
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER & DRAWER SIDEBAR */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className={`h-16 px-4 md:px-8 border-b flex items-center justify-between shrink-0 transition-colors duration-200 ${
          themeMode === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2 text-xs font-bold font-sans">
              <span className="text-slate-400">EMPRESA ATIVA:</span>
              <span className={`px-2 py-0.5 rounded border ${
                themeMode === 'dark' 
                  ? 'text-indigo-400 bg-indigo-950/40 border-indigo-900/30' 
                  : 'text-indigo-600 bg-indigo-50 border-indigo-100/50'
              }`}>{company?.name || 'Carregando...'}</span>
            </div>
          </div>

          {/* Quick operations & Notifications dropdown */}
          <div className="flex items-center gap-3">
            {/* Dark mode switcher */}
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-slate-100/80 rounded-xl text-slate-500 cursor-pointer"
              title="Alternar Tema"
            >
              {themeMode === 'light' ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5 text-amber-500" />}
            </button>

            {/* Notification alert bell dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                className="p-2 hover:bg-slate-100/80 rounded-xl text-slate-500 relative cursor-pointer"
              >
                <Bell className="w-4.5 h-4.5" />
                {activeNotificationCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
                )}
              </button>

              <AnimatePresence>
                {showNotificationsDropdown && (
                  <div className={`absolute right-0 mt-2 w-80 border shadow-xl rounded-2xl p-4 z-50 space-y-3 font-sans ${
                    themeMode === 'dark' 
                      ? 'bg-slate-900 border-slate-800 text-slate-100' 
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}>
                    <div className={`flex items-center justify-between border-b pb-2.5 ${
                      themeMode === 'dark' ? 'border-slate-800' : 'border-slate-100'
                    }`}>
                      <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-500" /> Atividade e Avisos
                      </h4>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        themeMode === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-700'
                      }`}>{notifications.length} avisos</span>
                    </div>

                    <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                      {notifications.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center py-6">Nenhum aviso no log de alertas do sistema.</p>
                      ) : (
                        notifications.map((notif) => (
                          <div key={notif.id} className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-[11px] leading-relaxed">
                            <span className="font-bold text-slate-800 block">{notif.title}</span>
                            <p className="text-slate-600 mt-0.5">{notif.message}</p>
                            <span className="text-[8px] text-slate-400 block mt-1">Disparado via {notif.type} • {new Date(notif.createdAt).toLocaleTimeString('pt-BR')}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs font-medium border-l pl-3 border-slate-200">
              <UserIcon className="w-4 h-4 text-slate-400" />
              <span>{currentUser.name}</span>
            </div>
          </div>
        </header>

        {/* CONTAINER CONTENT */}
        <main className={`flex-1 min-h-0 ${['services', 'payments'].includes(activeTab) ? 'overflow-hidden flex flex-col h-full p-4 md:p-6' : 'overflow-y-auto p-4 md:p-8'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className={['services', 'payments'].includes(activeTab) ? 'flex-1 flex flex-col min-h-0 h-full overflow-hidden' : ''}
            >
              {activeTab === 'dashboard' && (
                <Dashboard 
                  clients={clients} 
                  services={services} 
                  payments={payments} 
                  onNavigate={(tab) => setActiveTab(tab)} 
                />
              )}
              {activeTab === 'clients' && (
                <Clients 
                  clients={clients} 
                  services={services} 
                  payments={payments}
                  company={company}
                  onRefresh={fetchAllData} 
                  currentUser={currentUser}
                />
              )}
              {activeTab === 'services' && (
                <Services 
                  services={services} 
                  clients={clients} 
                  onRefresh={fetchAllData} 
                  currentUser={currentUser}
                  onNavigate={(tab) => setActiveTab(tab)}
                />
              )}
              {activeTab === 'payments' && (
                <Payments 
                  payments={payments} 
                  clients={clients} 
                  services={services} 
                  company={company}
                  onRefresh={fetchAllData} 
                  currentUser={currentUser}
                />
              )}
              {activeTab === 'calendar' && (
                <Calendar 
                  services={services} 
                  clients={clients} 
                  onRefresh={fetchAllData}
                />
              )}
              {activeTab === 'reports' && (
                <Reports 
                  payments={payments} 
                  clients={clients} 
                  services={services} 
                />
              )}
              {activeTab === 'settings' && (
                <Settings 
                  company={company} 
                  onRefreshCompany={fetchAllData} 
                  currentUser={currentUser}
                />
              )}
              {activeTab === 'audit' && (
                <Audit 
                  currentUser={currentUser} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* MOBILE DRAWER SIDEBAR SCREEN */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 flex z-50 md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            />

            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className={`relative flex-1 flex flex-col max-w-xs w-full p-6 space-y-6 transition-all border-r ${
                themeMode === 'dark' 
                  ? 'bg-slate-900 border-slate-800 text-slate-300' 
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <div className={`flex items-center justify-between border-b pb-4 ${
                themeMode === 'dark' ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-600 rounded-lg text-white">
                    <Server className="w-4 h-4" />
                  </div>
                  <span className={`text-base font-extrabold ${
                    themeMode === 'dark' ? 'text-white' : 'text-slate-950'
                  }`}>InforService</span>
                </div>
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className={`p-1.5 rounded-lg cursor-pointer ${
                    themeMode === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                        isActive 
                          ? themeMode === 'dark'
                            ? 'bg-indigo-950/50 text-indigo-400 border border-indigo-900/40 shadow-sm'
                            : 'bg-indigo-50 text-indigo-600 border border-indigo-100/50 shadow-xs'
                          : themeMode === 'dark'
                            ? 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70'
                      }`}
                    >
                      <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-indigo-500' : ''}`} />
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              <div className={`border-t pt-4 space-y-3 ${
                themeMode === 'dark' ? 'border-slate-800' : 'border-slate-200'
              }`}>
                <div className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${
                  themeMode === 'dark' 
                    ? 'bg-slate-800/40 border-slate-800 text-slate-300' 
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}>
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-xs">
                    {currentUser.name.charAt(0)}
                  </div>
                  <div className="truncate text-xs">
                    <span className={`font-bold block truncate ${themeMode === 'dark' ? 'text-white' : 'text-slate-900'}`}>{currentUser.name}</span>
                    <span className={`text-[10px] font-mono block mt-0.5 ${themeMode === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{currentUser.role}</span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    themeMode === 'dark'
                      ? 'bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 border border-slate-700 hover:border-rose-900/35 text-slate-300'
                      : 'bg-slate-100 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-slate-600'
                  }`}
                >
                  <LogOut className="w-4.5 h-4.5" /> Sair da conta
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

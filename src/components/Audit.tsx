/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuditLog, UserRole } from '../types';
import { api } from '../lib/api';
import { 
  ShieldAlert, 
  Search, 
  Terminal, 
  User, 
  Activity, 
  Calendar, 
  Database,
  RefreshCw,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';

interface AuditProps {
  currentUser: any;
}

export default function Audit({ currentUser }: AuditProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadLogs = async () => {
    if (currentUser?.role !== UserRole.SUPER_ADMIN) return;
    setLoading(true);
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [currentUser]);

  if (currentUser?.role !== UserRole.SUPER_ADMIN) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm max-w-xl mx-auto text-center space-y-4 mt-12 font-sans">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800">Acesso Restrito</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Esta tela de auditoria de logs e rastreamento de segurança é restrita e acessível exclusivamente para o perfil de <strong>Super Administrador</strong> do sistema.
        </p>
      </div>
    );
  }

  const filteredLogs = logs.filter(log => {
    const query = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(query) ||
      log.userName.toLowerCase().includes(query) ||
      log.details.toLowerCase().includes(query) ||
      log.ip.includes(query)
    );
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Database className="w-8 h-8 text-indigo-600" /> Trilha de Auditoria
          </h1>
          <p className="text-sm text-slate-500 mt-1">Histórico cronológico detalhado de logs de segurança, acessos e operações no banco de dados.</p>
        </div>
        <button
          onClick={loadLogs}
          disabled={loading}
          className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} /> Atualizar Trilha
        </button>
      </div>

      {/* Control / Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Pesquisar por ação, usuário, IP ou detalhe..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-800"
          />
        </div>
        <div className="text-xs text-slate-400 font-semibold">
          Mostrando {filteredLogs.length} logs registrados
        </div>
      </div>

      {/* Logs Chronology Panel */}
      <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-xl font-mono text-xs overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4 text-slate-400">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <span className="font-bold">SERVPAY SECURITY SYSTEM AUDIT GATEWAY v1.0.4</span>
        </div>

        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">Nenhum log de auditoria encontrado na trilha ativa.</div>
          ) : (
            filteredLogs.map(log => {
              // Color-coded actions
              let actionColor = 'text-indigo-400';
              if (log.action === 'LOGIN') actionColor = 'text-emerald-400';
              if (log.action === 'EXCLUSÃO') actionColor = 'text-rose-400';
              if (log.action === 'CADASTRO') actionColor = 'text-purple-400';

              return (
                <div key={log.id} className="border-b border-slate-800/60 pb-3.5 last:border-0 last:pb-0 hover:bg-slate-800/10 transition-colors rounded p-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-slate-400">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-bold shrink-0">
                        {new Date(log.timestamp).toLocaleDateString('pt-BR')} • {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                      </span>
                      <span className={`${actionColor} font-black uppercase`}>[{log.action}]</span>
                      <span className="text-slate-300 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-500" /> {log.userName}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">IP: {log.ip}</span>
                  </div>
                  <p className="mt-1.5 text-slate-300 pl-1 leading-relaxed">{log.details}</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

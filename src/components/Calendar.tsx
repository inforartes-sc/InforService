/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Service, Client } from '../types';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  User, 
  MapPin, 
  FileCheck,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { motion } from 'motion/react';

interface CalendarProps {
  services: Service[];
  clients: Client[];
}

export default function Calendar({ services, clients }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // First day of month (0 = Sunday, 1 = Monday, etc.)
  const firstDayIndex = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Generate calendar grid array
  const calendarDays: (number | null)[] = [];
  // Padding for starting day
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  // Month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  // Helper to find services scheduled for a specific calendar day
  const getServicesForDay = (dayNum: number): Service[] => {
    const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    return services.filter(s => s.expectedDate === formattedDate);
  };

  // Active services count for selected month
  const monthServices = services.filter(s => {
    if (!s.expectedDate) return false;
    const d = new Date(s.expectedDate);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-8 h-8 text-indigo-600" /> Agenda Integrada
          </h1>
          <p className="text-sm text-slate-500 mt-1">Acompanhe prazos de entrega e conclusão das ordens de serviço ativas.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid card */}
        <div className="lg:col-span-2 bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              {monthNames[month]} de {year}
            </h3>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 p-1 rounded-xl">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-50">
            <div>Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="aspect-square bg-slate-50/50 rounded-xl" />;
              }

              const dayServices = getServicesForDay(day);
              const isToday = 
                new Date().getDate() === day && 
                new Date().getMonth() === month && 
                new Date().getFullYear() === year;

              return (
                <div 
                  key={`day-${day}`}
                  className={`aspect-square p-2 border border-slate-100 rounded-xl flex flex-col justify-between hover:bg-slate-50/50 transition-colors ${
                    isToday ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white'
                  }`}
                >
                  <span className={`text-xs font-bold font-mono ${isToday ? 'text-indigo-700 font-extrabold' : 'text-slate-600'}`}>
                    {day}
                  </span>
                  
                  {/* Indicators for scheduled services */}
                  {dayServices.length > 0 && (
                    <div className="space-y-0.5 mt-1 max-h-[22px] overflow-hidden">
                      {dayServices.slice(0, 2).map(ds => (
                        <span 
                          key={ds.id} 
                          title={`${ds.serviceNumber}: ${ds.serviceType}`}
                          className={`block h-1.5 w-full rounded-full ${
                            ds.status === 'Pago' || ds.status === 'Finalizado' 
                              ? 'bg-emerald-500' 
                              : 'bg-amber-500'
                          }`} 
                        />
                      ))}
                      {dayServices.length > 2 && (
                        <span className="text-[7px] text-slate-400 block font-bold leading-none">+{dayServices.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Month Cronogram Side Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-slate-50 pb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Cronograma do Mês</h3>
              <p className="text-xs text-slate-400 mt-0.5">{monthServices.length} serviços programados para entrega.</p>
            </div>

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {monthServices.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs font-sans">
                  Nenhum serviço agendado para entrega neste mês.
                </div>
              ) : (
                monthServices.map(s => {
                  const client = clients.find(c => c.id === s.clientId);
                  return (
                    <div key={s.id} className="border border-slate-100 hover:border-slate-200 p-3 rounded-xl space-y-2 hover:bg-slate-50/20 transition-all text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-indigo-600 font-mono">{s.serviceNumber}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold border ${
                          s.status === 'Pago' || s.status === 'Finalizado'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : 'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 block truncate">{s.serviceType}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{s.category}</span>
                      </div>
                      <div className="flex items-center gap-3.5 text-[10px] text-slate-500 pt-1 border-t border-slate-50">
                        <span className="flex items-center gap-0.5 truncate">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" /> {client ? client.name : 'Excluído'}
                        </span>
                        <span className="flex items-center gap-0.5 shrink-0 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" /> 
                          {s.expectedDate ? new Date(s.expectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'numeric' }) : '-'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

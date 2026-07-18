/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client, Service, Payment, Company, User, AuditLog, SystemNotification, Receipt } from '../types';

const API_BASE = '/api';

// Token helpers
export function getToken(): string | null {
  return localStorage.getItem('servpay_token');
}

export function setToken(token: string) {
  localStorage.setItem('servpay_token', token);
}

export function removeToken() {
  localStorage.removeItem('servpay_token');
  localStorage.removeItem('servpay_user');
}

export function getStoredUser(): User | null {
  const userJson = localStorage.getItem('servpay_user');
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

export function setStoredUser(user: User) {
  localStorage.setItem('servpay_user', JSON.stringify(user));
}

// Base Fetch Wrapper with Authorization
async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    removeToken();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Não autenticado. Por favor, faça login.');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Ocorreu um erro na requisição');
  }

  return data;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setToken(data.token);
    setStoredUser(data.user);
    return data;
  },

  async getCurrentUser(): Promise<User> {
    const user = await apiFetch('/auth/me');
    setStoredUser(user);
    return user;
  },

  // Clients
  async getClients(): Promise<Client[]> {
    return apiFetch('/clients');
  },

  async createClient(client: Partial<Client>): Promise<Client> {
    return apiFetch('/clients', {
      method: 'POST',
      body: JSON.stringify(client)
    });
  },

  async updateClient(id: string, client: Partial<Client>): Promise<Client> {
    return apiFetch(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(client)
    });
  },

  async deleteClient(id: string): Promise<{ message: string }> {
    return apiFetch(`/clients/${id}`, {
      method: 'DELETE'
    });
  },

  // Services
  async getServices(): Promise<Service[]> {
    return apiFetch('/services');
  },

  async createService(service: Partial<Service>): Promise<Service> {
    return apiFetch('/services', {
      method: 'POST',
      body: JSON.stringify(service)
    });
  },

  async updateService(id: string, service: Partial<Service>): Promise<Service> {
    return apiFetch(`/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(service)
    });
  },

  async deleteService(id: string): Promise<{ message: string }> {
    return apiFetch(`/services/${id}`, {
      method: 'DELETE'
    });
  },

  // Payments / Accounts Receivable
  async getPayments(): Promise<Payment[]> {
    return apiFetch('/payments');
  },

  async createPayment(payment: Partial<Payment>): Promise<Payment> {
    return apiFetch('/payments', {
      method: 'POST',
      body: JSON.stringify(payment)
    });
  },

  async generateInstallments(data: {
    serviceId: string;
    clientId: string;
    totalValue: number;
    planType: 'vista' | 'parcelado' | 'entrada_parcelado';
    numberOfInstallments?: number;
    firstDueDate: string;
    interest?: number;
    penalty?: number;
    discount?: number;
    paymentMethod?: string;
    observation?: string;
    entranceValue?: number;
  }): Promise<Payment[]> {
    return apiFetch('/payments/generate-installments', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updatePayment(id: string, payment: Partial<Payment>): Promise<Payment> {
    return apiFetch(`/payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payment)
    });
  },

  async deletePayment(id: string): Promise<{ message: string }> {
    return apiFetch(`/payments/${id}`, {
      method: 'DELETE'
    });
  },

  // Receipts and Contracts
  async generateReceipt(data: {
    serviceId: string;
    clientId: string;
    type: 'receipt' | 'contract';
    content: string;
  }): Promise<Receipt> {
    return apiFetch('/receipts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getReceipts(): Promise<Receipt[]> {
    return apiFetch('/receipts');
  },

  // Config / Company
  async getCompanyConfig(): Promise<Company> {
    return apiFetch('/config');
  },

  async updateCompanyConfig(config: Partial<Company>): Promise<Company> {
    return apiFetch('/config', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  },

  // Users (Super Admin only)
  async getUsers(): Promise<User[]> {
    return apiFetch('/users');
  },

  async createUser(user: Partial<User> & { password?: string }): Promise<User> {
    return apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify(user)
    });
  },

  async updateUser(id: string, user: Partial<User> & { password?: string }): Promise<User> {
    return apiFetch(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(user)
    });
  },

  async deleteUser(id: string): Promise<{ message: string }> {
    return apiFetch(`/users/${id}`, {
      method: 'DELETE'
    });
  },

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    return apiFetch('/audit');
  },

  // System Notifications
  async getNotifications(): Promise<SystemNotification[]> {
    return apiFetch('/notifications');
  },

  // Database Management
  async clearDemoData(): Promise<{ message: string }> {
    return apiFetch('/db/clear-demo', { method: 'POST' });
  },

  async seedDemoData(): Promise<{ message: string }> {
    return apiFetch('/db/seed-demo', { method: 'POST' });
  }
};

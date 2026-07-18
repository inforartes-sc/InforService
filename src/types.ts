/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export enum ServiceStatus {
  AGUARDANDO = 'Aguardando',
  EM_ANDAMENTO = 'Em andamento',
  FINALIZADO = 'Finalizado',
  CANCELADO = 'Cancelado',
  PAGO = 'Pago',
  PARCIALMENTE_PAGO = 'Parcialmente pago'
}

export enum PaymentStatus {
  PENDENTE = 'Pendente',
  PAGO = 'Pago',
  VENCIDO = 'Vencido',
  PARCIAL = 'Parcialmente pago'
}

export enum PaymentMethod {
  PIX = 'Pix',
  DINHEIRO = 'Dinheiro',
  CARTAO_CREDITO = 'Cartão de Crédito',
  CARTAO_DEBITO = 'Cartão de Débito',
  BOLETO = 'Boleto',
  TRANSFERENCIA = 'Transferência Bancária'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
}

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  categories: string[];
  paymentMethods: string[];
  taxes: number; // percentage
  interest: number; // percentage/month
  penalty: number; // percentage
  defaultDiscount: number; // percentage
  isProduction?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  type: string; // 'document' | 'contract' | 'photo'
  url: string; // base64 or file path
  size?: string;
  uploadedAt: string;
}

export interface Client {
  id: string;
  name: string;
  cpfCnpj: string;
  rg: string;
  birthDate: string;
  phone: string;
  whatsapp: string;
  email: string;
  cep: string;
  address: string;
  number: string;
  bairro: string;
  city: string;
  state: string;
  complement: string;
  notes: string;
  attachments: Attachment[];
  isFavorite?: boolean;
  companyId: string;
  createdAt: string;
}

export interface Service {
  id: string;
  serviceNumber: string;
  clientId: string;
  category: string;
  serviceType: string;
  description: string;
  requestDate: string;
  expectedDate: string;
  completionDate?: string;
  serviceValue: number;
  discount: number;
  additions: number;
  finalValue: number;
  status: ServiceStatus;
  companyId: string;
  userId: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  serviceId: string;
  clientId: string;
  amount: number;
  dueDate: string;
  paymentDate?: string;
  paidAmount?: number;
  interest: number;
  penalty: number;
  discount: number;
  paymentMethod: PaymentMethod;
  observation: string;
  installmentNumber: number;
  totalInstallments: number;
  status: PaymentStatus;
  companyId: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  ip: string;
  timestamp: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: 'system' | 'email' | 'whatsapp';
  status: 'Pendente' | 'Enviado';
  createdAt: string;
  scheduledFor?: string;
}

export interface Receipt {
  id: string;
  serviceId: string;
  clientId: string;
  hash: string;
  qrCode: string;
  content: string;
  createdAt: string;
}

export interface Contract {
  id: string;
  serviceId: string;
  clientId: string;
  title: string;
  content: string;
  createdAt: string;
}

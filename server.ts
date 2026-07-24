import 'dotenv/config'; // MUST be first — loads .env before anything else
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Extend Express Request type globally
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        companyId: string;
        name: string;
      };
    }
  }
}

// Enums and Interfaces copied from types.ts for server-side type safety
enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER'
}

enum ServiceStatus {
  AGUARDANDO = 'Aguardando',
  EM_ANDAMENTO = 'Em andamento',
  FINALIZADO = 'Finalizado',
  CANCELADO = 'Cancelado',
  PAGO = 'Pago',
  PARCIALMENTE_PAGO = 'Parcialmente pago'
}

enum PaymentStatus {
  PENDENTE = 'Pendente',
  PAGO = 'Pago',
  VENCIDO = 'Vencido'
}

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'servpay-jwt-secret-key-12345';
const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// --- SUPABASE CLIENT (lazy — only created when USE_LOCAL_DB is false) ---
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_KEY || '';
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// Create all required tables if they don't exist yet (runs once on startup)
async function ensureTables() {
  const tables = ['users', 'companies', 'clients', 'services', 'payments', 'audit', 'receipts', 'notifications'];
  for (const table of tables) {
    try {
      const { error } = await getSupabase().rpc('create_collection_table', { table_name: table }).single();
      if (error && !error.message.includes('already exists') && !error.message.includes('does not exist')) {
        // RPC may not exist, try direct SQL via REST
        console.log(`Table setup for '${table}': ${error.message}`);
      }
    } catch (_e) {
      // Ignore — table creation is best-effort; manual SQL creation also works
    }
  }
}

// Database Helper with Supabase + Local JSON fallback
class FileDB {
  private static async getFile<T extends { id: string }>(tableName: string, defaultValue: T[] = []): Promise<T[]> {
    const useLocal = process.env.USE_LOCAL_DB === 'true';
    if (useLocal) {
      const filePath = path.join(DATA_DIR, `${tableName}.json`);
      if (existsSync(filePath)) {
        const data = await fs.readFile(filePath, 'utf-8');
        try { return JSON.parse(data); } catch { return defaultValue; }
      }
      return defaultValue;
    }

    try {
      const { data, error } = await getSupabase().from(tableName).select('id, data');
      if (error) throw error;
      if (!data || data.length === 0) {
        // If Supabase is empty, migrate from local JSON backup if exists
        const filePath = path.join(DATA_DIR, `${tableName}.json`);
        if (existsSync(filePath)) {
          const raw = await fs.readFile(filePath, 'utf-8');
          try {
            const localData = JSON.parse(raw) as T[];
            if (localData && localData.length > 0) {
              console.log(`Migrating local '${tableName}' JSON to Supabase...`);
              await this.saveFile(tableName, localData);
              return localData;
            }
          } catch (e) {
            console.error(`Error parsing local JSON for ${tableName}:`, e);
          }
        }
        return defaultValue;
      }
      // Reconstruct each record: merge {id} + {data fields}
      return data.map(row => ({ id: row.id, ...row.data }) as T);
    } catch (error) {
      console.error(`Supabase error on getFile for ${tableName}:`, error);
      // Fallback to local JSON backup
      const filePath = path.join(DATA_DIR, `${tableName}.json`);
      if (existsSync(filePath)) {
        const raw = await fs.readFile(filePath, 'utf-8');
        try { return JSON.parse(raw); } catch { return defaultValue; }
      }
      return defaultValue;
    }
  }

  private static async saveFile<T extends { id: string }>(tableName: string, data: T[]): Promise<void> {
    // Always write a local JSON backup first
    const filePath = path.join(DATA_DIR, `${tableName}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

    const useLocal = process.env.USE_LOCAL_DB === 'true';
    if (useLocal) return;

    try {
      // Fetch existing IDs from Supabase
      const { data: existingRows, error: fetchError } = await getSupabase().from(tableName).select('id');
      if (fetchError) throw fetchError;

      const existingIds = new Set((existingRows || []).map((r: any) => r.id));
      const newIds = new Set(data.map(item => item.id));

      // Delete rows no longer in data
      const toDelete = [...existingIds].filter(id => !newIds.has(id));
      if (toDelete.length > 0) {
        const { error: delError } = await getSupabase().from(tableName).delete().in('id', toDelete);
        if (delError) console.error(`Supabase delete error for ${tableName}:`, delError);
      }

      // Upsert all current records
      const rows = data.map(item => {
        const { id, ...rest } = item as any;
        return { id, data: rest };
      });
      const { error: upsertError } = await getSupabase().from(tableName).upsert(rows, { onConflict: 'id' });
      if (upsertError) throw upsertError;
    } catch (error) {
      console.error(`Supabase error on saveFile for ${tableName}:`, error);
    }
  }

  static async getUsers() { return this.getFile<any>('users'); }
  static async saveUsers(data: any[]) { return this.saveFile('users', data); }

  static async getCompanies() { return this.getFile<any>('companies'); }
  static async saveCompanies(data: any[]) { return this.saveFile('companies', data); }

  static async getClients() { return this.getFile<any>('clients'); }
  static async saveClients(data: any[]) { return this.saveFile('clients', data); }

  static async getServices() { return this.getFile<any>('services'); }
  static async saveServices(data: any[]) { return this.saveFile('services', data); }

  static async getPayments() { return this.getFile<any>('payments'); }
  static async savePayments(data: any[]) { return this.saveFile('payments', data); }

  static async getAuditLogs() { return this.getFile<any>('audit'); }
  static async saveAuditLogs(data: any[]) { return this.saveFile('audit', data); }

  static async getReceipts() { return this.getFile<any>('receipts'); }
  static async saveReceipts(data: any[]) { return this.saveFile('receipts', data); }

  static async getNotifications() { return this.getFile<any>('notifications'); }
  static async saveNotifications(data: any[]) { return this.saveFile('notifications', data); }
}

// Audit trail helper
async function addAuditLog(userId: string, userName: string, action: string, details: string, req: express.Request) {
  try {
    const logs = await FileDB.getAuditLogs();
    const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1';
    const log = {
      id: Math.random().toString(36).substring(2, 9),
      userId,
      userName,
      action,
      details,
      ip,
      timestamp: new Date().toISOString()
    };
    logs.unshift(log); // newest first
    // Limit to 2000 logs for size control
    if (logs.length > 2000) logs.pop();
    await FileDB.saveAuditLogs(logs);
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

// Trigger Notifications Helper
async function triggerSystemNotification(title: string, message: string, type: 'system' | 'email' | 'whatsapp') {
  try {
    const notifications = await FileDB.getNotifications();
    const newNotif = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      message,
      type,
      status: 'Enviado', // Simulated auto-sent
      createdAt: new Date().toISOString()
    };
    notifications.unshift(newNotif);
    if (notifications.length > 100) notifications.pop();
    await FileDB.saveNotifications(notifications);
  } catch (error) {
    console.error('Notification error:', error);
  }
}

// Initialize and Seed Database
async function initDB() {
  const isEnvProduction = process.env.IS_PRODUCTION === 'true' || process.env.NODE_ENV === 'production';

  // Ensure Supabase tables exist (no-op if already created)
  if (process.env.USE_LOCAL_DB !== 'true') {
    await ensureTables();
  }

  // Manual reset of demo data if configured via env
  if (process.env.CLEAR_DEMO_DATA === 'true') {
    console.log('CLEAR_DEMO_DATA is true. Clearing demo data collections...');
    await FileDB.saveClients([]);
    await FileDB.saveServices([]);
    await FileDB.savePayments([]);
    await FileDB.saveNotifications([]);
    await FileDB.saveReceipts([]);
  }

  // Seed Companies
  const companies = await FileDB.getCompanies();
  let defaultCompanyId = 'comp-1';
  let isProduction = isEnvProduction;
  if (companies.length === 0) {
    const defaultCompany = {
      id: 'comp-1',
      name: 'Empresa Demo de Serviços Ltda',
      cnpj: '12.345.678/0001-99',
      phone: '(11) 98765-4321',
      email: 'financeiro@empresademo.com',
      address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP, CEP 01310-100',
      primaryColor: '#0f172a', // Slate 900
      secondaryColor: '#3b82f6', // Blue 500
      categories: ['Consultoria', 'Suporte Técnico', 'Desenvolvimento Web', 'Design Gráfico', 'Manutenção'],
      paymentMethods: ['Pix', 'Dinheiro', 'Cartão de Crédito', 'Boleto', 'Transferência Bancária'],
      taxes: 5.0, // 5% ISS
      interest: 1.0, // 1% juros/mês
      penalty: 2.0, // 2% multa
      defaultDiscount: 0.0,
      isProduction: isEnvProduction
    };
    await FileDB.saveCompanies([defaultCompany]);
    console.log('Seeded default company');
  } else {
    defaultCompanyId = companies[0].id;
    isProduction = companies[0].isProduction || isEnvProduction;
    if (process.env.CLEAR_DEMO_DATA === 'true') {
      companies[0].isProduction = true;
      await FileDB.saveCompanies(companies);
    }
  }

  // Seed Users
  let users = await FileDB.getUsers();

  if (process.env.RESET_PASSWORDS === 'true' && users.length > 0) {
    console.log('RESET_PASSWORDS is true. Resetting passwords for seeded users to admin123/user123...');
    const superAdminPassword = await bcrypt.hash('admin123', 10);
    const adminPassword = await bcrypt.hash('admin123', 10);
    const userPassword = await bcrypt.hash('user123', 10);

    users.forEach(u => {
      if (u.email === 'superadmin@admin.com') u.passwordHash = superAdminPassword;
      if (u.email === 'admin@admin.com') u.passwordHash = adminPassword;
      if (u.email === 'user@user.com') u.passwordHash = userPassword;
    });
    await FileDB.saveUsers(users);
  }

  // Save local copy of users database to inspect current users
  await fs.writeFile(path.join(DATA_DIR, 'users.json'), JSON.stringify(users, null, 2), 'utf-8');

  if (users.length === 0) {
    const superAdminPassword = await bcrypt.hash('admin123', 10);
    const adminPassword = await bcrypt.hash('admin123', 10);
    const userPassword = await bcrypt.hash('user123', 10);

    const defaultUsers = [
      {
        id: 'user-super',
        name: 'Super Administrador',
        email: 'superadmin@admin.com',
        passwordHash: superAdminPassword,
        role: UserRole.SUPER_ADMIN,
        companyId: defaultCompanyId
      },
      {
        id: 'user-admin',
        name: 'Administrador Demo',
        email: 'admin@admin.com',
        passwordHash: adminPassword,
        role: UserRole.ADMIN,
        companyId: defaultCompanyId
      },
      {
        id: 'user-regular',
        name: 'Operador Financeiro',
        email: 'user@user.com',
        passwordHash: userPassword,
        role: UserRole.USER,
        companyId: defaultCompanyId
      }
    ];
    await FileDB.saveUsers(defaultUsers);
    console.log('Seeded default users (superadmin@admin.com, admin@admin.com, user@user.com with password: admin123/user123)');
  }

  // Seed initial Clients if empty to provide rich dashboard visuals immediately (only in demo/non-production mode)
  if (isProduction || process.env.CLEAR_DEMO_DATA === 'true') {
    console.log('Database running in Production/Clean mode. Skipping demonstration seeding of clients, services, and payments.');
    return;
  }

  const clients = await FileDB.getClients();
  if (clients.length === 0) {
    const seededClients = [
      {
        id: 'cli-1',
        name: 'Carlos da Silva Oliveira',
        cpfCnpj: '123.456.789-00',
        rg: '12.345.678-9',
        birthDate: '1985-05-15',
        phone: '(11) 99999-1111',
        whatsapp: '(11) 99999-1111',
        email: 'carlos.silva@email.com',
        cep: '01311-200',
        address: 'Alameda Santos',
        number: '1500',
        bairro: 'Cerqueira César',
        city: 'São Paulo',
        state: 'SP',
        complement: 'Apt 42',
        notes: 'Cliente preferencial desde 2024. Pagamentos pontuais.',
        attachments: [],
        isFavorite: true,
        companyId: defaultCompanyId,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'cli-2',
        name: 'Acme Corporações e Tecnologia',
        cpfCnpj: '98.765.432/0001-01',
        rg: '-',
        birthDate: '2000-01-01',
        phone: '(11) 5555-4444',
        whatsapp: '(11) 95555-4444',
        email: 'contato@acmetec.com.br',
        cep: '04571-010',
        address: 'Rua Arizona',
        number: '120',
        bairro: 'Cidade Monções',
        city: 'São Paulo',
        state: 'SP',
        complement: 'Andar 10',
        notes: 'Contrato corporativo para manutenção de sistemas.',
        attachments: [],
        isFavorite: true,
        companyId: defaultCompanyId,
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'cli-3',
        name: 'Mariana Santos Rodrigues',
        cpfCnpj: '456.123.789-11',
        rg: '44.555.666-X',
        birthDate: '1992-09-22',
        phone: '(21) 98888-2222',
        whatsapp: '(21) 98888-2222',
        email: 'mariana.santos@email.com',
        cep: '22040-010',
        address: 'Avenida Atlântica',
        number: '500',
        bairro: 'Copacabana',
        city: 'Rio de Janeiro',
        state: 'RJ',
        complement: 'Cobertura 01',
        notes: 'Cliente de consultoria em Design.',
        attachments: [],
        isFavorite: false,
        companyId: defaultCompanyId,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    await FileDB.saveClients(seededClients);
    console.log('Seeded demo clients');
  }

  // Seed initial Services & Payments if empty for rich dashboard metrics
  const services = await FileDB.getServices();
  if (services.length === 0) {
    const today = new Date();
    const dateMinus15 = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dateMinus5 = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const datePlus5 = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const datePlus15 = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const seededServices = [
      {
        id: 'srv-1',
        serviceNumber: 'OS-2026-001',
        clientId: 'cli-1',
        category: 'Desenvolvimento Web',
        serviceType: 'Criação de Web Site Institucional',
        description: 'Desenvolvimento de site responsivo com painel administrativo em React.',
        requestDate: dateMinus15,
        expectedDate: dateMinus5,
        completionDate: dateMinus5,
        serviceValue: 3500.00,
        discount: 200.00,
        additions: 100.00,
        finalValue: 3400.00,
        status: ServiceStatus.PAGO,
        companyId: defaultCompanyId,
        userId: 'user-admin',
        createdAt: dateMinus15
      },
      {
        id: 'srv-2',
        serviceNumber: 'OS-2026-002',
        clientId: 'cli-2',
        category: 'Suporte Técnico',
        serviceType: 'Manutenção de Servidores corporativos',
        description: 'Otimização e atualização periódica do servidor web Linux na AWS.',
        requestDate: dateMinus5,
        expectedDate: datePlus5,
        serviceValue: 1200.00,
        discount: 0.0,
        additions: 0.0,
        finalValue: 1200.00,
        status: ServiceStatus.EM_ANDAMENTO,
        companyId: defaultCompanyId,
        userId: 'user-regular',
        createdAt: dateMinus5
      },
      {
        id: 'srv-3',
        serviceNumber: 'OS-2026-003',
        clientId: 'cli-3',
        category: 'Consultoria',
        serviceType: 'Consultoria de Design de Produto',
        description: 'Mockups e protótipo interativo Figma para app de delivery.',
        requestDate: dateMinus5,
        expectedDate: datePlus15,
        serviceValue: 4800.00,
        discount: 300.00,
        additions: 0.0,
        finalValue: 4500.00,
        status: ServiceStatus.PARCIALMENTE_PAGO,
        companyId: defaultCompanyId,
        userId: 'user-admin',
        createdAt: dateMinus5
      }
    ];
    await FileDB.saveServices(seededServices);

    const seededPayments = [
      // Service 1 is fully paid à vista
      {
        id: 'pay-1',
        serviceId: 'srv-1',
        clientId: 'cli-1',
        amount: 3400.00,
        dueDate: dateMinus5,
        paymentDate: dateMinus5,
        paidAmount: 3400.00,
        interest: 0,
        penalty: 0,
        discount: 200,
        paymentMethod: 'Pix',
        observation: 'Pagamento integral via Pix.',
        installmentNumber: 1,
        totalInstallments: 1,
        status: PaymentStatus.PAGO,
        companyId: defaultCompanyId,
        createdAt: dateMinus15
      },
      // Service 2 has a pending payment coming up
      {
        id: 'pay-2',
        serviceId: 'srv-2',
        clientId: 'cli-2',
        amount: 1200.00,
        dueDate: datePlus5,
        interest: 0,
        penalty: 0,
        discount: 0,
        paymentMethod: 'Boleto',
        observation: 'Boleto gerado para faturamento.',
        installmentNumber: 1,
        totalInstallments: 1,
        status: PaymentStatus.PENDENTE,
        companyId: defaultCompanyId,
        createdAt: dateMinus5
      },
      // Service 3 has entrance + parcelas: 1 paid installment and 2 pending ones (one overdue!)
      {
        id: 'pay-3',
        serviceId: 'srv-3',
        clientId: 'cli-3',
        amount: 1500.00, // Entrance
        dueDate: dateMinus5,
        paymentDate: dateMinus5,
        paidAmount: 1500.00,
        interest: 0,
        penalty: 0,
        discount: 0,
        paymentMethod: 'Transferência Bancária',
        observation: 'Entrada de 1/3 paga via TED.',
        installmentNumber: 1,
        totalInstallments: 3,
        status: PaymentStatus.PAGO,
        companyId: defaultCompanyId,
        createdAt: dateMinus5
      },
      {
        id: 'pay-4',
        serviceId: 'srv-3',
        clientId: 'cli-3',
        amount: 1500.00, // Overdue parcel
        dueDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        interest: 0,
        penalty: 0,
        discount: 0,
        paymentMethod: 'Cartão de Crédito',
        observation: 'Parcela 2 de 3.',
        installmentNumber: 2,
        totalInstallments: 3,
        status: PaymentStatus.VENCIDO,
        companyId: defaultCompanyId,
        createdAt: dateMinus5
      },
      {
        id: 'pay-5',
        serviceId: 'srv-3',
        clientId: 'cli-3',
        amount: 1500.00, // Future parcel
        dueDate: new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        interest: 0,
        penalty: 0,
        discount: 0,
        paymentMethod: 'Cartão de Crédito',
        observation: 'Parcela 3 de 3.',
        installmentNumber: 3,
        totalInstallments: 3,
        status: PaymentStatus.PENDENTE,
        companyId: defaultCompanyId,
        createdAt: dateMinus5
      }
    ];
    await FileDB.savePayments(seededPayments);
    console.log('Seeded demo services & payments');
  }
}

// Start Server Wrapper
async function startServer() {
  try {
    await initDB();
  } catch (err) {
    console.error('Warning: initDB() failed on startup, continuing anyway:', err);
  }

  const app = express();
  app.use(express.json({ limit: '50mb' })); // support base64 uploads

  // Auth Middleware
  const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({ message: 'Token de autenticação não fornecido' });
      return;
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        res.status(403).json({ message: 'Token inválido ou expirado' });
        return;
      }
      req.user = user;
      next();
    });
  };

  // Roles Middleware
  const requireRole = (roles: UserRole[]) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
      if (!req.user || !roles.includes(req.user.role as UserRole)) {
        res.status(403).json({ message: 'Acesso negado: permissões insuficientes' });
        return;
      }
      next();
    };
  };

  // --- API ROUTES ---

  // Auth: Login
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ message: 'Email e senha são obrigatórios' });
      return;
    }

    try {
      const users = await FileDB.getUsers();
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!user) {
        res.status(401).json({ message: 'Credenciais inválidas' });
        return;
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ message: 'Credenciais inválidas' });
        return;
      }

      const token = jwt.sign(
        { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId },
        JWT_SECRET,
        { expiresIn: '12h' }
      );

      await addAuditLog(user.id, user.name, 'LOGIN', 'Efetuou login no sistema com sucesso', req);

      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId }
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Erro no servidor durante o login', error: error.message });
    }
  });

  // Auth: Get current profile
  app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
      const users = await FileDB.getUsers();
      const user = users.find(u => u.id === req.user.id);
      if (!user) {
        res.status(404).json({ message: 'Usuário não encontrado' });
        return;
      }
      res.json({ id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId });
    } catch (error: any) {
      res.status(500).json({ message: 'Erro no servidor', error: error.message });
    }
  });

  // Users Management (Super Admin ONLY can manage all, others can't)
  app.get('/api/users', authenticateToken, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
    try {
      const users = await FileDB.getUsers();
      // Don't send password hash
      const cleanUsers = users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, companyId: u.companyId }));
      res.json(cleanUsers);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao carregar usuários' });
    }
  });

  app.post('/api/users', authenticateToken, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
    try {
      const { name, email, password, role, companyId } = req.body;
      if (!name || !email || !password || !role) {
        res.status(400).json({ message: 'Dados incompletos para criação de usuário' });
        return;
      }

      const users = await FileDB.getUsers();
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        res.status(400).json({ message: 'Este email já está sendo utilizado' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = {
        id: 'user-' + Math.random().toString(36).substring(2, 9),
        name,
        email,
        passwordHash,
        role,
        companyId: companyId || req.user.companyId
      };

      users.push(newUser);
      await FileDB.saveUsers(users);

      await addAuditLog(req.user.id, req.user.name, 'CADASTRO', `Cadastrou o usuário: ${name} (${role})`, req);

      res.status(201).json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, companyId: newUser.companyId });
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao criar usuário', error: error.message });
    }
  });

  app.put('/api/users/:id', authenticateToken, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
    try {
      const { name, email, password, role, companyId } = req.body;
      const users = await FileDB.getUsers();
      const index = users.findIndex(u => u.id === req.params.id);

      if (index === -1) {
        res.status(404).json({ message: 'Usuário não encontrado' });
        return;
      }

      const existingUserWithEmail = users.find(u => u.email.toLowerCase() === email?.toLowerCase() && u.id !== req.params.id);
      if (existingUserWithEmail) {
        res.status(400).json({ message: 'Este email já está sendo utilizado por outro usuário' });
        return;
      }

      if (name) users[index].name = name;
      if (email) users[index].email = email;
      if (role) users[index].role = role;
      if (companyId) users[index].companyId = companyId;
      if (password) {
        users[index].passwordHash = await bcrypt.hash(password, 10);
      }

      await FileDB.saveUsers(users);
      await addAuditLog(req.user.id, req.user.name, 'EDIÇÃO', `Editou o usuário: ${name || users[index].name}`, req);

      res.json({ id: users[index].id, name: users[index].name, email: users[index].email, role: users[index].role, companyId: users[index].companyId });
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao atualizar usuário' });
    }
  });

  app.delete('/api/users/:id', authenticateToken, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
    try {
      if (req.params.id === req.user.id) {
        res.status(400).json({ message: 'Você não pode excluir a si mesmo' });
        return;
      }

      const users = await FileDB.getUsers();
      const userToDelete = users.find(u => u.id === req.params.id);
      if (!userToDelete) {
        res.status(404).json({ message: 'Usuário não encontrado' });
        return;
      }

      const updatedUsers = users.filter(u => u.id !== req.params.id);
      await FileDB.saveUsers(updatedUsers);

      await addAuditLog(req.user.id, req.user.name, 'EXCLUSÃO', `Excluiu o usuário: ${userToDelete.name}`, req);

      res.json({ message: 'Usuário excluído com sucesso' });
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao excluir usuário' });
    }
  });

  // Clients Endpoints
  app.get('/api/clients', authenticateToken, async (req, res) => {
    try {
      const clients = await FileDB.getClients();
      // Admin/Super Admin view all inside their company, Users can too
      const filtered = clients.filter(c => c.companyId === req.user.companyId);
      res.json(filtered);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao buscar clientes' });
    }
  });

  app.post('/api/clients', authenticateToken, async (req, res) => {
    try {
      const clientData = req.body;
      if (!clientData.name) {
        res.status(400).json({ message: 'Nome é obrigatório' });
        return;
      }

      const clients = await FileDB.getClients();
      const newClient = {
        ...clientData,
        id: 'cli-' + Math.random().toString(36).substring(2, 9),
        attachments: clientData.attachments || [],
        isFavorite: clientData.isFavorite || false,
        companyId: req.user.companyId,
        createdAt: new Date().toISOString()
      };

      clients.push(newClient);
      await FileDB.saveClients(clients);

      await addAuditLog(req.user.id, req.user.name, 'CADASTRO', `Cadastrou o cliente: ${newClient.name}`, req);
      await triggerSystemNotification('Novo Cliente Cadastrado', `O cliente ${newClient.name} foi adicionado ao sistema.`, 'system');

      res.status(201).json(newClient);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao cadastrar cliente', error: error.message });
    }
  });

  app.put('/api/clients/:id', authenticateToken, async (req, res) => {
    try {
      // User or Admin can edit. Let's filter clients first
      const clients = await FileDB.getClients();
      const index = clients.findIndex(c => c.id === req.params.id && c.companyId === req.user.companyId);

      if (index === -1) {
        res.status(404).json({ message: 'Cliente não encontrado' });
        return;
      }

      clients[index] = {
        ...clients[index],
        ...req.body,
        id: clients[index].id, // protect id
        companyId: clients[index].companyId, // protect companyId
        createdAt: clients[index].createdAt // protect createdAt
      };

      await FileDB.saveClients(clients);
      await addAuditLog(req.user.id, req.user.name, 'EDIÇÃO', `Atualizou dados do cliente: ${clients[index].name}`, req);

      res.json(clients[index]);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao atualizar cliente' });
    }
  });

  app.delete('/api/clients/:id', authenticateToken, requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]), async (req, res) => {
    try {
      const clients = await FileDB.getClients();
      const client = clients.find(c => c.id === req.params.id && c.companyId === req.user.companyId);

      if (!client) {
        res.status(404).json({ message: 'Cliente não encontrado' });
        return;
      }

      // Check if client has services linked before deleting
      const services = await FileDB.getServices();
      const hasServices = services.some(s => s.clientId === req.params.id);
      if (hasServices) {
        res.status(400).json({ message: 'Não é possível excluir um cliente com serviços vinculados. Cancele ou remova os serviços primeiro.' });
        return;
      }

      const filtered = clients.filter(c => c.id !== req.params.id);
      await FileDB.saveClients(filtered);

      await addAuditLog(req.user.id, req.user.name, 'EXCLUSÃO', `Excluiu o cliente: ${client.name}`, req);

      res.json({ message: 'Cliente excluído com sucesso' });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao excluir cliente' });
    }
  });

  // Services Endpoints
  app.get('/api/services', authenticateToken, async (req, res) => {
    try {
      const services = await FileDB.getServices();
      let filtered = services.filter(s => s.companyId === req.user.companyId);

      // Level of access control: User can only see their own services
      if (req.user.role === UserRole.USER) {
        filtered = filtered.filter(s => s.userId === req.user.id);
      }

      res.json(filtered);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao buscar serviços' });
    }
  });

  app.post('/api/services', authenticateToken, async (req, res) => {
    try {
      const serviceData = req.body;
      if (!serviceData.serviceType) {
        res.status(400).json({ message: 'Título do Serviço/Agendamento é obrigatório' });
        return;
      }

      const services = await FileDB.getServices();
      const serviceNumber = `OS-${new Date().getFullYear()}-${String(services.length + 1).padStart(3, '0')}`;

      const serviceVal = Number(serviceData.serviceValue || 0);
      const disc = Number(serviceData.discount || 0);
      const add = Number(serviceData.additions || 0);
      const finalVal = serviceVal - disc + add;

      const newService = {
        ...serviceData,
        id: 'srv-' + Math.random().toString(36).substring(2, 9),
        serviceNumber,
        serviceValue: serviceVal,
        discount: disc,
        additions: add,
        finalValue: finalVal,
        companyId: req.user.companyId,
        userId: req.user.id,
        createdAt: new Date().toISOString()
      };

      services.push(newService);
      await FileDB.saveServices(services);

      // Automatically generate a single payment installment (Conta a Receber) for the new service
      const payments = await FileDB.getPayments();
      const isPaid = newService.status === ServiceStatus.PAGO;
      const newPayment = {
        id: 'pay-' + Math.random().toString(36).substring(2, 9),
        serviceId: newService.id,
        clientId: newService.clientId,
        amount: finalVal,
        dueDate: newService.expectedDate || newService.requestDate || new Date().toISOString().split('T')[0],
        paymentDate: isPaid ? (newService.completionDate || new Date().toISOString().split('T')[0]) : undefined,
        paidAmount: isPaid ? finalVal : 0,
        interest: 0,
        penalty: 0,
        discount: disc,
        paymentMethod: serviceData.paymentMethod || 'Pix',
        observation: `Gerado automaticamente a partir da OS ${serviceNumber}`,
        installmentNumber: 1,
        totalInstallments: 1,
        status: isPaid ? PaymentStatus.PAGO : PaymentStatus.PENDENTE,
        companyId: req.user.companyId,
        createdAt: new Date().toISOString()
      };
      payments.push(newPayment);
      await FileDB.savePayments(payments);

      await addAuditLog(req.user.id, req.user.name, 'CADASTRO', `Criou serviço/OS: ${serviceNumber} e gerou parcela financeira`, req);

      // Auto trigger system notification
      const clients = await FileDB.getClients();
      const client = clients.find(c => c.id === serviceData.clientId);
      if (client) {
        await triggerSystemNotification('Novo Serviço Registrado', `O serviço ${serviceNumber} foi criado para o cliente ${client.name}.`, 'system');
      }

      res.status(201).json(newService);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao cadastrar serviço', error: error.message });
    }
  });

  app.put('/api/services/:id', authenticateToken, async (req, res) => {
    try {
      const services = await FileDB.getServices();
      const index = services.findIndex(s => s.id === req.params.id && s.companyId === req.user.companyId);

      if (index === -1) {
        res.status(404).json({ message: 'Serviço não encontrado' });
        return;
      }

      // Check User limitation: User role can only edit their own services
      if (req.user.role === UserRole.USER && services[index].userId !== req.user.id) {
        res.status(403).json({ message: 'Você não possui permissão para editar este serviço' });
        return;
      }

      const oldStatus = services[index].status;
      services[index] = {
        ...services[index],
        ...req.body,
        id: services[index].id,
        serviceNumber: services[index].serviceNumber,
        companyId: services[index].companyId,
        userId: services[index].userId,
        createdAt: services[index].createdAt
      };

      await FileDB.saveServices(services);
      await addAuditLog(req.user.id, req.user.name, 'EDIÇÃO', `Atualizou o serviço: ${services[index].serviceNumber}`, req);

      // Handle service completion notification
      if (services[index].status === ServiceStatus.FINALIZADO && oldStatus !== ServiceStatus.FINALIZADO) {
        await triggerSystemNotification('Serviço Concluído', `O serviço ${services[index].serviceNumber} foi marcado como Finalizado.`, 'system');
        const clients = await FileDB.getClients();
        const client = clients.find(c => c.id === services[index].clientId);
        if (client && client.whatsapp) {
          // Simulated WhatsApp notification via API
          await triggerSystemNotification(
            'WhatsApp: Serviço Concluído',
            `Olá ${client.name}, informamos que o seu serviço ${services[index].serviceNumber} foi finalizado com sucesso!`,
            'whatsapp'
          );
        }
      }

      res.json(services[index]);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao atualizar serviço' });
    }
  });

  app.delete('/api/services/:id', authenticateToken, requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]), async (req, res) => {
    try {
      const services = await FileDB.getServices();
      const service = services.find(s => s.id === req.params.id && s.companyId === req.user.companyId);

      if (!service) {
        res.status(404).json({ message: 'Serviço não encontrado' });
        return;
      }

      // Filter and delete associated payments
      const payments = await FileDB.getPayments();
      const updatedPayments = payments.filter(p => p.serviceId !== req.params.id);
      await FileDB.savePayments(updatedPayments);

      const filteredServices = services.filter(s => s.id !== req.params.id);
      await FileDB.saveServices(filteredServices);

      await addAuditLog(req.user.id, req.user.name, 'EXCLUSÃO', `Excluiu o serviço ${service.serviceNumber} e suas parcelas financeiras`, req);

      res.json({ message: 'Serviço e contas a receber vinculadas excluídos com sucesso' });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao excluir serviço' });
    }
  });

  // Payments / Installments Endpoints
  app.get('/api/payments', authenticateToken, async (req, res) => {
    try {
      const payments = await FileDB.getPayments();
      let filtered = payments.filter(p => p.companyId === req.user.companyId);

      // User role limit: can only see payments linked to their services
      if (req.user.role === UserRole.USER) {
        const services = await FileDB.getServices();
        const myServiceIds = services.filter(s => s.userId === req.user.id).map(s => s.id);
        filtered = filtered.filter(p => myServiceIds.includes(p.serviceId));
      }

      res.json(filtered);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao carregar pagamentos' });
    }
  });

  // Bulk / Cascade Receive Payment Endpoint — MUST be before generic POST /api/payments
  app.post('/api/payments/bulk-receive', authenticateToken, requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]), async (req, res) => {
    try {
      const { clientId, amount, paymentDate, paymentMethod } = req.body;
      const numericAmount = parseFloat(amount);

      if (!clientId || isNaN(numericAmount) || numericAmount <= 0) {
        res.status(400).json({ message: 'Cliente e valor válido são obrigatórios' });
        return;
      }

      const payments = await FileDB.getPayments();
      const clientPayments = payments.filter(p =>
        p.clientId === clientId &&
        p.companyId === req.user.companyId &&
        p.status !== PaymentStatus.PAGO &&
        (p.status as any) !== 'Pago' &&
        (p.status as any) !== 'Cancelado'
      );

      if (clientPayments.length === 0) {
        res.status(400).json({ message: 'Nenhuma parcela em aberto encontrada para este cliente' });
        return;
      }

      // Sort oldest first by dueDate, then installmentNumber, then createdAt/id
      clientPayments.sort((a, b) => {
        const timeA = new Date(a.dueDate).getTime();
        const timeB = new Date(b.dueDate).getTime();
        if (timeA !== timeB) return timeA - timeB;
        const instA = a.installmentNumber || 0;
        const instB = b.installmentNumber || 0;
        if (instA !== instB) return instA - instB;
        return (a.createdAt || a.id).localeCompare(b.createdAt || b.id);
      });

      let remaining = numericAmount;
      let invoicesPaid = 0;
      let hadPartial = false;
      const dateStr = paymentDate || new Date().toISOString().split('T')[0];
      const methodStr = paymentMethod || 'Pix';

      for (const inv of clientPayments) {
        if (remaining <= 0) break;

        const targetIndex = payments.findIndex(p => p.id === inv.id);
        if (targetIndex === -1) continue;

        const alreadyPaid = inv.paidAmount || 0;
        const due = Math.max(0, inv.amount - alreadyPaid);
        if (due <= 0) continue;

        if (remaining >= due) {
          // Full payment of this invoice
          payments[targetIndex] = {
            ...payments[targetIndex],
            status: PaymentStatus.PAGO,
            paidAmount: inv.amount,
            paymentDate: dateStr,
            paymentMethod: methodStr
          };
          remaining = parseFloat((remaining - due).toFixed(2));
          invoicesPaid++;
        } else {
          // Partial payment of this invoice
          payments[targetIndex] = {
            ...payments[targetIndex],
            status: PaymentStatus.PARCIAL,
            paidAmount: parseFloat((alreadyPaid + remaining).toFixed(2)),
            paymentDate: dateStr,
            paymentMethod: methodStr
          };
          hadPartial = true;
          remaining = 0;
          invoicesPaid++;
        }
      }

      await FileDB.savePayments(payments);

      const clients = await FileDB.getClients();
      const client = clients.find(c => c.id === clientId);
      const clientName = client ? client.name : 'Cliente';

      await addAuditLog(req.user.id, req.user.name, 'EDIÇÃO', `Recebeu R$ ${numericAmount.toFixed(2)} de ${clientName}. ${invoicesPaid} parcela(s) atualizada(s).`, req);

      res.json({
        success: true,
        invoicesPaid,
        hadPartial,
        remaining
      });
    } catch (error: any) {
      console.error('Error in bulk-receive endpoint:', error);
      res.status(500).json({ message: 'Erro ao registrar recebimento em lote', error: error.message });
    }
  });

  app.post('/api/payments', authenticateToken, requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]), async (req, res) => {
    try {
      const paymentData = req.body;
      if (!paymentData.serviceId || !paymentData.amount || !paymentData.dueDate) {
        res.status(400).json({ message: 'Campos Serviço, Valor e Vencimento são obrigatórios' });
        return;
      }

      const payments = await FileDB.getPayments();
      const newPayment = {
        ...paymentData,
        id: 'pay-' + Math.random().toString(36).substring(2, 9),
        companyId: req.user.companyId,
        createdAt: new Date().toISOString()
      };

      payments.push(newPayment);
      await FileDB.savePayments(payments);

      await addAuditLog(req.user.id, req.user.name, 'CADASTRO', `Registrou parcela de R$ ${paymentData.amount.toFixed(2)}`, req);
      res.status(201).json(newPayment);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao registrar pagamento', error: error.message });
    }
  });

  // Generate Installments Automatically Helper Endpoint
  app.post('/api/payments/generate-installments', authenticateToken, requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]), async (req, res) => {
    try {
      const { serviceId, clientId, totalValue, planType, numberOfInstallments, firstDueDate, interest, penalty, discount, paymentMethod, observation } = req.body;

      if (!serviceId || !clientId || !totalValue || !firstDueDate) {
        res.status(400).json({ message: 'Parâmetros insuficientes para geração de parcelas' });
        return;
      }

      const payments = await FileDB.getPayments();
      const generated: any[] = [];
      const baseDueDate = new Date(firstDueDate);

      if (planType === 'vista') {
        const p = {
          id: 'pay-' + Math.random().toString(36).substring(2, 9),
          serviceId,
          clientId,
          amount: totalValue,
          dueDate: firstDueDate,
          interest: interest || 0,
          penalty: penalty || 0,
          discount: discount || 0,
          paymentMethod: paymentMethod || 'Pix',
          observation: observation || 'Pagamento à vista',
          installmentNumber: 1,
          totalInstallments: 1,
          status: PaymentStatus.PENDENTE,
          companyId: req.user.companyId,
          createdAt: new Date().toISOString()
        };
        generated.push(p);
      } else if (planType === 'parcelado') {
        const numInst = numberOfInstallments || 1;
        const instVal = parseFloat((totalValue / numInst).toFixed(2));
        const finalAdjustment = parseFloat((totalValue - (instVal * numInst)).toFixed(2));

        for (let i = 1; i <= numInst; i++) {
          const installmentDate = new Date(baseDueDate);
          installmentDate.setMonth(baseDueDate.getMonth() + (i - 1));

          const p = {
            id: 'pay-' + Math.random().toString(36).substring(2, 9),
            serviceId,
            clientId,
            amount: i === numInst ? parseFloat((instVal + finalAdjustment).toFixed(2)) : instVal,
            dueDate: installmentDate.toISOString().split('T')[0],
            interest: interest || 0,
            penalty: penalty || 0,
            discount: 0,
            paymentMethod: paymentMethod || 'Cartão de Crédito',
            observation: observation || `Parcela ${i} de ${numInst}`,
            installmentNumber: i,
            totalInstallments: numInst,
            status: PaymentStatus.PENDENTE,
            companyId: req.user.companyId,
            createdAt: new Date().toISOString()
          };
          generated.push(p);
        }
      } else if (planType === 'entrada_parcelado') {
        const { entranceValue } = req.body;
        const entryVal = entranceValue || 0;
        const remainingVal = totalValue - entryVal;
        const numInst = numberOfInstallments || 1;

        // Entry installment
        const entryP = {
          id: 'pay-' + Math.random().toString(36).substring(2, 9),
          serviceId,
          clientId,
          amount: entryVal,
          dueDate: new Date().toISOString().split('T')[0], // immediate entrance
          interest: 0,
          penalty: 0,
          discount: discount || 0,
          paymentMethod: paymentMethod || 'Pix',
          observation: 'Valor de Entrada / Sinal',
          installmentNumber: 1,
          totalInstallments: numInst + 1,
          status: PaymentStatus.PENDENTE,
          companyId: req.user.companyId,
          createdAt: new Date().toISOString()
        };
        generated.push(entryP);

        // Remaining installments
        const instVal = parseFloat((remainingVal / numInst).toFixed(2));
        const finalAdjustment = parseFloat((remainingVal - (instVal * numInst)).toFixed(2));

        for (let i = 1; i <= numInst; i++) {
          const installmentDate = new Date(baseDueDate);
          installmentDate.setMonth(baseDueDate.getMonth() + (i - 1));

          const p = {
            id: 'pay-' + Math.random().toString(36).substring(2, 9),
            serviceId,
            clientId,
            amount: i === numInst ? parseFloat((instVal + finalAdjustment).toFixed(2)) : instVal,
            dueDate: installmentDate.toISOString().split('T')[0],
            interest: interest || 0,
            penalty: penalty || 0,
            discount: 0,
            paymentMethod: paymentMethod || 'Cartão de Crédito',
            observation: `Parcela ${i} de ${numInst} pós-entrada`,
            installmentNumber: i + 1,
            totalInstallments: numInst + 1,
            status: PaymentStatus.PENDENTE,
            companyId: req.user.companyId,
            createdAt: new Date().toISOString()
          };
          generated.push(p);
        }
      }

      // Save generated payments
      payments.push(...generated);
      await FileDB.savePayments(payments);

      await addAuditLog(req.user.id, req.user.name, 'CADASTRO', `Gerou cronograma financeiro para serviço ID: ${serviceId}. Total: ${generated.length} parcelas.`, req);

      res.status(201).json(generated);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao gerar parcelamento', error: error.message });
    }
  });

  app.put('/api/payments/:id', authenticateToken, requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]), async (req, res) => {
    try {
      const payments = await FileDB.getPayments();
      const index = payments.findIndex(p => p.id === req.params.id && p.companyId === req.user.companyId);

      if (index === -1) {
        res.status(404).json({ message: 'Parcela de pagamento não encontrada' });
        return;
      }

      const oldStatus = payments[index].status;
      payments[index] = {
        ...payments[index],
        ...req.body,
        id: payments[index].id,
        companyId: payments[index].companyId,
        createdAt: payments[index].createdAt
      };

      await FileDB.savePayments(payments);
      await addAuditLog(req.user.id, req.user.name, 'EDIÇÃO', `Atualizou parcela financeira ID ${req.params.id}. Status: ${payments[index].status}`, req);

      // Handle trigger notification when payment is received
      if (payments[index].status === PaymentStatus.PAGO && oldStatus !== PaymentStatus.PAGO) {
        const clients = await FileDB.getClients();
        const client = clients.find(c => c.id === payments[index].clientId);
        const nameText = client ? ` de ${client.name}` : '';

        await triggerSystemNotification(
          'Recebimento Confirmado',
          `Confirmado o recebimento da parcela ${payments[index].installmentNumber}/${payments[index].totalInstallments} no valor de R$ ${payments[index].paidAmount?.toFixed(2) || payments[index].amount.toFixed(2)}${nameText}.`,
          'system'
        );

        if (client && client.whatsapp) {
          await triggerSystemNotification(
            'WhatsApp: Confirmação de Pagamento',
            `Olá ${client.name}, recebemos seu pagamento de R$ ${payments[index].paidAmount?.toFixed(2) || payments[index].amount.toFixed(2)} referente à parcela ${payments[index].installmentNumber}/${payments[index].totalInstallments}. Obrigado!`,
            'whatsapp'
          );
        }
      }

      res.json(payments[index]);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao atualizar pagamento' });
    }
  });

  app.delete('/api/payments/:id', authenticateToken, requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]), async (req, res) => {
    try {
      const payments = await FileDB.getPayments();
      const payment = payments.find(p => p.id === req.params.id && p.companyId === req.user.companyId);

      if (!payment) {
        res.status(404).json({ message: 'Parcela de pagamento não encontrada' });
        return;
      }

      const filtered = payments.filter(p => p.id !== req.params.id);
      await FileDB.savePayments(filtered);

      await addAuditLog(req.user.id, req.user.name, 'EXCLUSÃO', `Excluiu a parcela financeira ID ${req.params.id}`, req);

      res.json({ message: 'Parcela financeira excluída com sucesso' });
    } catch (error) {
      res.status(500).json({ message: 'Erro ao excluir parcela' });
    }
  });

  // Receipts and Contracts Generation Endpoint
  app.post('/api/receipts', authenticateToken, async (req, res) => {
    try {
      const { serviceId, clientId, type, content } = req.body;
      const receipts = await FileDB.getReceipts();

      const validationHash = Math.random().toString(36).substring(2, 15).toUpperCase();
      const qrCodeUrl = `https://servpay-valid.web.app/validate/${validationHash}`;

      const newReceipt = {
        id: (type === 'contract' ? 'cnt-' : 'rec-') + Math.random().toString(36).substring(2, 9),
        serviceId,
        clientId,
        hash: validationHash,
        qrCode: qrCodeUrl,
        content: content || 'Comprovante oficial de quitação financeira.',
        createdAt: new Date().toISOString()
      };

      receipts.push(newReceipt);
      await FileDB.saveReceipts(receipts);

      await addAuditLog(req.user.id, req.user.name, 'CADASTRO', `Gerou ${type === 'contract' ? 'Contrato Simples' : 'Recibo'} com autenticação digital`, req);

      res.status(201).json(newReceipt);
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao gerar documento', error: error.message });
    }
  });

  app.get('/api/receipts', authenticateToken, async (req, res) => {
    try {
      const receipts = await FileDB.getReceipts();
      res.json(receipts);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao buscar recibos' });
    }
  });

  // Company Settings configuration (Admin and Super Admin only)
  app.get('/api/config', authenticateToken, async (req, res) => {
    try {
      const companies = await FileDB.getCompanies();
      const company = companies.find(c => c.id === req.user.companyId);
      if (!company) {
        res.status(404).json({ message: 'Configuração da empresa não encontrada' });
        return;
      }
      res.json(company);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao carregar configurações' });
    }
  });

  app.put('/api/config', authenticateToken, requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]), async (req, res) => {
    try {
      const companies = await FileDB.getCompanies();
      const index = companies.findIndex(c => c.id === req.user.companyId);

      if (index === -1) {
        res.status(404).json({ message: 'Configuração não encontrada' });
        return;
      }

      companies[index] = {
        ...companies[index],
        ...req.body,
        id: companies[index].id // protect ID
      };

      await FileDB.saveCompanies(companies);
      await addAuditLog(req.user.id, req.user.name, 'EDIÇÃO', `Atualizou as configurações da empresa`, req);

      res.json(companies[index]);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao atualizar configurações' });
    }
  });

  // Database Connection Status Endpoint
  app.get('/api/db/status', authenticateToken, async (req, res) => {
    try {
      const useLocal = process.env.USE_LOCAL_DB === 'true';
      if (useLocal) {
        res.json({ connected: true, type: 'local', message: 'Operando localmente (/data)' });
        return;
      }

      // Test reading companies to verify firestore connection
      await FileDB.getCompanies();
      res.json({ connected: true, type: 'firebase', message: 'Conectado ao Firebase Firestore' });
    } catch (error: any) {
      res.json({ connected: false, type: 'firebase_error', message: `Erro Firebase: ${error.message}` });
    }
  });

  // Database Management: Clear Demo Data & Activate Production Mode
  app.post('/api/db/clear-demo', authenticateToken, requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]), async (req, res) => {
    try {
      // 1. Delete all clients, services, payments, notifications, receipts, and logs in parallel
      await Promise.all([
        FileDB.saveClients([]),
        FileDB.saveServices([]),
        FileDB.savePayments([]),
        FileDB.saveNotifications([]),
        FileDB.saveReceipts([]),
        FileDB.saveAuditLogs([])
      ]);

      // 2. Set isProduction to true in company config
      const companies = await FileDB.getCompanies();
      const compIndex = companies.findIndex(c => c.id === req.user.companyId);
      if (compIndex !== -1) {
        companies[compIndex].isProduction = true;
        await FileDB.saveCompanies(companies);
      }

      await addAuditLog(req.user.id, req.user.name, 'LIMPEZA_BANCO', 'Limpou dados de demonstração e ativou o modo Produção real.', req);
      res.json({ message: 'Dados de demonstração removidos com sucesso. O sistema agora está pronto para uso real!' });
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao limpar dados de demonstração', error: error.message });
    }
  });

  // Database Management: Populate Demonstration Data & Deactivate Production Mode
  app.post('/api/db/seed-demo', authenticateToken, requireRole([UserRole.SUPER_ADMIN, UserRole.ADMIN]), async (req, res) => {
    try {
      const today = new Date();
      const dateMinus15 = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const dateMinus5 = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const datePlus5 = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const datePlus15 = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Reset the company config's isProduction flag to false
      const companies = await FileDB.getCompanies();
      const defaultCompanyId = req.user.companyId || 'comp-1';
      const compIndex = companies.findIndex(c => c.id === defaultCompanyId);
      if (compIndex !== -1) {
        companies[compIndex].isProduction = false;
        await FileDB.saveCompanies(companies);
      }

      // Seed clients
      const seededClients = [
        {
          id: 'cli-1',
          name: 'Carlos da Silva Oliveira',
          cpfCnpj: '123.456.789-00',
          rg: '12.345.678-9',
          birthDate: '1985-05-15',
          phone: '(11) 99999-1111',
          whatsapp: '(11) 99999-1111',
          email: 'carlos.silva@email.com',
          cep: '01311-200',
          address: 'Alameda Santos',
          number: '1500',
          bairro: 'Cerqueira César',
          city: 'São Paulo',
          state: 'SP',
          complement: 'Apt 42',
          notes: 'Cliente preferencial desde 2024. Pagamentos pontuais.',
          attachments: [],
          isFavorite: true,
          companyId: defaultCompanyId,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'cli-2',
          name: 'Acme Corporações e Tecnologia',
          cpfCnpj: '98.765.432/0001-01',
          rg: '-',
          birthDate: '2000-01-01',
          phone: '(11) 5555-4444',
          whatsapp: '(11) 95555-4444',
          email: 'contato@acmetec.com.br',
          cep: '04571-010',
          address: 'Rua Arizona',
          number: '120',
          bairro: 'Cidade Monções',
          city: 'São Paulo',
          state: 'SP',
          complement: 'Andar 10',
          notes: 'Contrato corporativo para manutenção de sistemas.',
          attachments: [],
          isFavorite: true,
          companyId: defaultCompanyId,
          createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'cli-3',
          name: 'Mariana Santos Rodrigues',
          cpfCnpj: '456.123.789-11',
          rg: '44.555.666-X',
          birthDate: '1992-09-22',
          phone: '(21) 98888-2222',
          whatsapp: '(21) 98888-2222',
          email: 'mariana.santos@email.com',
          cep: '22040-010',
          address: 'Avenida Atlântica',
          number: '500',
          bairro: 'Copacabana',
          city: 'Rio de Janeiro',
          state: 'RJ',
          complement: 'Cobertura 01',
          notes: 'Cliente de consultoria em Design.',
          attachments: [],
          isFavorite: false,
          companyId: defaultCompanyId,
          createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
      await FileDB.saveClients(seededClients);

      // Seed services
      const seededServices = [
        {
          id: 'srv-1',
          serviceNumber: 'OS-2026-001',
          clientId: 'cli-1',
          category: 'Desenvolvimento Web',
          serviceType: 'Criação de Web Site Institucional',
          description: 'Desenvolvimento de site responsivo com painel administrativo em React.',
          requestDate: dateMinus15,
          expectedDate: dateMinus5,
          completionDate: dateMinus5,
          serviceValue: 3500.00,
          discount: 200.00,
          additions: 100.00,
          finalValue: 3400.00,
          status: ServiceStatus.PAGO,
          companyId: defaultCompanyId,
          userId: 'user-admin',
          createdAt: dateMinus15
        },
        {
          id: 'srv-2',
          serviceNumber: 'OS-2026-002',
          clientId: 'cli-2',
          category: 'Suporte Técnico',
          serviceType: 'Manutenção de Servidores corporativos',
          description: 'Otimização e atualização periódica do servidor web Linux na AWS.',
          requestDate: dateMinus5,
          expectedDate: datePlus5,
          serviceValue: 1200.00,
          discount: 0.0,
          additions: 0.0,
          finalValue: 1200.00,
          status: ServiceStatus.EM_ANDAMENTO,
          companyId: defaultCompanyId,
          userId: 'user-regular',
          createdAt: dateMinus5
        },
        {
          id: 'srv-3',
          serviceNumber: 'OS-2026-003',
          clientId: 'cli-3',
          category: 'Consultoria',
          serviceType: 'Consultoria de Design de Produto',
          description: 'Mockups e protótipo interativo Figma para app de delivery.',
          requestDate: dateMinus5,
          expectedDate: datePlus15,
          serviceValue: 4800.00,
          discount: 300.00,
          additions: 0.0,
          finalValue: 4500.00,
          status: ServiceStatus.PARCIALMENTE_PAGO,
          companyId: defaultCompanyId,
          userId: 'user-admin',
          createdAt: dateMinus5
        }
      ];
      await FileDB.saveServices(seededServices);

      // Seed payments
      const seededPayments = [
        {
          id: 'pay-1',
          serviceId: 'srv-1',
          clientId: 'cli-1',
          amount: 3400.00,
          dueDate: dateMinus5,
          paymentDate: dateMinus5,
          paidAmount: 3400.00,
          interest: 0,
          penalty: 0,
          discount: 200,
          paymentMethod: 'Pix',
          observation: 'Pagamento integral via Pix.',
          installmentNumber: 1,
          totalInstallments: 1,
          status: PaymentStatus.PAGO,
          companyId: defaultCompanyId,
          createdAt: dateMinus15
        },
        {
          id: 'pay-2',
          serviceId: 'srv-2',
          clientId: 'cli-2',
          amount: 1200.00,
          dueDate: datePlus5,
          interest: 0,
          penalty: 0,
          discount: 0,
          paymentMethod: 'Boleto',
          observation: 'Boleto gerado para faturamento.',
          installmentNumber: 1,
          totalInstallments: 1,
          status: PaymentStatus.PENDENTE,
          companyId: defaultCompanyId,
          createdAt: dateMinus5
        },
        {
          id: 'pay-3',
          serviceId: 'srv-3',
          clientId: 'cli-3',
          amount: 1500.00,
          dueDate: dateMinus5,
          paymentDate: dateMinus5,
          paidAmount: 1500.00,
          interest: 0,
          penalty: 0,
          discount: 0,
          paymentMethod: 'Transferência Bancária',
          observation: 'Entrada de 1/3 paga via TED.',
          installmentNumber: 1,
          totalInstallments: 3,
          status: PaymentStatus.PAGO,
          companyId: defaultCompanyId,
          createdAt: dateMinus5
        },
        {
          id: 'pay-4',
          serviceId: 'srv-3',
          clientId: 'cli-3',
          amount: 1500.00,
          dueDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          interest: 0,
          penalty: 0,
          discount: 0,
          paymentMethod: 'Cartão de Crédito',
          observation: 'Parcela 2 de 3.',
          installmentNumber: 2,
          totalInstallments: 3,
          status: PaymentStatus.VENCIDO,
          companyId: defaultCompanyId,
          createdAt: dateMinus5
        },
        {
          id: 'pay-5',
          serviceId: 'srv-3',
          clientId: 'cli-3',
          amount: 1500.00,
          dueDate: new Date(today.getTime() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          interest: 0,
          penalty: 0,
          discount: 0,
          paymentMethod: 'Cartão de Crédito',
          observation: 'Parcela 3 de 3.',
          installmentNumber: 3,
          totalInstallments: 3,
          status: PaymentStatus.PENDENTE,
          companyId: defaultCompanyId,
          createdAt: dateMinus5
        }
      ];
      await FileDB.savePayments(seededPayments);

      await addAuditLog(req.user.id, req.user.name, 'RESTAURO_DEMO', 'Restaurou os dados de demonstração no sistema.', req);
      res.json({ message: 'Dados de demonstração restaurados com sucesso!' });
    } catch (error: any) {
      res.status(500).json({ message: 'Erro ao restaurar dados de demonstração', error: error.message });
    }
  });

  // Audit Logs Endpoints
  app.get('/api/audit', authenticateToken, requireRole([UserRole.SUPER_ADMIN]), async (req, res) => {
    try {
      const logs = await FileDB.getAuditLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao carregar log de auditoria' });
    }
  });

  // Notifications Endpoint
  app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
      const notifications = await FileDB.getNotifications();
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: 'Erro ao carregar notificações' });
    }
  });

  // --- SERVE STATIC FRONTEND AND VITE DEV ENVIRONMENT ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server running on http://0.0.0.0:${PORT}`);
  });
}

// Global process error catching
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();

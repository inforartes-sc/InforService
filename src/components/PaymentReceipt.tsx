/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { Payment, Client, Company, PaymentStatus } from '../types';
import { X, Printer, Download, CheckCircle } from 'lucide-react';

interface ReceiptLine {
  serviceNumber: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  paidAmount: number;
  status: PaymentStatus;
  dueDate: string;
  observation?: string;
}

interface PaymentReceiptProps {
  receiptNumber: string;
  paymentDate: string;
  paymentMethod: string;
  totalPaid: number;
  client: Client;
  company: Company | null;
  lines: ReceiptLine[];
  remainingBalance: number;
  operatorName: string;
  onClose: () => void;
}

function fmt(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(dateStr: string) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function PaymentReceipt({
  receiptNumber,
  paymentDate,
  paymentMethod,
  totalPaid,
  client,
  company,
  lines,
  remainingBalance,
  operatorName,
  onClose,
}: PaymentReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = receiptRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank', 'width=800,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Comprovante de Pagamento - ${receiptNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #111827; background: #fff; }
          .receipt { width: 100%; max-width: 680px; margin: 0 auto; padding: 32px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 20px; }
          .company-name { font-size: 20px; font-weight: 800; color: #4f46e5; }
          .company-info { font-size: 10px; color: #6b7280; margin-top: 4px; line-height: 1.6; }
          .receipt-badge { background: #4f46e5; color: white; padding: 8px 16px; border-radius: 8px; text-align: center; }
          .receipt-badge .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; }
          .receipt-badge .number { font-size: 15px; font-weight: 800; }
          .section { margin-bottom: 16px; }
          .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: 700; margin-bottom: 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .info-item { }
          .info-label { font-size: 9px; text-transform: uppercase; color: #9ca3af; font-weight: 600; }
          .info-value { font-size: 12px; color: #111827; font-weight: 600; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f3f4f6; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 700; padding: 8px 10px; text-align: left; }
          td { padding: 8px 10px; font-size: 11px; border-bottom: 1px solid #f3f4f6; }
          .status-pago { background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 99px; font-size: 9px; font-weight: 700; }
          .status-parcial { background: #fef9c3; color: #854d0e; padding: 2px 8px; border-radius: 99px; font-size: 9px; font-weight: 700; }
          .total-box { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 10px; padding: 16px 20px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; }
          .total-label { font-size: 12px; font-weight: 700; color: #166534; }
          .total-value { font-size: 22px; font-weight: 900; color: #16a34a; }
          .footer { margin-top: 32px; border-top: 1px dashed #d1d5db; padding-top: 20px; }
          .sig-area { display: flex; justify-content: space-around; margin-top: 16px; }
          .sig-line { text-align: center; }
          .sig-line .line { border-bottom: 1px solid #374151; width: 180px; margin-bottom: 6px; height: 32px; }
          .sig-line .label { font-size: 9px; color: #6b7280; }
          .watermark { text-align: center; font-size: 9px; color: #d1d5db; margin-top: 24px; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const now = new Date();
  const emittedAt = now.toLocaleString('pt-BR');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* Modal wrapper */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-bold text-slate-800">Comprovante de Pagamento</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Receipt content (scrollable) */}
        <div className="overflow-y-auto flex-1 p-4">
          <div ref={receiptRef} className="receipt" style={{ fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: '12px', color: '#111827', background: '#fff', padding: '32px', maxWidth: '680px', margin: '0 auto' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #4f46e5', paddingBottom: '20px', marginBottom: '20px' }}>
              <div>
                {company?.logoUrl && (
                  <img src={company.logoUrl} alt="Logo" style={{ height: '44px', objectFit: 'contain', marginBottom: '8px' }} />
                )}
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#4f46e5' }}>{company?.name || 'InforService'}</div>
                <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px', lineHeight: '1.7' }}>
                  {company?.cnpj && <span>CNPJ: {company.cnpj}<br /></span>}
                  {company?.phone && <span>Tel: {company.phone}<br /></span>}
                  {company?.address && <span>{company.address}</span>}
                </div>
              </div>
              <div style={{ background: '#4f46e5', color: 'white', padding: '10px 18px', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>Comprovante</div>
                <div style={{ fontSize: '16px', fontWeight: 900, marginTop: '2px' }}>#{receiptNumber}</div>
                <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>{fmtDate(paymentDate)}</div>
              </div>
            </div>

            {/* Client info */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280', fontWeight: 700, marginBottom: '8px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
                Dados do Cliente
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 600 }}>Nome</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', marginTop: '2px' }}>{client.name}</div>
                </div>
                {client.cpfCnpj && (
                  <div>
                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 600 }}>CPF / CNPJ</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginTop: '2px' }}>{client.cpfCnpj}</div>
                  </div>
                )}
                {client.phone && (
                  <div>
                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 600 }}>Telefone</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginTop: '2px' }}>{client.phone}</div>
                  </div>
                )}
                {client.city && (
                  <div>
                    <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 600 }}>Cidade</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', marginTop: '2px' }}>{client.city} - {client.state}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment info */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280', fontWeight: 700, marginBottom: '8px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
                Dados do Recebimento
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 600 }}>Data do Recebimento</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827', marginTop: '2px' }}>{fmtDate(paymentDate)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 600 }}>Forma de Pagamento</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827', marginTop: '2px' }}>{paymentMethod}</div>
                </div>
                <div>
                  <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 600 }}>Operador</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827', marginTop: '2px' }}>{operatorName}</div>
                </div>
              </div>
            </div>

            {/* Lines table */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280', fontWeight: 700, marginBottom: '8px', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px' }}>
                Parcelas Quitadas / Abatidas
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, padding: '8px 10px', textAlign: 'left' }}>O.S.</th>
                    <th style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, padding: '8px 10px', textAlign: 'left' }}>Parcela</th>
                    <th style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, padding: '8px 10px', textAlign: 'left' }}>Vencimento</th>
                    <th style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, padding: '8px 10px', textAlign: 'right' }}>Valor</th>
                    <th style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, padding: '8px 10px', textAlign: 'right' }}>Pago</th>
                    <th style={{ fontSize: '9px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, padding: '8px 10px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 600 }}>{line.serviceNumber}</td>
                      <td style={{ padding: '8px 10px', fontSize: '11px' }}>{line.installmentNumber}/{line.totalInstallments}</td>
                      <td style={{ padding: '8px 10px', fontSize: '11px' }}>{fmtDate(line.dueDate)}</td>
                      <td style={{ padding: '8px 10px', fontSize: '11px', textAlign: 'right' }}>{fmt(line.amount)}</td>
                      <td style={{ padding: '8px 10px', fontSize: '11px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>{fmt(line.paidAmount)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{
                          background: line.status === PaymentStatus.PAGO ? '#dcfce7' : '#fef9c3',
                          color: line.status === PaymentStatus.PAGO ? '#166534' : '#854d0e',
                          padding: '2px 8px',
                          borderRadius: '99px',
                          fontSize: '9px',
                          fontWeight: 700
                        }}>
                          {line.status === PaymentStatus.PAGO ? 'Quitado' : 'Parcial'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total box */}
            <div style={{ background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '10px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>Total Recebido</div>
                {remainingBalance > 0 && (
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>Saldo restante: {fmt(remainingBalance)}</div>
                )}
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#16a34a' }}>{fmt(totalPaid)}</div>
            </div>

            {/* Footer / signatures */}
            <div style={{ marginTop: '32px', borderTop: '1px dashed #d1d5db', paddingTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderBottom: '1px solid #374151', width: '180px', marginBottom: '6px', height: '32px' }}></div>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>Assinatura do Responsável</div>
                  <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: 600 }}>{company?.name || 'Empresa'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderBottom: '1px solid #374151', width: '180px', marginBottom: '6px', height: '32px' }}></div>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>Assinatura do Cliente</div>
                  <div style={{ fontSize: '9px', color: '#6b7280', fontWeight: 600 }}>{client.name}</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', fontSize: '9px', color: '#d1d5db', marginTop: '24px' }}>
                Emitido em {emittedAt} • Comprovante #{receiptNumber} • {company?.name || 'InforService'}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

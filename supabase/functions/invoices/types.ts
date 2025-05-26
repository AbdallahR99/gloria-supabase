// File: functions/invoices/types.ts
/**
 * TypeScript type definitions for the invoices module
 * Matches PostgreSQL enum types and database schema
 */

// Enum types matching PostgreSQL enums
export type InvoiceType = 'online' | 'instore' | 'manual';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'failed' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'online' | 'bank_transfer' | 'check' | 'other';

// Database record interfaces
export interface Invoice {
  id: string;
  invoice_number: string;
  order_id?: string;
  order_code?: string;
  invoice_type: InvoiceType;
  status: InvoiceStatus;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  subtotal: number;
  tax_amount: number;
  tax_rate: number;
  discount_amount: number;
  shipping_amount: number;
  total_amount: number;
  payment_method?: PaymentMethod;
  payment_status: PaymentStatus;
  payment_date?: string;
  payment_reference?: string;
  invoice_date: string;
  due_date: string;
  notes?: string;
  internal_notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  is_deleted: boolean;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id?: string;
  sku: string;
  product_name: string;
  product_name_ar?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  size?: string;
  color?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  is_deleted: boolean;
}

// Request/Response interfaces
export interface CreateInvoiceRequest {
  invoice_type?: InvoiceType;
  status?: InvoiceStatus;
  order_id?: string;
  order_code?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  tax_rate?: number;
  discount_amount?: number;
  shipping_amount?: number;
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  payment_date?: string;
  payment_reference?: string;
  due_date?: string;
  notes?: string;
  internal_notes?: string;
  items: CreateInvoiceItemRequest[];
}

export interface CreateInvoiceItemRequest {
  product_id?: string;
  sku: string;
  quantity: number;
  unit_price?: number; // Will be fetched from product if not provided
  size?: string;
  color?: string;
}

export interface UpdateInvoiceRequest {
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  tax_rate?: number;
  discount_amount?: number;
  shipping_amount?: number;
  due_date?: string;
  notes?: string;
  internal_notes?: string;
}

export interface UpdateInvoiceStatusRequest {
  new_status: InvoiceStatus;
  reason?: string;
  notify_customer?: boolean;
}

export interface MarkInvoicePaidRequest {
  payment_method: PaymentMethod;
  payment_reference?: string;
  payment_date?: string;
  notes?: string;
}

export interface BulkCreateInvoicesRequest {
  order_ids: string[];
  invoice_type?: InvoiceType;
  payment_method?: PaymentMethod;
  notes?: string;
}

export interface BulkDeleteInvoicesRequest {
  invoice_ids: string[];
  force?: boolean;
  reason?: string;
}

export interface AddInvoiceItemRequest {
  product_id?: string;
  sku: string;
  quantity: number;
  unit_price?: number;
  size?: string;
  color?: string;
}

export interface UpdateInvoiceItemRequest {
  quantity?: number;
  unit_price?: number;
  size?: string;
  color?: string;
}

// Response interfaces
export interface InvoiceResponse {
  success: boolean;
  data?: Invoice & {
    items?: InvoiceItem[];
    order?: any;
  };
  error?: string;
  message?: string;
}

export interface InvoiceListResponse {
  success: boolean;
  data?: {
    invoices: Invoice[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  };
  error?: string;
}

export interface BulkOperationResponse {
  success: boolean;
  data?: {
    successful: string[];
    failed: Array<{
      id: string;
      error: string;
    }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  };
  error?: string;
}

// Validation functions
export function isValidInvoiceType(value: string): value is InvoiceType {
  return ['online', 'instore', 'manual'].includes(value);
}

export function isValidInvoiceStatus(value: string): value is InvoiceStatus {
  return ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded'].includes(value);
}

export function isValidPaymentStatus(value: string): value is PaymentStatus {
  return ['pending', 'paid', 'partial', 'failed', 'refunded'].includes(value);
}

export function isValidPaymentMethod(value: string): value is PaymentMethod {
  return ['cash', 'card', 'online', 'bank_transfer', 'check', 'other'].includes(value);
}

// Status transition validation
export function isValidStatusTransition(currentStatus: InvoiceStatus, newStatus: InvoiceStatus): boolean {
  const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
    'draft': ['sent', 'cancelled'],
    'sent': ['paid', 'overdue', 'cancelled'],
    'paid': ['refunded'],
    'overdue': ['paid', 'cancelled'],
    'cancelled': [], // Cannot transition from cancelled
    'refunded': [] // Cannot transition from refunded
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
}

// Utility functions
export function calculateInvoiceTotal(
  subtotal: number,
  taxAmount: number,
  shippingAmount: number,
  discountAmount: number
): number {
  return subtotal + taxAmount + shippingAmount - discountAmount;
}

export function calculateTaxAmount(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * (taxRate / 100) * 100) / 100;
}

export function generateInvoiceNumber(date?: Date): string {
  const today = date || new Date();
  const dateStr = today.toISOString().split('T')[0];
  // This is a client-side fallback - actual generation happens in PostgreSQL
  const randomNum = Math.floor(Math.random() * 9999) + 1;
  return `INV-${dateStr}-${randomNum.toString().padStart(4, '0')}`;
}

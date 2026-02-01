// =====================================================
// SUPABASE EDGE FUNCTION - INVOICES
// Create and manage invoices/billing
// =====================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =====================================================
// CONFIG & TYPES
// =====================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface InvoiceItem {
  item_id?: string;
  invoice_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  tax_rate?: number;
  total: number;
}

interface Invoice {
  invoice_id?: string;
  clinic_id: string;
  patient_id: string;
  appointment_id?: string;
  invoice_number?: string;
  issue_date: string;
  due_date?: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  payment_method?: string;
  payment_date?: string;
  notes?: string;
  items?: InvoiceItem[];
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
}

// =====================================================
// INVOICE NUMBER GENERATION
// =====================================================

async function generateInvoiceNumber(clinicId: string): Promise<string> {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2);
  const month = String(today.getMonth() + 1).padStart(2, '0');

  // Get count for this month
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .like('invoice_number', `INV-${clinicId}-${year}${month}%`);

  const sequence = String((count || 0) + 1).padStart(4, '0');
  return `INV-${clinicId}-${year}${month}-${sequence}`;
}

// =====================================================
// CRUD OPERATIONS
// =====================================================

// GET - Fetch invoices
async function getInvoices(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const clinicId = url.searchParams.get('clinic_id');
  const patientId = url.searchParams.get('patient_id');
  const status = url.searchParams.get('status');
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('page_size') || '20');

  let query = supabase
    .from('invoices')
    .select(`
      *,
      patient:patients(name, phone),
      clinic:clinics(name),
      appointment:appointments(appointment_date)
    `, { count: 'exact' });

  if (clinicId) query = query.eq('clinic_id', clinicId);
  if (patientId) query = query.eq('patient_id', patientId);
  if (status) query = query.eq('status', status);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order('issue_date', { ascending: false })
    .range(from, to);

  if (error) {
    return Response.json({
      success: false,
      error: { message: error.message, code: error.code },
    }, { status: 400 });
  }

  return Response.json({
    success: true,
    data: {
      data: data || [],
      count: count || 0,
      page,
      pageSize,
      hasMore: (count || 0) > to + 1,
    },
  });
}

// GET - Fetch single invoice with items
async function getInvoice(invoiceId: string): Promise<Response> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      patient:patients(*),
      clinic:clinics(*),
      appointment:appointments(*),
      items:invoice_items(*)
    `)
    .eq('invoice_id', invoiceId)
    .single();

  if (error) {
    return Response.json({
      success: false,
      error: { message: error.message, code: error.code },
    }, { status: 404 });
  }

  return Response.json({ success: true, data });
}

// POST - Create invoice
async function createInvoice(req: Request): Promise<Response> {
  const body = await req.json() as Partial<Invoice>;

  // Validate required fields
  if (!body.clinic_id || !body.patient_id || !body.issue_date) {
    return Response.json({
      success: false,
      error: { message: 'Missing required fields', code: 'MISSING_FIELDS' },
    }, { status: 400 });
  }

  // Validate items
  if (!body.items || body.items.length === 0) {
    return Response.json({
      success: false,
      error: { message: 'Invoice must have at least one item', code: 'NO_ITEMS' },
    }, { status: 400 });
  }

  // Calculate totals
  let subtotal = 0;
  for (const item of body.items) {
    const itemTotal = (item.unit_price * item.quantity) - (item.discount || 0);
    item.total = itemTotal;
    subtotal += itemTotal;
  }

  const taxAmount = subtotal * 0.07; // 7% VAT
  const total = subtotal - (body.discount_amount || 0) + taxAmount;

  // Generate invoice number
  const invoiceNumber = body.invoice_number || await generateInvoiceNumber(body.clinic_id);

  // Create invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      clinic_id: body.clinic_id,
      patient_id: body.patient_id,
      appointment_id: body.appointment_id,
      invoice_number: invoiceNumber,
      issue_date: body.issue_date,
      due_date: body.due_date,
      subtotal,
      discount_amount: body.discount_amount || 0,
      tax_amount: taxAmount,
      total,
      status: 'draft',
      notes: body.notes,
    })
    .select()
    .single();

  if (invoiceError) {
    return Response.json({
      success: false,
      error: { message: invoiceError.message, code: invoiceError.code },
    }, { status: 500 });
  }

  // Create invoice items
  const itemsWithInvoiceId = body.items.map(item => ({
    ...item,
    invoice_id: invoice.invoice_id,
  }));

  const { data: items } = await supabase
    .from('invoice_items')
    .insert(itemsWithInvoiceId)
    .select();

  return Response.json({
    success: true,
    data: { invoice, items },
  }, { status: 201 });
}

// PATCH - Update invoice
async function updateInvoice(invoiceId: string, req: Request): Promise<Response> {
  const body = await req.json() as Partial<Invoice>;

  // Only allow certain updates
  const allowedFields = [
    'due_date', 'discount_amount', 'notes', 'status'
  ];

  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field as keyof Invoice] !== undefined) {
      updateData[field] = body[field as keyof Invoice];
    }
  }

  // Add payment date if status is paid
  if (body.status === 'paid' && !body.payment_date) {
    updateData.payment_date = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('invoice_id', invoiceId)
    .select()
    .single();

  if (error) {
    return Response.json({
      success: false,
      error: { message: error.message, code: error.code },
    }, { status: 500 });
  }

  return Response.json({ success: true, data });
}

// DELETE - Delete invoice (soft delete by cancelling)
async function deleteInvoice(invoiceId: string): Promise<Response> {
  const { error } = await supabase
    .from('invoices')
    .update({ status: 'cancelled' })
    .eq('invoice_id', invoiceId)
    .neq('status', 'paid'); // Can't cancel paid invoices

  if (error) {
    return Response.json({
      success: false,
      error: { message: error.message, code: error.code },
    }, { status: 500 });
  }

  return Response.json({ success: true });
}

// =====================================================
// PAYMENT WEBHOOK
// =====================================================

async function handlePaymentWebhook(req: Request): Promise<Response> {
  const body = await req.json();
  const { invoice_id, payment_method, transaction_id, amount } = body;

  if (!invoice_id || !payment_method || !amount) {
    return Response.json({
      success: false,
      error: { message: 'Missing required fields', code: 'MISSING_FIELDS' },
    }, { status: 400 });
  }

  // Verify invoice exists and matches amount
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('invoice_id', invoice_id)
    .single();

  if (!invoice) {
    return Response.json({
      success: false,
      error: { message: 'Invoice not found', code: 'NOT_FOUND' },
    }, { status: 404 });
  }

  if (Math.abs(invoice.total - amount) > 0.01) {
    return Response.json({
      success: false,
      error: { message: 'Amount mismatch', code: 'AMOUNT_MISMATCH' },
    }, { status: 400 });
  }

  // Update invoice as paid
  const { data, error } = await supabase
    .from('invoices')
    .update({
      status: 'paid',
      payment_method,
      payment_date: new Date().toISOString(),
    })
    .eq('invoice_id', invoice_id)
    .select()
    .single();

  if (error) {
    return Response.json({
      success: false,
      error: { message: error.message, code: error.code },
    }, { status: 500 });
  }

  // Record payment
  await supabase.from('payments').insert({
    invoice_id,
    amount,
    payment_method,
    transaction_id,
    paid_at: new Date().toISOString(),
    status: 'completed',
  });

  return Response.json({ success: true, data });
}

// =====================================================
// SUMMARY
// =====================================================

async function getInvoiceSummary(clinicId: string, startDate: string, endDate: string): Promise<Response> {
  const { data: invoices } = await supabase
    .from('invoices')
    .select('status, total, payment_date')
    .eq('clinic_id', clinicId)
    .gte('issue_date', startDate)
    .lte('issue_date', endDate);

  const totalAmount = invoices?.reduce((sum, inv) => sum + inv.total, 0) || 0;
  const paidAmount = invoices?.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0) || 0;
  const pendingAmount = invoices?.filter(inv => ['draft', 'sent'].includes(inv.status)).reduce((sum, inv) => sum + inv.total, 0) || 0;
  const overdueAmount = invoices?.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.total, 0) || 0;

  const countByStatus = {
    draft: invoices?.filter(inv => inv.status === 'draft').length || 0,
    sent: invoices?.filter(inv => inv.status === 'sent').length || 0,
    paid: invoices?.filter(inv => inv.status === 'paid').length || 0,
    overdue: invoices?.filter(inv => inv.status === 'overdue').length || 0,
    cancelled: invoices?.filter(inv => inv.status === 'cancelled').length || 0,
  };

  return Response.json({
    success: true,
    data: {
      total_amount: totalAmount,
      paid_amount: paidAmount,
      pending_amount: pendingAmount,
      overdue_amount: overdueAmount,
      collection_rate: totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0,
      count_by_status: countByStatus,
    },
  });
}

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const invoiceId = pathParts[pathParts.length - 1] !== 'invoices'
    ? pathParts[pathParts.length - 1]
    : null;

  try {
    // GET /invoices - List invoices
    if (req.method === 'GET' && !invoiceId) {
      const action = url.searchParams.get('action');

      if (action === 'summary') {
        const clinicId = url.searchParams.get('clinic_id');
        const startDate = url.searchParams.get('start_date');
        const endDate = url.searchParams.get('end_date');

        if (!clinicId || !startDate || !endDate) {
          return Response.json({
            success: false,
            error: { message: 'Missing clinic_id, start_date, or end_date', code: 'MISSING_PARAMS' },
          }, { status: 400 });
        }

        return await getInvoiceSummary(clinicId, startDate, endDate);
      }

      return await getInvoices(req);
    }

    // GET /invoices/:id - Get single invoice
    if (req.method === 'GET' && invoiceId) {
      return await getInvoice(invoiceId);
    }

    // POST /invoices - Create invoice
    if (req.method === 'POST' && !invoiceId) {
      const action = url.searchParams.get('action');

      if (action === 'payment-webhook') {
        return await handlePaymentWebhook(req);
      }

      return await createInvoice(req);
    }

    // PATCH /invoices/:id - Update invoice
    if (req.method === 'PATCH' && invoiceId) {
      return await updateInvoice(invoiceId, req);
    }

    // DELETE /invoices/:id - Delete invoice
    if (req.method === 'DELETE' && invoiceId) {
      return await deleteInvoice(invoiceId);
    }

    return Response.json({
      success: false,
      error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
    }, { status: 405 });

  } catch (error) {
    console.error('Error in invoices function:', error);
    return Response.json({
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
    }, { status: 500 });
  }
});

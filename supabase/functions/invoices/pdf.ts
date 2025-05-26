// File: functions/invoices/pdf.ts
export async function handleGetInvoicePDF(req, supabase, user, authError) {
  if (authError || !user) throw new Error("Unauthorized");
  
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const invoiceId = pathParts[pathParts.length - 2]; // Second to last since URL ends with /pdf
  
  if (!invoiceId) {
    return json({ message: "Invoice ID is required" }, 400);
  }

  try {    // Get invoice with all related data (no external FK dependencies)
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        invoice_items(*)
      `)
      .eq("id", invoiceId)
      .eq("is_deleted", false)
      .single();

    if (invoiceError || !invoice) {
      return json({ message: "Invoice not found" }, 404);
    }

    // Check permissions
    if (invoice.user_id !== user.id) {
      // TODO: Add staff role check here
      throw new Error("Unauthorized to access this invoice");
    }

    // Generate HTML for the invoice
    const invoiceHTML = generateInvoiceHTML(invoice);
    
    // For now, return the HTML directly
    // In a production environment, you would use a PDF generation service like Puppeteer
    return new Response(invoiceHTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoice_number}.html"`
      }
    });

  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    throw error;
  }
}

function generateInvoiceHTML(invoice) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: invoice.currency || 'AED'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const companyInfo = {
    name: 'Gloria Perfumes',
    nameAr: 'عطور جلوريا',
    address: 'Riyadh, Saudi Arabia',
    addressAr: 'الرياض، المملكة العربية السعودية',
    phone: '+966 XX XXX XXXX',
    email: 'info@gloriaperfumes.com',
    website: 'www.gloriaperfumes.com'
  };

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${invoice.invoice_number}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Arial', sans-serif;
                line-height: 1.6;
                color: #333;
                background: #f8f9fa;
                padding: 20px;
            }
            
            .invoice-container {
                max-width: 800px;
                margin: 0 auto;
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 0 20px rgba(0,0,0,0.1);
            }
            
            .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 40px;
                padding-bottom: 20px;
                border-bottom: 2px solid #e9ecef;
            }
            
            .company-info h1 {
                color: #2c3e50;
                font-size: 28px;
                margin-bottom: 5px;
            }
            
            .company-info .arabic {
                font-size: 24px;
                color: #7f8c8d;
                margin-bottom: 10px;
            }
            
            .company-info p {
                color: #7f8c8d;
                font-size: 14px;
                margin-bottom: 3px;
            }
            
            .invoice-details h2 {
                color: #e74c3c;
                font-size: 24px;
                margin-bottom: 10px;
            }
            
            .invoice-details p {
                font-size: 16px;
                margin-bottom: 5px;
            }
            
            .billing-section {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 40px;
                margin-bottom: 40px;
            }
            
            .billing-info h3 {
                color: #2c3e50;
                font-size: 18px;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #e9ecef;
            }
            
            .billing-info p {
                margin-bottom: 5px;
                font-size: 14px;
            }
            
            .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
            }
            
            .items-table th {
                background: #34495e;
                color: white;
                padding: 15px 10px;
                text-align: center;
                font-weight: bold;
            }
            
            .items-table td {
                padding: 12px 10px;
                text-align: center;
                border-bottom: 1px solid #e9ecef;
            }
            
            .items-table tr:nth-child(even) {
                background: #f8f9fa;
            }
            
            .totals {
                margin-left: auto;
                width: 300px;
            }
            
            .totals table {
                width: 100%;
                border-collapse: collapse;
            }
            
            .totals td {
                padding: 8px 15px;
                border-bottom: 1px solid #e9ecef;
            }
            
            .totals .total-row {
                background: #34495e;
                color: white;
                font-weight: bold;
                font-size: 18px;
            }
            
            .payment-info {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 5px;
                margin-top: 30px;
            }
            
            .payment-info h3 {
                color: #2c3e50;
                margin-bottom: 10px;
            }
            
            .status {
                display: inline-block;
                padding: 5px 15px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: bold;
                text-transform: uppercase;
            }
            
            .status.pending {
                background: #fff3cd;
                color: #856404;
            }
            
            .status.paid {
                background: #d4edda;
                color: #155724;
            }
            
            .status.overdue {
                background: #f8d7da;
                color: #721c24;
            }
            
            .notes {
                margin-top: 30px;
                padding: 20px;
                background: #e9ecef;
                border-radius: 5px;
            }
            
            .footer {
                margin-top: 40px;
                text-align: center;
                color: #7f8c8d;
                font-size: 12px;
                border-top: 1px solid #e9ecef;
                padding-top: 20px;
            }
            
            @media print {
                body {
                    background: white;
                    padding: 0;
                }
                
                .invoice-container {
                    box-shadow: none;
                    padding: 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <div class="header">
                <div class="company-info">
                    <h1>${companyInfo.name}</h1>
                    <p class="arabic">${companyInfo.nameAr}</p>
                    <p>${companyInfo.address}</p>
                    <p class="arabic">${companyInfo.addressAr}</p>
                    <p>Phone: ${companyInfo.phone}</p>
                    <p>Email: ${companyInfo.email}</p>
                    <p>Website: ${companyInfo.website}</p>
                </div>
                <div class="invoice-details">
                    <h2>INVOICE فاتورة</h2>
                    <p><strong>Invoice #:</strong> ${invoice.invoice_number}</p>
                    <p><strong>Date:</strong> ${formatDate(invoice.invoice_date)}</p>
                    ${invoice.due_date ? `<p><strong>Due Date:</strong> ${formatDate(invoice.due_date)}</p>` : ''}
                    ${invoice.order_code ? `<p><strong>Order:</strong> ${invoice.order_code}</p>` : ''}
                    <p><strong>Status:</strong> <span class="status ${invoice.payment_status}">${invoice.payment_status}</span></p>
                </div>
            </div>

            <div class="billing-section">
                <div class="billing-info">
                    <h3>Bill To معلومات الفوترة</h3>
                    <p><strong>${invoice.billing_first_name || ''} ${invoice.billing_last_name || ''}</strong></p>
                    ${invoice.billing_company ? `<p>${invoice.billing_company}</p>` : ''}
                    ${invoice.billing_email ? `<p>${invoice.billing_email}</p>` : ''}
                    ${invoice.billing_phone ? `<p>${invoice.billing_phone}</p>` : ''}
                    ${invoice.billing_street ? `<p>${invoice.billing_street}</p>` : ''}
                    ${invoice.billing_building ? `<p>Building: ${invoice.billing_building}</p>` : ''}
                    ${invoice.billing_apartment ? `<p>Apt: ${invoice.billing_apartment}</p>` : ''}
                    ${invoice.billing_area ? `<p>${invoice.billing_area}</p>` : ''}
                    ${invoice.billing_city ? `<p>${invoice.billing_city}</p>` : ''}
                    ${invoice.billing_state?.name_en ? `<p>${invoice.billing_state.name_en}</p>` : ''}
                    ${invoice.billing_notes ? `<p><em>${invoice.billing_notes}</em></p>` : ''}
                </div>
                <div class="billing-info">
                    <h3>Payment Info معلومات الدفع</h3>
                    <p><strong>Payment Status:</strong> ${invoice.payment_status}</p>
                    ${invoice.payment_method ? `<p><strong>Payment Method:</strong> ${invoice.payment_method}</p>` : ''}
                    ${invoice.payment_date ? `<p><strong>Payment Date:</strong> ${formatDate(invoice.payment_date)}</p>` : ''}
                    <p><strong>Currency:</strong> ${invoice.currency}</p>
                </div>
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th>SKU</th>
                        <th>Product المنتج</th>
                        <th>Qty الكمية</th>
                        <th>Unit Price السعر</th>
                        <th>Total الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.invoice_items.filter(item => !item.is_deleted).map(item => `
                        <tr>
                            <td>${item.product_sku}</td>
                            <td>
                                <strong>${item.product_name_en || 'N/A'}</strong>
                                ${item.product_name_ar ? `<br><small>${item.product_name_ar}</small>` : ''}
                                ${item.size || item.color ? `<br><small>${[item.size, item.color].filter(Boolean).join(', ')}</small>` : ''}
                            </td>
                            <td>${item.quantity}</td>
                            <td>${formatCurrency(item.unit_price)}</td>
                            <td>${formatCurrency(item.total_price)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="totals">
                <table>
                    <tr>
                        <td><strong>Subtotal:</strong></td>
                        <td><strong>${formatCurrency(invoice.subtotal)}</strong></td>
                    </tr>
                    ${invoice.discount_amount > 0 ? `
                        <tr>
                            <td><strong>Discount:</strong></td>
                            <td><strong>-${formatCurrency(invoice.discount_amount)}</strong></td>
                        </tr>
                    ` : ''}
                    ${invoice.tax_amount > 0 ? `
                        <tr>
                            <td><strong>Tax:</strong></td>
                            <td><strong>${formatCurrency(invoice.tax_amount)}</strong></td>
                        </tr>
                    ` : ''}
                    ${invoice.delivery_fee > 0 ? `
                        <tr>
                            <td><strong>Delivery Fee:</strong></td>
                            <td><strong>${formatCurrency(invoice.delivery_fee)}</strong></td>
                        </tr>
                    ` : ''}
                    <tr class="total-row">
                        <td><strong>TOTAL الإجمالي:</strong></td>
                        <td><strong>${formatCurrency(invoice.total_amount)}</strong></td>
                    </tr>
                </table>
            </div>

            ${(invoice.notes_en || invoice.notes_ar) ? `
                <div class="notes">
                    <h3>Notes ملاحظات</h3>
                    ${invoice.notes_en ? `<p>${invoice.notes_en}</p>` : ''}
                    ${invoice.notes_ar ? `<p>${invoice.notes_ar}</p>` : ''}
                </div>
            ` : ''}

            <div class="footer">
                <p>Thank you for your business! شكراً لتعاملكم معنا</p>
                <p>This is a computer-generated invoice. هذه فاتورة إلكترونية</p>
            </div>
        </div>
    </body>
    </html>
  `;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

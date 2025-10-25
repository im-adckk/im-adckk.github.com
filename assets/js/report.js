const SUPABASE_URL = 'https://hpmnizmmkepemezfntfh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbW5pem1ta2VwZW1lemZudGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNzA3MTEsImV4cCI6MjA3Njg0NjcxMX0.GeAgM3Xy1hrFqnA1XSiGYkhVTKd63VfRN_kFVH8WAws';
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Get invoice ID from URL (e.g., report.html?id=123)
const params = new URLSearchParams(window.location.search);
const invoiceId = params.get('id');

async function loadReport() {
  if (!invoiceId) {
    document.body.innerHTML = '<p>No invoice ID provided.</p>';
    return;
  }

  const { data: invoice, error } = await client
    .from('invoices')
    .select('*, invoice_items(*), customers(*)')
    .eq('id', invoiceId)
    .single();

  if (error || !invoice) {
    console.error(error);
    document.body.innerHTML = '<p>Failed to load report data.</p>';
    return;
  }

  renderReport(invoice);
}

// ------------------------------------------------------------
// Render invoice + customer info
// ------------------------------------------------------------
function renderReport(inv) {
  const container = document.getElementById('report-container');
  const isInvoice = inv.type === 'invoice';
  const docTitle = isInvoice ? 'INVOICE' : 'QUOTATION / SEBUT HARGA';
  const dateStr = new Date(inv.created_at).toLocaleDateString();

  const cust = inv.customers || {};
  const items = inv.invoice_items || [];

  container.innerHTML = `
  <div class="report">
    <div class="header">
      <div class="company-info">
        <img src="assets/letterhead.png" alt="Logo" class="logo">
      </div>
      <div class="doc-info">
        <h3>${docTitle}</h3>
        <p>No.: ${inv.invoice_no}<br>Date: ${dateStr}</p>
      </div>
    </div>

    <div class="customer-section">
      <h4>Customer / Pelanggan</h4>
      <p>
        <strong>${cust.name || '-'}</strong><br>
        ${cust.address || ''}<br>
        ${cust.contact ? '📞 ' + cust.contact + '<br>' : ''}
        ${cust.email ? '✉️ ' + cust.email : ''}
      </p>
    </div>

    <table class="item-table">
      <thead>
        <tr>
          <th>No.</th>
          <th>Description / Keterangan</th>
          <th>Qty</th>
          <th>Unit Price (RM)</th>
          <th>Total (RM)</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${item.description}</td>
                <td style="text-align:center;">${item.qty}</td>
                <td style="text-align:right;">${item.unit_price.toFixed(2)}</td>
                <td style="text-align:right;">${item.line_total.toFixed(2)}</td>
              </tr>`
          )
          .join('')}
      </tbody>
    </table>

    <div class="summary">
      <p><strong>Total:</strong> RM ${inv.total.toFixed(2)}</p>
      <p class="note">* Prices are inclusive of tax (SST included)</p>
    </div>

    <div class="footer">
      <p><strong>Remarks / Nota:</strong> ${inv.notes || '-'}</p>
      <div class="signature">
        <p>_________________________<br>Authorized Signature</p>
      </div>
    </div>
  </div>
  `;

  // Optional: Auto-generate PDF
  html2pdf()
    .from(container)
    .set({
      filename: `${inv.invoice_no}.pdf`,
      jsPDF: { format: 'a4', orientation: 'portrait' },
      margin: 10,
    })
    .save();
}

loadReport();

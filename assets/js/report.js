const SUPABASE_URL = 'https://hpmnizmmkepemezfntfh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbW5pem1ta2VwZW1lemZudGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNzA3MTEsImV4cCI6MjA3Njg0NjcxMX0.GeAgM3Xy1hrFqnA1XSiGYkhVTKd63VfRN_kFVH8WAws';
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Get invoice ID from URL (e.g., report.html?id=123)
const params = new URLSearchParams(window.location.search);
const invoiceId = params.get('id');

async function loadReport() {
  const { data: invoice, error } = await client
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('id', invoiceId)
    .single();
  if (error) return alert('Error loading report');

  renderReport(invoice);
}

function renderReport(inv) {
  const container = document.getElementById('report-container');
  container.innerHTML = `
  <div class="report">
    <div class="header">
      <img src="assets/logo.png" alt="Logo" class="logo">
      <div class="company">
        <h2>UNIVERSAL HEAVY INDUSTRIES SDN. BHD.</h2>
        <p>No. 123, Jalan Industri, 88100 Kota Kinabalu, Sabah<br>
           Tel: +60 88-123456 | Email: info@uhisbh.com</p>
      </div>
    </div>
    <div class="doc-info">
      <h3>${inv.type === 'invoice' ? 'INVOICE' : 'SEBUT HARGA / QUOTATION'}</h3>
      <p>No.: ${inv.invoice_no}<br>Date: ${new Date(inv.created_at).toLocaleDateString()}</p>
    </div>

    <table class="item-table">
      <thead><tr><th>No.</th><th>Description / Keterangan</th><th>Qty</th><th>Unit Price (RM)</th><th>Total (RM)</th></tr></thead>
      <tbody>
        ${inv.invoice_items
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
      <p>Subtotal: RM ${inv.subtotal.toFixed(2)}</p>
      <p>SST (${inv.sst_rate}%): RM ${inv.sst_amount.toFixed(2)}</p>
      <h3>Total: RM ${inv.total.toFixed(2)}</h3>
    </div>

    <div class="footer">
      <p><strong>Remarks / Nota:</strong> ${inv.notes || '-'}</p>
      <p style="margin-top:40px;">_________________________<br>Authorized Signature</p>
    </div>
  </div>
  `;

  // Auto-generate PDF after render
  html2pdf().from(container).set({
    filename: `${inv.invoice_no}.pdf`,
    jsPDF: { format: 'a4', orientation: 'portrait' },
    margin: 10,
  }).save();
}

loadReport();

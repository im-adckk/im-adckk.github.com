const SUPABASE_URL = 'https://hpmnizmmkepemezfntfh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbW5pem1ta2VwZW1lemZudGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNzA3MTEsImV4cCI6MjA3Njg0NjcxMX0.GeAgM3Xy1hrFqnA1XSiGYkhVTKd63VfRN_kFVH8WAws';
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const params = new URLSearchParams(window.location.search);
const invoiceId = params.get('id');

// ------------------------------------------------------------
// Utility: Convert number to Malay words
// ------------------------------------------------------------
function numberToBahasaWords(num) {
  const ones = [
    "", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam",
    "Tujuh", "Lapan", "Sembilan", "Sepuluh", "Sebelas"
  ];
  if (num < 12) return ones[num];
  if (num < 20) return numberToBahasaWords(num - 10) + " Belas";
  if (num < 100)
    return numberToBahasaWords(Math.floor(num / 10)) + " Puluh " + numberToBahasaWords(num % 10);
  if (num < 200)
    return "Seratus " + numberToBahasaWords(num - 100);
  if (num < 1000)
    return numberToBahasaWords(Math.floor(num / 100)) + " Ratus " + numberToBahasaWords(num % 100);
  if (num < 2000)
    return "Seribu " + numberToBahasaWords(num - 1000);
  if (num < 1000000)
    return numberToBahasaWords(Math.floor(num / 1000)) + " Ribu " + numberToBahasaWords(num % 1000);
  if (num < 1000000000)
    return numberToBahasaWords(Math.floor(num / 1000000)) + " Juta " + numberToBahasaWords(num % 1000000);
  return "Nombor Terlalu Besar";
}

function formatMalayDate(dateString) {
  const date = new Date(dateString);
  const bulan = [
    "Januari", "Februari", "Mac", "April", "Mei", "Jun",
    "Julai", "Ogos", "September", "Oktober", "November", "Disember"
  ];
  return `${date.getDate()} ${bulan[date.getMonth()]} ${date.getFullYear()}`;
}

// ------------------------------------------------------------
// Fetch and Render
// ------------------------------------------------------------
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
// Render professional A4 layout + Preview mode
// ------------------------------------------------------------
function renderReport(inv) {
  const container = document.getElementById('report-container');
  const isInvoice = inv.type === 'invoice';
  const docTitle = isInvoice ? 'INVOIS' : 'SEBUT HARGA';
  const dateStr = formatMalayDate(inv.created_at);

  const cust = inv.customers || {};
  const items = inv.invoice_items || [];
  const totalWords = `Ringgit Malaysia: ${numberToBahasaWords(Math.floor(inv.total))} Sahaja`;

  container.innerHTML = `
  <div class="a4-page">
    <div class="header">
      <img src="assets/letterhead.png" alt="Letterhead" class="letterhead">
    </div>

    <div class="doc-info">
      <h2>${docTitle}</h2>
      <table class="info-table">
        <tr><td>No. Dokumen:</td><td>${inv.invoice_no}</td></tr>
        <tr><td>Tarikh:</td><td>${dateStr}</td></tr>
      </table>
    </div>

    <div class="customer-info">
      <strong>Kepada:</strong><br>
      ${cust.name || '-'}<br>
      ${cust.address || ''}<br>
      ${cust.contact ? 'Tel: ' + cust.contact + '<br>' : ''}
      ${cust.email ? 'Emel: ' + cust.email : ''}
    </div>

    <table class="item-table">
      <thead>
        <tr>
          <th style="width:5%;">Bil</th>
          <th style="width:55%;">Perihalan Barang / Perkhidmatan</th>
          <th style="width:10%;">Kuantiti</th>
          <th style="width:15%;">Harga Seunit (RM)</th>
          <th style="width:15%;">Jumlah (RM)</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, i) => `
          <tr>
            <td style="text-align:center;">${i + 1}</td>
            <td>${item.description}</td>
            <td style="text-align:center;">${item.qty}</td>
            <td style="text-align:right;">${item.unit_price.toFixed(2)}</td>
            <td style="text-align:right;">${item.line_total.toFixed(2)}</td>
          </tr>`).join('')}
      </tbody>
    </table>

    <div class="total-section">
      <p><strong>Jumlah Keseluruhan (RM):</strong> ${inv.total.toFixed(2)}</p>
      <p><em>${totalWords}</em></p>
      <p class="note">* Harga termasuk cukai (SST telah disertakan)</p>
    </div>

    <div class="remarks">
      <strong>Nota:</strong><br>
      ${inv.notes || '-'}
    </div>

    <div class="bank-info">
      <strong>Maklumat Bank:</strong><br>
      Nama Bank: Maybank Berhad<br>
      No. Akaun: 512345678901<br>
      Nama Akaun: Universal Heavy Industries Sdn. Bhd.
    </div>

    <div class="footer-note">
      <p><em>Janaan komputer — tandatangan tidak diperlukan / No signature or authorization required</em></p>
    </div>

    <div class="action-bar">
      <button id="download-btn">⬇️ Muat Turun PDF</button>
    </div>
  </div>
  `;

  // Button: Download PDF
  document.getElementById('download-btn').addEventListener('click', () => {
    html2pdf()
      .from(document.querySelector('.a4-page'))
      .set({
        filename: `${inv.invoice_no}.pdf`,
        jsPDF: { format: 'a4', orientation: 'portrait' },
        margin: 10,
      })
      .save();
  });
}

loadReport();

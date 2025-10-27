const SUPABASE_URL = 'https://hpmnizmmkepemezfntfh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbW5pem1ta2VwZW1lemZudGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNzA3MTEsImV4cCI6MjA3Njg0NjcxMX0.GeAgM3Xy1hrFqnA1XSiGYkhVTKd63VfRN_kFVH8WAws';
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const params = new URLSearchParams(window.location.search);
const invoiceId = params.get('id');

// ------------------------------------------------------------
// Utility: Convert number to Malay words
// ------------------------------------------------------------
function numberToBahasaWords(num) {
  const ones = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Lapan", "Sembilan", "Sepuluh", "Sebelas"];
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
// Fetch + Render
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
// Render A4 layout (exact Sebut Harga / Invois style)
// ------------------------------------------------------------
async function renderReport(inv) {
  const container = document.getElementById('report-container');
  const isInvoice = inv.type === 'invoice';
  const docTitle = isInvoice ? 'INVOIS' : 'SEBUT HARGA';
  const dateStr = formatMalayDate(inv.created_at);

  const cust = inv.customers || {};
  const items = inv.invoice_items || [];

  // 🔹 Fetch group info if available
  let groupInfo = null;
  if (inv.group_id) {
    const { data: g, error: gErr } = await client
      .from('item_groups')
      .select('*')
      .eq('id', inv.group_id)
      .single();
    if (!gErr) groupInfo = g;
  }

  const totalWords = `Ringgit Malaysia: ${numberToBahasaWords(Math.floor(inv.total))} Sahaja`;

  container.innerHTML = `
  <div class="a4-page">
    <div class="header">
      <img src="assets/letterhead.png" alt="Letterhead" class="letterhead">
    </div>

    <!-- Top Title Section -->
    <div class="doc-top-title">
      <h2>${docTitle}</h2>
      ${
        groupInfo
          ? `<p class="group-info"><strong>${groupInfo.name}</strong> — ${groupInfo.description || ''}</p>`
          : ''
      }
    </div>

    <!-- Customer + Doc Info -->
    <div class="doc-info-row">
      <div class="doc-left">
        <div class="kepada">
          <strong>Kepada:</strong><br>
          ${cust.name || '-'}<br>
          ${cust.address || ''}<br>
          ${cust.contact ? 'Tel: ' + cust.contact + '<br>' : ''}
          ${cust.email ? 'Emel: ' + cust.email : ''}
        </div>
      </div>

      <div class="doc-right">
        <p><strong>No. Dokumen:</strong> ${inv.invoice_no}</p>
        <p><strong>Tarikh:</strong> ${dateStr}</p>
      </div>
    </div>

    <!-- Items Table -->
    <table class="item-table">
      <thead>
        <tr>
          <th style="width:5%;">Bil</th>
          <th style="width:55%;">Butir-butir Perkhidmatan</th>
          <th style="width:10%;">Kuantiti</th>
          <th style="width:15%;">Harga Seunit (RM)</th>
          <th style="width:15%;">Jumlah (RM)</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item, i) => `
              <tr>
                <td style="text-align:center;">${i + 1}</td>
                <td>${item.description}</td>
                <td style="text-align:center;">${item.qty}</td>
                <td style="text-align:right;">${item.unit_price.toFixed(2)}</td>
                <td style="text-align:right;">${item.line_total.toFixed(2)}</td>
              </tr>`
          )
          .join('')}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="total-section">
      <p><strong>Jumlah Keseluruhan (RM):</strong> ${inv.total.toFixed(2)}</p>
      <p><em>${totalWords}</em></p>
      <p class="note">* Harga termasuk cukai (SST telah disertakan)</p>
    </div>

    <!-- Nota -->
    <div class="nota">
      <p><strong>Nota **</strong></p>
      <ol>
        <li>Pembayaran perlu dibuat sebelum sesi bermula.</li>
        <li>Semua sesi adalah berdasarkan tempahan sahaja.</li>
        <li>Sebarang pembayaran dan sesi yang telah dijalankan tidak akan dikembalikan dan tertakluk kepada terma dan syarat yang telah ditetapkan.</li>
        <li>Pembayaran bolehlah dibuat kepada:</li>
      </ol>
      <div class="bank">
        <strong>API-API DRIVING CENTRE SDN BHD</strong><br>
        PUBLIC BANK<br>
        323-727-9005
      </div>
      <p style="margin-top:10px;">Sekian, terima kasih.<br>
      <strong>Api-Api Driving Centre Sdn. Bhd.</strong><br>
      <em>Drive Safe With Us!</em></p>
      <p class="footer-note"><em>Janaan komputer — tandatangan tidak diperlukan / No signature or authorization required</em></p>
    </div>

    <div class="action-bar">
      <button id="download-btn">⬇️ Muat Turun PDF</button>
    </div>
  </div>
  `;

  // ✅ PDF Export (centered, single-page, no overflow)
  document.getElementById('download-btn').addEventListener('click', () => {
    const element = document.querySelector('.a4-page');
    const downloadBtn = document.getElementById('download-btn');
  
    // Hide the button before rendering
    downloadBtn.style.display = 'none';
  
    // Temporarily remove box shadow (helps prevent right overflow)
    element.classList.add('no-shadow');
  
    const opt = {
      margin: [0, 0, 0, 0],
      filename: `${inv.invoice_no}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        scrollY: 0,
        windowWidth: element.scrollWidth,  // ✅ ensure proper capture width
        backgroundColor: '#ffffff',
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
      },
      pagebreak: { mode: ['css', 'avoid-all'] },
    };
  
    html2pdf()
      .set(opt)
      .from(element)
      .save()
      .then(() => {
        // Restore visuals
        element.classList.remove('no-shadow');
        downloadBtn.style.display = 'inline-block';
      })
      .catch((err) => {
        console.error('PDF generation failed:', err);
        element.classList.remove('no-shadow');
        downloadBtn.style.display = 'inline-block';
      });
  });


loadReport();

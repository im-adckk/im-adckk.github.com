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
    return numberToBahasaWords(Math.floor(num / 1000000)) + " Juta " + numberToBahasaWords(num % 1000000000);
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

  let preparedByUser = null;
  if (inv.created_by) {
      const { data: user, error: userErr } = await client
          .from('users')
          .select('name')
          .eq('id', inv.created_by)
          .single();
      if (!userErr) preparedByUser = user;
  }

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

  // 🔹 Fetch staff contact if available
  let staffContact = null;
  if (inv.staff_id) {
    const { data: s, error: sErr } = await client
      .from('staff')
      .select('*')
      .eq('id', inv.staff_id)
      .single();
    if (!sErr) staffContact = s;
  }

  const totalWords = `Ringgit Malaysia: ${numberToBahasaWords(Math.floor(inv.total))} Sahaja`;

  // Word wrap function for notes
  const wrapNotes = (text, maxLength = 80) => {
    if (!text) return 'N/A';
    
    // Clean the text first
    let cleanText = text.trim().replace(/\s+/g, ' ');
    
    // Pattern to detect: one or more words (names) followed by a 12-digit number (IC)
    const nameIcPattern = /([a-zA-Z]+(?:\s+[a-zA-Z]+)*)\s+(\d{11,13})/g; // Allow 11-13 digits for flexibility
    
    const lines = [];
    let lastIndex = 0;
    let match;
    
    // Find all name + IC number patterns
    while ((match = nameIcPattern.exec(cleanText)) !== null) {
      const fullMatch = `${match[1].trim()} ${match[2].trim()}`;
      lines.push(fullMatch);
      lastIndex = nameIcPattern.lastIndex;
    }
    
    // If we found matches, return them with line breaks
    if (lines.length > 0) {
      return lines.join('<br>');
    }
    
    // Alternative: split by common separators
    const separators = /[,;|]|\s+(?=\d{11,13})/;
    const parts = cleanText.split(separators);
    const filteredParts = parts.filter(part => part.trim().length > 0);
    
    if (filteredParts.length > 1) {
      return filteredParts.map(part => part.trim()).join('<br>');
    }
    
    // Final fallback: return original text
    return cleanText;
  };

  // Reduce margins and padding in your template
  container.innerHTML = `
  <div class="a4-page">
    <div class="header">
      <img src="assets/letterhead.png" alt="Letterhead" class="letterhead">
    </div>
    <div class="doc-top-title">
      <h2>${docTitle}</h2>
      ${groupInfo ? `<p class="group-info"><strong>${groupInfo.name}</strong> — ${groupInfo.description || ''}</p>` : ''}
    </div>
    <div class="doc-info-row">
      <div class="kepada">
        <strong>Kepada:</strong><br>
        <strong>${cust.name || '-'}</strong><br>
        ${cust.address || ''}<br>
        ${cust.contact ? 'Tel: ' + cust.contact + '<br>' : ''}
        ${cust.email ? 'Emel: ' + cust.email : ''}
      </div>
      <div class="doc-right">
        <p><strong>No. Dokumen:</strong> ${inv.invoice_no}</p>
        <p><strong>Tarikh:</strong> ${dateStr}</p>
        
        <!-- Reference Box positioned below tarikh -->
        ${inv.notes ? `
        <div class="reference-box">
          <div class="reference-header">
            <strong>Calon:</strong>
          </div>
          <div class="reference-content">
            <div class="notes-section">
              <div class="wrapped-notes">${inv.notes ? wrapNotes(inv.notes) : 'N/A'}</div>
            </div>
          </div>
        </div>
        ` : ''}
      </div>
    
    </div>
    <div class="quotation-intro">
      <p><strong>U/P: Tuan/Puan</strong></p>
      <p>Berikut merupakan sebut harga untuk jenis lesen yang dipohon:</p>
    </div>
    <table class="item-table">
      <thead>
        <tr>
          <th>Bil</th>
          <th>Butir-butir Perkhidmatan</th>
          <th>Qty</th>
          <th>Harga Seunit (RM)</th>
          <th>Jumlah (RM)</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${item.description}</td>
            <td>${item.qty}</td>
            <td>${item.unit_price.toFixed(2)}</td>
            <td>${item.line_total.toFixed(2)}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  
    <div class="total-section">
      <p><strong>Jumlah Keseluruhan (RM): ${inv.total.toFixed(2)}</p></strong>
      <p><em>${totalWords}</em></p>
      <p class="note">* Harga termasuk cukai (SST telah disertakan)</p>
    </div>
  
    <div class="nota">
      <p><strong>Nota **</strong></p>
      <ol>
        <li>Harga tidak termasuk <i>LDL RM35</i>, <i>Lesen Vokasional RM40</i> dan <i>Kad ujian RM10</i> jika berkenaan.</li>
        <li>Pembayaran perlu dibuat sebelum sesi bermula.</li>
        <li>Semua sesi adalah berdasarkan tempahan sahaja.</li>
        <li>Sebarang pembayaran dan sesi yang telah dijalankan tidak akan dikembalikan.</li>
        <li>Pembayaran bolehlah dibuat kepada:</li>
      </ol>
      <div class="bank">
        <strong>API-API DRIVING CENTRE SDN BHD</strong><br>
        PUBLIC BANK<br>
        323-727-9005
      </div>
      
      <!-- Additional Inquiries Contact -->
      ${staffContact ? `
      <div class="inquiry-contact">
        <p><strong>Untuk sebarang pertanyaan lanjut, sila hubungi:</strong> ${staffContact.name} - ${staffContact.contact_no}</p>
      </div>
      ` : ''}
      
      <p style="margin-top:20px; font-size: 14px;">Sekian, terima kasih.<br>
      <strong style="font-size: 16px;">Api-Api Driving Centre Sdn. Bhd.</strong></p>
      
  
    <div class="action-bar">
      <button id="download-btn">⬇️ Muat Turun PDF</button>
    </div>
    ${preparedByUser ? `
      <p class="footer-note-user"><strong>Disediakan oleh:</strong> ${preparedByUser.name}</p>
      ` : ''}
      <p class="footer-note">Janaan komputer — tandatangan tidak diperlukan</p>
    </div>
  </div>
  `;

// ✅ PERFECT MARGIN PDF Export
document.getElementById('download-btn').addEventListener('click', () => {
  const element = document.querySelector('.a4-page');
  const downloadBtn = document.getElementById('download-btn');
  
  downloadBtn.style.display = 'none';
  element.classList.add('pdf-export');

  // Perfect margin settings for A4
  const opt = {
    margin: [10, 10, 10, 5],  // [top, left, bottom, right] in mm - Equal small margins
    filename: `${inv.invoice_no}.pdf`,
    image: { 
      type: 'jpeg', 
      quality: 1 
    },
    html2canvas: {
      scale: 2,
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
      
      backgroundColor: '#FFFFFF',
      logging: false
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    },
    pagebreak: { 
      mode: ['avoid-all', 'css', 'legacy'] 
    }
  };

  html2pdf()
    .set(opt)
    .from(element)
    .save()
    .then(() => {
      element.classList.remove('pdf-export');
      downloadBtn.style.display = 'inline-block';
    })
    .catch((err) => {
      console.error('PDF generation failed:', err);
      element.classList.remove('pdf-export');
      downloadBtn.style.display = 'inline-block';
    });
});
}

loadReport();

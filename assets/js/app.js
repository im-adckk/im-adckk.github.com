// ------------------------------------------------------------
// ADC Invoice / Quotation App - Supabase Frontend
// ------------------------------------------------------------

// 🧩 1. Initialize Supabase Client
const SUPABASE_URL = 'https://hpmnizmmkepemezfntfh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbW5pem1ta2VwZW1lemZudGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNzA3MTEsImV4cCI6MjA3Njg0NjcxMX0.GeAgM3Xy1hrFqnA1XSiGYkhVTKd63VfRN_kFVH8WAws';

// ✅ Use the global Supabase object safely
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 🧩 2. Invoice data object
let invoice = {
  type: 'quotation', // default mode
  lines: [],
  sst_rate: 8.0,
};

// Utility: format to 2 decimal places
const fmt = (n) => Number(n || 0).toFixed(2);

// ------------------------------------------------------------
// 3️⃣ Load item catalog
// ------------------------------------------------------------
async function loadCatalog() {
  const { data: groups, error: gErr } = await client
    .from('item_groups')
    .select('*')
    .order('name');
  const { data: items, error: iErr } = await client
    .from('items')
    .select('*')
    .order('name');

  if (gErr || iErr) {
    console.error(gErr || iErr);
    alert('Failed to load catalog');
    return;
  }

  renderGroups(groups);
  renderItems(items);
}

function renderGroups(groups) {
  const el = document.getElementById('groups');
  el.innerHTML = groups
    .map(
      (g) =>
        `<button class="group-btn" data-id="${g.id}">${g.name}</button>`
    )
    .join('');
}

function renderItems(items) {
  const el = document.getElementById('items');
  el.innerHTML = items
    .map(
      (i) => `
    <div class="item" data-id="${i.id}">
      <div class="item-name">${i.name}</div>
      <div class="item-price">RM ${fmt(i.unit_price)}</div>
      <button class="add-btn" data-id="${i.id}">Add</button>
    </div>
  `
    )
    .join('');

  el.querySelectorAll('.add-btn').forEach((btn) =>
    btn.addEventListener('click', () => addItemToInvoice(btn.dataset.id, items))
  );
}

function addItemToInvoice(id, items) {
  const item = items.find((x) => x.id === id);
  if (!item) return;

  const line = {
    item_id: item.id,
    name: item.name,
    unit_price: Number(item.unit_price),
    qty: 1,
    line_total: Number(item.unit_price),
  };

  invoice.lines.push(line);
  renderInvoiceLines();
}

// ------------------------------------------------------------
// 4️⃣ Invoice line rendering & recalculation
// ------------------------------------------------------------
function renderInvoiceLines() {
  const el = document.getElementById('lines');
  el.innerHTML = invoice.lines
    .map(
      (l, idx) => `
    <div class="line" data-idx="${idx}">
      <div>${l.name}</div>
      <input type="number" class="qty" value="${l.qty}" min="1" data-idx="${idx}">
      <input type="number" class="price" value="${fmt(l.unit_price)}" step="0.01" data-idx="${idx}">
      <div class="line-total">RM ${fmt(l.line_total)}</div>
      <button class="remove" data-idx="${idx}">X</button>
    </div>`
    )
    .join('');

  attachLineHandlers();
  recalc();
}

function attachLineHandlers() {
  document.querySelectorAll('.qty').forEach((el) =>
    el.addEventListener('input', (e) => {
      const idx = e.target.dataset.idx;
      const v = Number(e.target.value || 1);
      invoice.lines[idx].qty = Math.max(1, v);
      invoice.lines[idx].line_total =
        invoice.lines[idx].unit_price * invoice.lines[idx].qty;
      renderInvoiceLines();
    })
  );

  document.querySelectorAll('.price').forEach((el) =>
    el.addEventListener('input', (e) => {
      const idx = e.target.dataset.idx;
      const v = Number(e.target.value || 0);
      invoice.lines[idx].unit_price = v;
      invoice.lines[idx].line_total =
        invoice.lines[idx].unit_price * invoice.lines[idx].qty;
      renderInvoiceLines();
    })
  );

  document.querySelectorAll('.remove').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      const idx = Number(btn.dataset.idx);
      invoice.lines.splice(idx, 1);
      renderInvoiceLines();
    })
  );
}

function recalc() {
  const subtotal = invoice.lines.reduce(
    (s, l) => s + (Number(l.line_total) || 0),
    0
  );
  const sst_amount = +(subtotal * (invoice.sst_rate / 100));
  const total = +(subtotal + sst_amount);

  document.getElementById('subtotal').textContent = fmt(subtotal);
  document.getElementById('sst-amount').textContent = fmt(sst_amount);
  document.getElementById('total').textContent = fmt(total);
  document.getElementById('sst-rate').textContent = fmt(invoice.sst_rate);

  invoice.subtotal = subtotal;
  invoice.sst_amount = sst_amount;
  invoice.total = total;
}

// ------------------------------------------------------------
// 5️⃣ Document type toggle (Quotation / Invoice)
// ------------------------------------------------------------
document
  .getElementById('toggle-type')
  .addEventListener('change', (e) => {
    invoice.type = e.target.checked ? 'invoice' : 'quotation';
    document.getElementById('doc-title').textContent =
      invoice.type === 'invoice' ? 'Invoice' : 'Quotation';
  });

// ------------------------------------------------------------
// 6️⃣ Generate next number via Supabase RPC
// ------------------------------------------------------------
async function getNextNumber(type) {
  const { data, error } = await client.rpc('get_next_doc_number', {
    p_type: type,
  });
  if (error) {
    console.error('Numbering error:', error);
    alert('Failed to generate document number');
    return null;
  }
  return data; // e.g., "INV-001" or "QUO-002"
}

// ------------------------------------------------------------
// 7️⃣ Save invoice + items
// ------------------------------------------------------------
document.getElementById('save-btn').addEventListener('click', async () => {
  const type = invoice.type;
  const notes = document.getElementById('notes').value || null;

  const docNumber = await getNextNumber(type);
  if (!docNumber) return;

  // Insert invoice
  const { data: inv, error: invErr } = await client
    .from('invoices')
    .insert([
      {
        invoice_no: docNumber,
        type,
        subtotal: invoice.subtotal,
        sst_rate: invoice.sst_rate,
        sst_amount: invoice.sst_amount,
        total: invoice.total,
        notes,
      },
    ])
    .select()
    .single();

  if (invErr) {
    console.error(invErr);
    alert('Save failed: ' + invErr.message);
    return;
  }

  const inv_id = inv.id;
  const lines = invoice.lines.map((l) => ({
    invoice_id: inv_id,
    item_id: l.item_id,
    description: l.name,
    unit_price: l.unit_price,
    qty: l.qty,
    line_total: l.line_total,
  }));

  const { error: lineErr } = await client.from('invoice_items').insert(lines);
  if (lineErr) {
    console.error(lineErr);
    alert('Line save failed: ' + lineErr.message);
    return;
  }

  // ✅ After invoice + items are saved successfully
  alert(`${docNumber} saved successfully!`);
  
  // ✅ Success — custom popup with WhatsApp share
  const reportLink = `${window.location.origin}/report.html?id=${inv.id}`;
  const message = encodeURIComponent(
    `Hi, here's the ${invoice.type.toUpperCase()} (${docNumber}) from Universal Heavy Industries:\n${reportLink}`
  );
  
  // Create popup container
  const popup = document.createElement('div');
  popup.style.position = 'fixed';
  popup.style.top = '0';
  popup.style.left = '0';
  popup.style.width = '100vw';
  popup.style.height = '100vh';
  popup.style.background = 'rgba(0,0,0,0.4)';
  popup.style.display = 'flex';
  popup.style.alignItems = 'center';
  popup.style.justifyContent = 'center';
  popup.style.zIndex = '9999';
  
  popup.innerHTML = `
    <div style="
      background:#fff;
      padding:20px;
      border-radius:12px;
      text-align:center;
      max-width:300px;
      width:90%;
      box-shadow:0 4px 10px rgba(0,0,0,0.2);
    ">
      <h3 style="margin-top:0;">✅ ${docNumber} Saved!</h3>
      <p>Your ${invoice.type} has been saved successfully.</p>
      <button id="view-report" style="background:#007bff;color:#fff;border:none;padding:10px 15px;border-radius:8px;margin:5px;width:100%;">📄 View Report</button>
      <button id="share-whatsapp" style="background:#25D366;color:#fff;border:none;padding:10px 15px;border-radius:8px;margin:5px;width:100%;">💬 Share via WhatsApp</button>
      <button id="close-popup" style="background:#ccc;color:#000;border:none;padding:8px 15px;border-radius:8px;margin-top:10px;width:100%;">Close</button>
    </div>
  `;
  
  // Append to body
  document.body.appendChild(popup);
  
  // Button actions
  document.getElementById('view-report').addEventListener('click', () => {
    window.open(reportLink, '_blank');
  });
  
  document.getElementById('share-whatsapp').addEventListener('click', () => {
    window.open(`https://wa.me/?text=${message}`, '_blank');
  });
  
  document.getElementById('close-popup').addEventListener('click', () => {
    popup.remove();
  });


});

// ------------------------------------------------------------
// 8️⃣ On load
// ------------------------------------------------------------
window.addEventListener('DOMContentLoaded', loadCatalog);
// ------------------------------------------------------------
// 9️⃣ Export to PDF
// ------------------------------------------------------------

document.getElementById('export-pdf').addEventListener('click', () => {
  // Choose what to export (the #invoice section)
  const invoiceSection = document.getElementById('invoice');

  // Add a print header dynamically (for cleaner PDF)
  const headerText = invoice.type === 'invoice' ? 'INVOICE' : 'QUOTATION';
  const dateStr = new Date().toLocaleDateString();

  // Clone content for PDF (so we can add header without affecting UI)
  const clone = invoiceSection.cloneNode(true);
  const header = document.createElement('div');
  header.style.textAlign = 'center';
  header.style.marginBottom = '20px';
  header.innerHTML = `
    <img src="assets/logo.png" style="width:100px;">
    <h1 style="margin:0;font-size:22px;">${headerText}</h1>
    <small>Date: ${dateStr}</small>
    <hr style="margin:10px 0;">
  `;
  clone.prepend(header);

  // PDF options
  const options = {
    margin: 10,
    filename: `${headerText}_${dateStr.replace(/\//g, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  html2pdf().set(options).from(clone).save();
});

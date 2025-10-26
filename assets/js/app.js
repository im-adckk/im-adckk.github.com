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
  type: 'quotation',
  lines: []
};

// Utility: format to 2 decimal places
const fmt = (n) => Number(n || 0).toFixed(2);

// ------------------------------------------------------------
// Spinner control
// ------------------------------------------------------------
function showSpinner() {
    document.getElementById('spinner').style.display = 'flex';
  }
  
  function hideSpinner() {
    document.getElementById('spinner').style.display = 'none';
}

// ------------------------------------------------------------
// 🔍 Customer Search + Add New (Modal Version)
// ------------------------------------------------------------
const searchInput = document.getElementById('customer-search');
const resultsBox = document.getElementById('customer-results');

// Modal elements
const modal = document.getElementById('addCustomerModal');
const saveNewBtn = document.getElementById('save-new-customer');
const cancelNewBtn = document.getElementById('cancel-new-customer');

let pendingNewCustomerName = ''; // hold the typed name for prefill

searchInput.addEventListener('input', async (e) => {
  const query = e.target.value.trim();
  if (!query) {
    resultsBox.style.display = 'none';
    resultsBox.innerHTML = '';
    return;
  }

  const { data: matches, error } = await client
    .from('customers')
    .select('*')
    .or(`name.ilike.%${query}%,contact.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(8);

  if (error) {
    console.error('Search error:', error);
    return;
  }

  let html = '';
  if (matches.length > 0) {
    html += matches
      .map(
        (c) => `
        <div class="customer-result" data-id="${c.id}"
             data-name="${c.name}"
             data-contact="${c.contact || ''}"
             data-email="${c.email || ''}"
             data-address="${c.address || ''}">
          ${c.name} <small style="color:#666;">(${c.contact || c.email || 'no contact'})</small>
        </div>`
      )
      .join('');
  } else {
    html += `<div class="no-match">No matching customer found.</div>`;
  }

  html += `
    <div class="add-new" id="add-new-customer" style="background:#f9f9f9;color:#007bff;font-weight:bold;text-align:center;">
      + Add New Customer "${query}"
    </div>
  `;

  resultsBox.innerHTML = html;
  resultsBox.style.display = 'block';

  document.querySelectorAll('.customer-result').forEach((item) => {
    item.addEventListener('click', () => {
      document.getElementById('cust-name').value = item.dataset.name;
      document.getElementById('cust-phone').value = item.dataset.contact;
      document.getElementById('cust-email').value = item.dataset.email;
      document.getElementById('cust-address').value = item.dataset.address;
      searchInput.value = item.dataset.name;
      resultsBox.style.display = 'none';
    });
  });

  document.getElementById('add-new-customer').addEventListener('click', () => {
    pendingNewCustomerName = query;
    openCustomerModal();
  });
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#customer-search') && !e.target.closest('#customer-results')) {
    resultsBox.style.display = 'none';
  }
});

// ------------------------------------------------------------
// Modal Controls
// ------------------------------------------------------------
function openCustomerModal() {
  document.getElementById('new-cust-name').value = pendingNewCustomerName;
  document.getElementById('new-cust-contact').value = '';
  document.getElementById('new-cust-email').value = '';
  document.getElementById('new-cust-address').value = '';
  modal.style.display = 'flex';
}

function closeCustomerModal() {
  modal.style.display = 'none';
}

cancelNewBtn.addEventListener('click', closeCustomerModal);

// Save New Customer
saveNewBtn.addEventListener('click', async () => {
  const name = document.getElementById('new-cust-name').value.trim();
  const contact = document.getElementById('new-cust-contact').value.trim();
  const email = document.getElementById('new-cust-email').value.trim();
  const address = document.getElementById('new-cust-address').value.trim();

  if (!name) {
    alert('Customer name is required.');
    return;
  }

  const { data: newCust, error: addErr } = await client
    .from('customers')
    .insert([{ name, contact, email, address }])
    .select()
    .single();

  if (addErr) {
    console.error(addErr);
    alert('Failed to add new customer.');
    return;
  }

  // Autofill fields in main form
  document.getElementById('cust-name').value = newCust.name;
  document.getElementById('cust-phone').value = newCust.contact || '';
  document.getElementById('cust-email').value = newCust.email || '';
  document.getElementById('cust-address').value = newCust.address || '';

  searchInput.value = newCust.name;
  closeCustomerModal();
  resultsBox.style.display = 'none';
});


// ------------------------------------------------------------
// 3️⃣ Load item catalog
// ------------------------------------------------------------
async function loadCatalog() {
  const { data: groups, error } = await client
    .from('item_groups')
    .select('*')
    .order('name');

  if (error) {
    console.error(error);
    alert('Failed to load item groups');
    return;
  }

  renderGroups(groups);
}

function renderGroups(groups) {
  const el = document.getElementById('groups');
  el.innerHTML = groups
    .map(
      (g) => `
        <button class="group-btn" data-id="${g.id}">
          ${g.name}
        </button>
      `
    )
    .join('');

  // ✅ Handle group button clicks
  el.querySelectorAll('.group-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const groupId = btn.dataset.id;
      const groupName = btn.textContent.trim();

      // 🔹 Store globally
      selectedGroupId = groupId;
      selectedGroupName = groupName;

      // 🔹 Highlight selected button
      el.querySelectorAll('.group-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      // 🔹 Fetch group description (optional)
      let groupDesc = null;
      try {
        const { data: g, error: gErr } = await client
          .from('item_groups')
          .select('description')
          .eq('id', groupId)
          .single();
        if (gErr) throw gErr;
        groupDesc = g?.description || null;
      } catch (err) {
        console.warn('Could not fetch group description:', err.message);
      }

      selectedGroupDescription = groupDesc;

      // 🔹 Load items by group
      await loadItemsByGroup(groupId, groupName);
    });
  });
}

async function loadItemsByGroup(groupId, groupName) {
  showSpinner();
  const { data: items, error } = await client
    .from('items')
    .select('*')
    .eq('group_id', groupId)
    .order('name');
  hideSpinner();
  if (error) {
    console.error(error);
    alert('Failed to load items for ' + groupName);
    return;
  }

  renderItems(items, groupName);
}

function renderItems(items, groupName) {
  const el = document.getElementById('items');

  if (!items || items.length === 0) {
    el.innerHTML = `<p style="text-align:center;color:#777;">No items in ${groupName}</p>`;
    return;
  }

  // Header + Add All button
  el.innerHTML = `
    <div class="group-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <h3 style="margin:0;font-size:1rem;color:#007bff;">${groupName}</h3>
      <button id="add-all-btn" class="add-all-btn">Add All</button>
    </div>
    <div class="item-grid">
      ${items
        .map(
          (i) => `
        <div class="item-card" data-id="${i.id}">
          <div class="item-name">${i.name}</div>
          <div class="item-price">RM ${fmt(i.unit_price)}</div>
          <button class="add-btn" data-id="${i.id}">Add</button>
        </div>
      `
        )
        .join('')}
    </div>
  `;

  // Attach single item add events
  el.querySelectorAll('.add-btn').forEach((btn) =>
    btn.addEventListener('click', () => addItemToInvoice(btn.dataset.id, items))
  );

  // Attach "Add All" button event
  document
    .getElementById('add-all-btn')
    .addEventListener('click', () => addAllToInvoice(items));
}

function addAllToInvoice(items) {
  items.forEach((item) => addItemToInvoice(item.id, items));
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

  document.getElementById('total').textContent = fmt(subtotal);

  invoice.total = subtotal;
  invoice.subtotal = subtotal;
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
// 7️⃣ Save invoice + items (with customer info)
// ------------------------------------------------------------
document.getElementById('save-btn').addEventListener('click', async () => {
  const type = invoice.type;
  const notes = document.getElementById('notes').value || null;

  const custName = document.getElementById('cust-name').value.trim();
  const custContact = document.getElementById('cust-phone').value.trim();
  const custEmail = document.getElementById('cust-email').value.trim();
  const custAddress = document.getElementById('cust-address').value.trim();

  if (!custName) {
    alert('Please enter a customer name.');
    return;
  }

  // 🔹 Step 1: Insert or fetch customer
  let customer_id = null;
  const { data: existingCust, error: findErr } = await client
    .from('customers')
    .select('id')
    .eq('contact', custContact)
    .maybeSingle();

  if (findErr) {
    console.error(findErr);
    alert('Failed to fetch customer.');
    return;
  }

  if (existingCust) {
    customer_id = existingCust.id;
  } else {
    const { data: newCust, error: custErr } = await client
      .from('customers')
      .insert([
        {
          name: custName,
          contact: custContact,
          email: custEmail,
          address: custAddress,
        },
      ])
      .select()
      .single();

    if (custErr) {
      console.error(custErr);
      alert('Failed to save customer.');
      return;
    }

    customer_id = newCust.id;
  }

  // 🔹 Step 2: Get next document number
  const docNumber = await getNextNumber(type);
  if (!docNumber) return;

  // 🔹 Step 3: Insert invoice
  const { data: inv, error: invErr } = await client
    .from('invoices')
    .insert([
      {
        invoice_no: docNumber,
        type,
        subtotal: invoice.subtotal,
        total: invoice.total,
        notes,
        customer_id,
        group_id: selectedGroupId,
      },
    ])
    .select()
    .single();

  if (invErr) {
    console.error(invErr);
    alert('Save failed: ' + invErr.message);
    return;
  }

  // 🔹 Step 4: Insert invoice items
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

  // 🔹 Step 5: Success popup
  const reportLink = `${window.location.origin}/report.html?id=${inv.id}`;
  const message = encodeURIComponent(
    `Hi, here is your ${invoice.type.toUpperCase()} (${docNumber}) from Universal Heavy Industries:\n${reportLink}`
  );

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
      max-width:320px;
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

  document.body.appendChild(popup);

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

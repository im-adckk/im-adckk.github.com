
// Replace these with your Supabase project's values
const SUPABASE_URL = 'https://hpmnizmmkepemezfntfh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbW5pem1ta2VwZW1lemZudGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNzA3MTEsImV4cCI6MjA3Njg0NjcxMX0.GeAgM3Xy1hrFqnA1XSiGYkhVTKd63VfRN_kFVH8WAws';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let invoice = {
  type: 'quotation', // or 'invoice'
  lines: [], // {item_id, name, unit_price, qty, line_total}
  sst_rate: 8.00
};

// Utility: format currency
function fmt(n) { return Number(n || 0).toFixed(2); }

// Load groups and items
async function loadCatalog() {
  const { data: groups } = await supabase.from('item_groups').select('*').order('name');
  const { data: items } = await supabase.from('items').select('*').order('name');
  renderGroups(groups);
  renderItems(items);
}

function renderGroups(groups) {
  const el = document.getElementById('groups');
  el.innerHTML = groups.map(g => `<button class="group-btn" data-id="${g.id}">${g.name}</button>`).join('');
  // click handlers optional: filter items by group
}

function renderItems(items) {
  const el = document.getElementById('items');
  el.innerHTML = items.map(i => `
    <div class="item" data-id="${i.id}">
      <div class="item-name">${i.name}</div>
      <div class="item-price">RM ${fmt(i.unit_price)}</div>
      <button class="add-btn" data-id="${i.id}">Add</button>
    </div>
  `).join('');
  el.querySelectorAll('.add-btn').forEach(btn => btn.onclick = () => addItemToInvoice(btn.dataset.id, items));
}

function addItemToInvoice(itemId, items) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  const line = {
    item_id: item.id,
    name: item.name,
    unit_price: Number(item.unit_price),
    qty: 1,
    line_total: Number(item.unit_price) * 1
  };
  invoice.lines.push(line);
  renderInvoiceLines();
}

function renderInvoiceLines(){
  const el = document.getElementById('lines');
  el.innerHTML = invoice.lines.map((l, idx) => `
    <div class="line" data-idx="${idx}">
      <div>${l.name}</div>
      <input type="number" class="qty" value="${l.qty}" min="1" data-idx="${idx}">
      <input type="number" class="price" value="${fmt(l.unit_price)}" step="0.01" data-idx="${idx}">
      <div class="line-total">RM ${fmt(l.line_total)}</div>
      <button class="remove" data-idx="${idx}">Remove</button>
    </div>`).join('');
  attachLineHandlers();
  recalc();
}

function attachLineHandlers(){
  document.querySelectorAll('.qty').forEach(el => el.oninput = (e) => {
    const idx = e.target.dataset.idx;
    const v = Number(e.target.value || 0);
    invoice.lines[idx].qty = Math.max(1, Math.floor(v));
    invoice.lines[idx].line_total = invoice.lines[idx].unit_price * invoice.lines[idx].qty;
    renderInvoiceLines();
  });
  document.querySelectorAll('.price').forEach(el => el.oninput = (e) => {
    const idx = e.target.dataset.idx;
    const v = Number(e.target.value || 0);
    invoice.lines[idx].unit_price = v;
    invoice.lines[idx].line_total = invoice.lines[idx].unit_price * invoice.lines[idx].qty;
    renderInvoiceLines();
  });
  document.querySelectorAll('.remove').forEach(btn => btn.onclick = (e) => {
    const idx = Number(btn.dataset.idx);
    invoice.lines.splice(idx,1);
    renderInvoiceLines();
  });
}

function recalc(){
  const subtotal = invoice.lines.reduce((s,l)=> s + (Number(l.line_total)||0), 0);
  const sst_amount = +(subtotal * (invoice.sst_rate/100));
  const total = +(subtotal + sst_amount);
  document.getElementById('subtotal').textContent = fmt(subtotal);
  document.getElementById('sst-amount').textContent = fmt(sst_amount);
  document.getElementById('total').textContent = fmt(total);
  document.getElementById('sst-rate').textContent = fmt(invoice.sst_rate);
  invoice.subtotal = subtotal; invoice.sst_amount = sst_amount; invoice.total = total;
}

document.getElementById('toggle-type').onchange = (e) => {
  invoice.type = e.target.checked ? 'invoice' : 'quotation';
  document.getElementById('doc-title').textContent = invoice.type === 'invoice' ? 'Invoice' : 'Quotation';
};

// Save invoice to Supabase
document.getElementById('save-btn').onclick = async () => {
  const notes = document.getElementById('notes').value || null;
  // create invoice row
  const { data: inv, error } = await supabase.from('invoices').insert([{
    invoice_no: `INV-${Date.now()}`,
    type: invoice.type,
    subtotal: invoice.subtotal,
    sst_rate: invoice.sst_rate,
    sst_amount: invoice.sst_amount,
    total: invoice.total,
    notes: notes
  }]).select().single();
  if (error) return alert('Save failed: ' + error.message);
  const inv_id = inv.id;
  // insert invoice items
  const itemsToInsert = invoice.lines.map(l => ({
    invoice_id: inv_id,
    item_id: l.item_id,
    description: l.name,
    unit_price: l.unit_price,
    qty: l.qty,
    line_total: l.line_total
  }));
  await supabase.from('invoice_items').insert(itemsToInsert);
  alert('Saved!');
};

// initial load
loadCatalog();

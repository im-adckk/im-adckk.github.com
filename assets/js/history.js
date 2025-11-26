// ------------------------------------------------------------
// Past Documents Viewer (with pagination + mobile cards + Edit/Re-send)
// ------------------------------------------------------------

const SUPABASE_URL = 'https://hpmnizmmkepemezfntfh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbW5pem1ta2VwZW1lemZudGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNzA3MTEsImV4cCI6MjA3Njg0NjcxMX0.GeAgM3Xy1hrFqnA1XSiGYkhVTKd63VfRN_kFVH8WAws';
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const tableBody = document.querySelector('#docs-table tbody');
const searchName = document.getElementById('search-name');
const searchDate = document.getElementById('search-date');
const filterType = document.getElementById('filter-type');
const searchBtn = document.getElementById('search-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const pageInfo = document.getElementById('page-info');

// Modal elements
const editModal = document.getElementById('editModal');
const resendModal = document.getElementById('resendModal');
const editForm = document.getElementById('edit-form');
const editLineItems = document.getElementById('edit-line-items');
const addLineBtn = document.getElementById('add-line-btn');
const cancelEditBtn = document.getElementById('cancel-edit');
const editStaffContact = document.getElementById('edit-staff-contact');

let currentPage = 1;
const pageSize = 20;
let totalRecords = 0;
let currentEditingDoc = null;
let staffContacts = [];

async function loadDocuments(page = 1, nameFilter = '', dateFilter = '', typeFilter = '') {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from('invoices')
    .select(`
      id,
      invoice_no,
      type,
      total,
      created_at,
      customers(name),
      staff(id, name, contact_no)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (nameFilter) query = query.ilike('customers.name', `%${nameFilter}%`);
  if (dateFilter) {
    const start = new Date(dateFilter);
    const end = new Date(dateFilter);
    end.setDate(end.getDate() + 1);
    query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString());
  }
  if (typeFilter) query = query.eq('type', typeFilter);

  const { data, error, count } = await query;
  if (error) {
    console.error('Fetch error:', error);
    tableBody.innerHTML = `<tr><td colspan="6" style="color:red;">Failed to load documents</td></tr>`;
    return;
  }

  totalRecords = count || 0;
  renderDocuments(data);
  updatePagination(page);
}

function renderDocuments(docs) {
  if (!docs || docs.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6">No documents found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = docs.map(doc => {
    const date = new Date(doc.created_at).toLocaleDateString();
    const name = doc.customers?.name || '—';
    const type = doc.type.charAt(0).toUpperCase() + doc.type.slice(1);
    const total = Number(doc.total || 0).toFixed(2);

    return `
      <tr>
        <td data-label="Date">${date}</td>
        <td data-label="Document No">${doc.invoice_no}</td>
        <td data-label="Type">${type}</td>
        <td data-label="Customer">${name}</td>
        <td data-label="Total (RM)">${total}</td>
        <td data-label="Actions">
          <div class="action-buttons">
            <a href="report.html?id=${doc.id}" target="_blank" class="view-link">View</a>
            <button class="edit-btn" data-id="${doc.id}">Edit</button>
            <button class="resend-btn" data-id="${doc.id}">Re-send</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach event listeners to edit and resend buttons
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });

  document.querySelectorAll('.resend-btn').forEach(btn => {
    btn.addEventListener('click', () => openResendModal(btn.dataset.id));
  });
}

function updatePagination(page) {
  const totalPages = Math.ceil(totalRecords / pageSize);
  pageInfo.textContent = `Page ${page} of ${totalPages || 1}`;
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= totalPages;
}

// Load staff contacts for dropdown
async function loadStaffContacts() {
  try {
    const { data: staff, error } = await client
      .from('staff')
      .select('*')
      .order('name');

    if (error) throw error;

    staffContacts = staff || [];
    renderStaffContacts();
  } catch (error) {
    console.error('Failed to load staff contacts:', error);
  }
}

function renderStaffContacts() {
  if (!editStaffContact) return;
  
  editStaffContact.innerHTML = '<option value="">-- Select Contact Department --</option>' +
    staffContacts.map(s => `
      <option value="${s.id}">${s.name} - ${s.contact_no}</option>
    `).join('');
}

// Edit Modal Functions
async function openEditModal(docId) {
  try {
    console.log('Opening edit modal for document:', docId);
    
    // Fetch complete document data with customer, staff, and line items
    const { data: doc, error } = await client
      .from('invoices')
      .select(`
        *,
        customers(*),
        staff(id, name, contact_no),
        invoice_items(*)
      `)
      .eq('id', docId)
      .single();

    if (error) {
      console.error('Error fetching document:', error);
      throw error;
    }

    console.log('Document data loaded:', doc);
    currentEditingDoc = doc;

    // Populate modal fields
    document.getElementById('edit-doc-no').value = doc.invoice_no;
    document.getElementById('edit-date').value = new Date(doc.created_at).toLocaleDateString();
    document.getElementById('edit-type').value = doc.type.charAt(0).toUpperCase() + doc.type.slice(1);
    document.getElementById('edit-customer-name').value = doc.customers?.name || '';
    document.getElementById('edit-customer-contact').value = doc.customers?.contact || '';
    document.getElementById('edit-customer-email').value = doc.customers?.email || '';
    document.getElementById('edit-customer-address').value = doc.customers?.address || '';
    document.getElementById('edit-notes').value = doc.notes || '';

    // Set staff contact if exists
    if (doc.staff_id && editStaffContact) {
      console.log('Setting staff contact to:', doc.staff_id);
      editStaffContact.value = doc.staff_id;
    } else {
      console.log('No staff_id found or staff_id is null');
      editStaffContact.value = '';
    }

    // Render line items
    renderEditLineItems(doc.invoice_items);

    // Show modal
    editModal.style.display = 'flex';
    
  } catch (error) {
    console.error('Error loading document for edit:', error);
    alert('Failed to load document for editing');
  }
}

function renderEditLineItems(lineItems) {
  editLineItems.innerHTML = '';

  if (!lineItems || lineItems.length === 0) {
    editLineItems.innerHTML = '<p>No line items</p>';
    return;
  }

  lineItems.forEach((item, index) => {
    const lineDiv = document.createElement('div');
    lineDiv.className = 'line-item';
    lineDiv.innerHTML = `
      <input type="text" class="line-description" value="${item.description}" placeholder="Description" data-index="${index}">
      <input type="number" class="line-qty" value="${item.qty}" min="1" placeholder="Qty" data-index="${index}" step="1">
      <input type="number" class="line-price" value="${item.unit_price}" min="0" placeholder="Price" data-index="${index}" step="0.01">
      <span class="line-total">RM ${(item.qty * item.unit_price).toFixed(2)}</span>
      <button type="button" class="remove-line" data-index="${index}">×</button>
    `;
    editLineItems.appendChild(lineDiv);
  });

  // Attach event listeners for line item changes
  attachLineItemListeners();
}

function attachLineItemListeners() {
  // Quantity and price change listeners
  editLineItems.querySelectorAll('.line-qty, .line-price').forEach(input => {
    input.addEventListener('input', (e) => {
      const index = e.target.dataset.index;
      updateLineTotal(index);
    });
  });

  // Remove line listeners
  editLineItems.querySelectorAll('.remove-line').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = e.target.dataset.index;
      removeLineItem(index);
    });
  });
}

function updateLineTotal(index) {
  const qty = parseFloat(editLineItems.querySelector(`.line-qty[data-index="${index}"]`).value) || 0;
  const price = parseFloat(editLineItems.querySelector(`.line-price[data-index="${index}"]`).value) || 0;
  const total = qty * price;
  
  editLineItems.querySelector(`.line-total[data-index="${index}"]`).textContent = `RM ${total.toFixed(2)}`;
}

function removeLineItem(index) {
  if (currentEditingDoc.invoice_items.length <= 1) {
    alert('Document must have at least one line item');
    return;
  }
  
  currentEditingDoc.invoice_items.splice(index, 1);
  renderEditLineItems(currentEditingDoc.invoice_items);
}

// Add new line item
addLineBtn.addEventListener('click', () => {
  const newLine = {
    description: '',
    qty: 1,
    unit_price: 0,
    line_total: 0
  };
  
  currentEditingDoc.invoice_items.push(newLine);
  renderEditLineItems(currentEditingDoc.invoice_items);
});

// Save edited document
editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  try {
    console.log('Starting document update...');
    
    // Update customer information
    const customerUpdate = {
      name: document.getElementById('edit-customer-name').value,
      contact: document.getElementById('edit-customer-contact').value,
      email: document.getElementById('edit-customer-email').value,
      address: document.getElementById('edit-customer-address').value
    };
    
    console.log('Updating customer:', customerUpdate);
    
    const { error: customerError } = await client
      .from('customers')
      .update(customerUpdate)
      .eq('id', currentEditingDoc.customer_id);

    if (customerError) {
      console.error('Customer update error:', customerError);
      throw customerError;
    }

    // Get selected staff contact
    const selectedStaffId = editStaffContact.value || null;
    console.log('Selected staff ID:', selectedStaffId);

    // Update invoice notes and staff contact
    const invoiceUpdate = {
      notes: document.getElementById('edit-notes').value,
      staff_id: selectedStaffId
    };
    
    console.log('Updating invoice:', invoiceUpdate);
    
    const { error: invoiceError } = await client
      .from('invoices')
      .update(invoiceUpdate)
      .eq('id', currentEditingDoc.id);

    if (invoiceError) {
      console.error('Invoice update error:', invoiceError);
      throw invoiceError;
    }

    // Update line items
    console.log('Updating line items...');
    for (let i = 0; i < currentEditingDoc.invoice_items.length; i++) {
      const item = currentEditingDoc.invoice_items[i];
      const description = editLineItems.querySelector(`.line-description[data-index="${i}"]`).value;
      const qty = parseFloat(editLineItems.querySelector(`.line-qty[data-index="${i}"]`).value) || 0;
      const unit_price = parseFloat(editLineItems.querySelector(`.line-price[data-index="${i}"]`).value) || 0;
      const line_total = qty * unit_price;
      
      console.log(`Line item ${i}:`, { description, qty, unit_price, line_total });
      
      if (item.id) {
        // Update existing line item
        const { error: lineError } = await client
          .from('invoice_items')
          .update({
            description,
            qty,
            unit_price,
            line_total
          })
          .eq('id', item.id);

        if (lineError) {
          console.error('Line item update error:', lineError);
          throw lineError;
        }
      } else {
        // Insert new line item
        const { error: lineError } = await client
          .from('invoice_items')
          .insert({
            invoice_id: currentEditingDoc.id,
            description,
            qty,
            unit_price,
            line_total
          });

        if (lineError) {
          console.error('Line item insert error:', lineError);
          throw lineError;
        }
      }
    }

    // Update invoice total
    const newTotal = currentEditingDoc.invoice_items.reduce((sum, item, index) => {
      const qty = parseFloat(editLineItems.querySelector(`.line-qty[data-index="${index}"]`).value) || 0;
      const unit_price = parseFloat(editLineItems.querySelector(`.line-price[data-index="${index}"]`).value) || 0;
      return sum + (qty * unit_price);
    }, 0);

    console.log('Updating total to:', newTotal);
    
    const { error: totalError } = await client
      .from('invoices')
      .update({ total: newTotal })
      .eq('id', currentEditingDoc.id);

    if (totalError) {
      console.error('Total update error:', totalError);
      throw totalError;
    }

    console.log('Document updated successfully!');
    alert('Document updated successfully!');
    closeEditModal();
    loadDocuments(currentPage, searchName.value.trim(), searchDate.value, filterType.value);
    
  } catch (error) {
    console.error('Error updating document:', error);
    alert('Failed to update document: ' + error.message);
  }
});

function closeEditModal() {
  editModal.style.display = 'none';
  currentEditingDoc = null;
}

cancelEditBtn.addEventListener('click', closeEditModal);

// Re-send Modal Functions
async function openResendModal(docId) {
  try {
    const { data: doc, error } = await client
      .from('invoices')
      .select(`
        *,
        customers(*)
      `)
      .eq('id', docId)
      .single();

    if (error) throw error;

    const reportLink = `${window.location.origin}/report.html?id=${doc.id}`;
    const docType = doc.type.toUpperCase();
    
    document.getElementById('resend-doc-info').textContent = `${docType} - ${doc.invoice_no}`;

    // Set up event listeners for sharing options
    setupResendListeners(doc, reportLink, docType);
    
    resendModal.style.display = 'flex';
  } catch (error) {
    console.error('Error loading document for resend:', error);
    alert('Failed to load document for sharing');
  }
}

function setupResendListeners(doc, reportLink, docType) {
  // Remove existing listeners
  const viewReport = document.getElementById('resend-view-report');
  const whatsappBtn = document.getElementById('resend-whatsapp');
  const emailBtn = document.getElementById('resend-email');
  const copyBtn = document.getElementById('resend-copy-link');
  const closeBtn = document.getElementById('close-resend');

  // Clone and replace to remove old listeners
  viewReport.replaceWith(viewReport.cloneNode(true));
  whatsappBtn.replaceWith(whatsappBtn.cloneNode(true));
  emailBtn.replaceWith(emailBtn.cloneNode(true));
  copyBtn.replaceWith(copyBtn.cloneNode(true));
  closeBtn.replaceWith(closeBtn.cloneNode(true));

  // Get fresh references
  const freshViewReport = document.getElementById('resend-view-report');
  const freshWhatsappBtn = document.getElementById('resend-whatsapp');
  const freshEmailBtn = document.getElementById('resend-email');
  const freshCopyBtn = document.getElementById('resend-copy-link');
  const freshCloseBtn = document.getElementById('close-resend');

  // Add new listeners
  freshViewReport.addEventListener('click', () => {
    window.open(reportLink, '_blank');
  });

  freshWhatsappBtn.addEventListener('click', () => {
    const message = encodeURIComponent(
      `Hi, here is your ${docType} (${doc.invoice_no}) from Api-Api Driving Centre:\n${reportLink}`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  });

  freshEmailBtn.addEventListener('click', () => {
    const emailSubject = encodeURIComponent(`${docType} - ${doc.invoice_no} - Api-Api Driving Centre`);
    const emailBody = encodeURIComponent(
      `Dear Customer,\n\nPlease find your ${docType} (${doc.invoice_no}) attached.\n\nYou can view it here: ${reportLink}\n\nThank you,\nApi-Api Driving Centre`
    );
    const customerEmail = doc.customers?.email || '';
    let mailtoLink = `mailto:${customerEmail}?subject=${emailSubject}&body=${emailBody}`;
    window.location.href = mailtoLink;
  });

  freshCopyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(reportLink);
      
      // Show copied feedback
      const originalText = freshCopyBtn.innerHTML;
      freshCopyBtn.innerHTML = '✅ Copied!';
      freshCopyBtn.style.background = '#28a745';
      
      setTimeout(() => {
        freshCopyBtn.innerHTML = originalText;
        freshCopyBtn.style.background = '#6c757d';
      }, 2000);
      
    } catch (err) {
      console.error('Failed to copy: ', err);
      alert('Failed to copy link to clipboard');
    }
  });

  freshCloseBtn.addEventListener('click', () => {
    resendModal.style.display = 'none';
  });
}

// Close modals when clicking outside
window.addEventListener('click', (e) => {
  if (e.target === editModal) {
    closeEditModal();
  }
  if (e.target === resendModal) {
    resendModal.style.display = 'none';
  }
});

// Event listeners for pagination and search
searchBtn.addEventListener('click', () => {
  currentPage = 1;
  loadDocuments(currentPage, searchName.value.trim(), searchDate.value, filterType.value);
});

prevBtn.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    loadDocuments(currentPage, searchName.value.trim(), searchDate.value, filterType.value);
  }
});

nextBtn.addEventListener('click', () => {
  const totalPages = Math.ceil(totalRecords / pageSize);
  if (currentPage < totalPages) {
    currentPage++;
    loadDocuments(currentPage, searchName.value.trim(), searchDate.value, filterType.value);
  }
});

// Initial load

loadStaffContacts();

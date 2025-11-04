// ------------------------------------------------------------
// ADC Invoice / Quotation App - Supabase Frontend
// ------------------------------------------------------------

// 🧩 1. Initialize Supabase Client
const SUPABASE_URL = 'https://hpmnizmmkepemezfntfh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbW5pem1ta2VwZW1lemZudGZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNzA3MTEsImV4cCI6MjA3Njg0NjcxMX0.GeAgM3Xy1hrFqnA1XSiGYkhVTKd63VfRN_kFVH8WAws';

// ✅ Use the global Supabase object safely
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------------------------------------------------------------
// 🔐 Authentication System
// ------------------------------------------------------------

// Check if user is logged in
function checkAuth() {
    console.log('Checking authentication...');
    const userData = sessionStorage.getItem('currentUser');
    console.log('User data from sessionStorage:', userData);
    
    if (userData) {
        try {
            const user = JSON.parse(userData);
            console.log('User found:', user);
            showUserInfo(user);
            hideLoginModal();
            return user;
        } catch (e) {
            console.error('Error parsing user data:', e);
            sessionStorage.removeItem('currentUser');
        }
    }
    
    console.log('No user found, showing login modal');
    showLoginModal();
    return null;
}

// Show login modal
function showLoginModal() {
    console.log('Showing login modal');
    const loginModal = document.getElementById('loginModal');
    const main = document.querySelector('main');
    const header = document.querySelector('header');
    
    if (loginModal) loginModal.style.display = 'flex';
    if (main) main.style.display = 'none';
    if (header) header.style.display = 'block';
    
    console.log('Login modal displayed:', loginModal?.style.display);
    console.log('Main display:', main?.style.display);
    console.log('Header display:', header?.style.display);
}

// Hide login modal
function hideLoginModal() {
    console.log('Hiding login modal');
    const loginModal = document.getElementById('loginModal');
    const main = document.querySelector('main');
    const header = document.querySelector('header');
    
    if (loginModal) loginModal.style.display = 'none';
    if (main) main.style.display = 'flex';
    if (header) header.style.display = 'block';
    
    console.log('Login modal hidden:', loginModal?.style.display);
    console.log('Main display:', main?.style.display);
    console.log('Header display:', header?.style.display);
}

// Show user info
function showUserInfo(user) {
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');
    
    if (userInfo && userName) {
        userInfo.style.display = 'flex';
        userName.textContent = user.name;
        console.log('User info displayed for:', user.name);
        
        // Ensure proper layout after showing user info
        setTimeout(updateSaveButtonVisibility, 100);
    }
}

// Login function
async function login() {
    console.log('Login attempt started');
    const name = document.getElementById('login-name').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorDiv = document.getElementById('login-error');

    console.log('Login credentials:', { name, password });

    if (!name || !password) {
        errorDiv.textContent = 'Please enter both name and password';
        errorDiv.style.display = 'block';
        return;
    }

    try {
        // Check user in database
        console.log('Checking user in database...');
        const { data: user, error } = await client
            .from('users')
            .select('*')
            .eq('name', name)
            .eq('password', password)
            .eq('is_active', true)
            .single();

        console.log('Database response:', { user, error });

        if (error || !user) {
            errorDiv.textContent = 'Invalid name or password';
            errorDiv.style.display = 'block';
            return;
        }

        // Save user session in sessionStorage (cleared when browser closes)
        const userData = {
            id: user.id,
            name: user.name,
            loggedIn: true,
            loginTime: new Date().getTime()
        };
        sessionStorage.setItem('currentUser', JSON.stringify(userData));
        console.log('User saved to sessionStorage');

        // Update UI
        showUserInfo(userData);
        hideLoginModal();

        // Load the app content
        await initializeApp();

    } catch (err) {
        console.error('Login error:', err);
        errorDiv.textContent = 'Login failed. Please try again.';
        errorDiv.style.display = 'block';
    }
}

// Initialize the main app
async function initializeApp() {
    console.log('Initializing app...');
    try {
        await loadCatalog();
        await loadStaffContacts();
        initializeDocumentTypeToggle();
        console.log('App initialized successfully');
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

// Logout function
function logout() {
    console.log('Logging out...');
    sessionStorage.removeItem('currentUser');
    document.getElementById('login-name').value = '';
    document.getElementById('login-password').value = '';
    showLoginModal();
}

// Initialize login modal events
function initializeLogin() {
    console.log('Initializing login events...');
    const loginBtn = document.getElementById('login-btn');
    const passwordField = document.getElementById('login-password');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', login);
        console.log('Login button event attached');
    } else {
        console.error('Login button not found!');
    }
    
    if (passwordField) {
        passwordField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                login();
            }
        });
    }
}

// 🧩 2. Invoice data object
let invoice = {
  type: 'quotation',
  lines: []
};

// 🧩 Global variables for group selection
let selectedGroupId = null;
let selectedGroupName = null;
let selectedGroupDescription = null;

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
// 5️⃣ Document type toggle (Modern Segmented Control)
// ------------------------------------------------------------
function initializeDocumentTypeToggle() {
  const radioButtons = document.querySelectorAll('input[name="doc-type"]');
  
  radioButtons.forEach(radio => {
    radio.addEventListener('change', (e) => {
      invoice.type = e.target.value;
      document.getElementById('doc-title').textContent =
        invoice.type === 'invoice' ? 'Invoice' : 'Quotation';
      
      // Optional: Log the change for debugging
      console.log('Document type changed to:', invoice.type);
    });
  });
  
  // Set initial state
  document.getElementById('doc-title').textContent = 'Quotation';
}


// ------------------------------------------------------------
// 6️⃣ Generate next number via Supabase RPC (Updated format)
// ------------------------------------------------------------
async function getNextNumber(type) {
  try {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear().toString().slice(-2); // Last 2 digits of year
    const prefix = type === 'invoice' ? 'INV' : 'QUO';
    const pattern = `%/${month}/${year}/${prefix}-%`; // Look for same month/year

    // Get the highest existing number for this month
    const { data: existingInvoices, error } = await client
      .from('invoices')
      .select('invoice_no')
      .like('invoice_no', pattern)
      .order('invoice_no', { ascending: false })
      .limit(1);

    if (error) throw error;

    let nextNum = 1;
    
    if (existingInvoices && existingInvoices.length > 0) {
      const lastInvoiceNo = existingInvoices[0].invoice_no;
      // Match pattern: DD/MM/YY/PREFIX-XXX
      const match = lastInvoiceNo.match(new RegExp(`\\d{2}\\/${month}\\/${year}\\/${prefix}-(\\d+)`));
      if (match && match[1]) {
        nextNum = parseInt(match[1]) + 1;
      }
    }

    // Format: DD/MM/YY/PREFIX-XXX
    const day = String(today.getDate()).padStart(2, '0');
    const newNumber = `${day}/${month}/${year}/${prefix}-${String(nextNum).padStart(3, '0')}`;
    return newNumber;

  } catch (error) {
    console.error('Numbering error:', error);
    
    // Fallback
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear().toString().slice(-2);
    const prefix = type === 'invoice' ? 'INV' : 'QUO';
    
    return `${day}/${month}/${year}/${prefix}-001`;
  }
}

// ------------------------------------------------------------
// 🧩 Staff Contact Selection
// ------------------------------------------------------------
let selectedStaffId = null;

async function loadStaffContacts() {
  const { data: staff, error } = await client
    .from('staff')
    .select('*')
    .order('name');

  if (error) {
    console.error('Failed to load staff contacts:', error);
    return;
  }

  renderStaffContacts(staff);
}

function renderStaffContacts(staff) {
  const select = document.getElementById('staff-contact');
  select.innerHTML = '<option value="">-- Select Contact Department --</option>' +
    staff.map(s => `
      <option value="${s.id}">${s.name} - ${s.contact_no}</option>
    `).join('');

  select.addEventListener('change', (e) => {
    selectedStaffId = e.target.value;
  });
}

//function to verify users exist in public.users
async function verifyUserInPublicUsers(userId) {
    try {
        const { data: user, error } = await client
            .from('users')
            .select('id, name, is_active')
            .eq('id', userId)
            .eq('is_active', true)
            .single();

        return { user, error };
    } catch (err) {
        return { user: null, error: err };
    }
}

function updateSaveButtonVisibility() {
  const floatingSaveBtn = document.getElementById('floating-save-btn');
  const headerSaveBtn = document.getElementById('header-save-btn');
  
  if (window.innerWidth <= 768) {
    // Mobile: show floating button, hide header button
    if (floatingSaveBtn) {
      floatingSaveBtn.style.display = 'flex';
    }
    if (headerSaveBtn) {
      headerSaveBtn.style.display = 'none';
    }
  } else {
    // Desktop: show header button, hide floating button
    if (floatingSaveBtn) {
      floatingSaveBtn.style.display = 'none';
    }
    if (headerSaveBtn) {
      headerSaveBtn.style.display = 'inline-block';
    }
  }
}

// ------------------------------------------------------------
// 7️⃣ Save invoice + items (with customer info)
// ------------------------------------------------------------

function initializeSaveButtons() {
  const headerSaveBtn = document.getElementById('header-save-btn');
  const floatingSaveBtn = document.getElementById('floating-save-btn');
  
  // Remove any existing event listeners
  headerSaveBtn.replaceWith(headerSaveBtn.cloneNode(true));
  floatingSaveBtn.replaceWith(floatingSaveBtn.cloneNode(true));
  
  // Get fresh references
  const freshHeaderSaveBtn = document.getElementById('header-save-btn');
  const freshFloatingSaveBtn = document.getElementById('floating-save-btn');
  
  // Add event listeners to both buttons
  if (freshHeaderSaveBtn) {
    freshHeaderSaveBtn.addEventListener('click', handleSave);
  }
  
  if (freshFloatingSaveBtn) {
    freshFloatingSaveBtn.addEventListener('click', handleSave);
  }
}

// Extract the save logic into a separate function
async function handleSave() {
  const type = invoice.type;
  const notes = document.getElementById('notes').value || null;

  const custName = document.getElementById('cust-name').value.trim();
  const custContact = document.getElementById('cust-phone').value.trim();
  const custEmail = document.getElementById('cust-email').value.trim();
  const custAddress = document.getElementById('cust-address').value.trim();
  const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    
  if (!currentUser) {
    alert('Please login to save documents');
    return;
  }

  // Verify user exists in public.users table
  const { user: verifiedUser, error: verifyError } = await verifyUserInPublicUsers(currentUser.id);
  
  if (verifyError || !verifiedUser) {
    console.error('User verification failed:', verifyError);
    alert('Your user account is not valid or has been deactivated. Please contact administrator.');
    logout();
    return;
  }

  console.log('User verified:', verifiedUser);

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
        staff_id: selectedStaffId,
        created_by: currentUser.id,
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

  // 🔹 Step 5: Success popup with multiple sharing options
  const reportLink = `${window.location.origin}/report.html?id=${inv.id}`;
  const docType = invoice.type.toUpperCase();
  const message = encodeURIComponent(
    `Hi, here is your ${docType} (${docNumber}) from Api-Api Driving Centre:\n${reportLink}`
  );
  
  const emailSubject = encodeURIComponent(`${docType} - ${docNumber} - Api-Api Driving Centre`);
  const emailBody = encodeURIComponent(
    `Dear Customer,\n\nPlease find your ${docType} (${docNumber}) attached.\n\nYou can view it here: ${reportLink}\n\nThank you,\nApi-Api Driving Centre`
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
      padding:25px;
      border-radius:12px;
      text-align:center;
      max-width:350px;
      width:90%;
      box-shadow:0 4px 10px rgba(0,0,0,0.2);
    ">
      <h3 style="margin-top:0;color:#28a745;">✅ ${docNumber} Saved!</h3>
      <p style="margin-bottom:20px;">Your ${invoice.type} has been saved successfully.</p>
      
      <button id="view-report" style="background:#007bff;color:#fff;border:none;padding:12px 15px;border-radius:8px;margin:8px 0;width:100%;font-size:14px;cursor:pointer;">
        📄 View Report
      </button>
      
      <button id="share-whatsapp" style="background:#25D366;color:#fff;border:none;padding:12px 15px;border-radius:8px;margin:8px 0;width:100%;font-size:14px;cursor:pointer;">
        💬 Share via WhatsApp
      </button>
      
      <button id="share-email" style="background:#ea4335;color:#fff;border:none;padding:12px 15px;border-radius:8px;margin:8px 0;width:100%;font-size:14px;cursor:pointer;">
        📧 Share via Email
      </button>
      
      <button id="copy-link" style="background:#6c757d;color:#fff;border:none;padding:12px 15px;border-radius:8px;margin:8px 0;width:100%;font-size:14px;cursor:pointer;">
        🔗 Copy Link
      </button>
      
      <button id="close-popup" style="background:#ccc;color:#000;border:none;padding:10px 15px;border-radius:8px;margin-top:15px;width:100%;font-size:14px;cursor:pointer;">
        Close
      </button>
    </div>
  `;
  
  document.body.appendChild(popup);
  
  // Event listeners for all buttons
  document.getElementById('view-report').addEventListener('click', () => {
    window.open(reportLink, '_blank');
  });
  
  document.getElementById('share-whatsapp').addEventListener('click', () => {
    window.open(`https://wa.me/?text=${message}`, '_blank');
  });
  
  document.getElementById('share-email').addEventListener('click', () => {
    const customerEmail = document.getElementById('cust-email').value.trim();
    let mailtoLink = `mailto:${customerEmail || ''}?subject=${emailSubject}&body=${emailBody}`;
    window.location.href = mailtoLink;
  });
  
  document.getElementById('copy-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(reportLink);
      
      // Show copied feedback
      const copyBtn = document.getElementById('copy-link');
      const originalText = copyBtn.innerHTML;
      copyBtn.innerHTML = '✅ Copied!';
      copyBtn.style.background = '#28a745';
      
      setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.style.background = '#6c757d';
      }, 2000);
      
    } catch (err) {
      console.error('Failed to copy: ', err);
      alert('Failed to copy link to clipboard');
    }
  });
  
  document.getElementById('close-popup').addEventListener('click', () => {
    popup.remove();
  });
}

// Update the DOMContentLoaded event listener
window.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded');
    
    // Initialize login system first
    initializeLogin();
    
    // Initialize save buttons (both regular and floating)
    initializeSaveButtons();
    
    // Set up save button visibility
    updateSaveButtonVisibility();
    window.addEventListener('resize', updateSaveButtonVisibility);
    
    // Check authentication
    const user = checkAuth();
    
    if (user) {
        console.log('User authenticated, loading app...');
        // Load the app if user is authenticated
        await initializeApp();
    } else {
        console.log('User not authenticated, waiting for login...');
    }
});


// ------------------------------------------------------------
// 8️⃣ On load
// ------------------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded');
    
    // Initialize login system first
    initializeLogin();
    
    // Set up save button visibility
    updateSaveButtonVisibility();
    window.addEventListener('resize', updateSaveButtonVisibility);
    
    // Check authentication
    const user = checkAuth();
    
    if (user) {
        console.log('User authenticated, loading app...');
        // Load the app if user is authenticated
        await initializeApp();
    } else {
        console.log('User not authenticated, waiting for login...');
    }
});
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

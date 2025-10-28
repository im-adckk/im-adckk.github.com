// ------------------------------------------------------------
// Past Documents Viewer (with pagination + type filter)
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

let currentPage = 1;
const pageSize = 20;
let totalRecords = 0;

// Load docs with optional filters
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
      customers(name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (nameFilter) {
    query = query.ilike('customers.name', `%${nameFilter}%`);
  }

  if (dateFilter) {
    const start = new Date(dateFilter);
    const end = new Date(dateFilter);
    end.setDate(end.getDate() + 1);
    query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString());
  }

  if (typeFilter) {
    query = query.eq('type', typeFilter);
  }

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
    return `
      <tr>
        <td>${date}</td>
        <td>${doc.invoice_no}</td>
        <td>${type}</td>
        <td>${name}</td>
        <td>${Number(doc.total || 0).toFixed(2)}</td>
        <td><a href="report.html?id=${doc.id}" target="_blank" class="view-link">View</a></td>
      </tr>
    `;
  }).join('');
}

function updatePagination(page) {
  const totalPages = Math.ceil(totalRecords / pageSize);
  pageInfo.textContent = `Page ${page} of ${totalPages || 1}`;

  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= totalPages;
}

// Event Listeners
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

// Initial Load
loadDocuments();

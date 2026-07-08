// Supabase Configuration
const SUPABASE_URL = 'https://yrrinzreyafiowehhhon.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4MnAXo4yxHMQX7fSn7hQjA_qV2X7t7o';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
   
// Admin password (simple - you can change this)
const ADMIN_PASSWORD = 'admin123';
const ADMIN_SESSION_KEY = 'admin_logged_in';
const ADMIN_LOGIN_TIME_KEY = 'admin_login_time';
 
// State
let adminMonth = new Date().getMonth();
let adminYear = new Date().getFullYear();
let selectedAdminDate = null;
let allBookingsData = [];
let currentPage = 1;
let rowsPerPage = 10;
let totalPages = 1;
let filteredBookings = [];
let totalDBCount = 0;

// DOM Elements
const adminLogin = document.getElementById('adminLogin');
const adminContent = document.getElementById('adminContent');
const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');

// ============================================
// UTILITIES
// ============================================

function getMalaysiaDate(dateInput) {
    const date = new Date(dateInput);
    const malaysiaOffset = 8 * 60;
    const localOffset = date.getTimezoneOffset();
    const malaysiaTime = date.getTime() + (localOffset + malaysiaOffset) * 60 * 1000;
    return new Date(malaysiaTime);
}

function getMalaysiaToday() {
    const now = new Date();
    const malaysiaDate = getMalaysiaDate(now);
    const year = malaysiaDate.getFullYear();
    const month = String(malaysiaDate.getMonth() + 1).padStart(2, '0');
    const day = String(malaysiaDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toMalaysiaDateStr(dateObj) {
    const malaysiaDate = getMalaysiaDate(dateObj);
    const year = malaysiaDate.getFullYear();
    const month = String(malaysiaDate.getMonth() + 1).padStart(2, '0');
    const day = String(malaysiaDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatMalaysiaDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString + 'T00:00:00');
    const malaysiaDate = getMalaysiaDate(date);
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
    };
    return malaysiaDate.toLocaleDateString('en-MY', options);
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('en-MY', options);
}

function showMessage(text, type = 'info') {
    const messageDiv = document.getElementById('message');
    const messageText = document.getElementById('messageText');
    if (!messageDiv) { 
        alert(text); 
        return; 
    }
    
    messageDiv.classList.remove('hidden');
    messageDiv.style.display = 'flex';
    messageDiv.className = 'alert items-start gap-2.5 p-3.5 border rounded-xl';
    
    const icon = messageDiv.querySelector('i');
    if (icon) {
        if (type === 'error') {
            icon.setAttribute('data-lucide', 'circle-alert');
            messageDiv.setAttribute('data-variant', 'destructive');
        } else if (type === 'success') {
            icon.setAttribute('data-lucide', 'circle-check');
            messageDiv.removeAttribute('data-variant');
            messageDiv.style.borderColor = 'var(--color-ring)';
            messageDiv.style.backgroundColor = 'var(--color-muted)';
            messageDiv.style.color = 'var(--color-foreground)';
        } else {
            icon.setAttribute('data-lucide', 'info');
            messageDiv.removeAttribute('data-variant');
        }
    }
    
    if (messageText) {
        messageText.textContent = text;
    } else {
        messageDiv.textContent = text;
    }
    
    if (window.lucide) lucide.createIcons();
}

// ============================================
// ADMIN SESSION MANAGEMENT
// ============================================

function checkAdminSession() {
    const isLoggedIn = sessionStorage.getItem(ADMIN_SESSION_KEY);
    const loginTime = sessionStorage.getItem(ADMIN_LOGIN_TIME_KEY);
    
    if (isLoggedIn === 'true' && loginTime) {
        const sessionAge = Date.now() - parseInt(loginTime);
        const maxSessionAge = 24 * 60 * 60 * 1000;
        
        if (sessionAge < maxSessionAge) {
            return true;
        } else {
            clearAdminSession();
            return false;
        }
    }
    return false;
}

function createAdminSession() {
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
    sessionStorage.setItem(ADMIN_LOGIN_TIME_KEY, Date.now().toString());
}

function clearAdminSession() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_LOGIN_TIME_KEY);
}

function logoutAdmin() {
    clearAdminSession();
    adminContent.classList.add('hidden');
    adminLogin.classList.remove('hidden');
    document.getElementById('adminStatus').textContent = '🔒 Admin Access';
    document.getElementById('adminStatus').style.color = 'inherit';
    document.getElementById('logoutBtn').classList.add('hidden');
    document.getElementById('adminPassword').value = '';
    loginMessage.classList.add('hidden');
    showMessage('Logged out successfully.', 'info');
}

// ============================================
// ADMIN LOGIN
// ============================================

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const password = document.getElementById('adminPassword').value;
    
    if (password === ADMIN_PASSWORD) {
        createAdminSession();
        adminLogin.classList.add('hidden');
        adminContent.classList.remove('hidden');
        document.getElementById('adminStatus').textContent = '✅ Admin Logged In';
        document.getElementById('adminStatus').style.color = 'green';
        document.getElementById('logoutBtn').style.display = 'inline-block';
        initializeAdmin();
    } else {
        loginMessage.style.display = 'block';
        loginMessage.textContent = '❌ Incorrect password. Please try again.';
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminPassword').focus();
    }
});

document.getElementById('adminPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loginForm.dispatchEvent(new Event('submit'));
    }
});

// ============================================
// STATS
// ============================================

async function loadStats() {
    try {
        const { count: total, error: totalError } = await supabaseClient
            .from('bookings')
            .select('*', { count: 'exact', head: true });
        
        if (totalError) throw totalError;
        document.getElementById('totalBookings').textContent = total || 0;
        
        const today = getMalaysiaToday();
        const { count: todayCount, error: todayError } = await supabaseClient
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('booking_date', today);
        
        if (todayError) throw todayError;
        document.getElementById('todayBookings').textContent = todayCount || 0;
        
        const { count: upcoming, error: upcomingError } = await supabaseClient
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .gt('booking_date', today) 
            .eq('status', 'confirmed');
        
        if (upcomingError) throw upcomingError;
        document.getElementById('upcomingBookings').textContent = upcoming || 0;
        
        const { count: bCount, error: bError } = await supabaseClient
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('class', 'B')
            .eq('status', 'confirmed');
        
        if (bError) throw bError;
        document.getElementById('classBBookings').textContent = bCount || 0;
        
        const { count: b2Count, error: b2Error } = await supabaseClient
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('class', 'B2')
            .eq('status', 'confirmed');
        
        if (b2Error) throw b2Error;
        document.getElementById('classB2Bookings').textContent = b2Count || 0;
        
        const { count: cancelled, error: cancelledError } = await supabaseClient
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'cancelled');
        
        if (cancelledError) throw cancelledError;
        document.getElementById('cancelledBookings').textContent = cancelled || 0;
        
    } catch (error) {
        console.error('Error loading stats:', error);
        showMessage('Error loading stats: ' + error.message, 'error');
    }
}

// ============================================
// ALL BOOKINGS TABLE
// ============================================

function renderBookingsTable(bookings, isLoading = false) {
    const tbody = document.getElementById('bookingsTableBody');
    if (!tbody) return;
    
    if (isLoading) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center p-8 text-muted-foreground"><i data-lucide="refresh-cw" class="w-5 h-5 animate-spin mx-auto mb-2"></i>Loading bookings data...</td></tr>`;
        if (window.lucide) lucide.createIcons();
        return;
    }
    
    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center p-12 text-muted-foreground font-medium">No bookings match the selected filtration query.</td></tr>`;
        return;
    }
    
    let html = '';
    bookings.forEach(booking => {
        let customColors = 'bg-slate-100 text-slate-800 border-slate-200';
        
        if (booking.status === 'confirmed') {
            customColors = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        } else if (booking.status === 'cancelled') {
            customColors = 'bg-red-50 text-red-700 border-red-200';
        } else if (booking.status === 'rescheduled') {
            customColors = 'bg-amber-50 text-amber-700 border-amber-200';
        }
        
        html += `
            <tr class="hover:bg-muted/40 transition-colors border-b border-border">
                <td class="p-3.5 font-mono text-xs text-foreground font-bold">${booking.session_id || ''}</td>
                <td class="p-3.5 text-muted-foreground">${booking.icno || ''}</td>
                <td class="p-3.5 font-medium text-foreground">${booking.name || ''}</td>
                <td class="p-3.5 text-muted-foreground">${booking.contact_no || ''}</td>
                <td class="p-3.5 text-center"><span class="inline-block px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs font-bold">${booking.class || ''}</span></td>
                <td class="p-3.5 text-foreground">${formatMalaysiaDate(booking.booking_date)}</td>
                <td class="p-3.5 text-muted-foreground">${booking.session_time || ''}</td>
                <td class="p-3.5 text-muted-foreground font-medium">${booking.session_slot || ''}</td>
                <td class="p-3.5 text-muted-foreground font-medium">${booking.lesson || ''}</td>
                <td class="p-3.5">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${customColors}">
                        ${booking.status.toUpperCase()}
                    </span>
                </td>
                <td class="p-3.5 text-xs text-muted-foreground">${formatDateTime(booking.created_at)}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

async function loadAllBookings() {
    renderBookingsTable([], true);
    
    try {
        const dateFrom = document.getElementById('filterDateFrom').value;
        const dateTo = document.getElementById('filterDateTo').value;
        const status = document.getElementById('filterStatus').value;
        const classType = document.getElementById('filterClass').value;
        
        let query = supabaseClient
            .from('bookings')
            .select('*', { count: 'exact' });
            
        if (dateFrom) {
            query = query.gte('booking_date', dateFrom);
        }
        if (dateTo) {
            query = query.lte('booking_date', dateTo);
        }
        if (status && status !== 'all') {
            query = query.eq('status', status);
        }
        if (classType && classType !== 'all') {
            query = query.eq('class', classType);
        }
        
        const fromRow = (currentPage - 1) * rowsPerPage;
        const toRow = fromRow + rowsPerPage - 1;
        
        query = query
            .order('booking_date', { ascending: false })
            .order('session_time', { ascending: true })
            .range(fromRow, toRow);
            
        const { data, error, count } = await query;
        
        if (error) throw error;
        
        allBookingsData = data || [];
        totalDBCount = count || 0;
        
        document.getElementById('resultCount').textContent = `${totalDBCount} bookings found`;
        
        renderBookingsTable(allBookingsData);
        updatePaginationServerSide();
        
    } catch (error) {
        console.error('Error loading server bookings:', error);
        showMessage('Failed to load bookings from database.', 'error');
        renderBookingsTable([]);
    }
}

function updatePaginationServerSide() {
    totalPages = Math.ceil(totalDBCount / rowsPerPage) || 1;
    
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    
    const paginationDiv = document.getElementById('paginationControls');
    if (!paginationDiv) return;
    
    paginationDiv.classList.remove('hidden');
    
    const startItem = totalDBCount === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const endItem = Math.min(currentPage * rowsPerPage, totalDBCount);
    
    document.getElementById('paginationInfo').textContent = 
        `Showing ${startItem} - ${endItem} of ${totalDBCount}`;
    
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage === totalPages;
    
    const pageNumbers = document.getElementById('pageNumbers');
    pageNumbers.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        pageNumbers.appendChild(createServerPageBtn(1));
        if (startPage > 2) {
            const span = document.createElement('span');
            span.textContent = '...';
            span.style.margin = '0 5px';
            pageNumbers.appendChild(span);
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const btn = createServerPageBtn(i);
        if (i === currentPage) {
            btn.classList.add('active');
            btn.style.background = '#3498db';
            btn.style.color = 'white';
        }
        pageNumbers.appendChild(btn);
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const span = document.createElement('span');
            span.textContent = '...';
            span.style.margin = '0 5px';
            pageNumbers.appendChild(span);
        }
        pageNumbers.appendChild(createServerPageBtn(totalPages));
    }
}

function createServerPageBtn(pageNum) {
    const btn = document.createElement('button');
    btn.className = 'page-btn';
    btn.textContent = pageNum;
    btn.onclick = () => goToPageServer(pageNum);
    return btn;
}

async function goToPageServer(pageNum) {
    if (pageNum < 1 || pageNum > totalPages) return;
    currentPage = pageNum;
    await loadAllBookings();
    
    const container = document.getElementById('bookingsTableContainer');
    if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

async function prevPage() {
    if (currentPage > 1) {
        await goToPageServer(currentPage - 1);
    }
}

async function nextPage() {
    if (currentPage < totalPages) {
        await goToPageServer(currentPage + 1);
    }
}

async function changeRowsPerPage() {
    rowsPerPage = parseInt(document.getElementById('rowsPerPageSelect').value) || 10;
    currentPage = 1;
    await loadAllBookings();
}

function clearDateFilters() {
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';
    document.getElementById('filterStatus').value = 'all';
    document.getElementById('filterClass').value = 'all';
    currentPage = 1;
    loadAllBookings();
}

function setDateRange(range) {
    const today = getMalaysiaToday();
    const dateFrom = document.getElementById('filterDateFrom');
    const dateTo = document.getElementById('filterDateTo');
    
    dateTo.value = today;
    
    switch(range) {
        case 'today':
            dateFrom.value = today;
            break;
        case 'week':
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            dateFrom.value = toMalaysiaDateStr(weekAgo);
            break;
        case 'month':
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            dateFrom.value = toMalaysiaDateStr(monthAgo);
            break;
        case 'all':
            dateFrom.value = '';
            dateTo.value = '';
            break;
    }
    currentPage = 1;
    loadAllBookings();
}

// ============================================
// PDF REPORT GENERATION - SEPARATE INCREMENT NUMBERS
// ============================================

function buildReportHTML(data) {
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const d = new Date(dateString + 'T00:00:00');
        return d.toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    
    function formatDateTimeLocal(dateString) {
        if (!dateString) return 'N/A';
        const d = new Date(dateString);
        return d.toLocaleDateString('en-MY', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    const bookings = data.bookings;
    const dateFrom = data.dateFrom;
    const dateTo = data.dateTo;
    const classLabel = data.classLabel;
    const statusLabel = data.statusLabel;
    const filename = `booking_report_${dateFrom}_to_${dateTo}`;
    
    // Separate bookings by class
    const classBBookings = bookings.filter(b => b.class === 'B');
    const classB2Bookings = bookings.filter(b => b.class === 'B2');
    
    // Function to render table rows for a class - each starts from 1
    function renderTableRows(bookingsList) {
        let html = '';
        bookingsList.forEach((b, index) => {
            const num = index + 1; // Starts from 1 for each class
            // Get lesson display name (extract the lesson part)
            let lessonDisplay = b.lesson || '';
            // Remove class prefix if present (e.g., "KPP02 - 1st KPP02" -> "1st KPP02")
            if (lessonDisplay.includes(' - ')) {
                lessonDisplay = lessonDisplay.split(' - ')[1] || lessonDisplay;
            }
            
            html += `
                <tr>
                    <td style="text-align:center;padding:6px;border:1px solid #ddd;">${num}</td>
                    <td style="padding:6px;border:1px solid #ddd;">${b.name || ''}</td>
                    <td style="padding:6px;border:1px solid #ddd;">${b.icno || ''}</td>
                    <td style="padding:6px;border:1px solid #ddd;">${b.remark || ''}</td>
                    <td style="text-align:center;padding:6px;border:1px solid #ddd;">${b.class || ''}</td>
                    <td style="padding:6px;border:1px solid #ddd;">${lessonDisplay}</td>
                    <td style="padding:6px;border:1px solid #ddd;">${b.plate_no || ''}</td>
                    <td style="padding:6px;border:1px solid #ddd;">${b.sign_in || ''}</td>
                    <td style="padding:6px;border:1px solid #ddd;">${b.sign_out || ''}</td>
                </tr>
            `;
        });
        return html;
    }
    
    // Count totals
    const totalB = classBBookings.length;
    const totalB2 = classB2Bookings.length;
    const totalAll = bookings.length;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Booking Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: Arial, sans-serif;
            background: #ffffff;
            color: #000000;
            padding: 40px;
            font-size: 12px;
            line-height: 1.5;
        }
        .report-container { max-width: 100%; margin: 0 auto; }
        .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 20px;
        }
        .header h1 { margin: 0; color: #2c3e50; font-size: 24px; }
        .header p { margin: 5px 0; color: #7f8c8d; font-size: 14px; }
        .section-title {
            color: #2c3e50;
            border-bottom: 2px solid #333;
            padding-bottom: 8px;
            font-size: 16px;
            margin: 25px 0 15px 0;
        }
        .section-title:first-of-type { margin-top: 0; }
        .class-badge {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 12px;
        }
        .class-badge-b { background: #dbeafe; color: #1e40af; }
        .class-badge-b2 { background: #fce7f3; color: #9d174d; }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
        }
        thead th {
            background: #34495e;
            color: #fff;
            padding: 8px;
            text-align: left;
            border: 1px solid #34495e;
        }
        thead th.center { text-align: center; }
        tbody td {
            padding: 6px;
            border: 1px solid #ddd;
        }
        tbody tr:nth-child(even) { background: #f8f9fa; }
        tbody tr:nth-child(odd) { background: #ffffff; }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 11px;
            color: #95a5a6;
            text-align: center;
        }
        .loading {
            text-align: center;
            padding: 40px;
            font-size: 16px;
            color: #666;
        }
        .spinner {
            display: inline-block;
            width: 30px;
            height: 30px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .subtotal {
            font-weight: bold;
            padding: 4px 8px;
            background: #f1f5f9;
            border-radius: 4px;
        }
        .total-row {
            font-weight: bold;
            background: #f8fafc;
        }
        .total-row td {
            padding: 8px 10px;
            border: 1px solid #ccc;
        }
    </style>
</head>
<body>
    <div id="loading" class="loading">
        <div class="spinner"></div>
        <p style="margin-top: 15px;">Generating PDF report...</p>
    </div>
    
    <div id="reportContent" class="report-container" style="display:none;">
        <div class="header">
            <h1>🏍️ Motorcycle Booking Report</h1>
            <p>Period: ${formatDate(dateFrom)} to ${formatDate(dateTo)}</p>
            <p>Status: ${statusLabel}</p>
            <p>Generated: ${formatDateTimeLocal(new Date().toISOString())}</p>
        </div>
        
        <!-- CLASS B TABLE -->
        <h3 class="section-title">
            <span class="class-badge class-badge-b">CLASS B</span>
            <span style="margin-left:15px;font-weight:normal;font-size:13px;color:#666;">Total: ${totalB} participants</span>
        </h3>
        ${totalB > 0 ? `
        <table>
            <thead>
                <tr>
                    <th class="center" style="width:40px;">NO</th>
                    <th style="min-width:120px;">NAME</th>
                    <th style="min-width:100px;">IC/PASSPORT</th>
                    <th style="min-width:80px;">REMARK</th>
                    <th class="center" style="width:50px;">CLASS</th>
                    <th style="min-width:80px;">LESSON</th>
                    <th style="min-width:80px;">PLATE NO</th>
                    <th style="min-width:70px;">SIGN IN</th>
                    <th style="min-width:70px;">SIGN OUT</th>
                </tr>
            </thead>
            <tbody>
                ${renderTableRows(classBBookings)}
            </tbody>
        </table>
        ` : '<p style="color:#999;font-style:italic;padding:10px 0;">No Class B bookings found for this period.</p>'}
        
        <!-- CLASS B2 TABLE -->
        <h3 class="section-title" style="margin-top:30px;">
            <span class="class-badge class-badge-b2">CLASS B2</span>
            <span style="margin-left:15px;font-weight:normal;font-size:13px;color:#666;">Total: ${totalB2} participants</span>
        </h3>
        ${totalB2 > 0 ? `
        <table>
            <thead>
                <tr>
                    <th class="center" style="width:40px;">NO</th>
                    <th style="min-width:120px;">NAME</th>
                    <th style="min-width:100px;">IC/PASSPORT</th>
                    <th style="min-width:80px;">REMARK</th>
                    <th class="center" style="width:50px;">CLASS</th>
                    <th style="min-width:80px;">LESSON</th>
                    <th style="min-width:80px;">PLATE NO</th>
                    <th style="min-width:70px;">SIGN IN</th>
                    <th style="min-width:70px;">SIGN OUT</th>
                </tr>
            </thead>
            <tbody>
                ${renderTableRows(classB2Bookings)}
            </tbody>
        </table>
        ` : '<p style="color:#999;font-style:italic;padding:10px 0;">No Class B2 bookings found for this period.</p>'}
        
        <!-- Grand Total -->
        <div style="margin-top:20px;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;text-align:right;">
            <span style="font-weight:bold;font-size:14px;">Grand Total: ${totalAll} participants</span>
            <span style="margin-left:20px;color:#666;font-size:12px;">
                (B: ${totalB} | B2: ${totalB2})
            </span>
        </div>
        
        <div class="footer">
            <p>This report is auto-generated by the Motorcycle Booking System.</p>
            <p>© ${new Date().getFullYear()} - All rights reserved.</p>
        </div>
    </div>
    
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
    <script>
        (function() {
            setTimeout(function() {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('reportContent').style.display = 'block';
                
                const element = document.getElementById('reportContent');
                const opt = {
                    margin: [10, 10, 10, 10],
                    filename: '${filename}.pdf',
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { 
                        scale: 2, 
                        useCORS: true, 
                        logging: false,
                        backgroundColor: '#ffffff',
                        allowTaint: true
                    },
                    jsPDF: { 
                        unit: 'mm', 
                        format: 'a4', 
                        orientation: 'landscape' 
                    }
                };
                
                html2pdf().set(opt).from(element).save().then(function() {
                    setTimeout(function() {
                        window.close();
                    }, 1000);
                }).catch(function(err) {
                    console.error('PDF generation error:', err);
                    document.body.innerHTML += 
                        '<p style="color:red;margin-top:20px;text-align:center;font-size:14px;">' +
                        '❌ Error generating PDF. Please use Print (Ctrl+P) to save as PDF.' +
                        '</p>' +
                        '<p style="text-align:center;margin-top:10px;">' +
                        '<button onclick="window.print()" style="padding:10px 20px;font-size:14px;cursor:pointer;">Print / Save as PDF</button>' +
                        '</p>';
                });
            }, 500);
        })();
    <\/script>
</body>
</html>`;
}

async function generatePDF(data, dateFrom, dateTo, classFilter, statusFilter) {
    const classLabel = classFilter === 'all' ? 'All Classes' : 'Class ' + classFilter;
    const statusLabel = statusFilter === 'all' ? 'All Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);
    
    const reportData = {
        bookings: data,
        dateFrom: dateFrom,
        dateTo: dateTo,
        classLabel: classLabel,
        statusLabel: statusLabel
    };
    
    const htmlContent = buildReportHTML(reportData);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const newTab = window.open(url, '_blank');
    
    if (!newTab) {
        throw new Error('Popup blocked. Please allow popups for this site.');
    }
    
    setTimeout(() => {
        try {
            URL.revokeObjectURL(url);
        } catch(e) {}
    }, 10000);
}

async function generatePDFReport() {
    const dateFrom = document.getElementById('reportDateFrom').value;
    const dateTo = document.getElementById('reportDateTo').value;
    const classFilter = document.getElementById('reportClass').value;
    const statusFilter = document.getElementById('reportStatus').value;
    
    if (!dateFrom || !dateTo) {
        showMessage('Please select both From and To dates.', 'error');
        return;
    }
    
    if (dateFrom > dateTo) {
        showMessage('"From" date must be before "To" date.', 'error');
        return;
    }
    
    const progressDiv = document.getElementById('reportProgress');
    if (progressDiv) progressDiv.style.display = 'block';
    
    try {
        let query = supabaseClient
            .from('bookings')
            .select('*')
            .gte('booking_date', dateFrom)
            .lte('booking_date', dateTo)
            .order('booking_date', { ascending: true })
            .order('session_time', { ascending: true });
        
        if (classFilter !== 'all') {
            query = query.eq('class', classFilter);
        }
        if (statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            showMessage('No bookings found for the selected criteria.', 'error');
            if (progressDiv) progressDiv.style.display = 'none';
            return;
        }
        
        await generatePDF(data, dateFrom, dateTo, classFilter, statusFilter);
        
        if (progressDiv) progressDiv.style.display = 'none';
        showMessage('PDF report generated successfully!', 'success');
        
    } catch (error) {
        console.error('Error generating report:', error);
        showMessage('Error generating report: ' + error.message, 'error');
        if (progressDiv) progressDiv.style.display = 'none';
    }
}

async function generateDailyReport() {
    const today = getMalaysiaToday();
    document.getElementById('reportDateFrom').value = today;
    document.getElementById('reportDateTo').value = today;
    await generatePDFReport();
}

// ============================================
// DATE MANAGEMENT
// ============================================

async function toggleDateStatus() {
    const date = document.getElementById('adminDateSelect').value;
    const reason = document.getElementById('closureReason').value.trim();
    const messageDiv = document.getElementById('dateStatusMessage');
    const statusDisplay = document.getElementById('currentDateStatus');
    
    if (!date) {
        showNotification('Please select a date first.', 'error', messageDiv);
        return;
    }
    
    showNotification('⏳ Processing...', 'info', messageDiv);
    
    try {
        const { data: existing, error: checkError } = await supabaseClient
            .from('date_status')
            .select('is_active, reason')
            .eq('target_date', date)
            .maybeSingle();
        
        if (checkError && checkError.code !== 'PGRST116') throw checkError;
        
        const currentStatus = existing ? existing.is_active : true;
        const newStatus = !currentStatus;
        const statusText = newStatus ? '🟢 ACTIVE' : '🔴 INACTIVE';
        const statusColor = newStatus ? 'text-green-700' : 'text-red-700';
        const bgColor = newStatus ? 'bg-green-50' : 'bg-red-50';
        const borderColor = newStatus ? 'border-green-300' : 'border-red-300';
        
        if (existing) {
            const { error: updateError } = await supabaseClient
                .from('date_status')
                .update({
                    is_active: newStatus,
                    reason: reason || null,
                    updated_at: new Date().toISOString()
                })
                .eq('target_date', date);
            
            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabaseClient
                .from('date_status')
                .insert([{
                    target_date: date,
                    is_active: newStatus,
                    reason: reason || null
                }]);
            
            if (insertError) throw insertError;
        }
        
        const icon = newStatus ? '✅' : '❌';
        const actionText = newStatus ? 'enabled' : 'disabled';
        const reasonText = reason ? ` (Reason: ${reason})` : '';
        
        showNotification(
            `${icon} Date ${date} is now ${actionText.toUpperCase()}${reasonText}`,
            'success',
            messageDiv
        );
        
        statusDisplay.innerHTML = `
            <div class="flex items-center gap-3 p-3 rounded-lg border ${borderColor} ${bgColor}">
                <span class="font-semibold ${statusColor}">${statusText}</span>
                <span class="text-gray-600 text-sm">Date: ${formatMalaysiaDate(date)}</span>
                ${reason ? `<span class="text-gray-500 text-sm">Reason: ${reason}</span>` : ''}
                <span class="text-xs text-gray-400 ml-auto">
                    ${newStatus ? 'Bookings allowed' : 'Bookings closed'}
                </span>
            </div>
        `;
        
        await loadAdminCalendarData();
        await loadStats();
        
        document.getElementById('closureReason').value = '';
        
        setTimeout(() => {
            if (!messageDiv.classList.contains('hidden')) {
                messageDiv.classList.add('hidden');
            }
        }, 5000);
        
    } catch (error) {
        console.error('Error toggling date status:', error);
        showNotification('❌ Error: ' + error.message, 'error', messageDiv);
    }
}

// ============================================
// NOTIFICATION HELPER
// ============================================

function showNotification(message, type = 'info', messageDiv) {
    if (!messageDiv) {
        messageDiv = document.getElementById('dateStatusMessage');
    }
    
    messageDiv.classList.remove('hidden');
    messageDiv.className = 'mt-3 p-3 rounded-lg border';
    
    messageDiv.classList.remove(
        'bg-green-50', 'border-green-300', 'text-green-700',
        'bg-red-50', 'border-red-300', 'text-red-700',
        'bg-blue-50', 'border-blue-300', 'text-blue-700',
        'bg-yellow-50', 'border-yellow-300', 'text-yellow-700'
    );
    
    switch(type) {
        case 'success':
            messageDiv.classList.add('bg-green-50', 'border-green-300', 'text-green-700');
            break;
        case 'error':
            messageDiv.classList.add('bg-red-50', 'border-red-300', 'text-red-700');
            break;
        case 'warning':
            messageDiv.classList.add('bg-yellow-50', 'border-yellow-300', 'text-yellow-700');
            break;
        default:
            messageDiv.classList.add('bg-blue-50', 'border-blue-300', 'text-blue-700');
            break;
    }
    
    messageDiv.innerHTML = `
        <div class="flex items-start gap-2">
            <span class="text-sm">${message}</span>
            <button onclick="this.parentElement.parentElement.classList.add('hidden')" 
                    class="ml-auto text-gray-400 hover:text-gray-600" 
                    style="background:none;border:none;cursor:pointer;font-size:16px;">
                ✕
            </button>
        </div>
    `;
}

// ============================================
// LOAD CURRENT DATE STATUS ON DATE SELECT
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    const dateSelect = document.getElementById('adminDateSelect');
    if (dateSelect) {
        dateSelect.addEventListener('change', function() {
            loadDateStatus(this.value);
        });
        
        if (dateSelect.value) {
            loadDateStatus(dateSelect.value);
        }
    }
});

async function loadDateStatus(date) {
    if (!date) return;
    
    const statusDisplay = document.getElementById('currentDateStatus');
    
    try {
        const { data: status, error } = await supabaseClient
            .from('date_status')
            .select('is_active, reason')
            .eq('target_date', date)
            .maybeSingle();
        
        if (error) throw error;
        
        if (status) {
            const isActive = status.is_active;
            const statusText = isActive ? '🟢 ACTIVE' : '🔴 INACTIVE';
            const statusColor = isActive ? 'text-green-700' : 'text-red-700';
            const bgColor = isActive ? 'bg-green-50' : 'bg-red-50';
            const borderColor = isActive ? 'border-green-300' : 'border-red-300';
            
            statusDisplay.innerHTML = `
                <div class="flex items-center gap-3 p-3 rounded-lg border ${borderColor} ${bgColor}">
                    <span class="font-semibold ${statusColor}">${statusText}</span>
                    <span class="text-gray-600 text-sm">${formatMalaysiaDate(date)}</span>
                    ${status.reason ? `<span class="text-gray-500 text-sm">Reason: ${status.reason}</span>` : ''}
                    <span class="text-xs text-gray-400 ml-auto">
                        ${isActive ? '✅ Bookings allowed' : '❌ Bookings closed'}
                    </span>
                </div>
            `;
        } else {
            statusDisplay.innerHTML = `
                <div class="flex items-center gap-3 p-3 rounded-lg border border-green-300 bg-green-50">
                    <span class="font-semibold text-green-700">🟢 ACTIVE (Default)</span>
                    <span class="text-gray-600 text-sm">${formatMalaysiaDate(date)}</span>
                    <span class="text-xs text-gray-400 ml-auto">✅ Bookings allowed</span>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading date status:', error);
        statusDisplay.innerHTML = `
            <div class="flex items-center gap-3 p-3 rounded-lg border border-yellow-300 bg-yellow-50">
                <span class="font-semibold text-yellow-700">⚠️ Unknown</span>
                <span class="text-gray-600 text-sm">${formatMalaysiaDate(date)}</span>
                <span class="text-xs text-gray-400 ml-auto">Status could not be loaded</span>
            </div>
        `;
    }
}

// ============================================
// REFRESH SCHEDULE
// ============================================

async function refreshSchedule() {
    try {
        showMessage('Refreshing schedule...', 'info');
        
        const { data, error } = await supabaseClient
            .rpc('maintain_rolling_schedule');
        
        if (error) throw error;
        
        showMessage('✅ Schedule refreshed successfully! 60 days available.', 'success');
        loadAdminCalendarData();
        loadStats();
        
    } catch (error) {
        console.error('Error refreshing schedule:', error);
        showMessage('Error refreshing schedule: ' + error.message, 'error');
    }
}

// ============================================
// ADMIN CALENDAR
// ============================================

function renderAdminCalendar() {
    const calendar = document.getElementById('adminCalendar');
    const monthDisplay = document.getElementById('adminMonthDisplay');
    
    if (!calendar) return;
    
    const firstDay = new Date(adminYear, adminMonth, 1).getDay();
    const daysInMonth = new Date(adminYear, adminMonth + 1, 0).getDate();
    
    monthDisplay.textContent = new Date(adminYear, adminMonth).toLocaleDateString('en-MY', { 
        month: 'long', 
        year: 'numeric' 
    });
    
    calendar.innerHTML = '';
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        const div = document.createElement('div');
        div.textContent = day;
        div.className = 'admin-cal-head';
        calendar.appendChild(div);
    });
    
    for (let i = 0; i < firstDay; i++) {
        const div = document.createElement('div');
        div.style.padding = '5px';
        calendar.appendChild(div);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(adminYear, adminMonth, day);
        const dateStr = toMalaysiaDateStr(dateObj);
        const div = document.createElement('div');
        div.textContent = day;
        div.className = 'admin-cal-cell';
        div.dataset.date = dateStr;
        div.style.backgroundColor = '#f5f5f5';
        div.style.color = '#999';
        div.dataset.sessions = '[]';
        div.dataset.status = 'null';
        div.addEventListener('click', () => onAdminDateClick(dateStr));
        calendar.appendChild(div);
    }
}

async function loadAdminCalendarData() {
    const today = getMalaysiaToday();
    const startDate = new Date(adminYear, adminMonth, 1);
    const endDate = new Date(adminYear, adminMonth + 1, 0);
    const startDateStr = toMalaysiaDateStr(startDate);
    const endDateStr = toMalaysiaDateStr(endDate);
    
    try {
        const { data: sessions, error: sessionsError } = await supabaseClient
            .from('available_sessions')
            .select('*')
            .gte('session_date', startDateStr)
            .lte('session_date', endDateStr);
        
        if (sessionsError) throw sessionsError;
        
        const { data: statuses, error: statusError } = await supabaseClient
            .from('date_status')
            .select('*')
            .gte('target_date', startDateStr)
            .lte('target_date', endDateStr);
        
        if (statusError) throw statusError;
        
        const sessionMap = {};
        sessions.forEach(s => {
            if (!sessionMap[s.session_date]) {
                sessionMap[s.session_date] = [];
            }
            sessionMap[s.session_date].push(s);
        });
        
        const statusMap = {};
        statuses.forEach(s => {
            statusMap[s.target_date] = s;
        });
        
        const cells = document.querySelectorAll('#adminCalendar div[data-date]');
        cells.forEach(cell => {
            const dateStr = cell.dataset.date;
            const sessions = sessionMap[dateStr] || [];
            const status = statusMap[dateStr];
            const isToday = dateStr === today;
            const hasAvailable = sessions.some(s => s.current_bookings < s.max_bookings);
            const isActive = status ? status.is_active : true;
            
            let bgColor = '#95a5a6';
            let textColor = 'white';
            let cursor = 'default';
            
            if (dateStr < today) {
                bgColor = '#f5f5f5';
                textColor = '#999';
                cursor = 'not-allowed';
            } else if (isToday) {
                bgColor = '#f39c12';
                textColor = 'white';
                cursor = 'pointer';
                cell.textContent = new Date(dateStr).getDate() + ' 📍';
            } else if (!isActive) {
                bgColor = '#95a5a6';
                textColor = 'white';
                cursor = 'pointer';
            } else if (hasAvailable) {
                bgColor = '#2ecc71';
                textColor = 'white';
                cursor = 'pointer';
            } else if (sessions.length > 0) {
                bgColor = '#e74c3c';
                textColor = 'white';
                cursor = 'pointer';
            } else {
                bgColor = '#f5f5f5';
                textColor = '#999';
                cursor = 'default';
            }
            
            cell.dataset.sessions = JSON.stringify(sessions);
            cell.dataset.status = JSON.stringify(status);
            cell.style.backgroundColor = bgColor;
            cell.style.color = textColor;
            cell.style.cursor = cursor;
            
            const existingDot = cell.querySelector('.availability-dot');
            if (existingDot) existingDot.remove();
            
            if (hasAvailable && dateStr >= today) {
                const dot = document.createElement('span');
                dot.className = 'availability-dot';
                dot.style.cssText = 'position:absolute;bottom:4px;right:6px;width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.7);';
                cell.appendChild(dot);
            }
        });
        
    } catch (error) {
        console.error('Error loading calendar data:', error);
        showMessage('Error loading calendar data: ' + error.message, 'error');
    }
}

function changeAdminMonth(delta) {
    adminMonth += delta;
    if (adminMonth > 11) {
        adminMonth = 0;
        adminYear++;
    } else if (adminMonth < 0) {
        adminMonth = 11;
        adminYear--;
    }
    selectedAdminDate = null;
    
    const details = document.getElementById('adminDateDetails');
    const prompt = document.getElementById('calendarFallbackPrompt');
    if (details) details.classList.add('hidden');
    if (prompt) prompt.classList.remove('hidden');
    
    renderAdminCalendar();
    setTimeout(() => {
        loadAdminCalendarData();
    }, 50);
}

function goToAdminToday() {
    const today = getMalaysiaToday();
    const date = new Date(today + 'T00:00:00');
    adminMonth = date.getMonth();
    adminYear = date.getFullYear();
    selectedAdminDate = null;
    
    const details = document.getElementById('adminDateDetails');
    const prompt = document.getElementById('calendarFallbackPrompt');
    if (details) details.classList.add('hidden');
    if (prompt) prompt.classList.remove('hidden');
    
    renderAdminCalendar();
    setTimeout(() => {
        loadAdminCalendarData();
    }, 50);
}

async function onAdminDateClick(dateStr) {
    const today = getMalaysiaToday();
    
    if (dateStr < today) {
        showMessage('Cannot select past dates.', 'error');
        return;
    }
    
    selectedAdminDate = dateStr;
    document.getElementById('adminSelectedDate').textContent = `📅 ${formatMalaysiaDate(dateStr)}`;
    
    try {
        const { data: sessionData, error: sessionError } = await supabaseClient
            .from('available_sessions')
            .select('*')
            .eq('session_date', dateStr);
        
        if (sessionError) throw sessionError;
        
        const { data: statusData, error: statusError } = await supabaseClient
            .from('date_status')
            .select('*')
            .eq('target_date', dateStr)
            .single();
        
        if (statusError && statusError.code !== 'PGRST116') throw statusError;
        
        const detailsDiv = document.getElementById('adminDateSessions');
        const detailsContainer = document.getElementById('adminDateDetails');
        const fallbackPrompt = document.getElementById('calendarFallbackPrompt');
        
        const classBData = sessionData ? sessionData.filter(s => s.class === 'B') : [];
        const classB2Data = sessionData ? sessionData.filter(s => s.class === 'B2') : [];
        
        let html = `
            <div class="p-3 bg-muted rounded-lg border text-sm mb-4">
                <p class="font-medium"><strong>Status:</strong> ${statusData ? (statusData.is_active ? '🟢 Active' : '🔴 Inactive') : '🟢 Active (default)'}</p>
                ${statusData && statusData.reason ? `<p class="mt-1 text-xs text-muted-foreground"><strong>Reason:</strong> ${statusData.reason}</p>` : ''}
                ${statusData && !statusData.is_active ? `<p class="mt-1 text-xs text-destructive font-semibold">⚠️ This date is closed for bookings.</p>` : ''}
            </div>
        `;
        
        html += `
            <div class="space-y-2">
                <h4 class="font-bold text-sm text-foreground border-b pb-1 flex justify-between">
                    <span>🏍️ Class B</span> <span class="text-xs text-muted-foreground font-normal">Quota: 5</span>
                </h4>
                ${classBData.length > 0 ? `
                    <div class="border rounded-lg overflow-hidden bg-card text-xs">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-muted text-muted-foreground font-semibold border-b">
                                    <th class="p-2">Time</th>
                                    <th class="p-2">Slot</th>
                                    <th class="p-2">Booked</th>
                                    <th class="p-2">Available</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y">
                                ${classBData.map(s => `
                                    <tr>
                                        <td class="p-2 font-semibold">${s.session_time || 'N/A'}</td>
                                        <td class="p-2 text-muted-foreground">${s.session_slot || 'N/A'}</td>
                                        <td class="p-2">${s.current_bookings || 0}/${s.max_bookings || 5}</td>
                                        <td class="p-2 font-bold ${s.current_bookings < s.max_bookings ? 'text-emerald-600' : 'text-destructive'}">
                                            ${s.current_bookings < s.max_bookings ? '✅ ' + (s.max_bookings - s.current_bookings) : '❌ Full'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<p class="text-xs text-muted-foreground italic p-2">No Class B sessions available.</p>'}
            </div>
        `;
        
        html += `
            <div class="space-y-2 mt-4">
                <h4 class="font-bold text-sm text-foreground border-b pb-1 flex justify-between">
                    <span>🏍️ Class B2</span> <span class="text-xs text-muted-foreground font-normal">Quota: 15</span>
                </h4>
                ${classB2Data.length > 0 ? `
                    <div class="border rounded-lg overflow-hidden bg-card text-xs">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-muted text-muted-foreground font-semibold border-b">
                                    <th class="p-2">Time</th>
                                    <th class="p-2">Slot</th>
                                    <th class="p-2">Booked</th>
                                    <th class="p-2">Available</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y">
                                ${classB2Data.map(s => `
                                    <tr>
                                        <td class="p-2 font-semibold">${s.session_time || 'N/A'}</td>
                                        <td class="p-2 text-muted-foreground">${s.session_slot || 'N/A'}</td>
                                        <td class="p-2">${s.current_bookings || 0}/${s.max_bookings || 15}</td>
                                        <td class="p-2 font-bold ${s.current_bookings < s.max_bookings ? 'text-emerald-600' : 'text-destructive'}">
                                            ${s.current_bookings < s.max_bookings ? '✅ ' + (s.max_bookings - s.current_bookings) : '❌ Full'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<p class="text-xs text-muted-foreground italic p-2">No Class B2 sessions available.</p>'}
            </div>
        `;
        
        const totalB = classBData.reduce((sum, s) => sum + (s.max_bookings - s.current_bookings), 0);
        const totalB2 = classB2Data.reduce((sum, s) => sum + (s.max_bookings - s.current_bookings), 0);
        const totalAvailable = totalB + totalB2;
        
        html += `
            <div class="mt-4 p-3 bg-card border rounded-lg text-xs font-medium space-y-1">
                <p class="text-muted-foreground">Class B Available: <span class="${totalB > 0 ? 'text-emerald-600 font-bold' : 'text-muted-foreground'}">${totalB > 0 ? totalB : '0'} slots</span></p>
                <p class="text-muted-foreground">Class B2 Available: <span class="${totalB2 > 0 ? 'text-emerald-600 font-bold' : 'text-muted-foreground'}">${totalB2 > 0 ? totalB2 : '0'} slots</span></p>
                <p class="border-t pt-1 font-bold text-foreground flex justify-between text-sm"><span>Total Remaining:</span> <span>${totalAvailable} slots</span></p>
            </div>
        `;
        
        detailsDiv.innerHTML = html;
        
        if (fallbackPrompt) fallbackPrompt.classList.add('hidden');
        if (detailsContainer) {
            detailsContainer.style.display = 'block';
            detailsContainer.classList.remove('hidden');
        }
        
        document.getElementById('adminDateSelect').value = dateStr;
        
    } catch (error) {
        console.error('Error loading date details:', error);
        showMessage('Error loading date details: ' + error.message, 'error');
    }
}

// ============================================
// TABS
// ============================================

function showTab(tabId) {
    const tabs = ['bookings', 'calendar', 'report'];
    
    tabs.forEach(t => {
        const contentDiv = document.getElementById(`tabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const tabBtn = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
        
        if (contentDiv && tabBtn) {
            if (t === tabId) {
                contentDiv.classList.remove('hidden');
                tabBtn.setAttribute('data-variant', 'secondary');
                tabBtn.classList.remove('text-muted-foreground');
            } else {
                contentDiv.classList.add('hidden');
                tabBtn.setAttribute('data-variant', 'ghost');
                tabBtn.classList.add('text-muted-foreground');
            }
        }
    });

    if (tabId === 'calendar') {
        renderAdminCalendar();
        setTimeout(() => {
            loadAdminCalendarData();
        }, 50);
    }
}

// ============================================
// ADMIN INITIALIZATION
// ============================================

async function initializeAdmin() {
    const today = getMalaysiaToday();
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    const firstDayStr = toMalaysiaDateStr(firstDayOfMonth);
    document.getElementById('logoutBtn').style.display = 'inline-block';
    document.getElementById('reportDateFrom').value = firstDayStr;
    document.getElementById('reportDateTo').value = today;
    
    await loadStats();
    await loadAllBookings();
    renderAdminCalendar();
    setTimeout(() => {
        loadAdminCalendarData();
    }, 100);
}

// ============================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE
// ============================================

window.generatePDFReport = generatePDFReport;
window.generateDailyReport = generateDailyReport;
window.generatePDF = generatePDF;
window.logoutAdmin = logoutAdmin;
window.showTab = showTab;
window.toggleDateStatus = toggleDateStatus;
window.refreshSchedule = refreshSchedule;
window.loadAllBookings = loadAllBookings;
window.clearDateFilters = clearDateFilters;
window.setDateRange = setDateRange;
window.changeRowsPerPage = changeRowsPerPage;
window.prevPage = prevPage;
window.nextPage = nextPage;
window.goToPageServer = goToPageServer;
window.changeAdminMonth = changeAdminMonth;
window.goToAdminToday = goToAdminToday;
window.onAdminDateClick = onAdminDateClick;

// ============================================
// INITIALIZE PAGE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('adminDateSelect').value = getMalaysiaToday();
    
    if (checkAdminSession()) {
        adminLogin.classList.add('hidden');
        adminContent.classList.remove('hidden');
        document.getElementById('adminStatus').textContent = '✅ Admin Logged In';
        document.getElementById('adminStatus').style.color = 'green';
        document.getElementById('logoutBtn').style.display = 'inline-block';
        initializeAdmin();
    } else {
        adminLogin.classList.remove('hidden');
        adminContent.classList.add('hidden');
        document.getElementById('adminPassword').focus();
    }
});

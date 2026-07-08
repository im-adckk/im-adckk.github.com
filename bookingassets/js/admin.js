// Supabase Configuration
const SUPABASE_URL = 'https://yrrinzreyafiowehhhon.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4MnAXo4yxHMQX7fSn7hQjA_qV2X7t7o';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Admin password
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
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
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

function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
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

    switch (range) {
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
// PDF REPORT GENERATION - BOOKING REPORT
// ============================================

function buildBookingReportHTML(data) {
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

    const classBBookings = bookings.filter(b => b.class === 'B');
    const classB2Bookings = bookings.filter(b => b.class === 'B2');

    const totalB = classBBookings.length;
    const totalB2 = classB2Bookings.length;
    const totalAll = bookings.length;

    function renderGroupedTableRows(bookingsList, startCounter) {
        const sessionOrder = ['9am-12pm', '12pm-3pm'];
        const slotOrder = ['sesi1', 'sesi2', 'sesi3'];

        const grouped = {};
        bookingsList.forEach(b => {
            const key = b.session_time || 'Unknown';
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(b);
        });

        let html = '';
        let counter = startCounter || 0;

        const sortedSessions = Object.keys(grouped).sort((a, b) => {
            return sessionOrder.indexOf(a) - sessionOrder.indexOf(b);
        });

        sortedSessions.forEach(sessionTime => {
            const items = grouped[sessionTime];
            items.sort((a, b) => {
                return slotOrder.indexOf(a.session_slot) - slotOrder.indexOf(b.session_slot);
            });

            html += `
                <tr class="class-separator">
                    <td colspan="9" style="padding:8px 10px;border:1px solid #ccc;background:#e8ecf1;font-weight:bold;color:#2c3e50;">
                        📅 ${sessionTime}
                    </td>
                </tr>
            `;

            items.forEach((b) => {
                counter++;
                let lessonDisplay = b.lesson || '';
                if (lessonDisplay.includes(' - ')) {
                    lessonDisplay = lessonDisplay.split(' - ')[1] || lessonDisplay;
                }

                html += `
                    <tr>
                        <td style="text-align:center;padding:6px;border:1px solid #ddd;">${counter}</td>
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

            html += `
                <tr style="background:#f8fafc;font-weight:bold;">
                    <td colspan="8" style="padding:6px 10px;border:1px solid #ddd;text-align:right;color:#2c3e50;">
                        Subtotal (${sessionTime}):
                    </td>
                    <td style="padding:6px;border:1px solid #ddd;text-align:center;color:#2c3e50;">
                        ${items.length}
                    </td>
                </tr>
            `;
        });

        return html;
    }

    function renderClassPage(bookingsList, className, classBadge, totalCount) {
        if (bookingsList.length === 0) {
            return `
                <div style="page-break-after:always;padding:40px 0;text-align:center;color:#999;font-style:italic;">
                    No ${className} bookings found for this period.
                </div>
            `;
        }

        return `
            <div style="page-break-after:always;">
                <h3 class="section-title" style="margin-top:0;">
                    <span class="class-badge ${classBadge}">${className}</span>
                    <span style="margin-left:15px;font-weight:normal;font-size:13px;color:#666;">Total: ${totalCount} participants</span>
                </h3>
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
                        ${renderGroupedTableRows(bookingsList, 0)}
                    </tbody>
                </table>
                <div style="margin-top:15px;padding:10px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;text-align:right;">
                    <span style="font-weight:bold;font-size:13px;">Total ${className}: ${totalCount} participants</span>
                </div>
            </div>
        `;
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Booking Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #ffffff; color: #000000; padding: 40px; font-size: 12px; line-height: 1.5; }
        .report-container { max-width: 100%; margin: 0 auto; }
        .page-break { page-break-after: always; }
        .page-break:last-child { page-break-after: avoid; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
        .header h1 { margin: 0; color: #2c3e50; font-size: 24px; }
        .header p { margin: 5px 0; color: #7f8c8d; font-size: 14px; }
        .section-title { color: #2c3e50; border-bottom: 2px solid #333; padding-bottom: 8px; font-size: 16px; margin: 25px 0 15px 0; }
        .section-title:first-of-type { margin-top: 0; }
        .class-badge { display: inline-block; padding: 2px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; }
        .class-badge-b { background: #dbeafe; color: #1e40af; }
        .class-badge-b2 { background: #fce7f3; color: #9d174d; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        thead th { background: #34495e; color: #fff; padding: 8px; text-align: left; border: 1px solid #34495e; }
        thead th.center { text-align: center; }
        tbody td { padding: 6px; border: 1px solid #ddd; }
        tbody tr:nth-child(even) { background: #f8f9fa; }
        tbody tr:nth-child(odd) { background: #ffffff; }
        .class-separator td { padding: 6px 10px; border: 1px solid #ccc; background: #e8ecf1 !important; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #95a5a6; text-align: center; }
        .loading { text-align: center; padding: 40px; font-size: 16px; color: #666; }
        .spinner { display: inline-block; width: 30px; height: 30px; border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .cover-page { text-align: center; padding: 60px 40px; page-break-after: always; }
        .cover-page h1 { font-size: 32px; color: #2c3e50; margin-bottom: 20px; }
        .cover-page .subtitle { font-size: 18px; color: #7f8c8d; margin-bottom: 40px; }
        .cover-page .info { font-size: 14px; color: #95a5a6; line-height: 2; }
        .cover-page .info strong { color: #2c3e50; }
        .cover-page .logo { font-size: 64px; margin-bottom: 30px; }
    </style>
</head>
<body>
    <div id="loading" class="loading">
        <div class="spinner"></div>
        <p style="margin-top: 15px;">Generating PDF report...</p>
    </div>
    
    <div id="reportContent" class="report-container" style="display:none;">
        <div class="cover-page">
            <div class="logo">🏍️</div>
            <h1>Motorcycle Booking Report</h1>
            <p class="subtitle">Class ${classLabel} • ${statusLabel}</p>
            <div class="info">
                <p><strong>Period:</strong> ${formatDate(dateFrom)} to ${formatDate(dateTo)}</p>
                <p><strong>Total Bookings:</strong> ${totalAll} participants</p>
                <p><strong>Class B:</strong> ${totalB} participants</p>
                <p><strong>Class B2:</strong> ${totalB2} participants</p>
                <p><strong>Generated:</strong> ${formatDateTimeLocal(new Date().toISOString())}</p>
            </div>
        </div>
        
        <div class="page-break">
            ${renderClassPage(classBBookings, 'CLASS B', 'class-badge-b', totalB)}
        </div>
        
        <div class="page-break">
            ${renderClassPage(classB2Bookings, 'CLASS B2', 'class-badge-b2', totalB2)}
        </div>
        
        <div style="page-break-after:avoid;padding-top:40px;">
            <h3 class="section-title" style="margin-top:0;">📊 Summary</h3>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-top:20px;">
                <div style="padding:20px;border:1px solid #ddd;border-radius:8px;text-align:center;background:#f8f9fa;">
                    <div style="font-size:28px;font-weight:bold;color:#2c3e50;">${totalAll}</div>
                    <div style="font-size:12px;color:#7f8c8d;margin-top:5px;">Total Participants</div>
                </div>
                <div style="padding:20px;border:1px solid #dbeafe;border-radius:8px;text-align:center;background:#eff6ff;">
                    <div style="font-size:28px;font-weight:bold;color:#1e40af;">${totalB}</div>
                    <div style="font-size:12px;color:#7f8c8d;margin-top:5px;">Class B</div>
                </div>
                <div style="padding:20px;border:1px solid #fce7f3;border-radius:8px;text-align:center;background:#fdf2f8;">
                    <div style="font-size:28px;font-weight:bold;color:#9d174d;">${totalB2}</div>
                    <div style="font-size:12px;color:#7f8c8d;margin-top:5px;">Class B2</div>
                </div>
            </div>
            <div style="margin-top:20px;padding:15px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
                <h4 style="margin-bottom:10px;color:#2c3e50;">Session Breakdown</h4>
                ${(() => {
                    const sessionCounts = {};
                    bookings.forEach(b => {
                        const key = b.session_time || 'Unknown';
                        if (!sessionCounts[key]) sessionCounts[key] = 0;
                        sessionCounts[key]++;
                    });
                    let html = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">';
                    for (const [session, count] of Object.entries(sessionCounts)) {
                        html += `
                            <div style="display:flex;justify-content:space-between;padding:8px 12px;background:white;border-radius:4px;border:1px solid #e2e8f0;">
                                <span>${session}</span>
                                <span style="font-weight:bold;">${count}</span>
                            </div>
                        `;
                    }
                    html += '</div>';
                    return html;
                })()}
            </div>
            <div class="footer">
                <p>This report is auto-generated by the Motorcycle Booking System.</p>
                <p>© ${new Date().getFullYear()} - All rights reserved.</p>
            </div>
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
                    html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', allowTaint: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
                };
                html2pdf().set(opt).from(element).save().then(function() {
                    setTimeout(function() { window.close(); }, 1000);
                }).catch(function(err) {
                    console.error('PDF generation error:', err);
                    document.body.innerHTML += 
                        '<p style="color:red;margin-top:20px;text-align:center;font-size:14px;">❌ Error generating PDF. Please use Print (Ctrl+P) to save as PDF.</p>' +
                        '<p style="text-align:center;margin-top:10px;"><button onclick="window.print()" style="padding:10px 20px;font-size:14px;cursor:pointer;">Print / Save as PDF</button></p>';
                });
            }, 500);
        })();
    <\/script>
</body>
</html>`;
}

async function generateBookingPDF(data, dateFrom, dateTo, classFilter, statusFilter) {
    const classLabel = classFilter === 'all' ? 'All Classes' : 'Class ' + classFilter;
    const statusLabel = statusFilter === 'all' ? 'All Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);

    const reportData = {
        bookings: data,
        dateFrom: dateFrom,
        dateTo: dateTo,
        classLabel: classLabel,
        statusLabel: statusLabel
    };

    const htmlContent = buildBookingReportHTML(reportData);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const newTab = window.open(url, '_blank');

    if (!newTab) {
        throw new Error('Popup blocked. Please allow popups for this site.');
    }

    setTimeout(() => {
        try {
            URL.revokeObjectURL(url);
        } catch (e) {}
    }, 10000);
}

async function generateBookingReport() {
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
            .order('session_time', { ascending: true })
            .order('session_slot', { ascending: true });

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

        await generateBookingPDF(data, dateFrom, dateTo, classFilter, statusFilter);

        if (progressDiv) progressDiv.style.display = 'none';
        showMessage('PDF report generated successfully!', 'success');

    } catch (error) {
        console.error('Error generating report:', error);
        showMessage('Error generating report: ' + error.message, 'error');
        if (progressDiv) progressDiv.style.display = 'none';
    }
}

async function generateDailyBookingReport() {
    const today = getMalaysiaToday();
    document.getElementById('reportDateFrom').value = today;
    document.getElementById('reportDateTo').value = today;
    await generateBookingReport();
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

    switch (type) {
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
    const tabs = ['bookings', 'calendar', 'report', 'instructor', 'duty'];

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

    if (tabId === 'instructor') {
        loadInstructors();
    }

    if (tabId === 'duty') {
        const today = getMalaysiaToday();
        document.getElementById('dutyDate').value = today;
        generateDutyReport();
    }
}

// ============================================
// INSTRUCTOR MANAGEMENT
// ============================================

async function loadInstructors() {
    try {
        const { data, error } = await supabaseClient
            .from('instructors')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;

        renderInstructors(data || []);
        populateInstructorDropdown(data || []);

    } catch (error) {
        console.error('Error loading instructors:', error);
        showMessage('Error loading instructors: ' + error.message, 'error');
    }
}

function renderInstructors(instructors) {
    const tbody = document.getElementById('instructorTableBody');
    if (!tbody) return;

    if (!instructors || instructors.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted-foreground p-8">No instructors found.</td></tr>`;
        document.getElementById('instructorCount').textContent = '0 instructors';
        return;
    }

    let html = '';
    instructors.forEach((inst, index) => {
        const classes = inst.class_qualified || [];
        const classBadge = classes.map(c => `<span class="inline-block px-1.5 py-0.5 rounded text-xs bg-muted mx-0.5">${c}</span>`).join('');
        const status = inst.is_active ?
            '<span class="text-emerald-600 font-medium">Active</span>' :
            '<span class="text-red-600 font-medium">Inactive</span>';

        html += `
            <tr class="hover:bg-muted/40 transition-colors border-b">
                <td class="p-3 text-center">${index + 1}</td>
                <td class="p-3 font-medium">${inst.name || ''}</td>
                <td class="p-3 font-mono text-xs">${inst.ic_no || ''}</td>
                <td class="p-3">${classBadge}</td>
                <td class="p-3">${status}</td>
                <td class="p-3 text-center">
                    <button onclick="toggleInstructorStatus('${inst.id}')" class="text-xs text-blue-600 hover:text-blue-800 mr-2" title="Toggle Active/Inactive">
                        <i data-lucide="toggle-left" class="w-4 h-4 inline"></i>
                    </button>
                    <button onclick="deleteInstructor('${inst.id}')" class="text-xs text-red-600 hover:text-red-800" title="Delete">
                        <i data-lucide="trash-2" class="w-4 h-4 inline"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    document.getElementById('instructorCount').textContent = `${instructors.length} instructors`;
    refreshIcons();
}

function populateInstructorDropdown(instructors) {
    const select = document.getElementById('dutyInstructor');
    if (!select) return;

    const activeInstructors = instructors.filter(i => i.is_active !== false);

    select.innerHTML = '<option value="">-- Select Instructor --</option>';
    activeInstructors.forEach(inst => {
        const option = document.createElement('option');
        option.value = inst.id;
        option.textContent = `${inst.name} (${(inst.class_qualified || []).join(', ')})`;
        select.appendChild(option);
    });
}

// Instructor form submission
document.addEventListener('DOMContentLoaded', function() {
    const instructorForm = document.getElementById('instructorForm');
    if (instructorForm) {
        instructorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await addInstructor();
        });
    }
});

async function addInstructor() {
    const name = document.getElementById('instructorName').value.trim();
    const ic_no = document.getElementById('instructorIc').value.trim();
    const classB = document.getElementById('instructorClassB').checked;
    const classB2 = document.getElementById('instructorClassB2').checked;

    if (!name || !ic_no) {
        showMessage('Please fill in Name and IC Number.', 'error');
        return;
    }

    const classes = [];
    if (classB) classes.push('B');
    if (classB2) classes.push('B2');

    if (classes.length === 0) {
        showMessage('Please select at least one class.', 'error');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('instructors')
            .insert([{
                name: name,
                ic_no: ic_no,
                class_qualified: classes
            }])
            .select();

        if (error) throw error;

        showMessage('✅ Instructor added successfully!', 'success');
        document.getElementById('instructorName').value = '';
        document.getElementById('instructorIc').value = '';
        await loadInstructors();

    } catch (error) {
        console.error('Error adding instructor:', error);
        showMessage('Error adding instructor: ' + error.message, 'error');
    }
}

async function toggleInstructorStatus(id) {
    try {
        const { data: current, error: fetchError } = await supabaseClient
            .from('instructors')
            .select('is_active')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        const { error } = await supabaseClient
            .from('instructors')
            .update({ is_active: !current.is_active })
            .eq('id', id);

        if (error) throw error;

        showMessage('Instructor status updated.', 'success');
        await loadInstructors();

    } catch (error) {
        console.error('Error toggling instructor:', error);
        showMessage('Error: ' + error.message, 'error');
    }
}

async function deleteInstructor(id) {
    if (!confirm('Are you sure you want to delete this instructor?')) return;

    try {
        const { error } = await supabaseClient
            .from('instructors')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showMessage('Instructor deleted successfully.', 'success');
        await loadInstructors();

    } catch (error) {
        console.error('Error deleting instructor:', error);
        showMessage('Error: ' + error.message, 'error');
    }
}

// ============================================
// DUTY SCHEDULE FUNCTIONS
// ============================================

async function assignDuty() {
    const instructor_id = document.getElementById('dutyInstructor').value;
    const dutyDate = document.getElementById('dutyDate').value;
    const session_time = document.getElementById('dutySession').value;
    const class_type = document.getElementById('dutyClass').value;
    const total_students = parseInt(document.getElementById('dutyStudents').value) || 0;

    if (!instructor_id) {
        showMessage('Please select an instructor.', 'error');
        return;
    }

    if (!dutyDate) {
        showMessage('Please select a date.', 'error');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('duty_schedule')
            .insert([{
                instructor_id: instructor_id,
                duty_date: dutyDate,
                session_time: session_time,
                class: class_type,
                total_students: total_students,
                sign: 'PENDING'
            }])
            .select();

        if (error) throw error;

        showMessage('✅ Duty assigned successfully!', 'success');
        document.getElementById('dutyStudents').value = '';
        await generateDutyReport();

    } catch (error) {
        console.error('Error assigning duty:', error);
        showMessage('Error: ' + error.message, 'error');
    }
}

async function generateDutyReport() {
    const date = document.getElementById('dutyDate').value;

    if (!date) {
        showMessage('Please select a date.', 'error');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('duty_report_view')
            .select('*')
            .eq('duty_date', date)
            .order('session_time', { ascending: true })
            .order('instructor_name', { ascending: true });

        if (error) throw error;

        renderDutyReport(data || [], date);

    } catch (error) {
        console.error('Error generating duty report:', error);
        showMessage('Error: ' + error.message, 'error');
    }
}

function renderDutyReport(data, date) {
    const container = document.getElementById('dutyReportContainer');
    if (!container) return;

    container.classList.remove('hidden');

    const dateObj = new Date(date + 'T00:00:00');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dateObj.getDay()];
    const formattedDate = dateObj.toLocaleDateString('en-MY', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    const session1 = data.filter(d => d.session_time === '9am-12pm');
    const session2 = data.filter(d => d.session_time === '1pm-4pm');

    function renderSessionTable(sessionData, sessionLabel) {
        if (sessionData.length === 0) {
            return `
                <div class="text-center text-muted-foreground p-4 border rounded-lg bg-muted/20">
                    No instructors assigned for ${sessionLabel}
                </div>
            `;
        }

        let html = `
            <div class="overflow-x-auto border rounded-lg">
                <table class="w-full text-left border-collapse text-sm">
                    <thead>
                        <tr class="bg-muted text-xs font-semibold text-muted-foreground uppercase border-b">
                            <th class="p-2.5 text-center">NO</th>
                            <th class="p-2.5">TOTAL STUDENT</th>
                            <th class="p-2.5">INSTRUCTOR</th>
                            <th class="p-2.5">SIGN</th>
                            <th class="p-2.5">CLASS</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        sessionData.forEach((item, index) => {
            // Remove the ✍️ Signed / ⏳ Pending display, just show empty or dash
            const signDisplay = ''; // Empty for PDF

            html += `
                <tr class="hover:bg-muted/40 transition-colors border-b">
                    <td class="p-2.5 text-center">${index + 1}</td>
                    <td class="p-2.5 font-medium">${item.total_students || 0}</td>
                    <td class="p-2.5 font-medium">${item.instructor_name || ''}</td>
                    <td class="p-2.5">
                        <!-- Sign column - left empty for manual signature -->
                        <span style="color: transparent;">.</span>
                    </td>
                    <td class="p-2.5">
                        <span class="inline-block px-2 py-0.5 rounded bg-muted text-xs">${item.class || ''}</span>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        return html;
    }

    container.innerHTML = `
        <div class="bg-white rounded-xl border p-6 space-y-6">
            <!-- Header removed from here - will be added in PDF export -->
            
            <div>
                <h4 class="font-semibold text-base mb-3 flex items-center gap-2">
                    <span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">SESSION (9AM-12PM)</span>
                </h4>
                ${renderSessionTable(session1, '9am-12pm')}
            </div>
            
            <div>
                <h4 class="font-semibold text-base mb-3 flex items-center gap-2">
                    <span class="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm">SESSION (1PM-4PM)</span>
                </h4>
                ${renderSessionTable(session2, '1pm-4pm')}
            </div>
            
            <div class="text-center text-xs text-muted-foreground border-t pt-4">
                Generated on: ${new Date().toLocaleString('en-MY')}
            </div>
        </div>
    `;

    refreshIcons();
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function exportDutyPDF() {
    const container = document.getElementById('dutyReportContainer');
    if (!container || container.classList.contains('hidden')) {
        showMessage('Please generate the report first.', 'error');
        return;
    }

    try {
        const date = document.getElementById('dutyDate').value;
        const dateObj = new Date(date + 'T00:00:00');
        const filename = `duty_schedule_${dateObj.toISOString().split('T')[0]}`;

        // Get the content and clean it
        let content = container.innerHTML;
        
        // Remove any buttons
        content = content.replace(/<button[^>]*>.*?<\/button>/g, '');
        
        // Remove ✍️ Signed text and icons
        content = content.replace(/✍️ Signed/g, '');
        content = content.replace(/⏳ Pending/g, '');
        content = content.replace(/<span[^>]*class="[^"]*text-emerald-600[^"]*"[^>]*>.*?<\/span>/g, '');
        content = content.replace(/<span[^>]*class="[^"]*text-amber-600[^"]*"[^>]*>.*?<\/span>/g, '');

        // Build full HTML page with single header
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Duty Schedule Report - ${filename}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: Arial, Helvetica, sans-serif; 
            padding: 30px; 
            background: white; 
            font-size: 12px;
            line-height: 1.5;
        }
        .report { 
            max-width: 1100px; 
            margin: 0 auto; 
        }
        .header { 
            text-align: center; 
            border-bottom: 2px solid #000; 
            padding-bottom: 15px; 
            margin-bottom: 20px; 
        }
        .header h2 { 
            margin: 0; 
            font-size: 18px; 
            font-weight: bold;
        }
        .header h3 { 
            margin: 5px 0; 
            font-size: 16px; 
            font-weight: 600;
        }
        .header .info { 
            margin: 8px 0 0 0; 
            color: #333; 
            font-size: 13px; 
        }
        .header .info span { 
            margin: 0 10px; 
        }
        .header .info .label { 
            font-weight: bold; 
        }
        .session-title {
            font-size: 14px;
            font-weight: bold;
            margin: 20px 0 10px 0;
            padding: 8px 15px;
            border-radius: 4px;
            display: inline-block;
            background: #dbeafe;
            color: #1e40af;
        }
        .session-title.purple {
            background: #f3e8ff;
            color: #6b21a8;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 12px; 
            margin: 10px 0; 
        }
        thead th { 
            background: #34495e; 
            color: white; 
            padding: 8px 10px; 
            text-align: left; 
            border: 1px solid #34495e; 
        }
        thead th.center { 
            text-align: center; 
        }
        tbody td { 
            padding: 7px 10px; 
            border: 1px solid #ddd; 
        }
        tbody tr:nth-child(even) { 
            background: #f9fafb; 
        }
        tbody tr:nth-child(odd) { 
            background: #ffffff; 
        }
        .text-center { 
            text-align: center; 
        }
        .text-muted { 
            color: #6b7280; 
        }
        .no-data { 
            text-align: center; 
            padding: 20px; 
            color: #999; 
            font-style: italic; 
        }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            background: #f3f4f6;
            font-size: 11px;
        }
        .footer { 
            text-align: center; 
            font-size: 11px; 
            color: #999; 
            border-top: 1px solid #ddd; 
            padding-top: 15px; 
            margin-top: 20px; 
        }
        @media print {
            body { padding: 20px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="report">
        <!-- SINGLE HEADER -->
        <div class="header">
            <h2>API-API DRIVING CENTRE SDN BHD (723723T)</h2>
            <h3>INSTRUCTOR RECORD TIMETABLE (DUTY SCHEDULE)</h3>
            <div class="info">
                <span><span class="label">DAY:</span> ${getDayName(date)}</span>
                <span><span class="label">DATE:</span> ${formatDateForReport(date)}</span>
            </div>
            <div class="info">
                <span class="label">SESSION:</span> (9AM-12PM) | (1PM-4PM)
            </div>
        </div>

        <!-- TABLE CONTENT -->
        ${content}

        <!-- FOOTER ONLY -->
        <div class="footer">
            Generated on: ${new Date().toLocaleString('en-MY')}
            <br>© ${new Date().getFullYear()} - API-API Driving Centre Sdn Bhd
        </div>
    </div>
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 800);
        };
    <\/script>
</body>
</html>`;

        // Open in new tab
        const newTab = window.open('', '_blank');
        if (!newTab) {
            throw new Error('Popup blocked. Please allow popups for this site.');
        }

        newTab.document.write(htmlContent);
        newTab.document.close();

        showMessage('✅ Report opened in new tab. Use "Save as PDF" or Print (Ctrl+P).', 'success');

    } catch (error) {
        console.error('Error exporting PDF:', error);
        showMessage('Error exporting PDF: ' + error.message, 'error');
    }
}

// Helper function to get day name
function getDayName(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[date.getDay()];
}

// Helper function to format date
function formatDateForReport(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-MY', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
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
    document.getElementById('dutyDate').value = today;

    await loadStats();
    await loadAllBookings();
    await loadInstructors();

    renderAdminCalendar();
    setTimeout(() => {
        loadAdminCalendarData();
    }, 100);

    // Generate initial duty report
    setTimeout(() => {
        generateDutyReport();
    }, 200);
}

// ============================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE
// ============================================

// Booking Report
window.generateBookingReport = generateBookingReport;
window.generateDailyBookingReport = generateDailyBookingReport;

// Admin
window.logoutAdmin = logoutAdmin;
window.showTab = showTab;
window.toggleDateStatus = toggleDateStatus;
window.refreshSchedule = refreshSchedule;

// Bookings Table
window.loadAllBookings = loadAllBookings;
window.clearDateFilters = clearDateFilters;
window.setDateRange = setDateRange;
window.changeRowsPerPage = changeRowsPerPage;
window.prevPage = prevPage;
window.nextPage = nextPage;
window.goToPageServer = goToPageServer;

// Calendar
window.changeAdminMonth = changeAdminMonth;
window.goToAdminToday = goToAdminToday;
window.onAdminDateClick = onAdminDateClick;

// Instructor
window.loadInstructors = loadInstructors;
window.addInstructor = addInstructor;
window.toggleInstructorStatus = toggleInstructorStatus;
window.deleteInstructor = deleteInstructor;

// Duty Schedule
window.assignDuty = assignDuty;
window.generateDutyReport = generateDutyReport;
window.markSigned = markSigned;
window.exportDutyPDF = exportDutyPDF;

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

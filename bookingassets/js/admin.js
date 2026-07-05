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
// ADMIN SESSION MANAGEMENT
// ============================================

// Check if admin session exists and is valid
function checkAdminSession() {
    const isLoggedIn = sessionStorage.getItem(ADMIN_SESSION_KEY);
    const loginTime = sessionStorage.getItem(ADMIN_LOGIN_TIME_KEY);
    
    if (isLoggedIn === 'true' && loginTime) {
        // Optional: Session timeout after 24 hours (86400000 ms)
        const sessionAge = Date.now() - parseInt(loginTime);
        const maxSessionAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (sessionAge < maxSessionAge) {
            return true;
        } else {
            // Session expired, clear it
            clearAdminSession();
            return false;
        }
    }
    return false;
}

// Create admin session
function createAdminSession() {
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
    sessionStorage.setItem(ADMIN_LOGIN_TIME_KEY, Date.now().toString());
}

// Clear admin session (logout)
function clearAdminSession() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_LOGIN_TIME_KEY);
}

// Logout function
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

// Also allow Enter key to submit
document.getElementById('adminPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loginForm.dispatchEvent(new Event('submit'));
    }
});

// ============================================
// ADMIN INITIALIZATION
// ============================================

async function initializeAdmin() {
    // Set default dates for report
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
    // Wait for calendar to render then load data
    setTimeout(() => {
        loadAdminCalendarData();
    }, 100);
}

// ============================================
// INITIALIZE PAGE - Check Session on Load
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('adminDateSelect').value = getMalaysiaToday();
    
    // Check if admin session exists
    if (checkAdminSession()) {
        // Auto-login
        adminLogin.classList.add('hidden');
        adminContent.classList.remove('hidden');
        document.getElementById('adminStatus').textContent = '✅ Admin Logged In';
        document.getElementById('adminStatus').style.color = 'green';
        initializeAdmin();
    } else {
        // Show login
        adminLogin.classList.remove('hidden');
        adminContent.classList.add('hidden');
        // Auto-focus password field
        document.getElementById('adminPassword').focus();
    }
});

// ============================================
// STATS (same as before)
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
            .gte('booking_date', today)
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
async function loadAllBookings() {
    renderBookingsTable([], true); // Show loading spinner
    
    try {
        // 1. Get filter input values
        const dateFrom = document.getElementById('filterDateFrom').value;
        const dateTo = document.getElementById('filterDateTo').value;
        const status = document.getElementById('filterStatus').value;
        const classType = document.getElementById('filterClass').value;
        
        // 2. Begin building the Supabase Query with exact row counting
        let query = supabaseClient
            .from('bookings')
            .select('*', { count: 'exact' });
            
        // 3. Apply server-side filters
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
        
        // 4. Calculate Server-side limits based on current page
        const fromRow = (currentPage - 1) * rowsPerPage;
        const toRow = fromRow + rowsPerPage - 1;
        
        // 5. Apply pagination range and sorting order
        query = query
            .order('booking_date', { ascending: false })
            .order('session_time', { ascending: true })
            .range(fromRow, toRow);
            
        // 6. Execute remote query
        const { data, error, count } = await query;
        
        if (error) throw error;
        
        // 7. Store state locally
        allBookingsData = data || [];
        totalDBCount = count || 0;
        
        // Update total counter text on screen
        document.getElementById('resultCount').textContent = `${totalDBCount} bookings found`;
        
        // 8. Render the limited page block and update controls
        renderBookingsTable(allBookingsData);
        updatePaginationServerSide();
        
    } catch (error) {
        console.error('Error loading server bookings:', error);
        showMessage('Failed to load bookings from database.', 'error');
        renderBookingsTable([]);
    }
}

// ============================================
// ALL BOOKINGS TABLE WITH DATE FILTERS
// ============================================

// Pagination state
function updatePaginationServerSide() {
    totalPages = Math.ceil(totalDBCount / rowsPerPage) || 1;
    
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    
    const paginationDiv = document.getElementById('paginationControls');
    if (!paginationDiv) return;
    
    // Always show controls container so the layout doesn't jump around
    paginationDiv.classList.remove('hidden');
    
    const startItem = totalDBCount === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
    const endItem = Math.min(currentPage * rowsPerPage, totalDBCount);
    
    document.getElementById('paginationInfo').textContent = 
        `Showing ${startItem} - ${endItem} of ${totalDBCount}`;
    
    // Toggle action button states
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage === totalPages;
    
    const pageNumbers = document.getElementById('pageNumbers');
    pageNumbers.innerHTML = '';
    
    if (totalPages <= 1) return; // No number links needed if it fits on 1 page
    
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
            btn.style.background = 'var(--color-primary, #3498db)';
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

// Actions fetch records from DB when navigation changes
async function goToPageServer(pageNum) {
    if (pageNum < 1 || pageNum > totalPages) return;
    currentPage = pageNum;
    await loadAllBookings(); // Triggers range request to database
    
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
    currentPage = 1; // Reset to page 1 to prevent indexing errors
    await loadAllBookings();
}

// Clear all filters and reload
function clearDateFilters() {
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';
    document.getElementById('filterStatus').value = 'all';
    document.getElementById('filterClass').value = 'all';
    currentPage = 1;
    loadAllBookings();
}

// Quick date range presets
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


function renderBookingsTable(bookings, isLoading = false) {
    const tbody = document.getElementById('bookingsTableBody');
    if (!tbody) return;
    
    if (isLoading) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center p-8 text-muted-foreground"><i data-lucide="refresh-cw" class="w-5 h-5 animate-spin mx-auto mb-2"></i>Loading bookings data...</td></tr>`;
        if (window.lucide) lucide.createIcons();
        return;
    }
    
    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center p-12 text-muted-foreground font-medium">No bookings match the selected filtration query.</td></tr>`;
        return;
    }
    
    let html = '';
    bookings.forEach(booking => {
        // Map status strings to clean Tailwind & Basecoat UI pill attributes
        let badgeVariant = 'data-variant="outline"';
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
// ============================================
// PDF REPORT GENERATION
// ============================================

async function generatePDF(data, dateFrom, dateTo, classFilter, statusFilter) {
    // Create report content with inline styles that avoid oklch colors
    const reportContent = document.createElement('div');
    reportContent.id = 'reportContent';
    // Use simple CSS that doesn't rely on oklch or modern color functions
    reportContent.style.cssText = `
        padding: 40px; 
        font-family: Arial, sans-serif; 
        background: #ffffff; 
        color: #000000;
        max-width: 100%;
    `;
    
    // Header
    const classLabel = classFilter === 'all' ? 'All Classes' : 'Class ' + classFilter;
    const statusLabel = statusFilter === 'all' ? 'All Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);
    
    reportContent.innerHTML = `
        <div style="text-align:center;border-bottom:2px solid #333333;padding-bottom:20px;margin-bottom:20px;">
            <h1 style="margin:0;color:#2c3e50;font-size:24px;">🏍️ Motorcycle Booking Report</h1>
            <p style="margin:5px 0;color:#7f8c8d;font-size:14px;">
                Period: ${formatMalaysiaDate(dateFrom)} to ${formatMalaysiaDate(dateTo)}
            </p>
            <p style="margin:5px 0;color:#7f8c8d;font-size:14px;">
                Class: ${classLabel} | Status: ${statusLabel}
            </p>
            <p style="margin:5px 0;color:#7f8c8d;font-size:12px;">
                Generated: ${formatDateTime(new Date().toISOString())}
            </p>
        </div>
        
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin-bottom:30px;">
            <div style="padding:15px;border:1px solid #dddddd;border-radius:4px;text-align:center;background:#f8f9fa;">
                <h3 style="margin:0;color:#2c3e50;font-size:20px;">${data.length}</h3>
                <p style="margin:5px 0 0;color:#7f8c8d;font-size:12px;">Total Bookings</p>
            </div>
            <div style="padding:15px;border:1px solid #dddddd;border-radius:4px;text-align:center;background:#f0fdf4;">
                <h3 style="margin:0;color:#27ae60;font-size:20px;">${data.filter(b => b.status === 'confirmed').length}</h3>
                <p style="margin:5px 0 0;color:#7f8c8d;font-size:12px;">Confirmed</p>
            </div>
            <div style="padding:15px;border:1px solid #dddddd;border-radius:4px;text-align:center;background:#fef2f2;">
                <h3 style="margin:0;color:#e74c3c;font-size:20px;">${data.filter(b => b.status === 'cancelled').length}</h3>
                <p style="margin:5px 0 0;color:#7f8c8d;font-size:12px;">Cancelled</p>
            </div>
            <div style="padding:15px;border:1px solid #dddddd;border-radius:4px;text-align:center;background:#fffbeb;">
                <h3 style="margin:0;color:#f39c12;font-size:20px;">${data.filter(b => b.status === 'rescheduled').length}</h3>
                <p style="margin:5px 0 0;color:#7f8c8d;font-size:12px;">Rescheduled</p>
            </div>
        </div>
        
        <h3 style="color:#2c3e50;border-bottom:1px solid #dddddd;padding-bottom:10px;font-size:16px;">Booking Details</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
                <tr style="background:#34495e;color:#ffffff;">
                    <th style="padding:8px;text-align:left;border:1px solid #34495e;">Session ID</th>
                    <th style="padding:8px;text-align:left;border:1px solid #34495e;">Name</th>
                    <th style="padding:8px;text-align:left;border:1px solid #34495e;">Class</th>
                    <th style="padding:8px;text-align:left;border:1px solid #34495e;">Date</th>
                    <th style="padding:8px;text-align:left;border:1px solid #34495e;">Time</th>
                    <th style="padding:8px;text-align:left;border:1px solid #34495e;">Slot</th>
                    <th style="padding:8px;text-align:left;border:1px solid #34495e;">Status</th>
                </tr>
            </thead>
            <tbody>
                ${data.map((b, index) => `
                    <tr style="${index % 2 === 0 ? 'background:#f8f9fa;' : 'background:#ffffff;'}">
                        <td style="padding:6px;border:1px solid #dddddd;">${b.session_id}</td>
                        <td style="padding:6px;border:1px solid #dddddd;">${b.name}</td>
                        <td style="padding:6px;border:1px solid #dddddd;">${b.class}</td>
                        <td style="padding:6px;border:1px solid #dddddd;">${formatMalaysiaDate(b.booking_date)}</td>
                        <td style="padding:6px;border:1px solid #dddddd;">${b.session_time}</td>
                        <td style="padding:6px;border:1px solid #dddddd;">${b.session_slot}</td>
                        <td style="padding:6px;border:1px solid #dddddd;color:${b.status === 'confirmed' ? '#27ae60' : b.status === 'cancelled' ? '#e74c3c' : '#f39c12'};font-weight:bold;">
                            ${b.status.toUpperCase()}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div style="margin-top:30px;padding-top:20px;border-top:1px solid #dddddd;font-size:11px;color:#95a5a6;text-align:center;">
            <p>This report is auto-generated by the Motorcycle Booking System.</p>
            <p>© ${new Date().getFullYear()} - All rights reserved.</p>
        </div>
    `;
    
    // Add to body temporarily
    document.body.appendChild(reportContent);
    
    // Generate PDF with simplified options
    const opt = {
        margin: [10, 10, 10, 10],
        filename: `booking_report_${dateFrom}_to_${dateTo}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true, 
            logging: false,
            backgroundColor: '#ffffff'
        },
        jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'landscape' 
        },
        pagebreak: { 
            mode: ['avoid-all', 'css', 'legacy'] 
        }
    };
    
    try {
        await html2pdf().set(opt).from(reportContent).save();
    } catch (error) {
        console.error('PDF generation error:', error);
        throw new Error('Failed to generate PDF: ' + error.message);
    } finally {
        // Clean up
        if (reportContent.parentNode) {
            document.body.removeChild(reportContent);
        }
    }
}

// ============================================
// DATE MANAGEMENT
// ============================================

async function toggleDateStatus() {
    const date = document.getElementById('adminDateSelect').value;
    const reason = document.getElementById('closureReason').value.trim();
    const messageDiv = document.getElementById('dateStatusMessage');
    
    if (!date) {
        showMessage('Please select a date first.', 'error');
        return;
    }
    
    try {
        const { data: existing, error: checkError } = await supabaseClient
            .from('date_status')
            .select('is_active')
            .eq('target_date', date)
            .single();
        
        if (checkError && checkError.code !== 'PGRST116') throw checkError;
        
        const newStatus = existing ? !existing.is_active : false;
        
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
                    is_active: false,
                    reason: reason || null
                }]);
            
            if (insertError) throw insertError;
        }
        
        messageDiv.style.display = 'block';
        messageDiv.style.color = 'green';
        messageDiv.textContent = `✅ Date ${date} is now ${newStatus ? 'ACTIVE' : 'INACTIVE'}${reason ? ' (Reason: ' + reason + ')' : ''}`;
        
        loadAdminCalendarData();
        loadStats();
        
        document.getElementById('closureReason').value = '';
        
    } catch (error) {
        console.error('Error toggling date status:', error);
        messageDiv.style.display = 'block';
        messageDiv.style.color = 'red';
        messageDiv.textContent = '❌ Error: ' + error.message;
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
        
        // Initialize with empty data
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
                // Keep the day number and add a location marker
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
                // No sessions but date is in future
                bgColor = '#f5f5f5';
                textColor = '#999';
                cursor = 'default';
            }
            
            // Store session data back to the cell for click handler
            cell.dataset.sessions = JSON.stringify(sessions);
            cell.dataset.status = JSON.stringify(status);
            
            // Apply styles
            cell.style.backgroundColor = bgColor;
            cell.style.color = textColor;
            cell.style.cursor = cursor;
            
            // Add a small indicator dot for available sessions
            if (hasAvailable && dateStr >= today) {
                const dot = document.createElement('span');
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
    
    // UI state clean up
    if(document.getElementById('adminDateDetails')) document.getElementById('adminDateDetails').classList.add('hidden');
    if(document.getElementById('calendarFallbackPrompt')) document.getElementById('calendarFallbackPrompt').classList.remove('hidden');
    
    renderAdminCalendar();
    // Use setTimeout to ensure DOM is updated
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
    
    // UI state clean up
    if(document.getElementById('adminDateDetails')) document.getElementById('adminDateDetails').classList.add('hidden');
    if(document.getElementById('calendarFallbackPrompt')) document.getElementById('calendarFallbackPrompt').classList.remove('hidden');
    
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
        // Get session data directly from Supabase instead of relying on DOM
        const { data: sessionData, error: sessionError } = await supabaseClient
            .from('available_sessions')
            .select('*')
            .eq('session_date', dateStr);
        
        if (sessionError) throw sessionError;
        
        // Get status data
        const { data: statusData, error: statusError } = await supabaseClient
            .from('date_status')
            .select('*')
            .eq('target_date', dateStr)
            .single();
        
        if (statusError && statusError.code !== 'PGRST116') throw statusError;
        
        const detailsDiv = document.getElementById('adminDateSessions');
        const detailsContainer = document.getElementById('adminDateDetails');
        const fallbackPrompt = document.getElementById('calendarFallbackPrompt');
        
        // Split data into B and B2
        const classBData = sessionData ? sessionData.filter(s => s.class === 'B') : [];
        const classB2Data = sessionData ? sessionData.filter(s => s.class === 'B2') : [];
        
        let html = `
            <div class="p-3 bg-muted rounded-lg border text-sm mb-4">
                <p class="font-medium"><strong>Status:</strong> ${statusData ? (statusData.is_active ? '🟢 Active' : '🔴 Inactive') : '🟢 Active (default)'}</p>
                ${statusData && statusData.reason ? `<p class="mt-1 text-xs text-muted-foreground"><strong>Reason:</strong> ${statusData.reason}</p>` : ''}
                ${statusData && !statusData.is_active ? `<p class="mt-1 text-xs text-destructive font-semibold">⚠️ This date is closed for bookings.</p>` : ''}
            </div>
        `;
        
        // Class B Table
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
        
        // Class B2 Table
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
        
        // Summary Card
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
        
        // Toggle Visibility Classes safely
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
    // Tab contents array list mapping
    const tabs = ['bookings', 'calendar', 'report'];
    
    tabs.forEach(t => {
        const contentDiv = document.getElementById(`tabContent${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const tabBtn = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
        
        if (contentDiv && tabBtn) {
            if (t === tabId) {
                contentDiv.classList.remove('hidden');
                // Set the active component configuration using Basecoat semantics
                tabBtn.setAttribute('data-variant', 'secondary');
                tabBtn.classList.remove('text-muted-foreground');
            } else {
                contentDiv.classList.add('hidden');
                // Set inactive element state variables
                tabBtn.setAttribute('data-variant', 'ghost');
                tabBtn.classList.add('text-muted-foreground');
            }
        }
    });

    // Handle initializations upon rendering specific tabs
    if (tabId === 'calendar') {
        renderAdminCalendar();
        setTimeout(() => {
            loadAdminCalendarData();
        }, 50);
    }
}

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
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Set default date
    document.getElementById('adminDateSelect').value = getMalaysiaToday();
    
    // Check if admin session exists
    if (checkAdminSession()) {
        // Auto-login
        adminLogin.classList.add('hidden');
        adminContent.classList.remove('hidden');
        document.getElementById('adminStatus').textContent = '✅ Admin Logged In';
        document.getElementById('adminStatus').style.color = 'green';
        document.getElementById('logoutBtn').style.display = 'inline-block';
        initializeAdmin();
    } else {
        // Show login
        adminLogin.classList.remove('hidden');
        adminContent.classList.add('hidden');
        // Auto-focus password field
        document.getElementById('adminPassword').focus();
    }
});

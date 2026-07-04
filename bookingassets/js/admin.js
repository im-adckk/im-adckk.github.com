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
    //await loadAllBookings();
    renderAdminCalendar();
    loadAdminCalendarData();
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

// ============================================
// ALL BOOKINGS TABLE WITH DATE FILTERS
// ============================================

// Pagination state
let currentPage = 1;
let rowsPerPage = 10;
let totalPages = 1;
let filteredBookings = [];

async function loadAllBookings() {
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;
    const statusFilter = document.getElementById('filterStatus').value;
    const classFilter = document.getElementById('filterClass').value;
    
    // Validate date range
    if (dateFrom && dateTo && dateFrom > dateTo) {
        showMessage('"From" date must be before "To" date.', 'error');
        return;
    }
    
    // Show loading state
    renderBookingsTable(null, true);
    
    try {
        let query = supabaseClient
            .from('bookings')
            .select('*')
            .order('booking_date', { ascending: false })
            .order('created_at', { ascending: false });
        
        // Apply date filters
        if (dateFrom) {
            query = query.gte('booking_date', dateFrom);
        }
        if (dateTo) {
            query = query.lte('booking_date', dateTo);
        }
        
        // Apply other filters
        if (statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }
        if (classFilter !== 'all') {
            query = query.eq('class', classFilter);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        allBookingsData = data || [];
        filteredBookings = [...allBookingsData];
        
        // Reset to first page when new search is performed
        currentPage = 1;
        
        // Update pagination
        updatePagination();
        
        // Render current page
        renderBookingsTable(getCurrentPageData());
        
        // Update result count
        document.getElementById('resultCount').textContent = 
            `${allBookingsData.length} booking${allBookingsData.length !== 1 ? 's' : ''} found`;
        
    } catch (error) {
        console.error('Error loading bookings:', error);
        showMessage('Error loading bookings: ' + error.message, 'error');
        const tbody = document.getElementById('bookingsTableBody');
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:red;">Error loading bookings. Please try again.</td></tr>';
        document.getElementById('resultCount').textContent = 'Error loading data';
        document.getElementById('paginationControls').style.display = 'none';
    }
}

// Get current page data
function getCurrentPageData() {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredBookings.slice(startIndex, endIndex);
}

// Update pagination controls
function updatePagination() {
    const totalItems = filteredBookings.length;
    totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
    
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    
    const paginationDiv = document.getElementById('paginationControls');
    if (!paginationDiv) return;
    
    // Use classList to show/hide to bypass the !important CSS rule
    if (totalItems <= rowsPerPage) {
        paginationDiv.classList.add('hidden');
        return;
    }
    
    paginationDiv.classList.remove('hidden');
    
    const startItem = (currentPage - 1) * rowsPerPage + 1;
    const endItem = Math.min(currentPage * rowsPerPage, totalItems);
    
    document.getElementById('paginationInfo').textContent = 
        `Showing ${startItem} - ${endItem} of ${totalItems}`;
    
    // Update buttons
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage === totalPages;
    
    // Generate page numbers
    const pageNumbers = document.getElementById('pageNumbers');
    pageNumbers.innerHTML = '';
    
    // Show limited page numbers with ellipsis
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        const firstBtn = createPageButton(1);
        pageNumbers.appendChild(firstBtn);
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.style.margin = '0 5px';
            pageNumbers.appendChild(ellipsis);
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const btn = createPageButton(i);
        if (i === currentPage) {
            btn.classList.add('active'); // Use your CSS .active class definition
            btn.style.background = '#3498db';
            btn.style.color = 'white';
        }
        pageNumbers.appendChild(btn);
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.style.margin = '0 5px';
            pageNumbers.appendChild(ellipsis);
        }
        const lastBtn = createPageButton(totalPages);
        pageNumbers.appendChild(lastBtn);
    }
}
// Create page button
function createPageButton(pageNum) {
    const btn = document.createElement('button');
    btn.className = 'page-btn'; // Assign standard page button styling from your HTML
    btn.textContent = pageNum;
    btn.onclick = () => goToPage(pageNum);
    return btn;
}

// Go to specific page
function goToPage(pageNum) {
    if (pageNum < 1 || pageNum > totalPages) return;
    currentPage = pageNum;
    renderBookingsTable(getCurrentPageData());
    updatePagination();
    
    // Safely check if container exists before triggering scroll view
    const tableContainer = document.getElementById('bookingsTableContainer');
    if (tableContainer) {
        tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Previous page
function prevPage() {
    if (currentPage > 1) {
        goToPage(currentPage - 1);
    }
}

// Next page
function nextPage() {
    if (currentPage < totalPages) {
        goToPage(currentPage + 1);
    }
}

// Change rows per page
function changeRowsPerPage() {
    const select = document.getElementById('rowsPerPageSelect');
    rowsPerPage = parseInt(select.value);
    currentPage = 1;
    updatePagination();
    renderBookingsTable(getCurrentPageData());
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
    
    if (isLoading) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Loading bookings...</td></tr>';
        return;
    }
    
    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No bookings found.</td></tr>';
        return;
    }
    
    let html = '';
    bookings.forEach(booking => {
        // Match the status badge styles defined in your HTML CSS definitions
        const statusClass = booking.status === 'confirmed' ? 'status-confirmed' : 
                            booking.status === 'cancelled' ? 'status-cancelled' : 'status-rescheduled';
        
        html += `
            <tr>
                <td><strong>${booking.session_id || ''}</strong></td>
                <td>${booking.icno || ''}</td>
                <td>${booking.name || ''}</td>
                <td>${booking.contact_no || ''}</td>
                <td><span class="font-bold">${booking.class || ''}</span></td>
                <td>${formatMalaysiaDate(booking.booking_date)}</td>
                <td>${booking.session_time || ''}</td>
                <td>${booking.session_slot || ''}</td>
                <td><span class="status-badge ${statusClass}">${booking.status.toUpperCase()}</span></td>
                <td>${formatDateTime(booking.created_at)}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}
// ============================================
// PDF REPORT GENERATION
// ============================================

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
    progressDiv.style.display = 'block';
    
    try {
        // Fetch filtered bookings
        let query = supabaseClient
            .from('bookings')
            .select('*')
            .gte('booking_date', dateFrom)
            .lte('booking_date', dateTo)
            .order('booking_date', { ascending: true });
        
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
            progressDiv.style.display = 'none';
            return;
        }
        
        // Generate PDF
        await generatePDF(data, dateFrom, dateTo, classFilter, statusFilter);
        
        progressDiv.style.display = 'none';
        showMessage('PDF report generated successfully!', 'success');
        
    } catch (error) {
        console.error('Error generating report:', error);
        showMessage('Error generating report: ' + error.message, 'error');
        progressDiv.style.display = 'none';
    }
}

async function generateDailyReport() {
    const today = getMalaysiaToday();
    document.getElementById('reportDateFrom').value = today;
    document.getElementById('reportDateTo').value = today;
    await generatePDFReport();
}

async function generatePDF(data, dateFrom, dateTo, classFilter, statusFilter) {
    // Create report content
    const reportContent = document.createElement('div');
    reportContent.id = 'reportContent';
    reportContent.style.cssText = 'padding:40px;font-family:Arial,sans-serif;background:white;';
    
    // Header
    const classLabel = classFilter === 'all' ? 'All Classes' : 'Class ' + classFilter;
    const statusLabel = statusFilter === 'all' ? 'All Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);
    
    reportContent.innerHTML = `
        <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:20px;margin-bottom:20px;">
            <h1 style="margin:0;color:#2c3e50;">🏍️ Motorcycle Booking Report</h1>
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
            <div style="padding:15px;border:1px solid #ddd;border-radius:4px;text-align:center;">
                <h3 style="margin:0;color:#2c3e50;">${data.length}</h3>
                <p style="margin:5px 0 0;color:#7f8c8d;font-size:12px;">Total Bookings</p>
            </div>
            <div style="padding:15px;border:1px solid #ddd;border-radius:4px;text-align:center;">
                <h3 style="margin:0;color:#27ae60;">${data.filter(b => b.status === 'confirmed').length}</h3>
                <p style="margin:5px 0 0;color:#7f8c8d;font-size:12px;">Confirmed</p>
            </div>
            <div style="padding:15px;border:1px solid #ddd;border-radius:4px;text-align:center;">
                <h3 style="margin:0;color:#e74c3c;">${data.filter(b => b.status === 'cancelled').length}</h3>
                <p style="margin:5px 0 0;color:#7f8c8d;font-size:12px;">Cancelled</p>
            </div>
            // <div style="padding:15px;border:1px solid #ddd;border-radius:4px;text-align:center;">
            //     <h3 style="margin:0;color:#f39c12;">${data.filter(b => b.status === 'rescheduled').length}</h3>
            //     <p style="margin:5px 0 0;color:#7f8c8d;font-size:12px;">Rescheduled</p>
            // </div>
        </div>
        
        <h3 style="color:#2c3e50;border-bottom:1px solid #ddd;padding-bottom:10px;">Booking Details</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
                <tr style="background:#34495e;color:white;">
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
                    <tr style="${index % 2 === 0 ? 'background:#f8f9fa;' : ''}">
                        <td style="padding:6px;border:1px solid #ddd;">${b.session_id}</td>
                        <td style="padding:6px;border:1px solid #ddd;">${b.name}</td>
                        <td style="padding:6px;border:1px solid #ddd;">${b.class}</td>
                        <td style="padding:6px;border:1px solid #ddd;">${formatMalaysiaDate(b.booking_date)}</td>
                        <td style="padding:6px;border:1px solid #ddd;">${b.session_time}</td>
                        <td style="padding:6px;border:1px solid #ddd;">${b.session_slot}</td>
                        <td style="padding:6px;border:1px solid #ddd;color:${b.status === 'confirmed' ? 'green' : b.status === 'cancelled' ? 'red' : 'orange'};">
                            ${b.status.toUpperCase()}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div style="margin-top:30px;padding-top:20px;border-top:1px solid #ddd;font-size:11px;color:#95a5a6;text-align:center;">
            <p>This report is auto-generated by the Motorcycle Booking System.</p>
            <p>© ${new Date().getFullYear()} - All rights reserved.</p>
        </div>
    `;
    
    // Add to body temporarily
    document.body.appendChild(reportContent);
    
    // Generate PDF
    const opt = {
        margin: [10, 10, 10, 10],
        filename: `booking_report_${dateFrom}_to_${dateTo}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    
    await html2pdf().set(opt).from(reportContent).save();
    
    // Clean up
    document.body.removeChild(reportContent);
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
        div.style.fontWeight = 'bold';
        div.style.textAlign = 'center';
        div.style.padding = '5px';
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
        div.style.padding = '10px 5px';
        div.style.textAlign = 'center';
        div.style.border = '1px solid #ddd';
        div.style.cursor = 'pointer';
        div.style.borderRadius = '4px';
        div.dataset.date = dateStr;
        div.style.backgroundColor = '#f5f5f5';
        div.style.color = '#999';
        
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
            }
            
            cell.style.backgroundColor = bgColor;
            cell.style.color = textColor;
            cell.style.cursor = cursor;
            
            cell.dataset.sessions = JSON.stringify(sessions);
            cell.dataset.status = JSON.stringify(status);
        });
        
    } catch (error) {
        console.error('Error loading calendar data:', error);
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
    document.getElementById('adminDateDetails').style.display = 'none';
    renderAdminCalendar();
    loadAdminCalendarData();
}

function goToAdminToday() {
    const today = getMalaysiaToday();
    const date = new Date(today + 'T00:00:00');
    adminMonth = date.getMonth();
    adminYear = date.getFullYear();
    selectedAdminDate = null;
    document.getElementById('adminDateDetails').style.display = 'none';
    renderAdminCalendar();
    loadAdminCalendarData();
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
        const { data, error } = await supabaseClient
            .rpc('get_available_sessions_for_date', {
                check_date: dateStr,
                class_filter: null
            });
        
        if (error) throw error;
        
        // Sort sessions: morning first, then afternoon
        if (data) {
            const timeOrder = { '9am-12pm': 1, '12pm-3pm': 2 };
            const slotOrder = { 'sesi1': 1, 'sesi2': 2, 'sesi3': 3 };
            
            data.sort((a, b) => {
                const timeDiff = (timeOrder[a.session_time] || 99) - (timeOrder[b.session_time] || 99);
                if (timeDiff !== 0) return timeDiff;
                return (slotOrder[a.session_slot] || 99) - (slotOrder[b.session_slot] || 99);
            });
        }
        
        const { data: status, error: statusError } = await supabaseClient
            .from('date_status')
            .select('*')
            .eq('target_date', dateStr)
            .single();
        
        if (statusError && statusError.code !== 'PGRST116') throw statusError;
        
        const detailsDiv = document.getElementById('adminDateSessions');
        const detailsContainer = document.getElementById('adminDateDetails');
        
        // Split data into B and B2
        const classBData = data ? data.filter(s => s.class === 'B') : [];
        const classB2Data = data ? data.filter(s => s.class === 'B2') : [];
        
        let html = `
            <div style="margin:10px 0;padding:10px;background:#f8f9fa;border-radius:4px;">
                <p><strong>Status:</strong> ${status ? (status.is_active ? '🟢 Active' : '🔴 Inactive') : '🟢 Active (default)'}</p>
                ${status && status.reason ? `<p><strong>Reason:</strong> ${status.reason}</p>` : ''}
                ${status && !status.is_active ? `<p style="color:red;">⚠️ This date is closed for bookings.</p>` : ''}
            </div>
        `;
        
        // Class B Table
        html += `
            <div style="margin:15px 0;">
                <h4 style="color:#2c3e50;border-bottom:2px solid #3498db;padding-bottom:5px;">🏍️ Class B (Quota: 5)</h4>
                ${classBData.length > 0 ? `
                    <table border="1" cellpadding="8" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:5px;font-size:13px;">
                        <thead>
                            <tr style="background:#3498db;color:white;">
                                <th>Time</th>
                                <th>Slot</th>
                                <th>Booked</th>
                                <th>Capacity</th>
                                <th>Available</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${classBData.map(s => `
                                <tr>
                                    <td><strong>${s.session_time}</strong></td>
                                    <td>${s.session_slot}</td>
                                    <td>${s.current_bookings}</td>
                                    <td>${s.max_bookings}</td>
                                    <td style="color:${s.available_slots > 0 ? 'green' : 'red'};font-weight:bold;">
                                        ${s.available_slots > 0 ? '✅ ' + s.available_slots : '❌ Full'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p style="color:#999;font-style:italic;">No Class B sessions available for this date.</p>'}
            </div>
        `;
        
        // Class B2 Table
        html += `
            <div style="margin:15px 0;">
                <h4 style="color:#2c3e50;border-bottom:2px solid #e67e22;padding-bottom:5px;">🏍️ Class B2 (Quota: 15)</h4>
                ${classB2Data.length > 0 ? `
                    <table border="1" cellpadding="8" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:5px;font-size:13px;">
                        <thead>
                            <tr style="background:#e67e22;color:white;">
                                <th>Time</th>
                                <th>Slot</th>
                                <th>Booked</th>
                                <th>Capacity</th>
                                <th>Available</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${classB2Data.map(s => `
                                <tr>
                                    <td><strong>${s.session_time}</strong></td>
                                    <td>${s.session_slot}</td>
                                    <td>${s.current_bookings}</td>
                                    <td>${s.max_bookings}</td>
                                    <td style="color:${s.available_slots > 0 ? 'green' : 'red'};font-weight:bold;">
                                        ${s.available_slots > 0 ? '✅ ' + s.available_slots : '❌ Full'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p style="color:#999;font-style:italic;">No Class B2 sessions available for this date.</p>'}
            </div>
        `;
        
        // Summary
        const totalB = classBData.reduce((sum, s) => sum + s.available_slots, 0);
        const totalB2 = classB2Data.reduce((sum, s) => sum + s.available_slots, 0);
        const totalAvailable = totalB + totalB2;
        
        html += `
            <div style="margin-top:15px;padding:10px;background:#f8f9fa;border-radius:4px;border:1px solid #ddd;">
                <p style="margin:0;">
                    <strong>Summary:</strong> 
                    Class B: ${totalB > 0 ? '✅ ' + totalB + ' slots available' : '❌ Fully Booked'} | 
                    Class B2: ${totalB2 > 0 ? '✅ ' + totalB2 + ' slots available' : '❌ Fully Booked'} | 
                    <strong>Total Available: ${totalAvailable}</strong>
                </p>
            </div>
        `;
        
        detailsDiv.innerHTML = html;
        detailsContainer.style.display = 'block';
        
        document.getElementById('adminDateSelect').value = dateStr;
        
    } catch (error) {
        console.error('Error loading date details:', error);
        showMessage('Error loading date details: ' + error.message, 'error');
    }
}

// ============================================
// TABS
// ============================================

function showTab(tab) {
    const tabBookings = document.getElementById('tabBookings');
    const tabCalendar = document.getElementById('tabCalendar');
    const tabReport = document.getElementById('tabReport');
    const contentBookings = document.getElementById('tabContentBookings');
    const contentCalendar = document.getElementById('tabContentCalendar');
    const contentReport = document.getElementById('tabContentReport');
    
    // Reset all tabs
    const tabs = [tabBookings, tabCalendar, tabReport];
    const contents = [contentBookings, contentCalendar, contentReport];
    
    tabs.forEach(t => {
        t.style.background = '#95a5a6';
        t.style.color = 'white';
    });
    contents.forEach(c => c.classList.add('hidden'));
    
    // Show selected tab
    if (tab === 'bookings') {
        tabBookings.style.background = '#3498db';
        contentBookings.classList.remove('hidden');
        loadAllBookings();
    } else if (tab === 'calendar') {
        tabCalendar.style.background = '#3498db';
        contentCalendar.classList.remove('hidden');
        renderAdminCalendar();
        loadAdminCalendarData();
    } else if (tab === 'report') {
        tabReport.style.background = '#3498db';
        contentReport.classList.remove('hidden');
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
    messageDiv.style.display = 'block';
    messageDiv.textContent = text;
    messageDiv.style.border = '1px solid #ccc';
    
    if (type === 'error') {
        messageDiv.style.color = 'red';
        messageDiv.style.borderColor = 'red';
        messageDiv.style.backgroundColor = '#ffeeee';
    } else if (type === 'success') {
        messageDiv.style.color = 'green';
        messageDiv.style.borderColor = 'green';
        messageDiv.style.backgroundColor = '#eeffee';
    } else {
        messageDiv.style.color = '#333';
        messageDiv.style.borderColor = '#ccc';
        messageDiv.style.backgroundColor = '#f5f5f5';
    }
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

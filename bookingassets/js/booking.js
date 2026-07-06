// Supabase Configuration
const SUPABASE_URL = 'https://yrrinzreyafiowehhhon.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4MnAXo4yxHMQX7fSn7hQjA_qV2X7t7o';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State variables
let selectedClass = '';
let currentMonth = 0;
let currentYear = 0;
let selectedDate = null;
let selectedSession = null;
let availableSessionsData = [];
let bookingData = {};
let hasDayDuplicate = false; // NEW: Track duplicate state

// DOM Elements
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const step4 = document.getElementById('step4');
const step5 = document.getElementById('step5');
const classForm = document.getElementById('classForm');
const detailsForm = document.getElementById('detailsForm');
const messageDiv = document.getElementById('message');
const messageIcon = document.getElementById('messageIcon');
const messageText = document.getElementById('messageText');

// ============================================
// ICON HELPER
// ============================================
// Re-scans the DOM for [data-lucide] and renders any new/updated icons.
// Safe to call as often as needed after innerHTML changes.
function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

// ============================================
// STEP NAVIGATION + PROGRESS INDICATOR
// ============================================
const STEPS = [step1, step2, step3, step4, step5];

function showStep(stepNumber) {
    STEPS.forEach((el, i) => {
        el.classList.toggle('hidden', i !== stepNumber - 1);
    });
    updateStepIndicator(stepNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateStepIndicator(stepNumber) {
    document.querySelectorAll('.step-dot').forEach(dot => {
        const n = parseInt(dot.dataset.step, 10);
        dot.classList.remove('bg-primary', 'text-primary-foreground', 'bg-muted', 'text-muted-foreground', 'ring-4', 'ring-primary/30');
        dot.innerHTML = '';
        if (n < stepNumber) {
            dot.classList.add('bg-primary', 'text-primary-foreground');
            dot.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i>';
        } else if (n === stepNumber) {
            dot.classList.add('bg-primary', 'text-primary-foreground', 'ring-4', 'ring-primary/30');
            dot.textContent = n;
        } else {
            dot.classList.add('bg-muted', 'text-muted-foreground');
            dot.textContent = n;
        }
    });
    document.querySelectorAll('[data-line]').forEach(line => {
        const n = parseInt(line.dataset.line, 10);
        line.classList.toggle('bg-primary', n < stepNumber);
        line.classList.toggle('bg-muted', n >= stepNumber);
    });
    refreshIcons();
}

// ============================================
// TIMEZONE HELPER FUNCTIONS (Malaysia UTC+8)
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

function getMalaysiaMonthYear() {
    const today = getMalaysiaToday();
    const date = new Date(today + 'T00:00:00');
    return {
        month: date.getMonth(),
        year: date.getFullYear()
    };
}

// ============================================
// INITIALIZE MONTH/YEAR
// ============================================
function initMonthYear() {
    const { month, year } = getMalaysiaMonthYear();
    currentMonth = month;
    currentYear = year;
}

// ============================================
// CALENDAR CELL STYLING (class-based, no inline styles)
// ============================================
const CAL_BASE = 'cal-cell';

const CAL_STATE_CLASSES = {
    past:      'bg-muted/60 text-muted-foreground/60 cursor-not-allowed',
    inactive:  'bg-muted text-muted-foreground cursor-not-allowed',
    available: 'bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer shadow-sm',
    full:      'bg-red-500 text-white cursor-not-allowed',
    none:      'bg-muted text-muted-foreground cursor-not-allowed',
    selected:  'bg-blue-600 text-white ring-2 ring-offset-1 ring-blue-700 cursor-pointer shadow-md'
};

function setCellState(cell, state) {
    cell.className = `${CAL_BASE} ${CAL_STATE_CLASSES[state] || CAL_STATE_CLASSES.none}`;
}

// ============================================
// STEP 1: Class Selection
// ============================================
classForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    selectedClass = document.querySelector('input[name="class"]:checked').value;
    document.getElementById('selectedClassDisplay').innerHTML =
        `<span class="badge" data-variant="secondary">Selected Class: ${selectedClass}</span>`;

    showStep(2);

    renderCalendar();
    await checkAvailabilityForMonth();
});

// ============================================
// STEP 2: Calendar
// ============================================
function renderCalendar() {
    const calendar = document.getElementById('calendar');
    const monthDisplay = document.getElementById('currentMonthDisplay');

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const todayStr = getMalaysiaToday();

    monthDisplay.textContent = new Date(currentYear, currentMonth).toLocaleDateString('en-MY', {
        month: 'long',
        year: 'numeric'
    });

    calendar.innerHTML = '';

    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        const div = document.createElement('div');
        div.textContent = day;
        div.className = 'cal-head';
        calendar.appendChild(div);
    });

    // Empty cells for days before first day
    for (let i = 0; i < firstDay; i++) {
        const div = document.createElement('div');
        calendar.appendChild(div);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(currentYear, currentMonth, day);
        const dateStr = toMalaysiaDateStr(dateObj);
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.dataset.date = dateStr;
        
        // Check if this is today
        if (dateStr === todayStr) {
            // Add a small indicator for today
            cell.innerHTML = `${day} <span class="text-[8px] font-bold text-amber-500 ml-0.5">●</span>`;
            cell.title = 'Today';
        } else {
            cell.textContent = day;
        }

        if (dateStr < todayStr) {
            setCellState(cell, 'past');
            cell.title = dateStr === todayStr ? 'Today - cannot book' : '';
        } else if (dateStr === todayStr) {
            // Today: rendered with a small dot indicator
            setCellState(cell, 'past');
            cell.title = 'Today - cannot book';
        } else {
            setCellState(cell, 'none');
        }

        cell.addEventListener('click', () => onDateClick(dateStr));
        calendar.appendChild(cell);
    }

    refreshIcons();
}

// ============================================
// UPDATE TODAY INDICATOR
// ============================================

function updateTodayIndicator() {
    const todayDisplay = document.getElementById('todayDateDisplay');
    if (todayDisplay) {
        const today = new Date();
        const options = { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        };
        todayDisplay.textContent = today.toLocaleDateString('en-MY', options);
    }
}

// Call this on page load
document.addEventListener('DOMContentLoaded', () => {
    initMonthYear();
    showStep(1);
    updateTodayIndicator(); // Add this line

    const icnoInput = document.getElementById('icno');
    if (icnoInput) {
        icnoInput.addEventListener('blur', checkDayDuplicate);
        icnoInput.addEventListener('input', () => {
            document.getElementById('dayDuplicateWarning').innerHTML = '';
        });
    }

    refreshIcons();
});

// ============================================
// UPDATE TODAY INDICATOR
// ============================================

function updateTodayIndicator() {
    const todayDisplay = document.getElementById('todayDateDisplay');
    if (todayDisplay) {
        const today = new Date();
        const options = { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        };
        todayDisplay.textContent = today.toLocaleDateString('en-MY', options);
    }
}

// Call this on page load
document.addEventListener('DOMContentLoaded', () => {
    initMonthYear();
    showStep(1);
    updateTodayIndicator(); // Add this line

    const icnoInput = document.getElementById('icno');
    if (icnoInput) {
        icnoInput.addEventListener('blur', checkDayDuplicate);
        icnoInput.addEventListener('input', () => {
            document.getElementById('dayDuplicateWarning').innerHTML = '';
        });
    }

    refreshIcons();
});

async function checkAvailabilityForMonth() {
    const year = currentYear;
    const month = currentMonth;
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const startDateStr = toMalaysiaDateStr(startDate);
    const endDateStr = toMalaysiaDateStr(endDate);
    const todayStr = getMalaysiaToday();

    try {
        // Get sessions
        const { data: sessions, error: sessionsError } = await supabaseClient
            .from('available_sessions')
            .select('*')
            .eq('class', selectedClass)
            .gte('session_date', startDateStr)
            .lte('session_date', endDateStr)
            .gte('session_date', todayStr);

        if (sessionsError) throw sessionsError;

        // Get date statuses (inactive dates)
        const { data: statuses, error: statusError } = await supabaseClient
            .from('date_status')
            .select('target_date, is_active, reason')
            .gte('target_date', startDateStr)
            .lte('target_date', endDateStr);

        if (statusError) throw statusError;

        // Build maps
        const sessionMap = {};
        sessions.forEach(session => {
            if (!sessionMap[session.session_date]) {
                sessionMap[session.session_date] = [];
            }
            sessionMap[session.session_date].push(session);
        });

        const statusMap = {};
        statuses.forEach(status => {
            statusMap[status.target_date] = status;
        });

        // Update calendar cells
        const cells = document.querySelectorAll('#calendar button[data-date]');
        cells.forEach(cell => {
            const dateStr = cell.dataset.date;

            // Skip past dates and today
            if (dateStr < todayStr || dateStr === todayStr) return;

            const sessions = sessionMap[dateStr] || [];
            const status = statusMap[dateStr];

            // Check if date is inactive
            const isInactive = status ? !status.is_active : false;

            // If inactive, show muted
            if (isInactive) {
                setCellState(cell, 'inactive');
                cell.title = status.reason || 'Date is closed for bookings';
                return;
            }

            // Check if any sessions have available slots
            const hasAvailable = sessions.some(s => s.current_bookings < s.max_bookings);

            if (hasAvailable) {
                setCellState(cell, 'available');
                cell.title = 'Available';
            } else if (sessions.length > 0) {
                setCellState(cell, 'full');
                cell.title = 'Fully Booked';
            } else {
                setCellState(cell, 'none');
                cell.title = 'No sessions available';
            }
        });

    } catch (error) {
        console.error('Error checking availability:', error);
    }
}

async function resetCalendarColors() {
    const todayStr = getMalaysiaToday();
    const cells = document.querySelectorAll('#calendar button[data-date]');

    const year = currentYear;
    const month = currentMonth;
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const startDateStr = toMalaysiaDateStr(startDate);
    const endDateStr = toMalaysiaDateStr(endDate);

    try {
        // Get sessions
        const { data: sessions, error: sessionsError } = await supabaseClient
            .from('available_sessions')
            .select('*')
            .eq('class', selectedClass)
            .gte('session_date', startDateStr)
            .lte('session_date', endDateStr)
            .gte('session_date', todayStr);

        if (sessionsError) throw sessionsError;

        // Get date statuses
        const { data: statuses, error: statusError } = await supabaseClient
            .from('date_status')
            .select('target_date, is_active, reason')
            .gte('target_date', startDateStr)
            .lte('target_date', endDateStr);

        if (statusError) throw statusError;

        const sessionMap = {};
        sessions.forEach(session => {
            if (!sessionMap[session.session_date]) {
                sessionMap[session.session_date] = [];
            }
            sessionMap[session.session_date].push(session);
        });

        const statusMap = {};
        statuses.forEach(status => {
            statusMap[status.target_date] = status;
        });

        cells.forEach(cell => {
            const dateStr = cell.dataset.date;

            // Skip if this is the currently selected date
            if (dateStr === selectedDate) return;

            if (dateStr < todayStr) {
                setCellState(cell, 'past');
                cell.title = '';
            }
            else if (dateStr === todayStr) {
                // Today: same muted look as any other non-bookable day, no label.
                setCellState(cell, 'past');
                cell.title = 'Today - cannot book';
            }
            else {
                const sessions = sessionMap[dateStr] || [];
                const status = statusMap[dateStr];
                const isInactive = status ? !status.is_active : false;

                if (isInactive) {
                    setCellState(cell, 'inactive');
                    cell.title = status.reason || 'Date is closed for bookings';
                } else {
                    const hasAvailable = sessions.some(s => s.current_bookings < s.max_bookings);

                    if (hasAvailable) {
                        setCellState(cell, 'available');
                        cell.title = 'Available';
                    } else if (sessions.length > 0) {
                        setCellState(cell, 'full');
                        cell.title = 'Fully Booked';
                    } else {
                        setCellState(cell, 'none');
                        cell.title = 'No sessions available';
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error resetting calendar colors:', error);
    }
}

function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    selectedDate = null;
    selectedSession = null;
    document.getElementById('selectedDateDisplay').textContent = '';
    document.getElementById('sessionsContainer').classList.add('hidden');
    document.getElementById('nextToDetailsBtn').classList.add('hidden');
    renderCalendar();
    checkAvailabilityForMonth();
}

function goToToday() {
    const { month, year } = getMalaysiaMonthYear();
    currentMonth = month;
    currentYear = year;
    selectedDate = null;
    selectedSession = null;
    document.getElementById('selectedDateDisplay').textContent = '';
    document.getElementById('sessionsContainer').classList.add('hidden');
    document.getElementById('nextToDetailsBtn').classList.add('hidden');
    renderCalendar();
    checkAvailabilityForMonth();
}

async function onDateClick(dateStr) {
    const todayStr = getMalaysiaToday();

    if (dateStr < todayStr) {
        showMessage('Cannot select past dates.', 'error');
        return;
    }
    if (dateStr === todayStr) {
        showMessage('Cannot book for today. Please select a future date.', 'error');
        return;
    }

    // Check if date is inactive
    try {
        const { data: status, error } = await supabaseClient
            .from('date_status')
            .select('is_active, reason')
            .eq('target_date', dateStr)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        // If date is explicitly set to inactive
        if (status && !status.is_active) {
            const reason = status.reason ? ` (Reason: ${status.reason})` : '';
            showMessage(`This date is closed for bookings.${reason}`, 'error');
            return;
        }
    } catch (error) {
        console.error('Error checking date status:', error);
        // Continue anyway - don't block if there's an error
    }

    // If clicking the same date, deselect it
    if (selectedDate === dateStr) {
        selectedDate = null;
        selectedSession = null;
        document.getElementById('selectedDateDisplay').textContent = '';
        document.getElementById('sessionsContainer').classList.add('hidden');
        document.getElementById('nextToDetailsBtn').classList.add('hidden');
        await resetCalendarColors();
        return;
    }

    selectedDate = dateStr;
    document.getElementById('selectedDateDisplay').innerHTML =
        `<span class="badge" data-variant="outline">Selected Date: ${formatMalaysiaDate(dateStr)}</span>`;

    await resetCalendarColors();

    const cells = document.querySelectorAll('#calendar button[data-date]');
    cells.forEach(cell => {
        if (cell.dataset.date === dateStr) {
            setCellState(cell, 'selected');
        }
    });

    await loadSessionsForDate(dateStr);
}

async function loadSessionsForDate(dateStr) {
    try {
        const { data, error } = await supabaseClient
            .rpc('get_available_sessions_for_date', {
                check_date: dateStr,
                class_filter: selectedClass
            });

        if (error) throw error;

        // Sort sessions: morning first, then afternoon
        if (data) {
            const timeOrder = { '9am-12pm': 1, '12pm-3pm': 2 };
            const slotOrder = { 'sesi1': 1, 'sesi2': 2, 'sesi3': 3 };

            data.sort((a, b) => {
                // First by time
                const timeDiff = (timeOrder[a.session_time] || 99) - (timeOrder[b.session_time] || 99);
                if (timeDiff !== 0) return timeDiff;
                // Then by slot
                return (slotOrder[a.session_slot] || 99) - (slotOrder[b.session_slot] || 99);
            });
        }

        availableSessionsData = data || [];

        const sessionsContainer = document.getElementById('sessionsContainer');
        const sessionsList = document.getElementById('sessionsList');
        const nextBtn = document.getElementById('nextToDetailsBtn');

        if (!data || data.length === 0) {
            sessionsList.innerHTML = `
                <div class="alert" data-variant="destructive">
                    <i data-lucide="circle-alert" class="w-4 h-4"></i>
                    <span class="text-sm">No sessions available for this date.</span>
                </div>`;
            sessionsContainer.classList.remove('hidden');
            nextBtn.classList.add('hidden');
            refreshIcons();
            return;
        }

        let html = '';
        data.forEach((session, index) => {
            const available = session.max_bookings - session.current_bookings;
            const isSelected = selectedSession === index;
            html += `
                <button type="button"
                    class="w-full text-left rounded-lg border p-3 flex items-center gap-3 transition-colors ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-card hover:bg-muted/50'}"
                    onclick="selectSession(${index})">
                    <span class="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <i data-lucide="clock" class="w-4 h-4"></i>
                    </span>
                    <span class="flex-1">
                        <span class="block text-sm font-medium">${session.session_time}</span>
                        <span class="block text-xs text-muted-foreground">${session.session_slot}</span>
                    </span>
                    <span class="badge" data-variant="secondary">${available} left</span>
                </button>
            `;
        });

        sessionsList.innerHTML = html;
        sessionsContainer.classList.remove('hidden');
        nextBtn.classList.add('hidden');
        selectedSession = null;
        refreshIcons();

        showMessage('Select a session time to continue.', 'info');

    } catch (error) {
        console.error('Error loading sessions:', error);
        showMessage('Error loading sessions. Please try again.', 'error');
    }
}

function selectSession(index) {
    selectedSession = index;
    const sessionsList = document.getElementById('sessionsList');
    const items = sessionsList.querySelectorAll('button');

    items.forEach((item, i) => {
        if (i === index) {
            item.className = 'w-full text-left rounded-lg border p-3 flex items-center gap-3 transition-colors border-primary bg-primary/5 ring-1 ring-primary';
        } else {
            item.className = 'w-full text-left rounded-lg border p-3 flex items-center gap-3 transition-colors border-border bg-card hover:bg-muted/50';
        }
    });

    document.getElementById('nextToDetailsBtn').classList.remove('hidden');
    showMessage('Session selected. Tap "Next" to enter your details.', 'success');
}

function goToStep3() {
    if (selectedSession === null) {
        showMessage('Please select a session first.', 'error');
        return;
    }

    showStep(3);
}

function goBackStep1() {
    hasDayDuplicate = false; // NEW: Reset flag when going back
    document.getElementById('dayDuplicateWarning').innerHTML = '';
    showStep(1);
}

function goBackStep2() {
    hasDayDuplicate = false; // NEW: Reset flag when going back
    document.getElementById('dayDuplicateWarning').innerHTML = '';
    showStep(2);
}

// ============================================
// STEP 3: Student Details
// ============================================
detailsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    goToStep4();
});

function goToStep4() {
    const icno = document.getElementById('icno').value.trim();
    const name = document.getElementById('name').value.trim();
    const contact = document.getElementById('contact').value.trim();
    
    // Validate lesson selection
    if (!validateLesson()) {
        return;
    }

    if (!icno || icno.length < 8) {
        showMessage('Please enter a valid IC or Passport number.', 'error');
        return;
    }

    if (!name || name.length < 3) {
        showMessage('Please enter your full name (minimum 3 characters).', 'error');
        return;
    }

    if (!contact || contact.length < 10) {
        showMessage('Please enter a valid contact number.', 'error');
        return;
    }

    // Check if there's a duplicate before proceeding
    if (hasDayDuplicate) {
        showMessage('⚠️ You cannot proceed with a duplicate booking. Please cancel your existing booking first.', 'error');
        return;
    }

    const fullLesson = getFullLesson();

    bookingData = {
        icno: icno,
        name: name,
        contact: contact,
        class: selectedClass,
        date: selectedDate,
        session: availableSessionsData[selectedSession],
        lesson: fullLesson  // Add the lesson
    };

    const summary = document.getElementById('bookingSummary');
    summary.innerHTML = buildSummaryRows([
        { icon: 'bike', label: 'Class', value: bookingData.class },
        { icon: 'calendar', label: 'Date', value: formatMalaysiaDate(bookingData.date) },
        { icon: 'clock', label: 'Session', value: `${bookingData.session.session_time} - ${bookingData.session.session_slot}` },
        { icon: 'book-open', label: 'Lesson', value: bookingData.lesson },  // Add lesson
        { icon: 'user', label: 'Name', value: bookingData.name },
        { icon: 'id-card', label: 'IC/Passport', value: bookingData.icno },
        { icon: 'phone', label: 'Contact', value: bookingData.contact }
    ]);
    refreshIcons();

    showStep(4);
}

function buildSummaryRows(rows) {
    return `
        <dl class="divide-y divide-border rounded-lg border">
            ${rows.map(r => `
                <div class="flex items-center gap-3 p-3">
                    <span class="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <i data-lucide="${r.icon}" class="w-4 h-4"></i>
                    </span>
                    <div class="flex-1 min-w-0">
                        <dt class="text-xs text-muted-foreground">${r.label}</dt>
                        <dd class="text-sm font-medium break-words">${r.value}</dd>
                    </div>
                </div>
            `).join('')}
        </dl>
    `;
}

function goBackStep3() {
    showStep(3);
}

// ============================================
// STEP 4: Submit Booking
// ============================================

function showConfirmDialog() {
    // Populate dialog with booking data
    document.getElementById('confirmClass').textContent = bookingData.class;
    document.getElementById('confirmDate').textContent = formatMalaysiaDate(bookingData.date);
    document.getElementById('confirmSession').textContent = `${bookingData.session.session_time} - ${bookingData.session.session_slot}`;
    document.getElementById('confirmLesson').textContent = bookingData.lesson; 
    document.getElementById('confirmName').textContent = bookingData.name;
    document.getElementById('confirmIC').textContent = bookingData.icno;
    document.getElementById('confirmContact').textContent = bookingData.contact;
    
    // Show dialog
    document.getElementById('confirmDialog').classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
    refreshIcons();
}

// Close confirmation dialog
function closeConfirmDialog() {
    document.getElementById('confirmDialog').classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
}

function submitBooking() {
    // Validate that we have all required data
    if (!bookingData || !bookingData.class || !bookingData.date || !bookingData.session || !bookingData.name) {
        showMessage('Missing booking information. Please go back and check your details.', 'error');
        return;
    }
    
    // Show confirmation dialog
    showConfirmDialog();
}

// Confirm booking (called from dialog)
async function confirmBooking() {
    closeConfirmDialog();
    
    // Disable confirm button to prevent double submission
    const confirmBtn = document.querySelector('#step4 button[onclick="submitBooking()"]');
    const originalHTML = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<i data-lucide="loader-circle" class="w-4 h-4 animate-spin"></i> Processing...';
    confirmBtn.disabled = true;
    refreshIcons();

    try {
        showMessage('Checking for duplicate bookings...', 'info');

        // Check for duplicates (including same day)
        const { data: duplicateCheck, error: dupError } = await supabaseClient
            .rpc('check_duplicate_booking', {
                p_icno: bookingData.icno,
                p_booking_date: bookingData.date,
                p_session_time: bookingData.session.session_time,
                p_session_slot: bookingData.session.session_slot,
                p_class: bookingData.class
            });

        if (dupError) throw dupError;

        // If duplicate found, show detailed message
        if (duplicateCheck && duplicateCheck.is_duplicate) {
            let message = duplicateCheck.message;

            // Add extra guidance for same-day duplicates
            if (duplicateCheck.existing_session_time !== bookingData.session.session_time ||
                duplicateCheck.existing_session_slot !== bookingData.session.session_slot) {
                message += '\n\n💡 Tip: You can only have ONE booking per day. To book a different session, first cancel your existing booking using the Session ID above.';
            } else {
                message += '\n\n💡 Tip: You are trying to book the exact same session. Please check your existing booking.';
            }

            showMessage(message, 'error');

            // Show the existing booking details for reference
            showExistingBooking(duplicateCheck);

            confirmBtn.innerHTML = originalHTML;
            confirmBtn.disabled = false;
            refreshIcons();
            return;
        }

        // Proceed with booking creation
        showMessage('Creating booking...', 'info');

        const { data: booking, error: createError } = await supabaseClient
            .from('bookings')
            .insert([{
                icno: bookingData.icno,
                name: bookingData.name,
                contact_no: bookingData.contact,
                class: bookingData.class,
                booking_date: bookingData.date,
                session_time: bookingData.session.session_time,
                session_slot: bookingData.session.session_slot,
                lesson: bookingData.lesson,
                status: 'confirmed'
            }])
            .select('session_id')
            .single();

        if (createError) {
            // Check if it's a duplicate error from the database
            if (createError.code === '23505') { // Unique violation
                showMessage('This booking already exists. Please check your bookings.', 'error');
                confirmBtn.innerHTML = originalHTML;
                confirmBtn.disabled = false;
                refreshIcons();
                return;
            }
            throw createError;
        }

        // Show confirmation
        showConfirmation(booking.session_id);

    } catch (error) {
        console.error('Booking error:', error);
        showMessage('Error creating booking: ' + error.message, 'error');
        confirmBtn.innerHTML = originalHTML;
        confirmBtn.disabled = false;
        refreshIcons();
    }
}
// Show existing booking details when duplicate found
function showExistingBooking(duplicateCheck) {
    const summary = document.getElementById('bookingSummary');
    const existingHTML = `
        <div class="mt-4 rounded-lg border-2 border-red-300 bg-red-50 p-4 space-y-2">
            <h4 class="flex items-center gap-1.5 text-sm font-semibold text-red-700">
                <i data-lucide="circle-alert" class="w-4 h-4"></i>
                Existing Booking Found
            </h4>
            <dl class="text-sm space-y-1.5">
                <div class="flex justify-between gap-2"><dt class="text-red-700/80">Session ID</dt><dd class="font-semibold">${duplicateCheck.existing_session_id}</dd></div>
                <div class="flex justify-between gap-2"><dt class="text-red-700/80">Session Time</dt><dd>${duplicateCheck.existing_session_time}</dd></div>
                <div class="flex justify-between gap-2"><dt class="text-red-700/80">Session Slot</dt><dd>${duplicateCheck.existing_session_slot}</dd></div>
            </dl>
            <p class="text-xs text-red-700 pt-1 border-t border-red-200">
                <strong>Cancel this booking first.</strong> Go to
                <a href="manage-booking.html" target="_blank" class="underline font-medium">Manage My Bookings</a>
                and use the Session ID above to cancel.
            </p>
        </div>
    `;

    // Insert the existing booking info below the summary
    summary.innerHTML += existingHTML;
    refreshIcons();
}

async function checkDayDuplicate() {
    const icno = document.getElementById('icno').value.trim();

    if (!icno || icno.length < 8) {
        document.getElementById('dayDuplicateWarning').innerHTML = '';
        hasDayDuplicate = false;
        return;
    }

    try {
        // Check for duplicate booking
        const { data, error } = await supabaseClient
            .from('bookings')
            .select('session_id, session_time, session_slot, booking_date')
            .eq('icno', icno)
            .eq('booking_date', selectedDate)
            .eq('status', 'confirmed')
            .single();

        if (data) {
            hasDayDuplicate = true;
            
            const warningContainer = document.getElementById('dayDuplicateWarning');
            if (!warningContainer.querySelector('#dayDuplicateWarningAlert')) {
                warningContainer.innerHTML = `
                    <div id="dayDuplicateWarningAlert" class="alert mb-4" data-variant="destructive">
                        <i data-lucide="circle-alert" class="w-4 h-4"></i>
                        <span class="text-sm">
                            <strong>❌ Booking Not Allowed:</strong> You already have a booking on this date
                            (Session: ${data.session_time} - ${data.session_slot}).
                            You can only have ONE booking per day. 
                            <a href="manage-booking.html" target="_blank" class="underline font-medium">Cancel your existing booking first</a>.
                        </span>
                    </div>
                `;
                refreshIcons();
            }
        } else {
            hasDayDuplicate = false;
            document.getElementById('dayDuplicateWarning').innerHTML = '';
        }
        
        // NEW: Load lesson history after duplicate check
        await loadLessonHistory(icno);

    } catch (error) {
        hasDayDuplicate = false;
        document.getElementById('dayDuplicateWarning').innerHTML = '';
        console.log('No duplicate found for this day');
        
        // Still load history even if no duplicate
        await loadLessonHistory(icno);
    }
}

// ============================================
// LESSON HISTORY FUNCTIONS
// ============================================

// Parse lesson string to get type and number
function parseLesson(lessonStr) {
    if (!lessonStr) return null;
    
    // Example: "KPP02 - 1st KPP02"
    const parts = lessonStr.split(' - ');
    if (parts.length === 2) {
        const type = parts[0];
        const sub = parts[1];
        // Extract number from "1st KPP02"
        const match = sub.match(/(\d+)/);
        const number = match ? parseInt(match[0]) : 0;
        return { type, sub, number };
    }
    return null;
}

// Get lesson type from string
function getLessonType(lessonStr) {
    if (!lessonStr) return null;
    const parts = lessonStr.split(' - ');
    return parts.length === 2 ? parts[0] : null;
}

// Lesson type definitions
const LESSON_TYPES = {
    'KPP02': {
        label: 'KPP02 (Circuit)',
        totalLessons: 5,
        color: '#2563eb'
    },
    'KPP03': {
        label: 'KPP03 (Road)',
        totalLessons: 5,
        color: '#16a34a'
    },
    'TM': {
        label: 'TM (Theory)',
        totalLessons: 2,
        color: '#9333ea'
    }
};

// Load lesson history for a student
async function loadLessonHistory(icno) {
    try {
        const { data: bookings, error } = await supabaseClient
            .from('bookings')
            .select('*')
            .eq('icno', icno)
            .order('booking_date', { ascending: false });
        
        if (error) throw error;
        
        if (!bookings || bookings.length === 0) {
            // No bookings found - hide the history indicator
            document.getElementById('historyIndicator').classList.add('hidden');
            return;
        }
        
        // Show the history indicator with count
        const historyIndicator = document.getElementById('historyIndicator');
        historyIndicator.classList.remove('hidden');
        document.getElementById('historyCount').textContent = bookings.length;
        
        // Store bookings for modal display
        window._lessonHistory = bookings;
        
    } catch (error) {
        console.error('Error loading lesson history:', error);
    }
}

// Open the history modal
function openHistoryModal() {
    const bookings = window._lessonHistory || [];
    const modal = document.getElementById('historyModal');
    
    if (!modal) return;
    
    // Render progress summary
    renderHistoryProgress(bookings);
    
    // Render bookings list
    renderHistoryBookings(bookings);
    
    // Render recommendations
    renderHistoryRecommendation(bookings);
    
    // Show modal
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    refreshIcons();
}

// Close history modal
function closeHistoryModal() {
    const modal = document.getElementById('historyModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

// Render progress summary in history modal
function renderHistoryProgress(bookings) {
    const summaryDiv = document.getElementById('historyProgressSummary');
    
    // Group by lesson type
    const completedLessons = {};
    
    bookings.forEach(booking => {
        if (booking.status !== 'confirmed') return;
        const lessonType = getLessonType(booking.lesson);
        if (!lessonType) return;
        if (!completedLessons[lessonType]) {
            completedLessons[lessonType] = new Set();
        }
        completedLessons[lessonType].add(booking.lesson);
    });
    
    let html = '<div class="space-y-2">';
    
    for (const [type, config] of Object.entries(LESSON_TYPES)) {
        const completed = completedLessons[type] ? completedLessons[type].size : 0;
        const total = config.totalLessons;
        const percentage = Math.min(100, Math.round((completed / total) * 100));
        const isComplete = completed >= total;
        
        html += `
            <div>
                <div class="flex justify-between items-center text-xs">
                    <span class="font-medium" style="color: #374151;">${config.label}</span>
                    <span style="color: #6b7280;">${completed}/${total}</span>
                </div>
                <div class="lesson-progress mt-0.5">
                    <div class="lesson-progress-bar ${isComplete ? 'completed' : ''}" 
                         style="width: ${percentage}%; background-color: ${isComplete ? '#22c55e' : config.color};">
                    </div>
                </div>
            </div>
        `;
    }
    
    // Overall progress
    const totalLessons = Object.values(LESSON_TYPES).reduce((sum, t) => sum + t.totalLessons, 0);
    let totalCompleted = 0;
    for (const type of Object.keys(LESSON_TYPES)) {
        totalCompleted += completedLessons[type] ? completedLessons[type].size : 0;
    }
    const overallPercentage = Math.min(100, Math.round((totalCompleted / totalLessons) * 100));
    
    html += `
        <div class="pt-2 border-t" style="border-color: #e5e7eb;">
            <div class="flex justify-between items-center text-xs">
                <span class="font-semibold" style="color: #374151;">Overall Progress</span>
                <span style="color: #6b7280;">${totalCompleted}/${totalLessons}</span>
            </div>
            <div class="lesson-progress mt-0.5">
                <div class="lesson-progress-bar ${overallPercentage >= 100 ? 'completed' : ''}" 
                     style="width: ${overallPercentage}%; ${overallPercentage >= 100 ? 'background-color: #22c55e;' : ''}">
                </div>
            </div>
            ${overallPercentage >= 100 ? '<span class="text-xs text-emerald-600 font-medium">🎉 All lessons completed!</span>' : ''}
        </div>
    `;
    
    html += '</div>';
    summaryDiv.innerHTML = html;
}

// Render bookings list in history modal
function renderHistoryBookings(bookings) {
    const listDiv = document.getElementById('historyBookingsList');
    
    if (!bookings || bookings.length === 0) {
        listDiv.innerHTML = '<p class="text-sm text-muted-foreground">No bookings found.</p>';
        return;
    }
    
    // Show only the 10 most recent bookings
    const recentBookings = bookings.slice(0, 10);
    
    let html = '';
    recentBookings.forEach(booking => {
        const isPast = booking.booking_date < getMalaysiaToday();
        const dateObj = new Date(booking.booking_date + 'T00:00:00');
        const dateStr = dateObj.toLocaleDateString('en-MY', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
        
        html += `
            <div class="history-item p-2 rounded-lg border" style="border-color: #e5e7eb; ${isPast ? 'background: #f9fafb;' : 'background: #ffffff;'}">
                <div class="flex items-center justify-between">
                    <div>
                        <span class="text-sm font-medium" style="color: #111827;">${booking.lesson || 'N/A'}</span>
                        <span class="text-xs ml-2" style="color: #6b7280;">${dateStr}</span>
                    </div>
                    <span class="text-xs ${booking.status === 'confirmed' ? 'text-emerald-600' : 'text-red-500'}">
                        ${booking.status === 'confirmed' ? '✅' : '❌'}
                    </span>
                </div>
            </div>
        `;
    });
    
    if (bookings.length > 10) {
        html += `
            <p class="text-xs text-center" style="color: #6b7280;">
                + ${bookings.length - 10} more bookings
            </p>
        `;
    }
    
    listDiv.innerHTML = html;
}

// Render recommended next lesson
function renderHistoryRecommendation(bookings) {
    const recDiv = document.getElementById('historyRecommendation');
    
    // Get completed lessons
    const completed = {};
    bookings.forEach(booking => {
        if (booking.status !== 'confirmed') return;
        const lessonType = getLessonType(booking.lesson);
        if (!lessonType) return;
        if (!completed[lessonType]) {
            completed[lessonType] = new Set();
        }
        completed[lessonType].add(booking.lesson);
    });
    
    // Find next lessons
    const nextLessons = [];
    for (const [type, config] of Object.entries(LESSON_TYPES)) {
        const done = completed[type] || new Set();
        const options = getLessonOptions(type);
        const next = options.find(opt => !done.has(`${type} - ${opt}`));
        if (next) {
            nextLessons.push(`${type} - ${next}`);
        }
    }
    
    // Check if all completed
    const allComplete = Object.values(LESSON_TYPES).every((config, index) => {
        const type = Object.keys(LESSON_TYPES)[index];
        const done = completed[type] || new Set();
        return done.size >= config.totalLessons;
    });
    
    if (allComplete) {
        recDiv.classList.remove('hidden');
        recDiv.innerHTML = `
            <div class="text-center">
                <p class="text-sm font-medium text-emerald-600">🎉 All lessons completed!</p>
                <p class="text-xs text-muted-foreground mt-0.5">You're ready for your license test!</p>
            </div>
        `;
        return;
    }
    
    if (nextLessons.length === 0) {
        recDiv.classList.add('hidden');
        return;
    }
    
    recDiv.classList.remove('hidden');
    recDiv.innerHTML = `
        <div class="flex items-center justify-between">
            <div>
                <p class="text-xs font-medium text-blue-700">📖 Next Lesson</p>
                <p class="text-sm font-semibold" style="color: #111827;">${nextLessons[0]}</p>
            </div>
            <a href="booking.html" class="btn" data-size="sm" style="background: #2563eb; color: white; font-weight: 500; padding: 4px 12px; font-size: 12px; border-radius: 6px;">
                Book Now
            </a>
        </div>
    `;
    refreshIcons();
}

// Get lesson options for a type
function getLessonOptions(type) {
    const options = {
        'KPP02': ['1st KPP02', '2nd KPP02', '3rd KPP02', '4th KPP02', '5th KPP02'],
        'KPP03': ['1st KPP03', '2nd KPP03', '3rd KPP03'],
        'TM': ['TM 1JAM', 'TM 2JAM']
    };
    return options[type] || [];
}

function showConfirmation(sessionId) {
    document.getElementById('confirmationDetails').innerHTML = buildSummaryRows([
        { icon: 'hash', label: 'Session ID', value: sessionId },
        { icon: 'bike', label: 'Class', value: bookingData.class },
        { icon: 'calendar', label: 'Date', value: formatMalaysiaDate(bookingData.date) },
        { icon: 'clock', label: 'Session', value: `${bookingData.session.session_time} - ${bookingData.session.session_slot}` },
        { icon: 'book-open', label: 'Lesson', value: bookingData.lesson },
        { icon: 'user', label: 'Name', value: bookingData.name },
        { icon: 'id-card', label: 'IC/Passport', value: bookingData.icno },
        { icon: 'phone', label: 'Contact', value: bookingData.contact }
    ]) + `<p class="text-xs text-muted-foreground text-center pt-3">Please save your Session ID for future reference.</p>`;

    showStep(5);
    refreshIcons();
    showMessage('Booking successful!', 'success');
}

// ============================================
// Reset
// ============================================
function resetAll() {
    showStep(1);
    selectedDate = null;
    selectedSession = null;
    bookingData = {};
    hasDayDuplicate = false; // NEW: Reset flag
    document.getElementById('icno').value = '';
    document.getElementById('name').value = '';
    document.getElementById('contact').value = '';
    document.getElementById('selectedDateDisplay').textContent = '';
    document.getElementById('sessionsContainer').classList.add('hidden');
    document.getElementById('nextToDetailsBtn').classList.add('hidden');
    document.getElementById('dayDuplicateWarning').innerHTML = '';
    hideMessage();
}

// ============================================
// Utilities
// ============================================
const MESSAGE_VARIANTS = {
    error:   { icon: 'circle-alert', attr: 'destructive', extra: '' },
    success: { icon: 'circle-check', attr: null, extra: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
    info:    { icon: 'info', attr: null, extra: 'border-blue-200 bg-blue-50 text-blue-800' }
};

function showMessage(text, type = 'info') {
    const variant = MESSAGE_VARIANTS[type] || MESSAGE_VARIANTS.info;

    messageDiv.classList.remove('hidden');
    messageDiv.className = `alert items-start gap-2 ${variant.extra}`;
    if (variant.attr) {
        messageDiv.setAttribute('data-variant', variant.attr);
    } else {
        messageDiv.removeAttribute('data-variant');
    }

    messageIcon.setAttribute('data-lucide', variant.icon);
    messageText.textContent = text;
    refreshIcons();
}

function hideMessage() {
    messageDiv.classList.add('hidden');
}

// ============================================
// GUIDE MODAL FUNCTIONS - MOST ROBUST
// ============================================

let isGuideModalOpen = false;

function openGuideModal(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    console.log('Opening guide modal...');
    const modal = document.getElementById('guideModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        isGuideModalOpen = true;
        refreshIcons();
        console.log('Modal opened successfully');
    }
}

function closeGuideModal(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    console.log('Closing guide modal...');
    const modal = document.getElementById('guideModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = '';
        isGuideModalOpen = false;
        console.log('Modal closed successfully');
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    if (!isGuideModalOpen) return;
    
    const modal = document.getElementById('guideModal');
    if (!modal || modal.classList.contains('hidden')) return;
    
    const modalContent = modal.querySelector('div');
    if (!modalContent) return;
    
    // Check if click is inside the modal content
    if (!modalContent.contains(event.target)) {
        // Check if click is on the guide button or its children
        const guideButton = document.getElementById('guideButton');
        if (guideButton && guideButton.contains(event.target)) {
            return;
        }
        closeGuideModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && isGuideModalOpen) {
        closeGuideModal();
    }
});

// ============================================
// LESSON TYPE AND SUB-OPTIONS
// ============================================

// Lesson options mapping
const LESSON_OPTIONS = {
    'KPP02': [
        '1st KPP02',
        '2nd KPP02',
        '3rd KPP02',
        '4th KPP02',
        '5th KPP02'
    ],
    'KPP03': [
        '1st KPP03',
        '2nd KPP03',
        '3rd KPP03',
        '4th KPP03',
        '5th KPP03'
    ],
    'TM': [
        'TM 1JAM',
        'TM 2JAM'
    ]
};

// Update lesson sub-options based on selected lesson type
function updateLessonSubOptions() {
    const selectedType = document.querySelector('input[name="lesson_type"]:checked');
    const subContainer = document.getElementById('lessonSubContainer');
    const subSelect = document.getElementById('lessonSub');
    
    if (!selectedType) {
        subContainer.classList.add('hidden');
        return;
    }
    
    const type = selectedType.value;
    const options = LESSON_OPTIONS[type] || [];
    
    if (options.length > 0) {
        subContainer.classList.remove('hidden');
        subSelect.innerHTML = '<option value="">-- Select a lesson --</option>';
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            subSelect.appendChild(option);
        });
        refreshIcons();
    } else {
        subContainer.classList.add('hidden');
    }
}

// Get the full lesson value (type + sub)
function getFullLesson() {
    const selectedType = document.querySelector('input[name="lesson_type"]:checked');
    const subSelect = document.getElementById('lessonSub');
    
    if (!selectedType) return null;
    
    const type = selectedType.value;
    const sub = subSelect.value;
    
    if (!sub) return null;
    
    return `${type} - ${sub}`;
}

// Validate lesson selection
function validateLesson() {
    const selectedType = document.querySelector('input[name="lesson_type"]:checked');
    const subSelect = document.getElementById('lessonSub');
    
    if (!selectedType) {
        showMessage('Please select a lesson type.', 'error');
        return false;
    }
    
    if (!subSelect.value) {
        showMessage('Please select a specific lesson.', 'error');
        return false;
    }
    
    return true;
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initMonthYear();
    showStep(1);

    const icnoInput = document.getElementById('icno');
    if (icnoInput) {
        icnoInput.addEventListener('blur', checkDayDuplicate);
        icnoInput.addEventListener('input', () => {
            document.getElementById('dayDuplicateWarning').innerHTML = '';
            document.getElementById('historyIndicator').classList.add('hidden');
        });
    }

    refreshIcons();
});

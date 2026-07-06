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
        cell.textContent = day;
        cell.dataset.date = dateStr;

        if (dateStr < todayStr) {
            setCellState(cell, 'past');
        } else if (dateStr === todayStr) {
            // Today: rendered the same as an unavailable day, no special label/highlight.
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

    // NEW: Check if there's a duplicate before proceeding
    if (hasDayDuplicate) {
        showMessage('⚠️ You cannot proceed with a duplicate booking. Please cancel your existing booking first.', 'error');
        return;
    }

    bookingData = {
        icno: icno,
        name: name,
        contact: contact,
        class: selectedClass,
        date: selectedDate,
        session: availableSessionsData[selectedSession]
    };

    const summary = document.getElementById('bookingSummary');
    summary.innerHTML = buildSummaryRows([
        { icon: 'bike', label: 'Class', value: bookingData.class },
        { icon: 'calendar', label: 'Date', value: formatMalaysiaDate(bookingData.date) },
        { icon: 'clock', label: 'Session', value: `${bookingData.session.session_time} - ${bookingData.session.session_slot}` },
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
        hasDayDuplicate = false; // NEW: Reset flag
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('bookings')
            .select('session_id, session_time, session_slot, booking_date')
            .eq('icno', icno)
            .eq('booking_date', selectedDate)
            .eq('status', 'confirmed')
            .single();

        if (data) {
            // NEW: Set flag to true to block form submission
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
            // NEW: Reset flag when no duplicate found
            hasDayDuplicate = false;
            document.getElementById('dayDuplicateWarning').innerHTML = '';
        }
    } catch (error) {
        // NEW: Reset flag on error
        hasDayDuplicate = false;
        document.getElementById('dayDuplicateWarning').innerHTML = '';
        console.log('No duplicate found for this day');
    }
}

function showConfirmation(sessionId) {
    document.getElementById('confirmationDetails').innerHTML = buildSummaryRows([
        { icon: 'hash', label: 'Session ID', value: sessionId },
        { icon: 'bike', label: 'Class', value: bookingData.class },
        { icon: 'calendar', label: 'Date', value: formatMalaysiaDate(bookingData.date) },
        { icon: 'clock', label: 'Session', value: `${bookingData.session.session_time} - ${bookingData.session.session_slot}` },
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
        });
    }

    refreshIcons();
});

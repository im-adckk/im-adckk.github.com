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
        cell.className = `${CAL_BASE} text-base`;

        if (dateStr < todayStr) {
            setCellState(cell, 'past');
            cell.disabled = true;
        } else {
            setCellState(cell, 'inactive');
            cell.addEventListener('click', (e) => {
                e.preventDefault();
                selectDate(dateStr, cell);
            });
        }

        calendar.appendChild(cell);
    }

    refreshIcons();
}

function selectDate(dateStr, cell) {
    document.querySelectorAll('#calendar button').forEach(btn => {
        btn.classList.remove(...Object.values(CAL_STATE_CLASSES).flat().split(' '));
        if (!btn.textContent || !btn.textContent.match(/^\d+$/)) return;
        if (btn.disabled) {
            setCellState(btn, 'past');
        } else {
            setCellState(btn, 'inactive');
        }
    });

    selectedDate = dateStr;
    setCellState(cell, 'selected');
    document.getElementById('selectedDateDisplay').textContent = formatMalaysiaDate(selectedDate);
    document.getElementById('sessionsContainer').classList.remove('hidden');
    document.getElementById('nextToDetailsBtn').classList.remove('hidden');

    loadSessions(selectedDate);
    hideMessage();
}

async function loadSessions(dateStr) {
    try {
        const { data, error } = await supabaseClient
            .from('available_sessions')
            .select('*')
            .eq('class', selectedClass)
            .order('session_time', { ascending: true });

        if (error) throw error;

        availableSessionsData = data || [];
        renderSessionButtons();
    } catch (error) {
        console.error('Error loading sessions:', error);
    }
}

function renderSessionButtons() {
    const container = document.getElementById('sessionsContainer');
    const buttonsContainer = container.querySelector('[role="group"]');
    buttonsContainer.innerHTML = '';

    if (!availableSessionsData || availableSessionsData.length === 0) {
        buttonsContainer.innerHTML = '<p class="text-sm text-muted-foreground col-span-full text-center py-4">No sessions available.</p>';
        return;
    }

    availableSessionsData.forEach(session => {
        const label = document.createElement('label');
        label.className = 'group relative flex flex-col items-center text-center gap-2 rounded-lg border-2 border-muted p-3 cursor-pointer transition-all duration-300 hover:border-primary/50 min-h-24';
        label.innerHTML = `
            <input type="radio" name="session" class="sr-only peer" required>
            <span class="relative z-10 font-semibold text-sm">${session.session_time}</span>
            <span class="relative z-10 text-xs text-muted-foreground">${session.session_slot} slot${session.session_slot > 1 ? 's' : ''}</span>
            <span class="relative z-10 badge" data-variant="secondary">${session.session_slot} available</span>
        `;

        const radio = label.querySelector('input');
        radio.value = JSON.stringify({
            session_time: session.session_time,
            session_slot: session.session_slot,
            id: session.id
        });

        radio.addEventListener('change', () => {
            selectedSession = JSON.parse(radio.value);
            document.querySelectorAll('#sessionsContainer label').forEach(l => {
                l.classList.remove('border-primary', 'shadow-lg', 'scale-105');
            });
            label.classList.add('border-primary', 'shadow-lg', 'scale-105');
        });

        buttonsContainer.appendChild(label);
    });

    refreshIcons();
}

async function checkAvailabilityForMonth() {
    try {
        const { data: sessions, error } = await supabaseClient
            .from('available_sessions')
            .select('session_date')
            .eq('class', selectedClass)
            .gte('session_date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`);

        if (error) throw error;

        const availableDates = new Set(sessions?.map(s => s.session_date) || []);

        document.querySelectorAll('#calendar button').forEach(cell => {
            if (!cell.textContent || !cell.textContent.match(/^\d+$/)) return;
            const day = parseInt(cell.textContent);
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            if (availableDates.has(dateStr)) {
                cell.disabled = false;
            }
        });
    } catch (error) {
        console.error('Error checking availability:', error);
    }
}

function prevMonth() {
    if (currentMonth === 0) {
        currentMonth = 11;
        currentYear--;
    } else {
        currentMonth--;
    }
    renderCalendar();
    checkAvailabilityForMonth();
}

function nextMonth() {
    if (currentMonth === 11) {
        currentMonth = 0;
        currentYear++;
    } else {
        currentMonth++;
    }
    renderCalendar();
    checkAvailabilityForMonth();
}

// ============================================
// STEP 3: Student Details
// ============================================
// MODIFIED: Add validation to check for duplicates before allowing submission
detailsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // NEW: Check if there's a duplicate before proceeding
    if (hasDayDuplicate) {
        showMessage('⚠️ You cannot proceed with a duplicate booking. Please cancel your existing booking first.', 'error');
        return;
    }

    bookingData.icno = document.getElementById('icno').value.trim();
    bookingData.name = document.getElementById('name').value.trim();
    bookingData.contact = document.getElementById('contact').value.trim();
    bookingData.class = selectedClass;
    bookingData.date = selectedDate;
    bookingData.session = selectedSession;

    const summary = document.getElementById('bookingSummary');
    summary.innerHTML = buildSummaryRows([
        { icon: 'bike', label: 'Class', value: bookingData.class },
        { icon: 'calendar', label: 'Date', value: formatMalaysiaDate(bookingData.date) },
        { icon: 'clock', label: 'Session', value: `${bookingData.session.session_time} - ${bookingData.session.session_slot}` },
        { icon: 'user', label: 'Name', value: bookingData.name },
        { icon: 'id-card', label: 'IC/Passport', value: bookingData.icno },
        { icon: 'phone', label: 'Contact', value: bookingData.contact }
    ]);

    showStep(4);
    refreshIcons();
});

function buildSummaryRows(items) {
    return items.map(item => `
        <div class="flex justify-between gap-2 items-center p-2 rounded">
            <span class="text-sm text-muted-foreground flex items-center gap-2">
                <i data-lucide="${item.icon}" class="w-4 h-4"></i>${item.label}
            </span>
            <span class="text-sm font-medium text-right">${item.value}</span>
        </div>
    `).join('');
}

// Go back functions
function goBackStep1() {
    selectedClass = '';
    selectedDate = null;
    selectedSession = null;
    bookingData = {};
    document.getElementById('dayDuplicateWarning').innerHTML = '';
    hasDayDuplicate = false; // NEW: Reset flag
    showStep(1);
}

function goBackStep2() {
    selectedSession = null;
    bookingData = {};
    document.getElementById('dayDuplicateWarning').innerHTML = '';
    hasDayDuplicate = false; // NEW: Reset flag
    showStep(2);
}

function goBackStep3() {
    showStep(3);
}

// ============================================
// STEP 4: Confirmation Dialog
// ============================================
function showConfirmDialog() {
    const dialog = document.getElementById('confirmDialog');
    if (dialog) dialog.classList.remove('hidden');
    document.getElementById('confirmClass').textContent = bookingData.class;
    document.getElementById('confirmDate').textContent = formatMalaysiaDate(bookingData.date);
    document.getElementById('confirmSession').textContent = `${bookingData.session.session_time} - ${bookingData.session.session_slot}`;
    document.getElementById('confirmName').textContent = bookingData.name;
    document.getElementById('confirmIC').textContent = bookingData.icno;
    document.getElementById('confirmContact').textContent = bookingData.contact;
}

function closeConfirmDialog() {
    const dialog = document.getElementById('confirmDialog');
    if (dialog) dialog.classList.add('hidden');
}

function submitBooking() {
    showConfirmDialog();
}

async function confirmBooking() {
    const confirmBtn = event.target;
    const originalHTML = confirmBtn.innerHTML;

    try {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Processing...';
        refreshIcons();

        // Check for duplicate at final submission
        const { data: duplicateCheck, error: dupError } = await supabaseClient
            .from('bookings')
            .select('session_id, session_time, session_slot')
            .eq('icno', bookingData.icno)
            .eq('booking_date', bookingData.date)
            .eq('status', 'confirmed')
            .single();

        if (duplicateCheck) {
            closeConfirmDialog();
            let message = '⚠️ You already have a booking on this date (Session: ' + duplicateCheck.session_time + ' - ' + duplicateCheck.session_slot + ').';

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
        closeConfirmDialog();
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

// MODIFIED: Enhanced duplicate checking with enforcement
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
            // NEW: Set the flag to true and show blocking message
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
            // NEW: Reset the flag when no duplicate is found
            hasDayDuplicate = false;
            document.getElementById('dayDuplicateWarning').innerHTML = '';
        }
    } catch (error) {
        // No booking found or error - consider it safe
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
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initMonthYear();
    showStep(1);

    const icnoInput = document.getElementById('icno');
    if (icnoInput) {
        icnoInput.addEventListener('blur', checkDayDuplicate);
        icnoInput.addEventListener('input', () => {
            // Don't clear the warning on input, only on blur
        });
    }

    refreshIcons();
});

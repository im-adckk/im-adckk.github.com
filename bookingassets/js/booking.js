// Supabase Configuration
const SUPABASE_URL = 'https://yrrinzreyafiowehhhon.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4MnAXo4yxHMQX7fSn7hQjA_qV2X7t7o';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const PRIVATE_TOKEN = new URLSearchParams(location.search).get('key') || null;

// ============================================
// STATE VARIABLES
// ============================================
let selectedClass = '';
let currentMonth = 0;
let currentYear = 0;
let selectedDate = null;
let selectedSession = null;
let availableSessionsData = [];
let bookingData = {};
let hasDayDuplicate = false;
let activeModal = null;
let isReadOnlyView = false;
let hasFutureLimit = false;
let futureLimitInfo = null;
let _icDebounceTimer = null;

// ============================================
// LESSON OPTIONS
// ============================================
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
        '3rd KPP03'
    ],
    'TM': [
        'TM 1JAM',
        'TM 2JAM'
    ]
};

const SESSION_SLOT_LABELS = {
    'sesi1': 'Group 1',
    'sesi2': 'Group 2',
    'sesi3': 'Group 3'
};

function formatSlot(slot) {
    if (!slot) return '';
    return SESSION_SLOT_LABELS[slot] || slot;
}

const LESSON_TYPES_SIMPLE = {
    'KPP02': { label: 'KPP02', max: 5 },
    'KPP03': { label: 'KPP03', max: 3 },
    'TM': { label: 'TM', max: 2 }
};

// ============================================
// DOM ELEMENTS
// ============================================
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

const STEPS = [step1, step2, step3, step4, step5];

// ============================================
// ICON HELPER
// ============================================
function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

// ============================================
// STEP NAVIGATION + PROGRESS INDICATOR
// ============================================
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
// CALENDAR CELL STYLING
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
// MESSAGE SYSTEM
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

function resetStep2State() {
    selectedDate = null;
    selectedSession = null;
    isReadOnlyView = false;
    hasDayDuplicate = false;
    hasFutureLimit = false;
    futureLimitInfo = null;
    window._dayDuplicateInfo = null;
    availableSessionsData = [];

    document.getElementById('selectedDateDisplay').textContent = '';
    document.getElementById('sessionsContainer').classList.add('hidden');
    document.getElementById('nextToDetailsBtn').classList.add('hidden');
    document.getElementById('dayDuplicateWarning').innerHTML = '';

    const banner = document.getElementById('fullDateBanner');
    if (banner) banner.classList.add('hidden');
}
// ============================================
// STEP 1: Class Selection
// ============================================
classForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    selectedClass = document.querySelector('input[name="class"]:checked').value;
    document.getElementById('selectedClassDisplay').innerHTML =
        `<span class="badge" data-variant="secondary">Selected Class: ${selectedClass}</span>`;

    resetStep2State();
    showStep(2);
    renderCalendar();
    await checkAvailabilityForMonth();
});

// ============================================
// STEP 2: Calendar
// ============================================
function initMonthYear() {
    const { month, year } = getMalaysiaMonthYear();
    currentMonth = month;
    currentYear = year;
}

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
        
        if (dateStr === todayStr) {
            cell.innerHTML = `${day} <span class="text-[8px] font-bold text-amber-500 ml-0.5">●</span>`;
            cell.title = 'Today';
        } else {
            cell.textContent = day;
        }

        if (dateStr < todayStr) {
            setCellState(cell, 'past');
            cell.title = dateStr === todayStr ? 'Today - cannot book' : '';
        } else if (dateStr === todayStr) {
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

// A session is "fully reserved" when every seat is earmarked for a
// reserved quota that matches its class. Quota columns are not-null
// default 0, but we coalesce defensively.
function isFullyReserved(s) {
    if (!s) return false;
    if (s.class === 'B')  return (s.reserved_quota_b  || 0) >= s.max_bookings;
    if (s.class === 'B2') return (s.reserved_quota_b2 || 0) >= s.max_bookings;
    return false;
}

// Snapshot of the current viewer's private-access state. Read fresh
// each call because _isSpecialViewer / _privateTokenClass are set
// asynchronously at boot from validate_private_token().
function getViewer() {
    return {
        isSpecial: !!window._isSpecialViewer,
        tokenClass: window._privateTokenClass || null
    };
}

// Can this viewer actually book this session?
// (class-null token = legacy/global, grants both classes.)
function isBookableByViewer(s, viewer) {
    if (s.is_available === false) return false;
    if (s.current_bookings >= s.max_bookings) return false;
    if (!isFullyReserved(s)) return true;
    return viewer.isSpecial
        && (viewer.tokenClass === null || viewer.tokenClass === s.class);
}

// ============================================
// SHARED DAY-STATE HELPER
// Single source of truth for a calendar cell's state.
// Both checkAvailabilityForMonth() and resetCalendarColors() use this
// so "red" is a stable fact regardless of which render ran last.
// ============================================
function computeDayState(dateStr, todayStr, sessionMap, statusMap, viewer) {
    if (dateStr < todayStr || dateStr === todayStr) {
        return { state: 'past', title: dateStr === todayStr ? 'Today - cannot book' : '' };
    }

    const status = statusMap[dateStr];
    if (status && !status.is_active) {
        return { state: 'inactive', title: status.reason || 'Date is closed for bookings' };
    }

    const sessions = sessionMap[dateStr] || [];
    const openSessions = sessions.filter(s => s.is_available !== false);

    const hasAvailable = openSessions.some(s => isBookableByViewer(s, viewer));
    if (hasAvailable) {
        return { state: 'available', title: 'Available' };
    }
    if (openSessions.length > 0) {
        return { state: 'full', title: 'Fully Booked' };
    }
    return { state: 'none', title: 'No sessions available' };
}

// Build the sessionMap / statusMap pair used by the helper.
function buildCalendarMaps(sessions, statuses) {
    const sessionMap = {};
    sessions.forEach(s => {
        if (!sessionMap[s.session_date]) sessionMap[s.session_date] = [];
        sessionMap[s.session_date].push(s);
    });
    const statusMap = {};
    statuses.forEach(s => { statusMap[s.target_date] = s; });
    return { sessionMap, statusMap };
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
        const { data: sessions, error: sessionsError } = await supabaseClient
            .from('available_sessions')
            .select('*')
            .eq('class', selectedClass)
            .gte('session_date', startDateStr)
            .lte('session_date', endDateStr)
            .gte('session_date', todayStr);

        if (sessionsError) throw sessionsError;

        const { data: statuses, error: statusError } = await supabaseClient
            .from('date_status')
            .select('target_date, is_active, reason')
            .gte('target_date', startDateStr)
            .lte('target_date', endDateStr);

        if (statusError) throw statusError;

        const { sessionMap, statusMap } = buildCalendarMaps(sessions || [], statuses || []);

        const cells = document.querySelectorAll('#calendar button[data-date]');
        cells.forEach(cell => {
            const dateStr = cell.dataset.date;
            const { state, title } = computeDayState(dateStr, todayStr, sessionMap, statusMap, getViewer());
            setCellState(cell, state);
            cell.title = title;
        });

    } catch (error) {
        console.error('Error checking availability:', error);
    }
}

async function resetCalendarColors() {
    const todayStr = getMalaysiaToday();

    // Only repaint cells OTHER than the one currently viewed/selected.
    // If nothing is being viewed, there is nothing to restore — skip the DB round-trip.
    if (!selectedDate) return;

    const year = currentYear;
    const month = currentMonth;
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const startDateStr = toMalaysiaDateStr(startDate);
    const endDateStr = toMalaysiaDateStr(endDate);

    try {
        const { data: sessions, error: sessionsError } = await supabaseClient
            .from('available_sessions')
            .select('*')
            .eq('class', selectedClass)
            .gte('session_date', startDateStr)
            .lte('session_date', endDateStr)
            .gte('session_date', todayStr);

        if (sessionsError) throw sessionsError;

        const { data: statuses, error: statusError } = await supabaseClient
            .from('date_status')
            .select('target_date, is_active, reason')
            .gte('target_date', startDateStr)
            .lte('target_date', endDateStr);

        if (statusError) throw statusError;

        const { sessionMap, statusMap } = buildCalendarMaps(sessions || [], statuses || []);

        const cells = document.querySelectorAll('#calendar button[data-date]');
        cells.forEach(cell => {
            const dateStr = cell.dataset.date;
            if (dateStr === selectedDate) return; // leave the active cell alone

            const { state, title } = computeDayState(dateStr, todayStr, sessionMap, statusMap, getViewer());
            setCellState(cell, state);
            cell.title = title;
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
    isReadOnlyView = false;
    document.getElementById('selectedDateDisplay').textContent = '';
    document.getElementById('sessionsContainer').classList.add('hidden');
    document.getElementById('nextToDetailsBtn').classList.add('hidden');
    const banner = document.getElementById('fullDateBanner');
    if (banner) banner.classList.add('hidden');
    
    renderCalendar();
    resetStep2State();
    checkAvailabilityForMonth();
}

function goToToday() {
    const { month, year } = getMalaysiaMonthYear();
    currentMonth = month;
    currentYear = year;
    selectedDate = null;
    selectedSession = null;
    isReadOnlyView = false;
    document.getElementById('selectedDateDisplay').textContent = '';
    document.getElementById('sessionsContainer').classList.add('hidden');
    document.getElementById('nextToDetailsBtn').classList.add('hidden');
    const banner = document.getElementById('fullDateBanner');
    if (banner) banner.classList.add('hidden');
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

    // --- Block inactive dates (unchanged) ---
    try {
        const { data: status, error } = await supabaseClient
            .from('date_status')
            .select('is_active, reason')
            .eq('target_date', dateStr)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (status && !status.is_active) {
            const reason = status.reason ? ` (Reason: ${status.reason})` : '';
            showMessage(`This date is closed for bookings.${reason}`, 'error');
            return;
        }
    } catch (error) {
        console.error('Error checking date status:', error);
    }

    // --- Toggle OFF the read-only view if the same full date is clicked again ---
    if (isReadOnlyView && selectedDate === dateStr) {
        isReadOnlyView = false;
        selectedDate = null;
        selectedSession = null;
        document.getElementById('selectedDateDisplay').textContent = '';
        document.getElementById('sessionsContainer').classList.add('hidden');
        document.getElementById('nextToDetailsBtn').classList.add('hidden');
        const banner = document.getElementById('fullDateBanner');
        if (banner) banner.classList.add('hidden');
        hideMessage();
        await resetCalendarColors();
        return;
    }

    // --- Toggle OFF a normal (green) selection (unchanged behaviour) ---
    if (!isReadOnlyView && selectedDate === dateStr) {
        selectedDate = null;
        selectedSession = null;
        hasDayDuplicate = false;
        hasFutureLimit = false;
        futureLimitInfo = null;
        window._dayDuplicateInfo = null;
        document.getElementById('selectedDateDisplay').textContent = '';
        document.getElementById('sessionsContainer').classList.add('hidden');
        document.getElementById('nextToDetailsBtn').classList.add('hidden');
        hideMessage();
        await resetCalendarColors();
        return;
    }

    // --- Determine this date's state before deciding how to handle the click ---
    let dayState = 'none';
    try {
        const { data: rows, error } = await supabaseClient
            .from('available_sessions')
            .select('*')
            .eq('class', selectedClass)
            .eq('session_date', dateStr);
    
        if (error) throw error;
    
        const viewer = getViewer();
        const openSessions = (rows || []).filter(s => s.is_available !== false);
        const hasAvailable = openSessions.some(s => isBookableByViewer(s, viewer));
        dayState = hasAvailable ? 'available' : (openSessions.length > 0 ? 'full' : 'none');
    } catch (error) {
        console.error('Error checking day state:', error);
        showMessage('Error checking availability. Please try again.', 'error');
        return;
    }

    // --- FULL DATE: read-only view (option 2) ---
    if (dayState === 'full') {
        const previousDate = selectedDate;
        isReadOnlyView = true;
        selectedDate = dateStr;
        selectedSession = null;
        hasDayDuplicate = false;
        hasFutureLimit = false;
        futureLimitInfo = null;
        window._dayDuplicateInfo = null;

        // Restore the previously-selected (green) cell, if any.
        if (previousDate && previousDate !== dateStr) {
            await resetCalendarColors();
        }

        // Keep the clicked cell RED — do NOT paint it blue.
        const cells = document.querySelectorAll('#calendar button[data-date]');
        cells.forEach(cell => {
            if (cell.dataset.date === dateStr) {
                setCellState(cell, 'full');
                cell.title = 'Fully Booked';
            }
        });

        // Honest badge text + muted variant.
        document.getElementById('selectedDateDisplay').innerHTML =
            `<span class="badge" data-variant="destructive">Date: ${formatMalaysiaDate(dateStr)} (fully booked)</span>`;

        // Date-level banner.
        const banner = document.getElementById('fullDateBanner');
        if (banner) banner.classList.remove('hidden');

        await loadSessionsForDate(dateStr, { readOnlyFull: true });
        return;
    }

    // --- NO SESSIONS AT ALL: treat like an inert date ---
    if (dayState === 'none') {
        showMessage('No sessions available for this date. Please choose another date.', 'error');
        return;
    }

    // --- AVAILABLE DATE: normal selection path ---
    isReadOnlyView = false;
    selectedDate = dateStr;

    document.getElementById('selectedDateDisplay').innerHTML =
        `<span class="badge" data-variant="outline">Selected Date: ${formatMalaysiaDate(dateStr)}</span>`;

        // Early duplicate + future-limit checks for the currently-entered IC.
    const icnoValue = (document.getElementById('icno')?.value || '').trim();
    const dupResult = await checkDuplicateForDate(icnoValue, dateStr);
    hasDayDuplicate = dupResult.isDuplicate;
    window._dayDuplicateInfo = dupResult.existing || null;

    const limitResult = await checkFutureLimit(icnoValue, dateStr);
    hasFutureLimit = limitResult.limited;
    futureLimitInfo = limitResult.info;

    await resetCalendarColors();

    const cells = document.querySelectorAll('#calendar button[data-date]');
    cells.forEach(cell => {
        if (cell.dataset.date === dateStr) {
            setCellState(cell, 'selected');
        }
    });

    // Hide the full-date banner when a bookable date is selected.
    const banner = document.getElementById('fullDateBanner');
    if (banner) banner.classList.add('hidden');

    await loadSessionsForDate(dateStr, { silentInfoMessage: hasDayDuplicate });

    if (hasDayDuplicate) {
        const existing = window._dayDuplicateInfo;
        const detail = existing
            ? ` (Session: ${existing.session_time} - ${formatSlot(existing.session_slot)})`
            : '';
        showMessage(
            `⚠️ You already have a booking on this date${detail}. You can only have ONE booking per day. To book a different session, cancel your existing booking first via Manage My Bookings.`,
            'error'
        );
    }

    if (hasFutureLimit) {
        const info = futureLimitInfo;
        showMessage(
            `⚠️ ${info.message}\n\n` +
            info.existing.map(b =>
                `• ${b.booking_date} — ${b.session_time} (${formatSlot(b.session_slot)})`
            ).join('\n') +
            `\n\nCancel one via Manage My Bookings, then try again.`,
            'error'
        );
    }
}

async function loadSessionsForDate(dateStr, opts = {}) {
    const readOnlyFull = !!opts.readOnlyFull;

    try {
        const { data, error } = await supabaseClient
            .rpc('get_available_sessions_for_date', {
                check_date: dateStr,
                class_filter: selectedClass,
                p_token: PRIVATE_TOKEN
            });

        if (error) throw error;

        if (data) {
            const timeOrder = { '9am-12pm': 1, '12pm-3pm': 2 };
            const slotOrder = { 'sesi1': 1, 'sesi2': 2, 'sesi3': 3 };

            data.sort((a, b) => {
                const timeDiff = (timeOrder[a.session_time] || 99) - (timeOrder[b.session_time] || 99);
                if (timeDiff !== 0) return timeDiff;
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
            selectedSession = null;
            refreshIcons();
            return;
        }

        if (selectedSession !== null) {
            const prev = availableSessionsData[selectedSession];
            if (!prev || prev.current_bookings >= prev.max_bookings) {
                // selectedSession = null;
            }
        }

        let html = '';
        data.forEach((session, index) => {
            const available = Math.max(0, session.max_bookings - session.current_bookings);
            // In read-only mode, force EVERY row to the disabled style.
            const isFull = readOnlyFull || available <= 0;

            if (isFull) {
                html += `
                    <button type="button" disabled
                        class="w-full text-left rounded-lg border p-3 flex items-center gap-3 transition-colors border-red-200 bg-red-50 text-red-700 cursor-not-allowed opacity-80">
                        <span class="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                            <i data-lucide="clock" class="w-4 h-4"></i>
                        </span>
                        <span class="flex-1">
                            <span class="block text-sm font-medium">${session.session_time}</span>
                            <span class="block text-xs text-red-600/80">${formatSlot(session.session_slot)}</span>
                        </span>
                        <span class="badge bg-red-600 text-white border-red-700">FULL</span>
                    </button>
                `;
            } else {
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
                            <span class="block text-xs text-muted-foreground">${formatSlot(session.session_slot)}</span>
                        </span>
                        <span class="badge" data-variant="secondary">${available} left</span>
                    </button>
                `;
            }
        });

        sessionsList.innerHTML = html;
        sessionsContainer.classList.remove('hidden');
        nextBtn.classList.add('hidden');
        selectedSession = null;
        refreshIcons();

        if (!readOnlyFull && !opts.silentInfoMessage) {
            showMessage('Select a session time to continue.', 'info');
        }

    } catch (error) {
        console.error('Error loading sessions:', error);
        showMessage('Error loading sessions. Please try again.', 'error');
    }
}

function selectSession(index) {
    const s = availableSessionsData[index];
    if (!s || s.current_bookings >= s.max_bookings) {
        showMessage('This session is full. Please choose another.', 'error');
        return;
    }
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
    if (isReadOnlyView) {
        showMessage('This date is fully booked. Please choose another date.', 'error');
        return;
    }
    if (selectedSession === null) {
        showMessage('Please select a session first.', 'error');
        return;
    }
    showStep(3);
}

function goBackStep1() {
    resetStep2State();
    showStep(1);
}

function goBackStep2() {
    resetStep2State();
    showStep(2);
}

// ============================================
// STEP 3: Student Details - WITH VALIDATION
// ============================================

// IC/Passport validation - only letters and numbers
function validateICPassport(value) {
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '');
    return cleaned.toUpperCase();
}

// Name validation - force uppercase letters only
function validateName(value) {
    const cleaned = value.replace(/[^a-zA-Z\s]/g, '');
    return cleaned.toUpperCase();
}

// Contact validation - only numbers
function validateContact(value) {
    const cleaned = value.replace(/\D/g, '');
    return cleaned;
}

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

function getFullLesson() {
    const selectedType = document.querySelector('input[name="lesson_type"]:checked');
    const subSelect = document.getElementById('lessonSub');
    
    if (!selectedType) return null;
    const type = selectedType.value;
    const sub = subSelect.value;
    if (!sub) return null;
    return `${type} - ${sub}`;
}

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

function validateICPassportFormat(value) {
    // Must contain only letters and numbers
    if (!/^[A-Z0-9]+$/.test(value)) {
        return { valid: false, message: 'IC/Passport must contain only letters and numbers.' };
    }
    // Must be at least 8 characters
    if (value.length < 8) {
        return { valid: false, message: 'IC/Passport must be at least 8 characters.' };
    }
    // Must be at most 20 characters
    if (value.length > 20) {
        return { valid: false, message: 'IC/Passport must be at most 20 characters.' };
    }
    return { valid: true };
}

function validateNameFormat(value) {
    // Must contain only letters and spaces
    if (!/^[A-Z\s]+$/.test(value)) {
        return { valid: false, message: 'Name must contain only letters and spaces.' };
    }
    // Must be at least 3 characters
    if (value.length < 3) {
        return { valid: false, message: 'Name must be at least 3 characters.' };
    }
    // Must be at most 100 characters
    if (value.length > 100) {
        return { valid: false, message: 'Name must be at most 100 characters.' };
    }
    return { valid: true };
}

function validateContactFormat(value) {
    // Must contain only numbers
    if (!/^\d+$/.test(value)) {
        return { valid: false, message: 'Contact number must contain only numbers.' };
    }
    // Must be between 10-15 digits
    if (value.length < 10 || value.length > 15) {
        return { valid: false, message: 'Contact number must be 10-15 digits.' };
    }
    return { valid: true };
}

detailsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await goToStep4();
});

async function goToStep4() {
    // Get and validate IC/Passport
    let icno = document.getElementById('icno').value.trim();
    icno = validateICPassport(icno);
    document.getElementById('icno').value = icno;

    // Get and validate Name
    let name = document.getElementById('name').value.trim();
    name = validateName(name);
    document.getElementById('name').value = name;

    // Get and validate Contact
    let contact = document.getElementById('contact').value.trim();
    contact = validateContact(contact);
    document.getElementById('contact').value = contact;

    // Validate lesson selection
    if (!validateLesson()) {
        return;
    }

    // Validate IC/Passport
    if (!icno || icno.length < 8) {
        showMessage('Please enter a valid IC or Passport number (minimum 8 characters).', 'error');
        document.getElementById('icno').focus();
        return;
    }

    const icValidation = validateICPassportFormat(icno);
    if (!icValidation.valid) {
        showMessage(icValidation.message, 'error');
        document.getElementById('icno').focus();
        return;
    }

    // Validate Name
    if (!name || name.length < 3) {
        showMessage('Please enter your full name (minimum 3 characters).', 'error');
        document.getElementById('name').focus();
        return;
    }

    const nameValidation = validateNameFormat(name);
    if (!nameValidation.valid) {
        showMessage(nameValidation.message, 'error');
        document.getElementById('name').focus();
        return;
    }

    // Validate Contact
    if (!contact || contact.length < 10) {
        showMessage('Please enter a valid contact number (minimum 10 digits).', 'error');
        document.getElementById('contact').focus();
        return;
    }

    const contactValidation = validateContactFormat(contact);
    if (!contactValidation.valid) {
        showMessage(contactValidation.message, 'error');
        document.getElementById('contact').focus();
        return;
    }

    // --- Fresh duplicate + future-limit checks against the final IC ---
    // Step 2 checked whatever was in the IC box at date-click time; the user
    // may have typed/edited the IC since then. Re-query both rules now so the
    // state we gate on matches what confirmBooking() will actually submit.
    const dupResult = await checkDuplicateForDate(icno, selectedDate);
    hasDayDuplicate = dupResult.isDuplicate;
    window._dayDuplicateInfo = dupResult.existing || null;

    const limitResult = await checkFutureLimit(icno, selectedDate);
    hasFutureLimit = limitResult.limited;
    futureLimitInfo = limitResult.info;

    // --- Combine both problems into one message (don't let one overwrite the other) ---
    if (hasDayDuplicate || hasFutureLimit) {
        renderStep3Warnings();
        showMessage(
            '⚠️ Please resolve the issues shown above before continuing.\n' +
            'Cancel an existing booking via Manage My Bookings to proceed.',
            'error'
        );
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
        lesson: fullLesson
    };

    const summary = document.getElementById('bookingSummary');
    summary.innerHTML = buildSummaryRows([
        { icon: 'bike', label: 'Class', value: bookingData.class },
        { icon: 'calendar', label: 'Date', value: formatMalaysiaDate(bookingData.date) },
        { icon: 'clock', label: 'Session', value: `${bookingData.session.session_time} - ${formatSlot(bookingData.session.session_slot)}` },
        { icon: 'book-open', label: 'Lesson', value: bookingData.lesson },
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
// DUPLICATE CHECK
// ============================================
async function checkDayDuplicate() {
    const icno = document.getElementById('icno').value.trim();

    if (!icno || icno.length < 8) {
        document.getElementById('dayDuplicateWarning').innerHTML = '';
        hasDayDuplicate = false;
        hasFutureLimit = false;
        futureLimitInfo = null;
        document.getElementById('historyIndicator').classList.add('hidden');
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
            hasDayDuplicate = true;
            const warningContainer = document.getElementById('dayDuplicateWarning');
            if (!warningContainer.querySelector('#dayDuplicateWarningAlert')) {
                warningContainer.innerHTML = `
                    <div id="dayDuplicateWarningAlert" class="alert mb-4" data-variant="destructive">
                        <i data-lucide="circle-alert" class="w-4 h-4"></i>
                        <span class="text-sm">
                            <strong>❌ Booking Not Allowed:</strong> You already have a booking on this date
                            (Session: ${data.session_time} - ${formatSlot(data.session_slot)}).
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
        
        await loadLessonHistory(icno);

    } catch (error) {
        hasDayDuplicate = false;
        document.getElementById('dayDuplicateWarning').innerHTML = '';
        await loadLessonHistory(icno);
    }
}


// Runs on IC blur (Step 3). Checks BOTH same-day duplicate AND future limit.
// Renders the combined warning into #dayDuplicateWarning.
async function checkICOnStep3() {
    const icno = (document.getElementById('icno')?.value || '').trim();
    const warningContainer = document.getElementById('dayDuplicateWarning');

    // Not enough input yet — clear everything and bail.
    if (!icno || icno.length < 8) {
        hasDayDuplicate = false;
        hasFutureLimit = false;
        futureLimitInfo = null;
        window._dayDuplicateInfo = null;
        if (warningContainer) warningContainer.innerHTML = '';
        document.getElementById('historyIndicator').classList.add('hidden');
        return;
    }

    // Same-day duplicate (only meaningful once a date is selected).
    let dupResult = { isDuplicate: false, existing: null };
    if (selectedDate) {
        dupResult = await checkDuplicateForDate(icno, selectedDate);
    }
    hasDayDuplicate = dupResult.isDuplicate;
    window._dayDuplicateInfo = dupResult.existing || null;

    // Future limit — check against the selected date, or "today" if none yet,
    // so the limit is enforced even before the user picks a date.
    const limitRefDate = selectedDate || getMalaysiaToday();
    const limitResult = await checkFutureLimit(icno, limitRefDate);
    hasFutureLimit = limitResult.limited;
    futureLimitInfo = limitResult.info;

    // Render combined warning.
    renderStep3Warnings();

    // History indicator (existing behaviour).
    await loadLessonHistory(icno);
}

function renderStep3Warnings() {
    const warningContainer = document.getElementById('dayDuplicateWarning');
    if (!warningContainer) return;

    const problems = [];

    if (hasDayDuplicate) {
        const existing = window._dayDuplicateInfo;
        const detail = existing
            ? ` (Session: ${existing.session_time} - ${formatSlot(existing.session_slot)})`
            : '';
        problems.push(
            `<strong>❌ Booking Not Allowed:</strong> You already have a booking on this date${detail}. ` +
            `You can only have ONE booking per day. ` +
            `<a href="manage-booking.html" target="_blank" class="underline font-medium">Cancel your existing booking first</a>.`
        );
    }

    if (hasFutureLimit && futureLimitInfo) {
        const info = futureLimitInfo;
        const existing = Array.isArray(info.existing) ? info.existing : [];
        const list = existing.length
            ? existing.map(b =>
                `• ${b.booking_date} — ${b.session_time} (${formatSlot(b.session_slot)})`
              ).join('\n')
            : '(existing bookings could not be listed)';
        const max = info.max ?? 2;
        problems.push(
            `<strong>⚠️ Future Booking Limit Reached:</strong> You already have the maximum ${max} future bookings.\n${list}\n` +
            `Cancel one via <a href="manage-booking.html" target="_blank" class="underline font-medium">Manage My Bookings</a> before booking another.`
        );
    }

    if (problems.length === 0) {
        warningContainer.innerHTML = '';
        return;
    }

    warningContainer.innerHTML = `
        <div id="dayDuplicateWarningAlert" class="alert mb-4" data-variant="destructive">
            <i data-lucide="circle-alert" class="w-4 h-4"></i>
            <span class="text-sm whitespace-pre-line">${problems.join('\n\n')}</span>
        </div>
    `;
    refreshIcons();
}

// Checks whether a given IC already has a confirmed booking on a given date.
// Returns { isDuplicate: boolean, existing: object|null }.
// Does NOT touch UI or state — callers decide what to do with the result.
async function checkDuplicateForDate(icno, dateStr) {
    if (!icno || icno.length < 8 || !dateStr) {
        return { isDuplicate: false, existing: null };
    }

    try {
        const { data, error } = await supabaseClient
            .from('bookings')
            .select('session_id, session_time, session_slot, booking_date')
            .eq('icno', icno)
            .eq('booking_date', dateStr)
            .eq('status', 'confirmed')
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            return { isDuplicate: true, existing: data };
        }
        return { isDuplicate: false, existing: null };

    } catch (error) {
        console.error('Error checking duplicate for date:', error);
        // Fail open for the early-warning layer: don't block the user on a
        // network/transient error. The Confirm-time RPC is the enforcement layer.
        return { isDuplicate: false, existing: null };
    }
}

async function checkFutureLimit(icno, dateStr) {
    if (!icno || icno.length < 8 || !dateStr) {
        return { limited: false, info: null };
    }
    try {
        const { data, error } = await supabaseClient
            .rpc('check_future_booking_limit', {
                p_icno: icno,
                p_booking_date: dateStr
            });

        if (error) throw error;

        if (data && data.allowed === false) {
            return { limited: true, info: data };
        }
        return { limited: false, info: data || null };
    } catch (error) {
        console.error('Error checking future booking limit:', error);
        // Fail open — the trigger is the real gate.
        return { limited: false, info: null };
    }
}

// ============================================
// LESSON HISTORY FUNCTIONS
// ============================================
async function loadLessonHistory(icno) {
    try {
        const { data: bookings, error } = await supabaseClient
            .from('bookings')
            .select('*')
            .eq('icno', icno)
            .order('booking_date', { ascending: false });
        
        if (error) throw error;
        
        if (!bookings || bookings.length === 0) {
            const indicator = document.getElementById('historyIndicator');
            if (indicator) indicator.classList.add('hidden');
            return;
        }
        
        const historyIndicator = document.getElementById('historyIndicator');
        historyIndicator.classList.remove('hidden');
        document.getElementById('historyCount').textContent = bookings.length;
        
        const plural = document.getElementById('historyPlural');
        if (plural) {
            plural.textContent = bookings.length > 1 ? 's' : '';
        }
        
        window._lessonHistory = bookings;
        
    } catch (error) {
        console.error('Error loading lesson history:', error);
    }
}

function getLessonType(lessonStr) {
    if (!lessonStr) return null;
    const parts = lessonStr.split(' - ');
    return parts.length === 2 ? parts[0] : null;
}

function renderHistorySummary(bookings) {
    const summaryDiv = document.getElementById('historySummary');
    
    const counts = {};
    bookings.forEach(booking => {
        if (booking.status !== 'confirmed') return;
        const lessonType = getLessonType(booking.lesson);
        if (!lessonType) return;
        if (!counts[lessonType]) {
            counts[lessonType] = 0;
        }
        counts[lessonType]++;
    });
    
    let html = '';
    for (const [type, config] of Object.entries(LESSON_TYPES_SIMPLE)) {
        const count = counts[type] || 0;
        html += `
            <div class="p-2 rounded-lg border" style="border-color: #e5e7eb;">
                <div class="font-semibold" style="color: #111827;">${config.label}</div>
                <div style="color: #6b7280;">${count} / ${config.max}</div>
            </div>
        `;
    }
    
    summaryDiv.innerHTML = html;
}

function renderHistoryBookings(bookings) {
    const listDiv = document.getElementById('historyBookingsList');
    
    if (!bookings || bookings.length === 0) {
        listDiv.innerHTML = '<p class="text-sm text-muted-foreground text-center py-4">No lesson history found.</p>';
        return;
    }
    
    let html = '';
    bookings.forEach((booking) => {
        const isPast = booking.booking_date < getMalaysiaToday();
        const dateObj = new Date(booking.booking_date + 'T00:00:00');
        const dateStr = dateObj.toLocaleDateString('en-MY', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
        
        const statusIcon = booking.status === 'confirmed' ? '✅' : '❌';
        const statusText = booking.status === 'confirmed' ? 'Confirmed' : booking.status.toUpperCase();
        
        html += `
            <div class="history-item p-2.5 rounded-lg border ${isPast ? 'history-item-past' : 'history-item-upcoming'}" style="border-color: #e5e7eb;">
                <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-medium" style="color: #111827;">${booking.lesson || 'N/A'}</span>
                            <span class="text-xs px-1.5 py-0.5 rounded" style="background: #f3f4f6; color: #6b7280;">${booking.class}</span>
                        </div>
                        <div class="text-xs" style="color: #6b7280; margin-top: 1px;">
                            ${dateStr} • ${booking.session_time}
                        </div>
                    </div>
                    <div class="text-xs text-right ml-2 shrink-0">
                        <div>${statusIcon}</div>
                        <div style="color: ${booking.status === 'confirmed' ? '#065f46' : '#991b1b'}; font-size: 9px;">${statusText}</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `
        <div class="text-center text-xs pt-2" style="color: #6b7280;">
            Total: ${bookings.length} lesson${bookings.length > 1 ? 's' : ''}
        </div>
    `;
    
    listDiv.innerHTML = html;
}

// ============================================
// MODAL MANAGEMENT
// ============================================
function openGuideModal(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    if (activeModal && activeModal !== 'guide') {
        closeHistoryModal();
    }
    
    const modal = document.getElementById('guideModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        activeModal = 'guide';
        refreshIcons();
    }
}

function closeGuideModal(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const modal = document.getElementById('guideModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        if (activeModal === 'guide') {
            activeModal = null;
        }
        if (!activeModal) {
            document.body.style.overflow = '';
        }
        refreshIcons();
    }
}

function openHistoryModal() {
    if (activeModal && activeModal !== 'history') {
        closeGuideModal();
    }
    
    const bookings = window._lessonHistory || [];
    const modal = document.getElementById('historyModal');
    
    if (!modal) return;
    
    renderHistorySummary(bookings);
    renderHistoryBookings(bookings);
    
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    activeModal = 'history';
    refreshIcons();
}

function closeHistoryModal(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const modal = document.getElementById('historyModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        if (activeModal === 'history') {
            activeModal = null;
        }
        if (!activeModal) {
            document.body.style.overflow = '';
        }
        refreshIcons();
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    if (!activeModal) return;
    
    const modalId = activeModal === 'guide' ? 'guideModal' : 'historyModal';
    const modal = document.getElementById(modalId);
    if (!modal || modal.classList.contains('hidden')) return;
    
    const modalContent = modal.querySelector('div');
    if (!modalContent) return;
    
    if (!modalContent.contains(event.target)) {
        const triggerButton = activeModal === 'guide' ? 
            document.querySelector('[onclick="openGuideModal()"]') : 
            document.getElementById('historyIndicator');
            
        if (triggerButton && triggerButton.contains(event.target)) {
            return;
        }
        
        if (activeModal === 'guide') {
            closeGuideModal();
        } else {
            closeHistoryModal();
        }
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && activeModal) {
        if (activeModal === 'guide') {
            closeGuideModal();
        } else {
            closeHistoryModal();
        }
    }
});

// ============================================
// STEP 4: Submit Booking
// ============================================
function showConfirmDialog() {
    document.getElementById('confirmClass').textContent   = bookingData.class;
    document.getElementById('confirmDate').textContent    = formatMalaysiaDate(bookingData.date);
    document.getElementById('confirmSession').textContent = `${bookingData.session.session_time} - ${formatSlot(bookingData.session.session_slot)}`;
    document.getElementById('confirmLesson').textContent  = bookingData.lesson;
    document.getElementById('confirmName').textContent    = bookingData.name;
    document.getElementById('confirmIC').textContent      = bookingData.icno;
    document.getElementById('confirmContact').textContent = bookingData.contact;

    document.getElementById('confirmDialog').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    refreshIcons();
}

function closeConfirmDialog() {
    document.getElementById('confirmDialog').classList.add('hidden');
    document.body.style.overflow = '';
}

function submitBooking() {
    if (!bookingData
        || !bookingData.class
        || !bookingData.date
        || !bookingData.session
        || !bookingData.name
        || !bookingData.icno
        || !bookingData.contact
        || !bookingData.lesson) {
        showMessage('Missing booking information. Please go back and check your details.', 'error');
        return;
    }
    showConfirmDialog();
}

function handleBookingError(err, confirmBtn, originalHTML) {
    const code = err?.code || '';
    const msg  = err?.message || '';
    const hint = err?.hint || err?.details || '';

    // Restore the button first so every path below leaves UI consistent.
    const restore = () => {
        confirmBtn.innerHTML = originalHTML;
        confirmBtn.disabled = false;
        refreshIcons();
    };

    // ---- Slot-level errors (raised by confirm_booking) ----
    if (/SLOT_NOT_FOUND/.test(msg) || /SLOT_NOT_FOUND/.test(hint)) {
        restore();
        showMessage(
            'This session is no longer available. Please pick another session.',
            'error'
        );
        return true;
    }

    if (/SLOT_CLOSED/.test(msg) || /SLOT_CLOSED/.test(hint)) {
        restore();
        showMessage(
            'This session has just been closed by the admin. Please pick another session.',
            'error'
        );
        return true;
    }

    if (/SLOT_FULL/.test(msg) || /SLOT_FULL/.test(hint)) {
        restore();
        // Tailor the message: was this a reserved slot?
        const wasReserved = !!bookingData?.session?.is_reserved;
        if (wasReserved && !window._isSpecialViewer) {
            showMessage(
                'This session is reserved for private access and the remaining seats ' +
                'are not available on the public booking page. Please choose another session, ' +
                'or use the private link you were given.',
                'error'
            );
        } else {
            showMessage(
                'This session just filled up. Please pick another session.',
                'error'
            );
        }
        return true;
    }

    if (/SLOT_RESERVED_ONLY/.test(msg) || /SLOT_RESERVED_ONLY/.test(hint)) {
        restore();
        showMessage(
            'This session is reserved for private access. Please choose another session, ' +
            'or use the private link you were given.',
            'error'
        );
        return true;
    }

    if (/TOKEN_INVALID/.test(msg) || /TOKEN_INVALID/.test(hint)) {
        restore();
        showMessage(
            'Your private link is no longer valid (it may have expired, been revoked, ' +
            'or reached its usage limit). Please contact the admin for a new link, ' +
            'or choose a public session.',
            'error'
        );
        // Flag the token as bad for the rest of the session
        window._isSpecialViewer = false;
        return true;
    }

    // NEW: token is valid but belongs to the other class.
    // Only raised when the slot is reserved AND the token's class ≠ booking class.
    // The token itself is fine — it just doesn't grant access to THIS reserved slot.
    if (/TOKEN_CLASS_MISMATCH/.test(msg) || /TOKEN_CLASS_MISMATCH/.test(hint)) {
        restore();
        const tokenClass = window._privateTokenClass || null;
        const classLabel = tokenClass ? `Class ${tokenClass}` : 'a different class';
        showMessage(
            `This private link is for ${classLabel} only. ` +
            `You can still book public sessions, or contact the admin for the correct link.`,
            'error'
        );
        // Do NOT flip window._isSpecialViewer — the token is still valid.
        return true;
    }

    // ---- Existing rules (still enforced by triggers inside confirm_booking) ----
    if (code === 'P0001' && /FUTURE_BOOKING_LIMIT/.test(msg)) {
        restore();
        showMessage(
            '⚠️ You already have the maximum 2 future bookings. ' +
            'Please cancel one of your existing bookings via Manage My Bookings before booking another.',
            'error'
        );
        return true;
    }

    if (code === 'P0001' && /DUPLICATE_BOOKING/.test(msg)) {
        restore();
        showMessage(
            'You already have a confirmed booking on this date. ' +
            'Cancel it via Manage My Bookings before booking another.',
            'error'
        );
        return true;
    }

    // ---- Belt-and-braces: unique constraint ----
    if (code === '23505') {
        restore();
        showMessage(
            'This booking already exists. Please check Manage My Bookings.',
            'error'
        );
        return true;
    }

    // ---- Unrecognised ----
    return false;
}

async function confirmBooking() {
    closeConfirmDialog();

    const confirmBtn  = document.querySelector('#step4 button[onclick="submitBooking()"]');
    const originalHTML = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<i data-lucide="loader-circle" class="w-4 h-4 animate-spin"></i> Processing...';
    confirmBtn.disabled = true;
    refreshIcons();

    try {
        // ---- 1) Pre-flight duplicate check (fast, gives a richer existing-booking card) ----
        //     The RPC is still the authoritative gate; this is purely UX.
        showMessage('Checking for duplicate bookings...', 'info');

        const { data: duplicateCheck, error: dupError } = await supabaseClient
            .rpc('check_duplicate_booking', {
                p_icno:         bookingData.icno,
                p_booking_date: bookingData.date,
                p_session_time: bookingData.session.session_time,
                p_session_slot: bookingData.session.session_slot,
                p_class:        bookingData.class
            });

        if (dupError) throw dupError;

        if (duplicateCheck && duplicateCheck.is_duplicate) {
            let message = duplicateCheck.message || 'You already have a booking on this date.';
            if (duplicateCheck.existing_session_time !== bookingData.session.session_time ||
                duplicateCheck.existing_session_slot !== bookingData.session.session_slot) {
                message += '\n\n💡 You can only have ONE booking per day. To book a different session, first cancel your existing booking using the Session ID above.';
            } else {
                message += '\n\n💡 You are trying to book the exact same session. Please check your existing booking.';
            }
            showMessage(message, 'error');
            showExistingBooking(duplicateCheck);
            confirmBtn.innerHTML = originalHTML;
            confirmBtn.disabled = false;
            refreshIcons();
            return;
        }

        // ---- 2) Create the booking through the server-side gate ----
        showMessage('Creating booking...', 'info');

        const { data: booking, error: createError } = await supabaseClient
            .rpc('confirm_booking', {
                p_icno:         bookingData.icno,
                p_name:         bookingData.name,
                p_contact_no:   bookingData.contact,
                p_class:        bookingData.class,
                p_booking_date: bookingData.date,
                p_session_time: bookingData.session.session_time,
                p_session_slot: bookingData.session.session_slot,
                p_lesson:       bookingData.lesson,
                p_token:        PRIVATE_TOKEN
            });

        // ---- 3) Handle any server error in one place ----
        if (createError) {
            const handled = handleBookingError(createError, confirmBtn, originalHTML);
            if (handled) return;
            throw createError;
        }

        // ---- 4) Defensive: RPC succeeded but returned no row ----
        if (!booking || !booking.session_id) {
            confirmBtn.innerHTML = originalHTML;
            confirmBtn.disabled = false;
            refreshIcons();
            showMessage(
                'Booking was submitted, but the confirmation could not be loaded. ' +
                'Please check Manage My Bookings to verify.',
                'error'
            );
            return;
        }

        // ---- 5) Success ----
        showConfirmation(booking.session_id);

    } catch (error) {
        console.error('Booking error:', error);

        // Anything that escaped handleBookingError(): network failure, RPC missing, etc.
        const msg = error?.message || 'Unknown error';
        if (/function.*confirm_booking.*does not exist/i.test(msg)) {
            showMessage(
                'Booking system is not fully set up (confirm_booking RPC missing). ' +
                'Please contact the admin.',
                'error'
            );
        } else if (/Failed to fetch|NetworkError|network/i.test(msg)) {
            showMessage(
                'Network error while creating your booking. Please check your connection and try again.',
                'error'
            );
        } else {
            showMessage('Error creating booking: ' + msg, 'error');
        }

        confirmBtn.innerHTML = originalHTML;
        confirmBtn.disabled = false;
        refreshIcons();
    }
}

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
                <div class="flex justify-between gap-2"><dt class="text-red-700/80">Session Slot</dt><dd>${formatSlot(duplicateCheck.existing_session_slot)}</dd></div>
            </dl>
            <p class="text-xs text-red-700 pt-1 border-t border-red-200">
                <strong>Cancel this booking first.</strong> Go to
                <a href="manage-booking.html" target="_blank" class="underline font-medium">Manage My Bookings</a>
                and use the Session ID above to cancel.
            </p>
        </div>
    `;
    summary.innerHTML += existingHTML;
    refreshIcons();
}

function showConfirmation(sessionId) {
    document.getElementById('confirmationDetails').innerHTML = buildSummaryRows([
        { icon: 'hash', label: 'Session ID', value: sessionId },
        { icon: 'bike', label: 'Class', value: bookingData.class },
        { icon: 'calendar', label: 'Date', value: formatMalaysiaDate(bookingData.date) },
        { icon: 'clock', label: 'Session', value: `${bookingData.session.session_time} - ${formatSlot(bookingData.session.session_slot)}` },
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
// RESET
// ============================================
function resetAll() {
    resetStep2State();
    showStep(1);
    bookingData = {};
    document.getElementById('icno').value = '';
    document.getElementById('name').value = '';
    document.getElementById('contact').value = '';
    hideMessage();
}

// ============================================
// INITIALIZE
// ============================================
document.addEventListener('DOMContentLoaded', async () => {

    // ---- 1) Base init (unchanged) ----
    initMonthYear();
    showStep(1);
    updateTodayIndicator();

    // ---- 2) Validate the private token ONCE at boot ----
    // We do this before anything else so every later RPC and every
    // UI decision (badge, messages, SLOT_FULL tailoring) uses the
    // same verdict.
        window._isSpecialViewer = false;
    window._privateTokenClass = null;   // NEW: 'B' | 'B2' | null

    if (PRIVATE_TOKEN) {
        try {
            const { data, error } = await supabaseClient
                .rpc('validate_private_token', { p_token: PRIVATE_TOKEN });

            // Normalise whatever shape the RPC returns:
            //   true  |  {valid: true}  |  {valid: true, label, class}
            let valid = false;
            let label = null;
            let tokenClass = null;      // NEW

            if (error) {
                console.warn('validate_private_token error:', error.message);
            } else if (data === true) {
                valid = true;
            } else if (data && typeof data === 'object') {
                valid = data.valid === true;
                label = data.label || data.notes || null;
                tokenClass = data.class || null;    // NEW
            }

            window._isSpecialViewer  = valid;
            window._privateTokenClass = valid ? tokenClass : null;   // NEW

            if (valid) {
                showPrivateBadge(label, tokenClass);                 // NEW: pass class
            } else {
                showMessage(
                    'The private link in your URL is invalid, expired, or has been revoked. ' +
                    'You are browsing as a normal user. Contact the admin for a new link if needed.',
                    'error'
                );
            }
        } catch (err) {
            console.error('Token validation failed:', err);
            window._isSpecialViewer  = false;
            window._privateTokenClass = null;
        }
    }

    // ---- 3) IC/Passport input ----
    const icnoInput = document.getElementById('icno');
    if (icnoInput) {
        icnoInput.addEventListener('blur', checkICOnStep3);
        icnoInput.addEventListener('input', function () {
            let value = this.value.replace(/[^a-zA-Z0-9]/g, '');
            value = value.toUpperCase();
            if (this.value !== value) {
                this.value = value;
            }

            hasDayDuplicate = false;
            window._dayDuplicateInfo = null;
            document.getElementById('dayDuplicateWarning').innerHTML = '';

            hasFutureLimit = false;
            futureLimitInfo = null;

            document.getElementById('historyIndicator').classList.add('hidden');

            clearTimeout(_icDebounceTimer);
            const ic = value.trim();
            if (ic.length >= 8) {
                _icDebounceTimer = setTimeout(checkICOnStep3, 500);
            }
        });

        icnoInput.addEventListener('paste', function (e) {
            e.preventDefault();
            const paste = (e.clipboardData || window.clipboardData).getData('text');
            const cleaned = paste.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            document.execCommand('insertText', false, cleaned);
        });
    }

    // ---- 4) Name input ----
    const nameInput = document.getElementById('name');
    if (nameInput) {
        nameInput.addEventListener('input', function () {
            let value = this.value.replace(/[^a-zA-Z\s]/g, '');
            value = value.toUpperCase();
            if (this.value !== value) {
                this.value = value;
            }
        });

        nameInput.addEventListener('paste', function (e) {
            e.preventDefault();
            const paste = (e.clipboardData || window.clipboardData).getData('text');
            const cleaned = paste.replace(/[^a-zA-Z\s]/g, '').toUpperCase();
            document.execCommand('insertText', false, cleaned);
        });
    }

    // ---- 5) Contact input ----
    const contactInput = document.getElementById('contact');
    if (contactInput) {
        contactInput.addEventListener('input', function () {
            let value = this.value.replace(/\D/g, '');
            if (this.value !== value) {
                this.value = value;
            }
        });

        contactInput.addEventListener('paste', function (e) {
            e.preventDefault();
            const paste = (e.clipboardData || window.clipboardData).getData('text');
            const cleaned = paste.replace(/\D/g, '');
            document.execCommand('insertText', false, cleaned);
        });
    }

    refreshIcons();
});


// ============================================
// PRIVATE BADGE HELPER
// ============================================
/**
 * Inject a small "🔒 Private access enabled" chip just below the header
 * subtitle. Called only when a token is validated at boot.
 *
 * Falls back silently if #privateBadge is not present in the HTML
 * (so you can roll this out without touching booking.html first).
 */
function showPrivateBadge(label, tokenClass) {
    // Build the class segment: ' · Class B' / ' · Class B2' / '' (legacy = both)
    const classSegment = tokenClass ? ` · Class ${tokenClass}` : '';

    const badge = document.getElementById('privateBadge');
    if (!badge) {
        // Fallback: no dedicated badge element — use the message bar.
        showMessage(
            '🔒 Private access enabled' +
            classSegment +
            (label ? ` (${label})` : '') +
            '. Reserved seats are visible to you.',
            'success'
        );
        return;
    }

    badge.innerHTML = `
        <i data-lucide="lock" class="w-3.5 h-3.5"></i>
        <span>Private access${classSegment}${label ? ` · ${label}` : ''}</span>
    `;
    badge.classList.remove('hidden');
    refreshIcons();
}

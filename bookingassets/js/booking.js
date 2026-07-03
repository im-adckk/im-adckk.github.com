// Supabase Configuration
const SUPABASE_URL = 'https://yrrinzreyafiowehhhon.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4MnAXo4yxHMQX7fSn7hQjA_qV2X7t7o';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State variables
let selectedClass = '';
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = null;
let selectedSession = null;
let availableSessionsData = [];
let bookingData = {};

// DOM Elements
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const step4 = document.getElementById('step4');
const step5 = document.getElementById('step5');
const classForm = document.getElementById('classForm');
const detailsForm = document.getElementById('detailsForm');
const messageDiv = document.getElementById('message');

// ============================================
// STEP 1: Class Selection
// ============================================
classForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    selectedClass = document.querySelector('input[name="class"]:checked').value;
    document.getElementById('selectedClassDisplay').textContent = `Selected Class: ${selectedClass}`;
    
    step1.style.display = 'none';
    step2.style.display = 'block';
    
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
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    monthDisplay.textContent = new Date(currentYear, currentMonth).toLocaleDateString('en-MY', { 
        month: 'long', 
        year: 'numeric' 
    });
    
    // Clear calendar
    calendar.innerHTML = '';
    
    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        const div = document.createElement('div');
        div.textContent = day;
        div.style.fontWeight = 'bold';
        div.style.textAlign = 'center';
        div.style.padding = '5px';
        calendar.appendChild(div);
    });
    
    // Empty cells for days before first day
    for (let i = 0; i < firstDay; i++) {
        const div = document.createElement('div');
        div.style.padding = '5px';
        calendar.appendChild(div);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(currentYear, currentMonth, day);
        const dateStr = dateObj.toISOString().split('T')[0];
        const div = document.createElement('div');
        div.textContent = day;
        div.style.padding = '10px 5px';
        div.style.textAlign = 'center';
        div.style.border = '1px solid #ddd';
        div.style.cursor = 'pointer';
        div.style.borderRadius = '4px';
        div.dataset.date = dateStr;
        
        // Past dates
        if (dateStr < todayStr) {
            div.style.backgroundColor = '#f5f5f5';
            div.style.color = '#999';
            div.style.cursor = 'not-allowed';
        } 
        // Today
        else if (dateStr === todayStr) {
            div.style.backgroundColor = '#f39c12';
            div.style.color = 'white';
            div.textContent = day + ' (Today)';
            div.style.cursor = 'not-allowed';
        } 
        // Future dates - will be styled based on availability
        else {
            div.style.backgroundColor = '#95a5a6'; // Default: inactive
            div.style.color = 'white';
        }
        
        div.addEventListener('click', () => onDateClick(dateStr));
        calendar.appendChild(div);
    }
}

async function checkAvailabilityForMonth() {
    const year = currentYear;
    const month = currentMonth;
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const { data, error } = await supabaseClient
            .from('available_sessions')
            .select('*')
            .eq('class', selectedClass)
            .gte('session_date', startDate)
            .lte('session_date', endDate)
            .gte('session_date', today);
        
        if (error) throw error;
        
        const availabilityMap = {};
        data.forEach(session => {
            if (!availabilityMap[session.session_date]) {
                availabilityMap[session.session_date] = [];
            }
            availabilityMap[session.session_date].push(session);
        });
        
        const cells = document.querySelectorAll('#calendar div[data-date]');
        cells.forEach(cell => {
            const dateStr = cell.dataset.date;
            
            if (dateStr < today || dateStr === today) return;
            
            const sessions = availabilityMap[dateStr] || [];
            const hasAvailable = sessions.some(s => s.current_bookings < s.max_bookings);
            
            if (hasAvailable) {
                cell.style.backgroundColor = '#2ecc71';
                cell.style.color = 'white';
            } else if (sessions.length > 0) {
                cell.style.backgroundColor = '#e74c3c';
                cell.style.color = 'white';
            } else {
                cell.style.backgroundColor = '#95a5a6';
                cell.style.color = 'white';
            }
        });
        
    } catch (error) {
        console.error('Error checking availability:', error);
    }
}

async function resetCalendarColors() {
    const today = new Date().toISOString().split('T')[0];
    const cells = document.querySelectorAll('#calendar div[data-date]');
    
    const year = currentYear;
    const month = currentMonth;
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
    
    try {
        const { data, error } = await supabaseClient
            .from('available_sessions')
            .select('*')
            .eq('class', selectedClass)
            .gte('session_date', startDate)
            .lte('session_date', endDate)
            .gte('session_date', today);
        
        if (error) throw error;
        
        const availabilityMap = {};
        data.forEach(session => {
            if (!availabilityMap[session.session_date]) {
                availabilityMap[session.session_date] = [];
            }
            availabilityMap[session.session_date].push(session);
        });
        
        cells.forEach(cell => {
            const dateStr = cell.dataset.date;
            
            // Skip if this is the currently selected date
            if (dateStr === selectedDate) return;
            
            if (dateStr < today) {
                cell.style.backgroundColor = '#f5f5f5';
                cell.style.color = '#999';
                cell.style.cursor = 'not-allowed';
                cell.style.border = '1px solid #ddd';
            } 
            else if (dateStr === today) {
                cell.style.backgroundColor = '#f39c12';
                cell.style.color = 'white';
                cell.style.border = '1px solid #ddd';
                const day = new Date(dateStr).getDate();
                cell.textContent = day + ' (Today)';
            } 
            else {
                const sessions = availabilityMap[dateStr] || [];
                const hasAvailable = sessions.some(s => s.current_bookings < s.max_bookings);
                
                if (hasAvailable) {
                    cell.style.backgroundColor = '#2ecc71';
                    cell.style.color = 'white';
                } else if (sessions.length > 0) {
                    cell.style.backgroundColor = '#e74c3c';
                    cell.style.color = 'white';
                } else {
                    cell.style.backgroundColor = '#95a5a6';
                    cell.style.color = 'white';
                }
                cell.style.border = '1px solid #ddd';
                cell.style.cursor = 'pointer';
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
    document.getElementById('sessionsContainer').style.display = 'none';
    document.getElementById('nextToDetailsBtn').style.display = 'none';
    renderCalendar();
    checkAvailabilityForMonth();
}

function goToToday() {
    const today = new Date();
    currentMonth = today.getMonth();
    currentYear = today.getFullYear();
    selectedDate = null;
    selectedSession = null;
    document.getElementById('selectedDateDisplay').textContent = '';
    document.getElementById('sessionsContainer').style.display = 'none';
    document.getElementById('nextToDetailsBtn').style.display = 'none';
    renderCalendar();
    checkAvailabilityForMonth();
}

async function onDateClick(dateStr) {
    const today = new Date().toISOString().split('T')[0];
    
    if (dateStr < today) {
        showMessage('Cannot select past dates.', 'error');
        return;
    }
    if (dateStr === today) {
        showMessage('Cannot book for today. Please select a future date.', 'error');
        return;
    }
    
    // If clicking the same date, deselect it
    if (selectedDate === dateStr) {
        selectedDate = null;
        selectedSession = null;
        document.getElementById('selectedDateDisplay').textContent = '';
        document.getElementById('sessionsContainer').style.display = 'none';
        document.getElementById('nextToDetailsBtn').style.display = 'none';
        await resetCalendarColors();
        return;
    }
    
    selectedDate = dateStr;
    document.getElementById('selectedDateDisplay').textContent = `Selected Date: ${formatDate(dateStr)}`;
    
    // Reset all dates to their original colors
    await resetCalendarColors();
    
    // Highlight selected date
    const cells = document.querySelectorAll('#calendar div[data-date]');
    cells.forEach(cell => {
        if (cell.dataset.date === dateStr) {
            cell.style.backgroundColor = '#3498db';
            cell.style.color = 'white';
            cell.style.border = '3px solid #2980b9';
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
        
        availableSessionsData = data || [];
        
        const sessionsContainer = document.getElementById('sessionsContainer');
        const sessionsList = document.getElementById('sessionsList');
        const nextBtn = document.getElementById('nextToDetailsBtn');
        
        if (!data || data.length === 0) {
            sessionsList.innerHTML = '<p style="color:red;">No sessions available for this date.</p>';
            sessionsContainer.style.display = 'block';
            nextBtn.style.display = 'none';
            return;
        }
        
        let html = '';
        data.forEach((session, index) => {
            const available = session.max_bookings - session.current_bookings;
            const isSelected = selectedSession === index;
            html += `
                <div style="
                    padding:10px;
                    margin:5px 0;
                    border:2px solid ${isSelected ? '#3498db' : '#ddd'};
                    border-radius:4px;
                    cursor:pointer;
                    background-color: ${isSelected ? '#ebf5fb' : 'white'};
                " onclick="selectSession(${index})">
                    <strong>${session.session_time}</strong> - ${session.session_slot}
                    <span style="float:right;">
                        ${available} slots available
                    </span>
                </div>
            `;
        });
        
        sessionsList.innerHTML = html;
        sessionsContainer.style.display = 'block';
        nextBtn.style.display = 'none';
        selectedSession = null;
        
        showMessage('Select a session time to continue.', 'info');
        
    } catch (error) {
        console.error('Error loading sessions:', error);
        showMessage('Error loading sessions. Please try again.', 'error');
    }
}

function selectSession(index) {
    selectedSession = index;
    const sessionsList = document.getElementById('sessionsList');
    const items = sessionsList.querySelectorAll('div');
    
    items.forEach((item, i) => {
        if (i === index) {
            item.style.border = '2px solid #3498db';
            item.style.backgroundColor = '#ebf5fb';
        } else {
            item.style.border = '2px solid #ddd';
            item.style.backgroundColor = 'white';
        }
    });
    
    document.getElementById('nextToDetailsBtn').style.display = 'block';
    showMessage('Session selected. Click "Next" to enter your details.', 'success');
}

function goToStep3() {
    if (selectedSession === null) {
        showMessage('Please select a session first.', 'error');
        return;
    }
    
    step2.style.display = 'none';
    step3.style.display = 'block';
}

function goBackStep1() {
    step2.style.display = 'none';
    step1.style.display = 'block';
}

function goBackStep2() {
    step3.style.display = 'none';
    step2.style.display = 'block';
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
    
    bookingData = {
        icno: icno,
        name: name,
        contact: contact,
        class: selectedClass,
        date: selectedDate,
        session: availableSessionsData[selectedSession]
    };
    
    const summary = document.getElementById('bookingSummary');
    summary.innerHTML = `
        <table border="1" cellpadding="10" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:600px;">
            <tr>
                <td><strong>Class</strong></td>
                <td>${bookingData.class}</td>
            </tr>
            <tr>
                <td><strong>Date</strong></td>
                <td>${formatDate(bookingData.date)}</td>
            </tr>
            <tr>
                <td><strong>Session</strong></td>
                <td>${bookingData.session.session_time} - ${bookingData.session.session_slot}</td>
            </tr>
            <tr>
                <td><strong>Name</strong></td>
                <td>${bookingData.name}</td>
            </tr>
            <tr>
                <td><strong>IC/Passport</strong></td>
                <td>${bookingData.icno}</td>
            </tr>
            <tr>
                <td><strong>Contact</strong></td>
                <td>${bookingData.contact}</td>
            </tr>
        </table>
    `;
    
    step3.style.display = 'none';
    step4.style.display = 'block';
}

function goBackStep3() {
    step4.style.display = 'none';
    step3.style.display = 'block';
}

// ============================================
// STEP 4: Submit Booking
// ============================================
async function submitBooking() {
    try {
        showMessage('Creating booking...', 'info');
        
        const { data: duplicate, error: dupError } = await supabaseClient
            .rpc('check_duplicate_booking', {
                p_icno: bookingData.icno,
                p_booking_date: bookingData.date,
                p_session_time: bookingData.session.session_time,
                p_session_slot: bookingData.session.session_slot,
                p_class: bookingData.class
            });
        
        if (dupError) throw dupError;
        
        if (duplicate) {
            showMessage('You already have a booking for this session!', 'error');
            return;
        }
        
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
        
        if (createError) throw createError;
        
        showConfirmation(booking.session_id);
        
    } catch (error) {
        console.error('Booking error:', error);
        showMessage('Error creating booking: ' + error.message, 'error');
    }
}

function showConfirmation(sessionId) {
    step4.style.display = 'none';
    step5.style.display = 'block';
    
    document.getElementById('confirmationDetails').innerHTML = `
        <div style="padding:20px;border:2px solid #2ecc71;border-radius:8px;max-width:500px;margin:0 auto;">
            <p><strong>Session ID:</strong> ${sessionId}</p>
            <p><strong>Class:</strong> ${bookingData.class}</p>
            <p><strong>Date:</strong> ${formatDate(bookingData.date)}</p>
            <p><strong>Session:</strong> ${bookingData.session.session_time} - ${bookingData.session.session_slot}</p>
            <p><strong>Name:</strong> ${bookingData.name}</p>
            <p><strong>IC/Passport:</strong> ${bookingData.icno}</p>
            <p><strong>Contact:</strong> ${bookingData.contact}</p>
            <p style="color:green;font-weight:bold;font-size:18px;">✓ Booking Confirmed!</p>
            <p><small>Please save your Session ID for future reference.</small></p>
        </div>
    `;
    
    showMessage('Booking successful!', 'success');
}

// ============================================
// Reset
// ============================================
function resetAll() {
    step5.style.display = 'none';
    step1.style.display = 'block';
    selectedDate = null;
    selectedSession = null;
    bookingData = {};
    document.getElementById('icno').value = '';
    document.getElementById('name').value = '';
    document.getElementById('contact').value = '';
    document.getElementById('selectedDateDisplay').textContent = '';
    document.getElementById('sessionsContainer').style.display = 'none';
    document.getElementById('nextToDetailsBtn').style.display = 'none';
}

// ============================================
// Utilities
// ============================================
function showMessage(text, type = 'info') {
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

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-MY', options);
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    step1.style.display = 'block';
    step2.style.display = 'none';
    step3.style.display = 'none';
    step4.style.display = 'none';
    step5.style.display = 'none';
});

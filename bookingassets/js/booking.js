// Supabase Configuration
const SUPABASE_URL = 'https://your-project-id.supabase.co'; // Replace with your URL
const SUPABASE_ANON_KEY = 'sb_publishable_4MnAXo4yxHMQX7fSn7hQjA_qV2X7t7o';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State variables
let selectedClass = '';
let availableDates = [];
let availableSessions = [];

// DOM Elements
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const classForm = document.getElementById('classForm');
const bookingForm = document.getElementById('bookingForm');
const selectedClassInput = document.getElementById('selectedClass');
const bookingDateSelect = document.getElementById('bookingDate');
const sessionTimeSelect = document.getElementById('sessionTime');
const sessionSlotSelect = document.getElementById('sessionSlot');
const messageDiv = document.getElementById('message');
const confirmationDetails = document.getElementById('confirmationDetails');

// Class Selection
classForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    selectedClass = document.querySelector('input[name="class"]:checked').value;
    selectedClassInput.value = selectedClass;
    
    // Show booking form
    step1.style.display = 'none';
    step2.style.display = 'block';
    
    // Load available dates
    await loadAvailableDates();
});

// Booking Form Submit
bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await createBooking();
});

// Load Available Dates
async function loadAvailableDates() {
    try {
        showMessage('Loading available dates...', 'info');
        
        // Get all available dates with sessions
        const { data, error } = await supabase
            .rpc('get_available_sessions_for_date', {
                check_date: null,
                class_filter: selectedClass
            });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            showMessage('No available sessions found for your selected class.', 'error');
            return;
        }
        
        // Get unique dates
        const dates = [...new Set(data.map(item => item.session_date))].sort();
        availableDates = dates;
        
        // Populate date dropdown
        bookingDateSelect.innerHTML = '<option value="">-- Select Date --</option>';
        dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = formatDate(date);
            bookingDateSelect.appendChild(option);
        });
        
        showMessage('Select a date to continue.', 'info');
        
    } catch (error) {
        console.error('Error loading dates:', error);
        showMessage('Error loading available dates. Please try again.', 'error');
    }
}

// Load Sessions for Selected Date
bookingDateSelect.addEventListener('change', async () => {
    const selectedDate = bookingDateSelect.value;
    if (!selectedDate) {
        sessionTimeSelect.innerHTML = '<option value="">-- Select Session --</option>';
        sessionSlotSelect.innerHTML = '<option value="">-- Select Slot --</option>';
        return;
    }
    
    try {
        const { data, error } = await supabase
            .rpc('get_available_sessions_for_date', {
                check_date: selectedDate,
                class_filter: selectedClass
            });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            showMessage('No sessions available for this date.', 'error');
            return;
        }
        
        availableSessions = data;
        
        // Populate session times
        const times = [...new Set(data.map(item => item.session_time))].sort();
        sessionTimeSelect.innerHTML = '<option value="">-- Select Session --</option>';
        times.forEach(time => {
            const option = document.createElement('option');
            option.value = time;
            option.textContent = time;
            sessionTimeSelect.appendChild(option);
        });
        
        // Reset slot dropdown
        sessionSlotSelect.innerHTML = '<option value="">-- Select Slot --</option>';
        
        showMessage('Select a session time.', 'info');
        
    } catch (error) {
        console.error('Error loading sessions:', error);
        showMessage('Error loading sessions. Please try again.', 'error');
    }
});

// Load Slots for Selected Time
sessionTimeSelect.addEventListener('change', () => {
    const selectedTime = sessionTimeSelect.value;
    const selectedDate = bookingDateSelect.value;
    
    if (!selectedTime || !selectedDate) {
        sessionSlotSelect.innerHTML = '<option value="">-- Select Slot --</option>';
        return;
    }
    
    // Filter slots for selected time and date
    const slots = availableSessions
        .filter(s => s.session_time === selectedTime && s.available_slots > 0)
        .map(s => s.session_slot)
        .sort();
    
    sessionSlotSelect.innerHTML = '<option value="">-- Select Slot --</option>';
    slots.forEach(slot => {
        const option = document.createElement('option');
        option.value = slot;
        const available = availableSessions.find(s => s.session_slot === slot && s.session_time === selectedTime);
        option.textContent = `${slot} (${available.available_slots} slots available)`;
        sessionSlotSelect.appendChild(option);
    });
});

// Create Booking
async function createBooking() {
    const icno = document.getElementById('icno').value.trim();
    const name = document.getElementById('name').value.trim();
    const contact = document.getElementById('contact').value.trim();
    const bookingDate = bookingDateSelect.value;
    const sessionTime = sessionTimeSelect.value;
    const sessionSlot = sessionSlotSelect.value;
    
    // Validation
    if (!icno || icno.length !== 12 || !/^\d{12}$/.test(icno)) {
        showMessage('Please enter a valid 12-digit IC number.', 'error');
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
    
    if (!bookingDate || !sessionTime || !sessionSlot) {
        showMessage('Please select date, time, and slot.', 'error');
        return;
    }
    
    try {
        showMessage('Creating booking...', 'info');
        
        // Check for duplicate booking
        const { data: duplicate, error: dupError } = await supabase
            .rpc('check_duplicate_booking', {
                p_icno: icno,
                p_booking_date: bookingDate,
                p_session_time: sessionTime,
                p_session_slot: sessionSlot,
                p_class: selectedClass
            });
        
        if (dupError) throw dupError;
        
        if (duplicate) {
            showMessage('You already have a booking for this session!', 'error');
            return;
        }
        
        // Create booking
        const { data: booking, error: createError } = await supabase
            .from('bookings')
            .insert([{
                icno: icno,
                name: name,
                contact_no: contact,
                class: selectedClass,
                booking_date: bookingDate,
                session_time: sessionTime,
                session_slot: sessionSlot,
                status: 'confirmed'
            }])
            .select('session_id')
            .single();
        
        if (createError) throw createError;
        
        // Show confirmation
        showConfirmation(booking.session_id, name, bookingDate, sessionTime, sessionSlot);
        
    } catch (error) {
        console.error('Booking error:', error);
        showMessage('Error creating booking: ' + error.message, 'error');
    }
}

// Show Confirmation
function showConfirmation(sessionId, name, date, time, slot) {
    step2.style.display = 'none';
    step3.style.display = 'block';
    
    confirmationDetails.innerHTML = `
        <p><strong>Session ID:</strong> ${sessionId}</p>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Class:</strong> ${selectedClass}</p>
        <p><strong>Date:</strong> ${formatDate(date)}</p>
        <p><strong>Time:</strong> ${time}</p>
        <p><strong>Slot:</strong> ${slot}</p>
        <p style="color: green; font-weight: bold;">✓ Booking Confirmed!</p>
        <p><small>Please save your Session ID for future reference.</small></p>
    `;
    
    showMessage('Booking successful!', 'success');
}

// Go Back
function goBack() {
    step2.style.display = 'none';
    step1.style.display = 'block';
}

// Show Message
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

// Format Date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-MY', options);
}

// Load available dates on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're returning from manage page
    step1.style.display = 'block';
    step2.style.display = 'none';
    step3.style.display = 'none';
});

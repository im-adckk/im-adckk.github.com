
const SUPABASE_URL = 'https://yrrinzreyafiowehhhon.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4MnAXo4yxHMQX7fSn7hQjA_qV2X7t7o';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const searchForm = document.getElementById('searchForm');
const searchIC = document.getElementById('searchIC');
const bookingResults = document.getElementById('bookingResults');
const bookingsList = document.getElementById('bookingsList');
const messageDiv = document.getElementById('message');

// Search Form Submit
searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await searchBookings();
});

// Search Bookings
async function searchBookings() {
    const icno = searchIC.value.trim();
    
    if (!icno || icno.length !== 12 || !/^\d{12}$/.test(icno)) {
        showMessage('Please enter a valid 12-digit IC number.', 'error');
        return;
    }
    
    try {
        showMessage('Searching...', 'info');
        
        // Get all bookings (including past) for this IC
        const { data, error } = await supabase
            .from('bookings')
            .select('*')
            .eq('icno', icno)
            .order('booking_date', { ascending: false });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            showMessage('No bookings found for this IC number.', 'error');
            bookingResults.style.display = 'none';
            return;
        }
        
        // Display bookings
        displayBookings(data);
        bookingResults.style.display = 'block';
        showMessage(`Found ${data.length} booking(s) for IC: ${icno}`, 'success');
        
    } catch (error) {
        console.error('Search error:', error);
        showMessage('Error searching bookings: ' + error.message, 'error');
    }
}

// Display Bookings
function displayBookings(bookings) {
    let html = '';
    
    // Separate upcoming and past
    const upcoming = bookings.filter(b => b.booking_date >= new Date().toISOString().split('T')[0] && b.status === 'confirmed');
    const past = bookings.filter(b => b.booking_date < new Date().toISOString().split('T')[0] || b.status !== 'confirmed');
    
    if (upcoming.length > 0) {
        html += `<h4>Upcoming Bookings</h4>`;
        html += createBookingTable(upcoming);
    }
    
    if (past.length > 0) {
        html += `<h4 style="margin-top:20px;">Past / Cancelled Bookings</h4>`;
        html += createBookingTable(past);
    }
    
    bookingsList.innerHTML = html;
}

// Create Booking Table
function createBookingTable(bookings) {
    let html = `
        <table border="1" cellpadding="10" cellspacing="0" style="width:100%;border-collapse:collapse;">
            <thead>
                <tr>
                    <th>Session ID</th>
                    <th>Class</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Slot</th>
                    <th>Status</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    bookings.forEach(booking => {
        const isUpcoming = booking.booking_date >= new Date().toISOString().split('T')[0] && booking.status === 'confirmed';
        
        html += `
            <tr>
                <td><strong>${booking.session_id}</strong></td>
                <td>${booking.class}</td>
                <td>${formatDate(booking.booking_date)}</td>
                <td>${booking.session_time}</td>
                <td>${booking.session_slot}</td>
                <td style="color: ${booking.status === 'confirmed' ? 'green' : 'red'};">
                    ${booking.status.toUpperCase()}
                </td>
                <td>
                    ${isUpcoming ? `
                        <button onclick="cancelBooking('${booking.session_id}')">Cancel</button>
                    ` : '—'}
                </td>
            </tr>
        `;
    });
    
    html += `</tbody></table>`;
    return html;
}

// Cancel Booking
async function cancelBooking(sessionId) {
    if (!confirm('Are you sure you want to cancel this booking?')) {
        return;
    }
    
    try {
        showMessage('Cancelling booking...', 'info');
        
        const { data, error } = await supabase
            .rpc('cancel_booking', { p_session_id: sessionId });
        
        if (error) throw error;
        
        if (data) {
            showMessage('Booking cancelled successfully!', 'success');
            // Refresh the bookings list
            await searchBookings();
        } else {
            showMessage('Booking not found or already cancelled.', 'error');
        }
        
    } catch (error) {
        console.error('Cancel error:', error);
        showMessage('Error cancelling booking: ' + error.message, 'error');
    }
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

// Load on page load
document.addEventListener('DOMContentLoaded', () => {
    // Focus IC input
    searchIC.focus();
});

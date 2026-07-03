
const SUPABASE_URL = 'https://yrrinzreyafiowehhhon.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4MnAXo4yxHMQX7fSn7hQjA_qV2X7t7o';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const searchForm = document.getElementById('searchForm');
const searchSessionId = document.getElementById('searchSessionId');
const bookingResult = document.getElementById('bookingResult');
const bookingDetails = document.getElementById('bookingDetails');
const messageDiv = document.getElementById('message');

// Search Form Submit
searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await searchBooking();
});

// Search Booking by Session ID
async function searchBooking() {
    const sessionId = searchSessionId.value.trim().toUpperCase();
    
    if (!sessionId) {
        showMessage('Please enter your Session ID.', 'error');
        return;
    }
    
    try {
        showMessage('Searching...', 'info');
        
        // Get booking by session_id
        const { data, error } = await supabaseClient
            .from('bookings')
            .select('*')
            .eq('session_id', sessionId)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                showMessage('No booking found with this Session ID.', 'error');
                bookingResult.style.display = 'none';
                return;
            }
            throw error;
        }
        
        // Display booking details
        displayBooking(data);
        bookingResult.style.display = 'block';
        showMessage('Booking found!', 'success');
        
    } catch (error) {
        console.error('Search error:', error);
        showMessage('Error searching booking: ' + error.message, 'error');
        bookingResult.style.display = 'none';
    }
}

// Display Booking Details
function displayBooking(booking) {
    const isUpcoming = booking.booking_date >= new Date().toISOString().split('T')[0] && booking.status === 'confirmed';
    const isPast = booking.booking_date < new Date().toISOString().split('T')[0];
    
    let html = `
        <table border="1" cellpadding="12" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:600px;">
            <tr>
                <td><strong>Session ID</strong></td>
                <td><strong>${booking.session_id}</strong></td>
            </tr>
            <tr>
                <td><strong>Class</strong></td>
                <td>${booking.class}</td>
            </tr>
            <tr>
                <td><strong>Date</strong></td>
                <td>${formatDate(booking.booking_date)}</td>
            </tr>
            <tr>
                <td><strong>Session</strong></td>
                <td>${booking.session_time} - ${booking.session_slot}</td>
            </tr>
            <tr>
                <td><strong>Name</strong></td>
                <td>${booking.name}</td>
            </tr>
            <tr>
                <td><strong>IC/Passport</strong></td>
                <td>${booking.icno}</td>
            </tr>
            <tr>
                <td><strong>Contact</strong></td>
                <td>${booking.contact_no}</td>
            </tr>
            <tr>
                <td><strong>Status</strong></td>
                <td style="color: ${booking.status === 'confirmed' ? 'green' : 'red'}; font-weight:bold;">
                    ${booking.status.toUpperCase()}
                </td>
            </tr>
            <tr>
                <td><strong>Booked On</strong></td>
                <td>${formatDateTime(booking.created_at)}</td>
            </tr>
        </table>
    `;
    
    // Add action buttons for upcoming confirmed bookings
    if (isUpcoming && booking.status === 'confirmed') {
        html += `
            <div style="margin-top:20px;">
                <button onclick="cancelBooking('${booking.session_id}')" style="background:#e74c3c;color:white;padding:10px 20px;border:none;border-radius:4px;cursor:pointer;">
                    Cancel Booking
                </button>
                <span style="margin-left:10px;font-size:14px;color:#666;">
                    (Cancellations release the slot for others)
                </span>
            </div>
        `;
    } else if (isPast && booking.status === 'confirmed') {
        html += `
            <div style="margin-top:20px;padding:10px;background:#f5f5f5;border-radius:4px;">
                <p style="margin:0;color:#666;">✓ This booking has already passed.</p>
            </div>
        `;
    } else if (booking.status === 'cancelled') {
        html += `
            <div style="margin-top:20px;padding:10px;background:#ffeeee;border-radius:4px;">
                <p style="margin:0;color:#e74c3c;">✗ This booking has been cancelled.</p>
            </div>
        `;
    }
    
    bookingDetails.innerHTML = html;
}

// Cancel Booking
async function cancelBooking(sessionId) {
    if (!confirm('Are you sure you want to cancel this booking?\n\nThis action cannot be undone.')) {
        return;
    }
    
    try {
        showMessage('Cancelling booking...', 'info');
        
        const { data, error } = await supabaseClient
            .rpc('cancel_booking', { p_session_id: sessionId });
        
        if (error) throw error;
        
        if (data) {
            showMessage('Booking cancelled successfully! The slot is now available for others.', 'success');
            // Refresh the booking display
            await searchBooking();
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

// Format Date & Time
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

// Load on page load
document.addEventListener('DOMContentLoaded', () => {
    // Focus Session ID input
    searchSessionId.focus();
});

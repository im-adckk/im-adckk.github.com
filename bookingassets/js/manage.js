const SUPABASE_URL = 'https://yrrinzreyafiowehhhon.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4MnAXo4yxHMQX7fSn7hQjA_qV2X7t7o';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const searchForm = document.getElementById('searchForm');
const searchSessionId = document.getElementById('searchSessionId');
const bookingResult = document.getElementById('bookingResult');
const bookingDetails = document.getElementById('bookingDetails');
const messageDiv = document.getElementById('message');
const messageIcon = document.getElementById('messageIcon');
const messageText = document.getElementById('messageText');

// ============================================
// ICON HELPER
// ============================================
function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

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
                bookingResult.classList.add('hidden');
                return;
            }
            throw error;
        }

        // Display booking details
        displayBooking(data);
        bookingResult.classList.remove('hidden');
        showMessage('Booking found!', 'success');

    } catch (error) {
        console.error('Search error:', error);
        showMessage('Error searching booking: ' + error.message, 'error');
        bookingResult.classList.add('hidden');
    }
}

// ============================================
// SUMMARY ROW BUILDER (icon + label + value list)
// ============================================
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

function statusBadge(status) {
    const variant = status === 'confirmed' ? 'default' : 'destructive';
    return `<span class="badge" data-variant="${variant}">${status.toUpperCase()}</span>`;
}

// Display Booking Details
function displayBooking(booking) {
    const isUpcoming = booking.booking_date >= new Date().toISOString().split('T')[0] && booking.status === 'confirmed';
    const isPast = booking.booking_date < new Date().toISOString().split('T')[0];

    let html = buildSummaryRows([
        { icon: 'hash', label: 'Session ID', value: `<span class="font-semibold">${booking.session_id}</span>` },
        { icon: 'bike', label: 'Class', value: booking.class },
        { icon: 'calendar', label: 'Date', value: formatDate(booking.booking_date) },
        { icon: 'clock', label: 'Session', value: `${booking.session_time} - ${booking.session_slot}` },
        { icon: 'user', label: 'Name', value: booking.name },
        { icon: 'id-card', label: 'IC/Passport', value: booking.icno },
        { icon: 'phone', label: 'Contact', value: booking.contact_no },
        { icon: 'flag', label: 'Status', value: statusBadge(booking.status) },
        { icon: 'clock-4', label: 'Booked On', value: formatDateTime(booking.created_at) }
    ]);

    // Add action buttons / notices depending on booking state
    if (isUpcoming && booking.status === 'confirmed') {
        html += `
            <div class="mt-4 space-y-2">
                <button onclick="cancelBooking('${booking.session_id}')" class="btn w-full justify-center gap-2" data-variant="destructive">
                    <i data-lucide="x-circle" class="w-4 h-4"></i>
                    Cancel Booking
                </button>
                <p class="text-xs text-muted-foreground text-center">Cancellations release the slot for others.</p>
            </div>
        `;
    } else if (isPast && booking.status === 'confirmed') {
        html += `
            <div class="alert mt-4">
                <i data-lucide="check-circle-2" class="w-4 h-4"></i>
                <span class="text-sm">This booking has already passed.</span>
            </div>
        `;
    } else if (booking.status === 'cancelled') {
        html += `
            <div class="alert mt-4" data-variant="destructive">
                <i data-lucide="circle-x" class="w-4 h-4"></i>
                <span class="text-sm">This booking has been cancelled.</span>
            </div>
        `;
    }

    bookingDetails.innerHTML = html;
    refreshIcons();
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

// ============================================
// Message / alert helper (matches booking.js)
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
    refreshIcons();
    // Focus Session ID input
    searchSessionId.focus();
});

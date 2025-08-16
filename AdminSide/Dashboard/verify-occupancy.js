// OCCUPANCY UPDATE VERIFICATION SCRIPT
// Run this in the browser console of the Dashboard page

console.log("🔍 OCCUPANCY UPDATE VERIFICATION STARTING...");

// 1. Check if real-time listener is active
if (window.app && window.app.bookingsListener) {
    console.log("✅ Real-time listener is active");
} else {
    console.log("❌ Real-time listener not found");
    console.log("Available app methods:", Object.keys(window.app || {}));
}

// 2. Check current occupancy data
if (window.app && window.app.bookings) {
    const currentBookings = window.app.bookings;
    console.log(`📊 Current bookings in memory: ${currentBookings.length}`);
    
    const confirmedBookings = currentBookings.filter(booking => 
        booking.status === 'Confirmed' || booking.status === 'confirmed'
    );
    console.log(`✅ Confirmed bookings: ${confirmedBookings.length}`);
    
    confirmedBookings.forEach((booking, index) => {
        console.log(`  ${index + 1}. Room ${booking.roomNumber} - ${booking.guestName} (${booking.status})`);
    });
} else {
    console.log("❌ No booking data found in app");
}

// 3. Test manual refresh
console.log("🔄 Testing manual data refresh...");
if (window.app && typeof window.app.fetchBookingsManual === 'function') {
    window.app.fetchBookingsManual();
    console.log("✅ Manual refresh triggered");
} else if (window.app && typeof window.app.fetchBookings === 'function') {
    window.app.fetchBookings();
    console.log("✅ Fetch bookings called");
} else {
    console.log("❌ No refresh method available");
}

// 4. Check event listeners
const eventListeners = document.getEventListeners ? 
    document.getEventListeners(document) : "Not available in this browser";
console.log("📡 Document event listeners:", eventListeners);

// 5. Test local storage communication
console.log("💾 Testing localStorage communication...");
const testData = {
    action: 'verification_test',
    timestamp: new Date().getTime(),
    roomNumber: 999
};
localStorage.setItem('dashboard:refresh', JSON.stringify(testData));
console.log("✅ Test notification sent to localStorage");

// 6. Show current occupancy rate
setTimeout(() => {
    const occupancyElement = document.getElementById('occupancy-rate');
    const availableElement = document.getElementById('available-rooms');
    
    if (occupancyElement && availableElement) {
        console.log(`📈 Current Dashboard Display:`);
        console.log(`   Occupancy Rate: ${occupancyElement.textContent}`);
        console.log(`   Available Rooms: ${availableElement.textContent}`);
    } else {
        console.log("❌ Dashboard elements not found");
        console.log("Available elements with 'occupancy':", 
            Array.from(document.querySelectorAll('[id*="occupancy"], [class*="occupancy"]'))
                .map(el => el.id || el.className)
        );
    }
}, 2000);

console.log("🏁 VERIFICATION COMPLETE - Check output above for issues");
console.log("💡 Now go to Room Management and create a manual booking to test real-time updates");

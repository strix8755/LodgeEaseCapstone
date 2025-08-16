// Dashboard Update Test Script
// Run this in the browser console on the Room Management page

console.log("=== DASHBOARD UPDATE TEST ===");
console.log("This script will test the dashboard update system");

// Test 1: Check if event listeners are working
console.log("\n1. Testing CustomEvent dispatch...");
try {
    const testEvent = new CustomEvent('dashboard:booking:update', {
        detail: {
            action: 'test_event',
            bookingId: 'test-123',
            timestamp: new Date().getTime()
        }
    });
    document.dispatchEvent(testEvent);
    console.log("✅ CustomEvent dispatched successfully");
} catch (error) {
    console.error("❌ CustomEvent dispatch failed:", error);
}

// Test 2: Check localStorage
console.log("\n2. Testing localStorage notification...");
try {
    localStorage.setItem('dashboard:refresh', JSON.stringify({
        action: 'test_refresh',
        timestamp: new Date().getTime()
    }));
    console.log("✅ localStorage notification sent successfully");
} catch (error) {
    console.error("❌ localStorage notification failed:", error);
}

// Test 3: Check if Vue app exists
console.log("\n3. Checking Vue app availability...");
if (typeof Vue !== 'undefined') {
    console.log("✅ Vue.js is available");
} else {
    console.error("❌ Vue.js is not available");
}

// Test 4: Check if manual booking form exists
console.log("\n4. Checking manual booking functionality...");
const manualBookingModal = document.querySelector('#manualBookingModal');
if (manualBookingModal) {
    console.log("✅ Manual booking modal found");
} else {
    console.error("❌ Manual booking modal not found");
}

// Test 5: Check Firebase imports
console.log("\n5. Checking Firebase availability...");
if (typeof db === 'function') {
    console.log("✅ Firebase db function is available");
} else {
    console.error("❌ Firebase db function is not available");
}

// Test 6: Check current bookings data
console.log("\n6. Checking current Vue app data...");
if (window.app && window.app.allBookings) {
    console.log(`✅ Vue app has ${window.app.allBookings.length} bookings loaded`);
    console.log("Current occupancy rate:", window.app.stats?.occupancyRate || 'Not available');
    console.log("Available rooms:", window.app.availableRooms || 'Not available');
} else {
    console.log("❌ Vue app or booking data not available");
}

console.log("\n=== TEST COMPLETE ===");
console.log("Instructions:");
console.log("1. Open Dashboard in another tab");
console.log("2. Create a manual booking here");
console.log("3. Check if Dashboard occupancy updates automatically");
console.log("4. Look for 'DASHBOARD DEBUG' and 'OCCUPANCY DEBUG' messages in console");

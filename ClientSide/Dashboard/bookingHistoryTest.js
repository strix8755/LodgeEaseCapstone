/**
 * Test script to verify that bookingHistory.js is properly loaded
 * and the functions are available in the global scope
 */

console.log('BookingHistoryTest.js loaded');

// Global variables to track retry attempts
let retryCount = 0;
const MAX_RETRIES = 10;
const RETRY_DELAY = 300; // milliseconds

// Function to check if booking history functions are available
function checkBookingHistoryFunctions() {
    console.log(`[BookingHistoryTest] Checking booking history functions (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
    
    // Check if functions are available in the global scope
    const globalLoadFnAvailable = typeof window.loadBookingHistory === 'function';
    const globalNavigateFnAvailable = typeof window.navigateToBookingDetails === 'function';
    
    // Check if functions are available in the local scope
    const localLoadFnAvailable = typeof loadBookingHistory === 'function';
    const localNavigateFnAvailable = typeof navigateToBookingDetails === 'function';
    
    // Log the availability status
    console.log(`[BookingHistoryTest] Global loadBookingHistory available: ${globalLoadFnAvailable}`);
    console.log(`[BookingHistoryTest] Global navigateToBookingDetails available: ${globalNavigateFnAvailable}`);
    console.log(`[BookingHistoryTest] Local loadBookingHistory available: ${localLoadFnAvailable}`);
    console.log(`[BookingHistoryTest] Local navigateToBookingDetails available: ${localNavigateFnAvailable}`);
    
    // If functions are available, try to use them
    if (globalLoadFnAvailable && globalNavigateFnAvailable) {
        console.log('[BookingHistoryTest] SUCCESS: All booking history functions are available globally');
        tryLoadBookingHistory();
        return true;
    } else if (localLoadFnAvailable && localNavigateFnAvailable) {
        console.log('[BookingHistoryTest] Functions found locally but not globally, exposing to global scope');
        exposeLocalFunctionsToGlobal();
        return true;
    } else {
        // If functions are not available and we haven't reached max retries, try again
        if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(`[BookingHistoryTest] Functions not found, retrying in ${RETRY_DELAY}ms...`);
            setTimeout(checkBookingHistoryFunctions, RETRY_DELAY);
            return false;
        } else {
            console.error('[BookingHistoryTest] ERROR: Booking history functions not found after maximum retries');
            showFunctionNotFoundError();
            return false;
        }
    }
}

// Function to expose local functions to the global scope if they exist
function exposeLocalFunctionsToGlobal() {
    console.log('[BookingHistoryTest] Attempting to expose local functions to global scope');
    
    if (typeof loadBookingHistory === 'function') {
        console.log('[BookingHistoryTest] Exposing loadBookingHistory to window');
        window.loadBookingHistory = loadBookingHistory;
    }
    
    if (typeof navigateToBookingDetails === 'function') {
        console.log('[BookingHistoryTest] Exposing navigateToBookingDetails to window');
        window.navigateToBookingDetails = navigateToBookingDetails;
    }
    
    // Verify the functions are now available globally
    setTimeout(() => {
        const globalLoadFnAvailable = typeof window.loadBookingHistory === 'function';
        const globalNavigateFnAvailable = typeof window.navigateToBookingDetails === 'function';
        
        console.log(`[BookingHistoryTest] After exposure: Global loadBookingHistory available: ${globalLoadFnAvailable}`);
        console.log(`[BookingHistoryTest] After exposure: Global navigateToBookingDetails available: ${globalNavigateFnAvailable}`);
        
        if (globalLoadFnAvailable && globalNavigateFnAvailable) {
            console.log('[BookingHistoryTest] Successfully exposed functions to global scope');
            tryLoadBookingHistory();
        } else {
            console.error('[BookingHistoryTest] Failed to expose functions to global scope');
            showFunctionNotFoundError();
        }
    }, 100);
}

// Function to show an error message when functions are not found
function showFunctionNotFoundError() {
    console.error('[BookingHistoryTest] Could not find booking history functions');
    
    const historyContainer = document.getElementById('bookingHistoryContainer');
    if (historyContainer) {
        historyContainer.innerHTML = `
            <div class="text-center text-red-500 py-8">
                <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                <p>Error: Booking history functions not found</p>
                <div class="mt-4">
                    <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" 
                            onclick="window.location.reload()">
                        Refresh Page
                    </button>
                </div>
            </div>
        `;
    }
}

// Function to try loading booking history if the user is logged in
function tryLoadBookingHistory() {
    console.log('[BookingHistoryTest] Attempting to load booking history');
    
    // Check if Firebase Auth is available
    if (typeof firebase !== 'undefined' && firebase.auth) {
        const auth = firebase.auth();
        
        // Check if user is logged in
        if (auth.currentUser) {
            console.log('[BookingHistoryTest] User is logged in, loading booking history');
            
            // Get Firestore instance
            let db = null;
            if (typeof getFirestoreDb === 'function') {
                db = getFirestoreDb();
            } else if (window.firebaseDb) {
                db = window.firebaseDb;
            }
            
            // Try to load booking history
            if (typeof window.loadBookingHistory === 'function') {
                window.loadBookingHistory(auth.currentUser.uid, db);
            }
        } else {
            console.log('[BookingHistoryTest] User is not logged in, cannot load booking history');
        }
    } else {
        console.warn('[BookingHistoryTest] Firebase Auth not available');
    }
}

// Add a manual trigger function to the global scope
window.manuallyLoadBookingHistory = function() {
    console.log('[BookingHistoryTest] Manual trigger for loading booking history');
    
    // Reset retry count and check functions again
    retryCount = 0;
    checkBookingHistoryFunctions();
};

// Start checking for booking history functions when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('[BookingHistoryTest] Document ready, starting function checks');
    
    // Give a short delay to ensure other scripts have loaded
    setTimeout(checkBookingHistoryFunctions, 500);
});

// Also check when the window is fully loaded
window.addEventListener('load', function() {
    console.log('[BookingHistoryTest] Window loaded, ensuring function checks');
    
    // If we haven't already succeeded, try again
    if (retryCount < MAX_RETRIES) {
        // Reset retry count and check again
        retryCount = 0;
        checkBookingHistoryFunctions();
    }
});

// Add a test function to the global scope
window.testBookingHistoryFunctions = function() {
    console.log('Testing booking history functions...');
    const result = checkBookingHistoryFunctions();
    
    // Try to manually expose the functions if they're not available
    if (!result.loadBookingHistoryAvailable || !result.navigateToBookingDetailsAvailable) {
        console.log('Attempting to fix missing functions...');
        return exposeBookingHistoryFunctions();
    }
    
    return result;
};

// Add a function to manually load booking history
window.manuallyLoadBookingHistory = function() {
    if (typeof window.loadBookingHistory === 'function') {
        console.log('Manually loading booking history...');
        
        // Get user ID
        let userId = null;
        if (window.firebase && window.firebase.auth && window.firebase.auth().currentUser) {
            userId = window.firebase.auth().currentUser.uid;
        } else if (window.currentUser && window.currentUser.uid) {
            userId = window.currentUser.uid;
        } else {
            userId = 'test-user-id';
            console.log('No logged in user found, using test user ID');
        }
        
        // Get database
        let db = null;
        if (window.firebaseDb) {
            db = window.firebaseDb;
        } else if (window.firebase && window.firebase.firestore) {
            db = window.firebase.firestore();
        } else if (typeof getFirestoreDb === 'function') {
            db = getFirestoreDb();
        } else {
            console.error('No valid Firestore instance available');
            return false;
        }
        
        // Call loadBookingHistory
        window.loadBookingHistory(userId, db);
        return true;
    } else {
        console.error('loadBookingHistory function not available');
        return false;
    }
};

// Log a success message
console.log('bookingHistoryTest.js completed successfully'); 
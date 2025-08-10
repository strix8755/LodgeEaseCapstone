// This script uses Firebase functions from the global window object

// Prevent multiple initializations of the script
if (window.dashboardJsInitialized) {
  console.log('dashboard.js already initialized, skipping duplicate initialization');
} else {
  window.dashboardJsInitialized = true;

// Define Firebase helper functions only if needed
(function() {
  // Setup Firebase helper functions
  if (typeof window.getFirebaseAuth !== 'function') {
    window.getFirebaseAuth = () => window.firebase?.auth?.() || window.firebaseAuth;
  }
  
  if (typeof window.getFirestoreDb !== 'function') {
    window.getFirestoreDb = () => window.firebase?.firestore?.() || window.firebaseDb;
  }
  
  if (typeof window.firestoreDoc !== 'function') {
    window.firestoreDoc = (db, collection, docId) => {
      if (db && db.collection && typeof db.collection === 'function') {
        return db.collection(collection).doc(docId);
      }
      console.error('Invalid Firestore database instance or collection method not available');
      return null;
    };
  }
  
  if (typeof window.getFirestoreDoc !== 'function') {
    window.getFirestoreDoc = (docRef) => docRef?.get?.() || Promise.reject(new Error('Invalid document reference'));
  }
  
  if (typeof window.firestoreCollection !== 'function') {
    window.firestoreCollection = (db, path) => db?.collection?.(path);
  }
  
  if (typeof window.firestoreQuery !== 'function') {
    window.firestoreQuery = (collectionRef, ...queryConstraints) => {
      // For Firebase v8, we need to apply where clauses
      let query = collectionRef;
      queryConstraints.forEach(constraint => {
        if (constraint && constraint.field && constraint.opStr && constraint.value !== undefined) {
          query = query.where(constraint.field, constraint.opStr, constraint.value);
        }
      });
      return query;
    };
  }
  
  if (typeof window.firestoreWhere !== 'function') {
    window.firestoreWhere = (field, opStr, value) => ({ field, opStr, value });
  }
  
  if (typeof window.getFirestoreDocs !== 'function') {
    window.getFirestoreDocs = (query) => query?.get?.() || Promise.reject(new Error('Invalid query'));
  }
  
  if (typeof window.firestoreOrderBy !== 'function') {
    window.firestoreOrderBy = (field, direction) => ({ field, direction });
  }
  
  if (typeof window.firestoreLimit !== 'function') {
    window.firestoreLimit = (limit) => ({ limit });
  }
  
  if (typeof window.firestoreOnSnapshot !== 'function') {
    window.firestoreOnSnapshot = (reference, callback, errorCallback) => {
      if (reference && reference.onSnapshot && typeof reference.onSnapshot === 'function') {
        return reference.onSnapshot(callback, errorCallback);
      } else {
        console.error('Invalid reference for onSnapshot');
        return () => {}; // Return empty unsubscribe function
      }
    };
  }
})();

// Try to get the userDrawer module but handle errors gracefully
// Prevent duplicate declaration of _getInitializeUserDrawer
if (typeof window._getInitializeUserDrawer !== 'function') {
  window._getInitializeUserDrawer = function() {
    // Use fallback if module loading fails
    console.log('Using userDrawer fallback from window global object');
    return window.initializeUserDrawer || function() {
        console.error('No userDrawer initialization function found');
    };
  };
}

// Use the window-scoped version to avoid redeclaration errors
const _getInitializeUserDrawer = window._getInitializeUserDrawer;

// Use bookingHistory.js loaded via script tag in HTML
// Access it through the window global object
console.log('Using bookingHistory from window global object');
// We'll check for window.loadBookingHistory in the DOMContentLoaded event

// Function to get URL parameters with better error handling
function getUrlParameters() {
    try {
        const bookingId = getUrlParameter('bookingId');
        const collection = getUrlParameter('collection') || 'everlodgebookings';
        const status = getUrlParameter('status'); // Add status parameter
        
        return { 
            bookingId: bookingId, 
            collection: collection,
            status: status // Include status in returned object
        };
    } catch (error) {
        console.error('Error parsing URL parameters:', error);
        return { 
            bookingId: null, 
            collection: 'everlodgebookings',
            status: null
        };
    }
}

// Replace the individual parameter parsing with the combined function
const urlParams = getUrlParameters();
const bookingId = urlParams.bookingId;
const collectionName = urlParams.collection;

// Add this function near the top of the file to handle URL parameters
function getUrlParameter(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Add a DOMContentLoaded listener to ensure the view details button is set up
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DASHBOARD DEBUG: Dashboard page loaded');
    
    // Wait for Firebase to be ready
    setTimeout(async () => {
        console.log('DASHBOARD DEBUG: Checking authentication status...');
        
        // Initialize all dashboard functionality first
        initializeAllFunctionality();
        
        // Check authentication and load user's latest booking
        const auth = window.getFirebaseAuth();
        if (auth && auth.currentUser) {
            console.log('DASHBOARD DEBUG: User is authenticated, loading latest booking...');
            await loadUserLatestBooking(auth.currentUser);
        } else {
            console.log('DASHBOARD DEBUG: User not authenticated, setting up auth listener...');
            
            // Set up auth state listener for when user logs in
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    console.log('DASHBOARD DEBUG: User authenticated via state change, loading latest booking...');
                    await loadUserLatestBooking(user);
                } else {
                    console.log('DASHBOARD DEBUG: User signed out, showing no booking info');
                    displayNoBookingInfo();
                }
            });
        }
        
        // Also check for booking confirmation as a fallback
        checkBookingConfirmation();
        
        // Update booking status display
        updateBookingStatusDisplay();
        
        // Setup View Details button
        setupViewDetailsButton();
        
        // Check if URL has booking-related parameters
        const urlParams = getUrlParameters();
        if (urlParams.status || urlParams.bookingId) {
            console.log('DASHBOARD DEBUG: URL contains booking parameters:', urlParams);
            checkBookingConfirmation();
        }
    }, 1000);
});

// New function to load user's latest active booking
async function loadUserLatestBooking(user) {
    try {
        console.log('DASHBOARD DEBUG: Loading latest booking for user:', user.uid);
        console.log('DASHBOARD DEBUG: User email:', user.email);
        
        // Add debugging for Firebase connection
        const db = window.getFirestoreDb();
        console.log('DASHBOARD DEBUG: Firestore DB available:', !!db);
        
        if (!db) {
            console.error('DASHBOARD DEBUG: Firestore database not available');
            displayNoBookingInfo();
            return false;
        }

        // Get the user's latest booking from Firestore
        console.log('DASHBOARD DEBUG: Calling getLatestBooking...');
        const latestBooking = await getLatestBooking(user);
        
        console.log('DASHBOARD DEBUG: getLatestBooking returned:', latestBooking);
        
        if (latestBooking) {
            console.log('DASHBOARD DEBUG: Found latest booking:', {
                id: latestBooking.id,
                status: latestBooking.status,
                guestName: latestBooking.guestName,
                roomNumber: latestBooking.propertyDetails?.roomNumber,
                checkIn: latestBooking.checkIn,
                checkOut: latestBooking.checkOut,
                totalPrice: latestBooking.totalPrice,
                nightlyRate: latestBooking.nightlyRate
            });
            
            // Store the booking data globally and locally
            window.currentBookingData = latestBooking;
            localStorage.setItem('currentBooking', JSON.stringify(latestBooking));
            
            // Display the booking information
            console.log('DASHBOARD DEBUG: Calling displayBookingInfo...');
            displayBookingInfo(latestBooking);
            
            // Set up status listener for real-time updates
            if (latestBooking.id) {
                setupBookingStatusListener(latestBooking.id);
            }
            
            return true;
        } else {
            console.log('DASHBOARD DEBUG: No booking found for user');
            displayNoBookingInfo();
            return false;
        }
    } catch (error) {
        console.error('DASHBOARD DEBUG: Error loading user latest booking:', error);
        console.error('DASHBOARD DEBUG: Error stack:', error.stack);
        
        // Fallback to stored data if available
        const storedBooking = localStorage.getItem('currentBooking');
        if (storedBooking) {
            try {
                const bookingData = JSON.parse(storedBooking);
                if (bookingData.userId === user.uid) {
                    console.log('DASHBOARD DEBUG: Using fallback booking from localStorage');
                    displayBookingInfo(bookingData);
                    return true;
                }
            } catch (parseError) {
                console.error('DASHBOARD DEBUG: Error parsing stored booking:', parseError);
            }
        }
        
        // If all else fails, show no booking info
        console.log('DASHBOARD DEBUG: Showing no booking info due to error');
        displayNoBookingInfo();
        return false;
    }
}

// Setup for the View Details Button Click Handler
function setupViewDetailsButton() {
  console.log('DEBUG: Setting up view details button');
  
  // Use the global functions we defined in the HTML file
  const viewDetailsBtn = document.getElementById('viewDetailsBtn');
  if (!viewDetailsBtn) {
    console.error('DEBUG: View Details button not found in DOM');
    return;
  }
  
  // Remove any existing event listeners
  const newBtn = viewDetailsBtn.cloneNode(true);
  viewDetailsBtn.parentNode.replaceChild(newBtn, viewDetailsBtn);
  
  // Add new event listener that calls our global handler
  newBtn.addEventListener('click', function(event) {
    console.log('DEBUG: View Details button clicked directly');
    if (window.showBookingDetailsHandler) {
      window.showBookingDetailsHandler(event);
    } else {
      console.error('ERROR: Global showBookingDetailsHandler function not found');
    }
  });
  
  console.log('DEBUG: View Details button handler set up successfully');
}

// Create a separate handler function that can be added and removed as needed
function showBookingDetailsHandler(event) {
    console.log('DEBUG: View Details button clicked!', event);
    event.preventDefault();
    event.stopPropagation();
    
    // Try to get booking data from different sources
    let bookingData = window.currentBookingData;
    
    // If no current booking data, try to get from localStorage
    if (!bookingData) {
        try {
            const storedBooking = localStorage.getItem('currentBooking');
            if (storedBooking) {
                bookingData = JSON.parse(storedBooking);
                window.currentBookingData = bookingData;
                console.log('DEBUG: Retrieved booking data from localStorage:', bookingData);
            }
        } catch (error) {
            console.error('DEBUG: Error retrieving booking data from localStorage:', error);
        }
    }
    
    if (bookingData) {
        console.log('DEBUG: Attempting to show booking details');
        showBookingDetails(bookingData);
    } else {
        console.error('DEBUG: No booking data available to display');
        alert('No booking information available to display. Please refresh the page and try again.');
    }
    
    return false;
}

// Function to set up the rest of the modal event listeners
function setupModalEventListeners(modal, downloadPDF, printBooking) {
    // Print functionality
    if (printBooking) {
        printBooking.addEventListener('click', () => {
            const modalContent = document.getElementById('modalContent');
            if (!modalContent) return;

            const printWindow = window.open('', '', 'width=800,height=600');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                    <head>
                        <title>Booking Confirmation - ${window.currentBookingData?.id || 'LodgeEase'}</title>
                        <link href="https://cdn.tailwindcss.com" rel="stylesheet">
                        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
                        <style>
                            @media print {
                                @page {
                                    size: letter portrait;
                                    margin: 0.5in;
                                }
                                body {
                                    -webkit-print-color-adjust: exact;
                                    print-color-adjust: exact;
                                }
                                .page-break {
                                    page-break-after: always;
                                }
                                .no-print {
                                    display: none !important;
                                }
                                .print-container {
                                    max-width: 100% !important;
                                    width: 100% !important;
                                }
                            }
                            
                            /* Print-friendly font sizes */
                            body {
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                line-height: 1.5;
                                color: #333;
                            }
                            
                            /* Custom classes for print */
                            .print-header {
                                text-align: center;
                                margin-bottom: 1.5rem;
                            }
                            
                            .print-content {
                                width: 100%;
                                max-width: 800px;
                                margin: 0 auto;
                            }
                        </style>
                    </head>
                    <body class="print-ready p-4" onload="window.print(); window.setTimeout(function(){ window.close(); }, 500);">
                        <div class="print-content">${modalContent.innerHTML}</div>
                    </body>
                </html>
            `);
            
            printWindow.document.close();
        });
    }

    // Download PDF functionality
    if (downloadPDF) {
        downloadPDF.addEventListener('click', () => {
            const modalContent = document.getElementById('modalContent');
            if (!modalContent) return;
            
            const printSection = modalContent.querySelector('#printable-content') || modalContent;
            
            const opt = {
                margin: 0.5,
                filename: `booking-confirmation-${window.currentBookingData?.id || 'default'}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            
            // Use html2pdf bundle
            html2pdf().set(opt).from(printSection).save();
        });
    }
}

// Add formatDate function to global scope
function formatDate(dateInput) {
    if (!dateInput) return '---';
    
    let date;
    
    // Handle different date formats
    if (typeof dateInput === 'string') {
        // ISO string format
        date = new Date(dateInput);
    } else if (dateInput.seconds) {
        // Firebase timestamp format
        date = new Date(dateInput.seconds * 1000);
    } else if (dateInput.toDate && typeof dateInput.toDate === 'function') {
        // Firestore Timestamp object
        date = dateInput.toDate();
    } else if (dateInput instanceof Date) {
        // Already a Date object
        date = dateInput;
    } else {
        console.error('Unknown date format:', dateInput);
        return 'Invalid Date';
    }
    
    // Check if we have a valid date
    if (isNaN(date.getTime())) {
        console.error('Invalid date value:', dateInput);
        return 'Invalid Date';
    }
    
    try {
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return date.toLocaleDateString();
    }
}

// Update getLatestBooking function
async function getLatestBooking(user) {
    try {
        console.log('DASHBOARD DEBUG: getLatestBooking called for user:', user.uid);
        
        // First check localStorage for current booking
        const currentBooking = localStorage.getItem('currentBooking');
        console.log('DASHBOARD DEBUG: localStorage currentBooking:', !!currentBooking);
        
        if (currentBooking) {
            try {
                const bookingData = JSON.parse(currentBooking);
                console.log('DASHBOARD DEBUG: Parsed localStorage booking:', {
                    id: bookingData.id,
                    userId: bookingData.userId,
                    status: bookingData.status
                });
                
                // Verify this booking belongs to current user and is still relevant
                if (bookingData.userId === user.uid && isBookingRelevant(bookingData)) {
                    console.log('DASHBOARD DEBUG: Using relevant booking from localStorage:', bookingData.id);
                    return bookingData;
                } else {
                    console.log('DASHBOARD DEBUG: localStorage booking not relevant or wrong user');
                }
            } catch (parseError) {
                console.error('DASHBOARD DEBUG: Error parsing localStorage booking:', parseError);
            }
        }

        // If no valid booking in localStorage, get from Firestore
        console.log('DASHBOARD DEBUG: Fetching latest booking from Firestore...');
        const db = window.getFirestoreDb();
        
        if (!db) {
            console.error('DASHBOARD DEBUG: No Firestore database available');
            return null;
        }
        
        console.log('DASHBOARD DEBUG: Creating Firestore collection reference...');
        const bookingsRef = window.firestoreCollection(db, 'everlodgebookings');
        console.log('DASHBOARD DEBUG: Collection reference created:', !!bookingsRef);
        
        // Query for user's bookings
        console.log('DASHBOARD DEBUG: Creating query for userId:', user.uid);
        const q = window.firestoreQuery(
            bookingsRef,
            window.firestoreWhere('userId', '==', user.uid)
        );
        console.log('DASHBOARD DEBUG: Query created:', !!q);

        console.log('DASHBOARD DEBUG: Executing Firestore query...');
        const querySnapshot = await window.getFirestoreDocs(q);
        console.log('DASHBOARD DEBUG: Query executed, empty:', querySnapshot.empty);
        console.log('DASHBOARD DEBUG: Query size:', querySnapshot.size);
        
        if (!querySnapshot.empty) {
            // Convert to array with enhanced data
            const allBookings = querySnapshot.docs.map(doc => {
                const data = doc.data();
                console.log('DASHBOARD DEBUG: Found booking document:', {
                    id: doc.id,
                    status: data.status,
                    userId: data.userId,
                    guestName: data.guestName,
                    checkIn: data.checkIn,
                    checkOut: data.checkOut
                });
                return {
                    id: doc.id,
                    ...data
                };
            });
            
            console.log(`DASHBOARD DEBUG: Found ${allBookings.length} total bookings for user`);
            
            // Filter and prioritize bookings
            console.log('DASHBOARD DEBUG: Prioritizing bookings...');
            const prioritizedBookings = prioritizeBookings(allBookings);
            console.log('DASHBOARD DEBUG: Prioritized bookings count:', prioritizedBookings.length);
            
            if (prioritizedBookings.length > 0) {
                const latestBooking = prioritizedBookings[0];
                console.log('DASHBOARD DEBUG: Selected prioritized booking:', {
                    id: latestBooking.id,
                    status: latestBooking.status,
                    checkIn: latestBooking.checkIn,
                    checkOut: latestBooking.checkOut,
                    guestName: latestBooking.guestName,
                    roomNumber: latestBooking.propertyDetails?.roomNumber
                });
                
                // Update localStorage with latest booking
                localStorage.setItem('currentBooking', JSON.stringify(latestBooking));
                return latestBooking;
            } else {
                console.log('DASHBOARD DEBUG: No prioritized bookings found after filtering');
            }
        } else {
            console.log('DASHBOARD DEBUG: Query returned no documents');
        }

        console.log('DASHBOARD DEBUG: No relevant booking found');
        return null;
    } catch (error) {
        console.error('DASHBOARD DEBUG: Error in getLatestBooking:', error);
        console.error('DASHBOARD DEBUG: Error details:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        
        // If the error is about missing index, show a user-friendly message
        if (error.code === 'failed-precondition' || error.message.includes('requires an index')) {
            const statusElement = document.getElementById('booking-status');
            if (statusElement) {
                statusElement.innerHTML = `
                    <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                        <div class="flex">
                            <div class="flex-shrink-0">
                                <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                                </svg>
                            </div>
                            <div class="ml-3">
                                <p class="text-sm text-yellow-700">
                                    Database index not ready. Please create the following composite index in Firebase Console:
                                </p>
                                <div class="mt-2 text-xs text-yellow-600 bg-yellow-100 p-2 rounded">
                                    <p>Collection: bookings</p>
                                    <p>Fields to index:</p>
                                    <ul class="list-disc pl-4">
                                        <li>userId (Ascending)</li>
                                        <li>createdAt (Descending)</li>
                                    </ul>
                                </div>
                                <p class="mt-2 text-xs text-yellow-600">
                                    Once the index is created, please wait a few minutes for it to build and then refresh the page.
                                </p>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
        throw error;
    }
}

// Helper function to check if a booking is relevant for dashboard display
function isBookingRelevant(booking) {
    const status = booking.status?.toLowerCase();
    const now = new Date();
    
    // Always show if booking is active/approved/confirmed
    if (['approved', 'confirmed', 'active'].includes(status)) {
        return true;
    }
    
    // Show pending bookings
    if (status === 'pending') {
        return true;
    }
    
    // For completed bookings, only show if recent (within last 30 days)
    if (status === 'completed') {
        const checkOutDate = getDateFromBooking(booking.checkOut);
        if (checkOutDate) {
            const daysSinceCheckout = (now - checkOutDate) / (1000 * 60 * 60 * 24);
            return daysSinceCheckout <= 30;
        }
    }
    
    // Don't show cancelled or rejected bookings unless very recent
    if (['cancelled', 'rejected'].includes(status)) {
        const createdDate = getDateFromBooking(booking.createdAt);
        if (createdDate) {
            const daysSinceCreated = (now - createdDate) / (1000 * 60 * 60 * 24);
            return daysSinceCreated <= 7; // Show for up to 7 days
        }
    }
    
    return false;
}

// Helper function to prioritize bookings for dashboard display
function prioritizeBookings(bookings) {
    const now = new Date();
    
    // Group bookings by priority
    const activeBookings = [];
    const pendingBookings = [];
    const recentBookings = [];
    const otherBookings = [];
    
    bookings.forEach(booking => {
        const status = booking.status?.toLowerCase();
        const checkInDate = getDateFromBooking(booking.checkIn);
        const checkOutDate = getDateFromBooking(booking.checkOut);
        
        // Check if booking is currently active (between check-in and check-out)
        const isCurrentlyActive = checkInDate && checkOutDate && 
                                  now >= checkInDate && now <= checkOutDate;
        
        if (isCurrentlyActive && ['approved', 'confirmed', 'active'].includes(status)) {
            activeBookings.push(booking);
        } else if (status === 'pending') {
            pendingBookings.push(booking);
        } else if (['approved', 'confirmed'].includes(status)) {
            recentBookings.push(booking);
        } else if (isBookingRelevant(booking)) {
            otherBookings.push(booking);
        }
    });
    
    // Sort each group by creation date (newest first)
    const sortByCreated = (a, b) => {
        const dateA = getDateFromBooking(a.createdAt) || new Date(0);
        const dateB = getDateFromBooking(b.createdAt) || new Date(0);
        return dateB - dateA;
    };
    
    activeBookings.sort(sortByCreated);
    pendingBookings.sort(sortByCreated);
    recentBookings.sort(sortByCreated);
    otherBookings.sort(sortByCreated);
    
    // Return in priority order: active first, then pending, then recent, then others
    return [...activeBookings, ...pendingBookings, ...recentBookings, ...otherBookings];
}

// Helper function to convert various date formats to Date object
function getDateFromBooking(dateValue) {
    if (!dateValue) return null;
    
    try {
        if (typeof dateValue === 'string') {
            return new Date(dateValue);
        } else if (dateValue.seconds) {
            // Firebase timestamp format
            return new Date(dateValue.seconds * 1000);
        } else if (dateValue.toDate && typeof dateValue.toDate === 'function') {
            // Firestore Timestamp object
            return dateValue.toDate();
        } else if (dateValue instanceof Date) {
            return dateValue;
        }
    } catch (error) {
        console.error('Error parsing date:', error);
    }
    
    return null;
}

// Function to check for booking confirmation from various sources
async function checkBookingConfirmation() {
    try {
        console.log('DASHBOARD DEBUG: Checking for booking confirmation in session storage...');
        
        const sessionBookingData = sessionStorage.getItem('bookingConfirmation');
        
        if (sessionBookingData) {
            try {
                const bookingData = JSON.parse(sessionBookingData);
                console.log('DASHBOARD DEBUG: Found booking confirmation in session storage:', bookingData);
                console.log('DASHBOARD DEBUG: Session booking data keys:', Object.keys(bookingData));
                
                // Check if the booking data is complete
                const isIncomplete = !bookingData.checkIn || !bookingData.checkOut || 
                                   !bookingData.totalPrice || !bookingData.nightlyRate ||
                                   !bookingData.propertyDetails?.roomNumber;
                
                if (isIncomplete && bookingData.id) {
                    console.log('DASHBOARD DEBUG: Session storage booking data is incomplete, fetching complete data from Firestore...');
                    
                    // Fetch complete booking data from Firestore
                    const completeBookingData = await fetchBookingById(bookingData.id);
                    if (completeBookingData) {
                        console.log('DASHBOARD DEBUG: Fetched complete booking data from Firestore');
                        window.currentBookingData = completeBookingData;
                        displayBookingInfo(completeBookingData);
                        return true;
                    } else {
                        console.log('DASHBOARD DEBUG: Could not fetch complete booking data, using session data anyway');
                    }
                }
                
                // Use the booking data from session storage (even if incomplete)
                window.currentBookingData = bookingData;
                displayBookingInfo(bookingData);
                return true;
            } catch (parseError) {
                console.error('DASHBOARD DEBUG: Error parsing session storage booking:', parseError);
            }
        }
        
        // Fallback to localStorage
        console.log('DASHBOARD DEBUG: Checking localStorage for booking data...');
        
        // Try to get booking data from numerous possible sources
        try {
            // Try confirmation data from successful booking flow
            const confirmationData = localStorage.getItem('bookingConfirmation');
            
            if (confirmationData) {
                console.log('DASHBOARD DEBUG: Found booking confirmation data in localStorage');
                const bookingData = JSON.parse(confirmationData);
                
                if (bookingData && (bookingData.id || bookingData.bookingId)) {
                    console.log('DASHBOARD DEBUG: Displaying booking info from backup data');
                    // Ensure booking flags are correctly set
                    const processedBookingData = ensureCorrectBookingFlags(bookingData);
                    window.currentBookingData = processedBookingData;
                    displayBookingInfo(processedBookingData);
                    return true;
                }
            }
            
            // Try current booking data which might be set by other flows
            const storedBookingData = localStorage.getItem('currentBooking');
            
            if (storedBookingData) {
                console.log('DASHBOARD DEBUG: Found current booking data in localStorage');
                const bookingData = JSON.parse(storedBookingData);
                
                if (bookingData && (bookingData.id || bookingData.bookingId)) {
                    console.log('DASHBOARD DEBUG: Displaying booking info from current booking data');
                    // Ensure booking flags are correctly set
                    const processedBookingData = ensureCorrectBookingFlags(bookingData);
                    window.currentBookingData = processedBookingData;
                    displayBookingInfo(processedBookingData);
                    return true;
                }
            }
            
            // Last resort - look for a booking ID and fetch from Firebase
            const bookingId = localStorage.getItem('lastBookingId');
            
            if (bookingId) {
                console.log(`DASHBOARD DEBUG: Found booking ID ${bookingId} in localStorage, fetching from Firebase`);
                
                const bookingData = await fetchBookingById(bookingId);
                
                if (bookingData) {
                    console.log('DASHBOARD DEBUG: Successfully retrieved booking from localStorage ID');
                    window.currentBookingData = bookingData;
                    displayBookingInfo(bookingData);
                    return true;
                }
            }
        } catch (error) {
            console.error('DASHBOARD DEBUG: Error parsing local storage booking data:', error);
        }
        
        // If all else fails, display the no booking info screen
        console.log('DASHBOARD DEBUG: No booking data found in any storage location');
        displayNoBookingInfo();
        return false;
    } catch (error) {
        console.error('DASHBOARD DEBUG: Error checking booking confirmation:', error);
        displayNoBookingInfo();
        return false;
    }
}

// Function to fetch booking by ID with retry logic
async function fetchBookingById(bookingId, collectionName = 'everlodgebookings') {
    console.log(`Fetching booking with ID: ${bookingId} from collection: ${collectionName}`);
    
    if (!bookingId) {
        console.error('No booking ID provided to fetch');
        return null;
    }
    
    // Initialize Firebase if not already done
    const db = window.getFirestoreDb();
    if (!db) {
        console.error('Firestore not initialized');
        return null;
    }
    
    // Check if there's a status parameter in URL
    const urlStatus = getUrlParameter('status');
    console.log('URL contains status parameter:', urlStatus);
    
    // Setup retry logic
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempt ${attempt} to fetch booking ${bookingId}`);
            
            // Create the document reference
            const bookingRef = window.firestoreDoc(db, collectionName, bookingId);
            
            // Get the document
            const bookingDoc = await window.getFirestoreDoc(bookingRef);
            
            if (bookingDoc.exists()) {
                // Construct the booking data with the document ID
                const bookingData = {
                    id: bookingDoc.id,
                    ...bookingDoc.data()
                };
                
                // Override status from URL if provided (for new bookings from payment page)
                if (urlStatus) {
                    console.log(`Overriding booking status with URL parameter: ${urlStatus}`);
                    bookingData.status = urlStatus;
                }
                
                // Ensure booking flags are correctly set
                const processedBookingData = ensureCorrectBookingFlags(bookingData);
                
                console.log('Successfully fetched booking data:', processedBookingData);
                
                // Store the booking data for future reference
                localStorage.setItem('currentBooking', JSON.stringify(processedBookingData));
                localStorage.setItem('currentBookingId', bookingId);
                
                // Display the booking info
                displayBookingInfo(processedBookingData);
                
                // Setup real-time listener for booking status changes
                setupBookingStatusListener(bookingId, collectionName);
                
                return processedBookingData;
            } else {
                console.warn(`Booking document ${bookingId} not found in collection ${collectionName}`);
                
                if (attempt < maxRetries) {
                    console.log(`Retry attempt ${attempt + 1} in ${retryDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        } catch (error) {
            console.error(`Error fetching booking (attempt ${attempt}):`, error);
            
            if (attempt < maxRetries) {
                console.log(`Retry attempt ${attempt + 1} in ${retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }
    
    console.error(`Failed to fetch booking ${bookingId} after ${maxRetries} attempts`);
    return null;
}

// Function to set up real-time listener for booking status changes
function setupBookingStatusListener(bookingId, collectionName = 'everlodgebookings') {
    console.log(`DASHBOARD DEBUG: Setting up real-time listener for booking: ${bookingId}`);
    if (!bookingId) {
        console.error('DASHBOARD DEBUG: No booking ID provided for listener');
        return;
    }
    
    // Clear any existing listeners
    if (window.bookingStatusUnsubscribe) {
        console.log('DASHBOARD DEBUG: Clearing previous booking status listener');
        try {
            window.bookingStatusUnsubscribe();
        } catch (error) {
            console.warn('DASHBOARD DEBUG: Error clearing previous listener:', error);
        }
    }
    
    try {
        const db = window.getFirestoreDb();
        if (!db) {
            console.error('DASHBOARD DEBUG: Firestore not initialized for real-time updates');
            return;
        }
        
        console.log('DASHBOARD DEBUG: Creating document reference for collection:', collectionName, 'document:', bookingId);
        const bookingRef = window.firestoreDoc(db, collectionName, bookingId);
        
        if (!bookingRef) {
            console.error('DASHBOARD DEBUG: Failed to create document reference');
            return;
        }
        
        console.log('DASHBOARD DEBUG: Document reference created successfully:', !!bookingRef);
        
        // Set up the real-time listener
        window.bookingStatusUnsubscribe = window.firestoreOnSnapshot(
            bookingRef, 
            (docSnapshot) => {
                console.log('DASHBOARD DEBUG: Real-time update received for booking:', bookingId);
                
                if (docSnapshot.exists) {
                    const updatedBookingData = {
                        id: docSnapshot.id,
                        ...docSnapshot.data()
                    };
                    
                    console.log('DASHBOARD DEBUG: Real-time booking update data:', {
                        id: updatedBookingData.id,
                        status: updatedBookingData.status,
                        paymentStatus: updatedBookingData.paymentStatus
                    });
                    
                    // Update localStorage
                    localStorage.setItem('currentBooking', JSON.stringify(updatedBookingData));
                    
                    // Update the displayed booking info
                    displayBookingInfo(updatedBookingData);
                    
                    // Update window.currentBookingData
                    window.currentBookingData = updatedBookingData;
                    
                    // Check if status has changed and show notification
                    const oldStatus = JSON.parse(localStorage.getItem('lastBookingStatus') || '{"status":"pending"}');
                    if (oldStatus.status !== updatedBookingData.status) {
                        // Show notification of status change
                        showStatusChangeNotification(updatedBookingData.status);
                        
                        // Update the stored status
                        localStorage.setItem('lastBookingStatus', JSON.stringify({
                            status: updatedBookingData.status
                        }));
                    }
                } else {
                    console.warn(`DASHBOARD DEBUG: Booking ${bookingId} no longer exists.`);
                }
            }, 
            (error) => {
                console.error('DASHBOARD DEBUG: Error in booking status listener:', error);
            }
        );
        
        console.log('DASHBOARD DEBUG: Real-time booking status listener setup complete');
    } catch (error) {
        console.error('DASHBOARD DEBUG: Error setting up booking status listener:', error);
        console.error('DASHBOARD DEBUG: Error details:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
    }
}

// Function to show status change notification
function showStatusChangeNotification(status) {
    // Convert status to readable message
    let message = '';
    let bgColor = '';
    let textColor = '';
    
    switch (status) {
        case 'confirmed':
        case 'approved':
            message = 'Your booking has been approved!';
            bgColor = 'bg-green-100';
            textColor = 'text-green-800';
            break;
        case 'rejected':
            message = 'Your booking has been rejected.';
            bgColor = 'bg-red-100';
            textColor = 'text-red-800';
            break;
        case 'payment_rejected':
            message = 'Your payment has been rejected.';
            bgColor = 'bg-red-100';
            textColor = 'text-red-800';
            break;
        case 'pending':
            message = 'Your booking is pending approval.';
            bgColor = 'bg-yellow-100';
            textColor = 'text-yellow-800';
            break;
        case 'cancelled':
            message = 'Your booking has been cancelled.';
            bgColor = 'bg-red-100';
            textColor = 'text-red-800';
            break;
        default:
            message = `Booking status updated to: ${status}`;
            bgColor = 'bg-blue-100';
            textColor = 'text-blue-800';
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed bottom-4 right-4 ${bgColor} ${textColor} px-6 py-3 rounded-lg shadow-lg transform transition-transform duration-300 z-50`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-bell mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateY(200%)';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Function to display booking information
function displayBookingInfo(bookingData) {
    try {
        console.log('DASHBOARD DEBUG: Displaying booking information:', bookingData);
        console.log('DASHBOARD DEBUG: Booking data keys:', Object.keys(bookingData || {}));
        
        // Store booking data globally for later use (for View Details button)
        window.currentBookingData = bookingData;
        
        // Get all the booking details UI elements
        const elements = {
            guestName: document.getElementById('guest-name'),
            bookingStatus: document.getElementById('booking-status'),
            roomNumber: document.getElementById('room-number'),
            guestCount: document.getElementById('guest-count'),
            checkInDate: document.getElementById('check-in-date'),
            checkOutDate: document.getElementById('check-out-date'),
            ratePerNight: document.getElementById('rate-per-night'),
            totalAmount: document.getElementById('total-amount')
        };
        
        // Check which elements exist
        const missingElements = [];
        Object.entries(elements).forEach(([key, element]) => {
            if (!element) {
                console.error(`DASHBOARD DEBUG: Element not found: ${key}`);
                missingElements.push(key);
            }
        });
        
        if (missingElements.length > 0) {
            console.error('DASHBOARD DEBUG: Missing elements:', missingElements);
        }
        
        // Update guest name if available
        if (elements.guestName) {
            const guestName = bookingData.guestName || 'Guest';
            console.log('DASHBOARD DEBUG: Setting guest name to:', guestName);
            elements.guestName.textContent = guestName;
        }
        
        // Set room details - handle different data structures flexibly
        const propertyDetails = bookingData.propertyDetails || {};
        console.log('DASHBOARD DEBUG: Property details:', propertyDetails);
        
        if (elements.roomNumber) {
            const roomNumber = propertyDetails.roomNumber || 
                              propertyDetails.roomNo || 
                              propertyDetails.room || 
                              bookingData.roomNumber ||
                              'N/A';
            console.log('DASHBOARD DEBUG: Setting room number to:', roomNumber);
            elements.roomNumber.textContent = roomNumber;
        }
        
        // Set guest count
        if (elements.guestCount) {
            const guestCount = bookingData.guests || 
                              bookingData.guestCount || 
                              bookingData.numberOfGuests || 
                              1;
            console.log('DASHBOARD DEBUG: Setting guest count to:', guestCount);
            elements.guestCount.textContent = guestCount;
        }
        
        // Format and set dates
        if (elements.checkInDate || elements.checkOutDate) {
            console.log('DASHBOARD DEBUG: Processing dates - checkIn:', bookingData.checkIn, 'checkOut:', bookingData.checkOut);
            
            const formatDate = (dateString) => {
                if (!dateString) return 'Not specified';
                
                let date;
                
                // Handle different date formats
                if (typeof dateString === 'string') {
                    // ISO string format
                    date = new Date(dateString);
                } else if (dateString.seconds) {
                    // Firebase timestamp format
                    date = new Date(dateString.seconds * 1000);
                } else if (dateString.toDate && typeof dateString.toDate === 'function') {
                    // Firestore Timestamp object
                    date = dateString.toDate();
                } else if (dateString instanceof Date) {
                    // Already a Date object
                    date = dateString;
                } else {
                    console.error('Unknown date format:', dateString);
                    return 'Invalid Date';
                }
                
                // Check if we have a valid date
                if (isNaN(date.getTime())) {
                    console.error('Invalid date value:', dateString);
                    return 'Invalid Date';
                }
                
                try {
                    return date.toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    });
                } catch (error) {
                    console.error('Error formatting date:', error);
                    return date.toLocaleDateString();
                }
            };
            
            if (elements.checkInDate) {
                const checkInFormatted = formatDate(bookingData.checkIn);
                console.log('DASHBOARD DEBUG: Setting check-in date to:', checkInFormatted);
                elements.checkInDate.textContent = checkInFormatted;
            }
            
            if (elements.checkOutDate) {
                const checkOutFormatted = formatDate(bookingData.checkOut);
                console.log('DASHBOARD DEBUG: Setting check-out date to:', checkOutFormatted);
                elements.checkOutDate.textContent = checkOutFormatted;
            }
        }
        
        // Set pricing information
        const formatPrice = (price) => {
            // Check if price is a number or a string that can be converted to a number
            if (isNaN(price)) {
                return price; // Return as is if not a number
            }
            
            // Format as PHP currency
            return '₱' + parseFloat(price).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        };
        
        if (elements.ratePerNight) {
            const rate = bookingData.nightlyRate || 
                        bookingData.rate || 
                        bookingData.pricePerNight || 
                        0;
            const formattedRate = formatPrice(rate);
            console.log('DASHBOARD DEBUG: Setting rate per night to:', formattedRate, '(from value:', rate, ')');
            elements.ratePerNight.textContent = formattedRate;
        }
        
        if (elements.totalAmount) {
            const total = bookingData.totalPrice || 
                         bookingData.totalAmount || 
                         bookingData.totalCost || 
                         0;
            const formattedTotal = formatPrice(total);
            console.log('DASHBOARD DEBUG: Setting total amount to:', formattedTotal, '(from value:', total, ')');
            elements.totalAmount.textContent = formattedTotal;
        }
        
        // Set booking status message
        if (elements.bookingStatus) {
            console.log('DASHBOARD DEBUG: Setting booking status based on:', {
                status: bookingData.status || 'pending',
                paymentStatus: bookingData.paymentStatus || 'pending',
                approvedByAdmin: bookingData.approvedByAdmin || false
            });
            
            const bookingStatus = bookingData.status || 'pending';
            const paymentStatus = bookingData.paymentStatus || 'pending';
            let statusMessage = '';
            
            switch (bookingStatus.toLowerCase()) {
                case 'approved':
                    statusMessage = 'Your booking is confirmed';
                    elements.bookingStatus.style.color = '#047857'; // Green
                    break;
                case 'confirmed':
                    // Only treat as confirmed if it's explicitly been approved by admin
                    if (bookingData.approvedByAdmin === true) {
                        statusMessage = 'Your booking is confirmed';
                        elements.bookingStatus.style.color = '#047857'; // Green
                    } else {
                        statusMessage = 'Your booking is pending approval';
                        elements.bookingStatus.style.color = '#B45309'; // Amber
                    }
                    break;
                case 'pending':
                    if (paymentStatus === 'rejected') {
                        statusMessage = 'Your payment has been rejected';
                        elements.bookingStatus.style.color = '#DC2626'; // Red
                    } else {
                        statusMessage = 'Your booking is pending approval';
                        elements.bookingStatus.style.color = '#B45309'; // Amber
                    }
                    break;
                case 'rejected':
                    statusMessage = 'Your booking has been rejected';
                    elements.bookingStatus.style.color = '#DC2626'; // Red
                    
                    // Add rejection reason if available
                    if (bookingData.rejectionReason) {
                        statusMessage += `: ${bookingData.rejectionReason}`;
                    }
                    break;
                case 'payment_rejected':
                    statusMessage = 'Your payment has been rejected';
                    elements.bookingStatus.style.color = '#DC2626'; // Red
                    
                    // Add rejection reason if available
                    if (bookingData.rejectionReason) {
                        statusMessage += `. Reason: ${bookingData.rejectionReason}`;
                    }
                    break;
                case 'completed':
                    statusMessage = 'Your stay has been completed';
                    elements.bookingStatus.style.color = '#1F2937'; // Gray
                    break;
                case 'cancelled':
                    statusMessage = 'This booking has been cancelled';
                    elements.bookingStatus.style.color = '#DC2626'; // Red
                    break;
                default:
                    statusMessage = `Booking status: ${bookingStatus}`;
                    elements.bookingStatus.style.color = '#2563EB'; // Blue
            }
            
            elements.bookingStatus.textContent = statusMessage;
            console.log('DASHBOARD DEBUG: Set booking status to:', statusMessage);
        }
        
        console.log('DASHBOARD DEBUG: Successfully displayed booking information');
        
    } catch (error) {
        console.error('DASHBOARD DEBUG: Error displaying booking information:', error);
        console.error('DASHBOARD DEBUG: Error stack:', error.stack);
    }
}

function displayNoBookingInfo() {
    // Clear all booking fields
    const elements = [
        'room-number',
        'check-in-date',
        'check-out-date',
        'guest-count',
        'rate-per-night',
        'total-amount'
    ];

    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = '---';
        }
    });

    // Update status
    const statusElement = document.getElementById('booking-status');
    if (statusElement) {
        statusElement.textContent = 'No active bookings found. Browse our available rooms to make a reservation.';
    }
}

// Function to show bookings modal
function showBookingsModal() {
    console.log('showBookingsModal called');
    
    // Make sure the popup exists first
    const bookingsPopup = ensureBookingsPopupExists();
    
    if (bookingsPopup) {
        // IMPORTANT: Update the booking history if the user is logged in
        const auth = window.getFirebaseAuth();
        if (auth && auth.currentUser) {
            const userId = auth.currentUser.uid;
            console.log('Loading booking data for user:', userId);
            
            // Ensure current booking data has the correct user ID
            if (window.currentBookingData && !window.currentBookingData.userId) {
                console.log('Setting user ID for current booking data');
                window.currentBookingData.userId = userId;
                // Also update localStorage
                localStorage.setItem('currentBooking', JSON.stringify(window.currentBookingData));
            }
            
            try {
                // Load data for all tabs immediately
                loadAllBookingTabs(userId);
                
            } catch (error) {
                console.error('Error loading booking data:', error);
                showBookingErrorMessage();
            }
        } else {
            console.warn('User not logged in - cannot load booking history');
            showLoginPrompt();
        }
        
        // Show the popup with proper styling
        bookingsPopup.classList.remove('hidden');
        bookingsPopup.classList.remove('bg-black', 'bg-opacity-50', 'bg-opacity-0');
        bookingsPopup.classList.add('bg-transparent');
        
        // Close the user drawer if it's open
        const userDrawer = document.getElementById('userDrawer');
        if (userDrawer && !userDrawer.classList.contains('hidden')) {
            userDrawer.classList.add('hidden');
        }
        
        // Ensure the current tab is selected by default
        setDefaultActiveTab();
    }
}

// New function to load all booking tabs efficiently
function loadAllBookingTabs(userId) {
    const currentTab = document.getElementById('currentBookings');
    const previousTab = document.getElementById('previousBookings');
    const historyTab = document.getElementById('bookingHistoryContainer');
    
    // Show loading indicators
    const loadingHTML = `
        <div class="flex justify-center items-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span class="text-gray-600">Loading your bookings...</span>
        </div>
    `;
    
    if (currentTab) currentTab.innerHTML = loadingHTML;
    if (previousTab) previousTab.innerHTML = loadingHTML;
    if (historyTab) historyTab.innerHTML = loadingHTML;
    
    // Check if we have current booking data from the dashboard
    let dashboardBooking = null;
    if (window.currentBookingData && window.currentBookingData.userId === userId) {
        dashboardBooking = window.currentBookingData;
        console.log('Found current booking data from dashboard:', dashboardBooking);
    }
    
    // Load booking history which will populate all tabs
    if (typeof window.loadBookingHistory === 'function') {
        console.log('Loading booking history for all tabs');
        
        // Create a wrapper function to handle the dashboard booking
        const originalDisplayAllBookings = window.displayAllBookings;
        
        // Temporarily override displayAllBookings to include dashboard booking
        window.displayAllBookings = function(bookings, historyContainer, currentBookingsContainer, previousBookingsContainer) {
            console.log('Enhanced displayAllBookings called with', bookings?.length || 0, 'bookings from Firestore');
            
            let allBookings = [...(bookings || [])];
            
            // Add dashboard booking if it exists and isn't already in the list
            if (dashboardBooking) {
                const existingBooking = allBookings.find(b => b.id === dashboardBooking.id);
                if (!existingBooking) {
                    console.log('Adding dashboard booking to bookings list');
                    allBookings.unshift(dashboardBooking); // Add to beginning
                } else {
                    console.log('Dashboard booking already exists in Firestore results');
                }
            }
            
            console.log('Total bookings to display:', allBookings.length);
            
            // Call the original function with enhanced booking list
            if (originalDisplayAllBookings) {
                originalDisplayAllBookings(allBookings, historyContainer, currentBookingsContainer, previousBookingsContainer);
            }
            
            // Restore original function
            window.displayAllBookings = originalDisplayAllBookings;
        };
        
        window.loadBookingHistory(userId, window.getFirestoreDb);
    } else {
        console.error('loadBookingHistory function not available');
        
        // If loadBookingHistory isn't available but we have dashboard booking, show it
        if (dashboardBooking) {
            console.log('Displaying dashboard booking only since loadBookingHistory unavailable');
            
            // Create a simple display for the dashboard booking
            const bookingCard = createSimpleDashboardBookingCard(dashboardBooking);
            
            if (currentTab) {
                currentTab.innerHTML = `
                    <div class="space-y-4">
                        <div class="mb-4">
                            <p class="text-sm text-gray-600">
                                <i class="ri-information-line mr-1"></i>
                                1 active booking (from dashboard)
                            </p>
                        </div>
                        ${bookingCard}
                    </div>
                `;
            }
            
            if (historyTab) {
                historyTab.innerHTML = `
                    <div class="space-y-4">
                        <h3 class="text-lg font-semibold">Current Booking</h3>
                        ${bookingCard}
                    </div>
                `;
            }
            
            if (previousTab) {
                previousTab.innerHTML = `
                    <div class="text-center text-gray-500 py-8">
                        <i class="ri-history-line text-4xl mb-4 text-gray-300"></i>
                        <p class="text-lg mb-2">No previous bookings</p>
                        <p class="text-sm">Your booking history will appear here</p>
                    </div>
                `;
            }
        } else {
            showBookingErrorMessage();
        }
    }
}

// Function to show error message in all booking tabs
function showBookingErrorMessage() {
    const errorHTML = `
        <div class="text-center text-red-500 py-8">
            <i class="ri-error-warning-line text-2xl mb-2"></i>
            <p>Error loading booking data</p>
            <button onclick="window.location.reload()" class="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                Retry
            </button>
        </div>
    `;
    
    const containers = [
        document.getElementById('currentBookings'),
        document.getElementById('previousBookings'),
        document.getElementById('bookingHistoryContainer')
    ];
    
    containers.forEach(container => {
        if (container) container.innerHTML = errorHTML;
    });
}

// Function to show login prompt in all booking tabs
function showLoginPrompt() {
    const loginHTML = `
        <div class="text-center py-8">
            <i class="ri-user-line text-4xl text-gray-400 mb-4"></i>
            <p class="text-gray-500 mb-4">Please log in to view your bookings</p>
            <a href="../Login/index.html" class="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 inline-block">
                Log In
            </a>
        </div>
    `;
    
    const containers = [
        document.getElementById('currentBookings'),
        document.getElementById('previousBookings'),
        document.getElementById('bookingHistoryContainer')
    ];
    
    containers.forEach(container => {
        if (container) container.innerHTML = loginHTML;
    });
}

// Function to ensure the correct tab is active by default
function setDefaultActiveTab() {
    const bookingsPopup = document.getElementById('bookingsPopup');
    if (!bookingsPopup) return;
    
    const tabButtons = bookingsPopup.querySelectorAll('[data-tab]');
    const currentTab = document.getElementById('currentBookings');
    const previousTab = document.getElementById('previousBookings');
    const historyTab = document.getElementById('bookingHistoryContainer');
    
    // Set Current tab as active
    tabButtons.forEach(btn => {
        const isActive = btn.getAttribute('data-tab') === 'current';
        btn.classList.toggle('text-blue-600', isActive);
        btn.classList.toggle('border-b-2', isActive);
        btn.classList.toggle('border-blue-600', isActive);
        btn.classList.toggle('text-gray-500', !isActive);
    });
    
    // Show current tab content, hide others
    if (currentTab) currentTab.classList.remove('hidden');
    if (previousTab) previousTab.classList.add('hidden');
    if (historyTab) historyTab.classList.add('hidden');
}

// Function to create a simple booking card from dashboard booking data
function createSimpleDashboardBookingCard(booking) {
    // Extract and format date information
    const formatDate = (dateInput) => {
        if (!dateInput) return 'N/A';
        
        let date;
        
        // Handle different date formats
        if (typeof dateInput === 'string') {
            date = new Date(dateInput);
        } else if (dateInput.seconds) {
            date = new Date(dateInput.seconds * 1000);
        } else if (dateInput.toDate && typeof dateInput.toDate === 'function') {
            date = dateInput.toDate();
        } else if (dateInput instanceof Date) {
            date = dateInput;
        } else {
            return 'Invalid Date';
        }
        
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    };
    
    const checkInDate = formatDate(booking.checkIn);
    const checkOutDate = formatDate(booking.checkOut);
    
    // Get property details - handle different data structures
    const propertyName = booking.propertyDetails?.name || 'LodgeEase Hotel';
    const roomType = booking.propertyDetails?.roomType || 'Standard Room';
    const roomNumber = booking.propertyDetails?.roomNumber || 
                      booking.propertyDetails?.roomNo || 
                      booking.roomNumber || 
                      'N/A';
    
    // Get status and determine styling
    const status = booking.status || 'pending';
    let statusClass = '';
    let statusText = '';
    
    switch (status.toLowerCase()) {
        case 'confirmed':
        case 'approved':
            if (booking.approvedByAdmin === true) {
                statusClass = 'bg-green-100 text-green-800';
                statusText = 'Confirmed';
            } else {
                statusClass = 'bg-yellow-100 text-yellow-800';
                statusText = 'Pending Approval';
            }
            break;
        case 'pending':
            statusClass = 'bg-yellow-100 text-yellow-800';
            statusText = 'Pending';
            break;
        case 'active':
            statusClass = 'bg-green-100 text-green-800';
            statusText = 'Active';
            break;
        case 'cancelled':
            statusClass = 'bg-red-100 text-red-800';
            statusText = 'Cancelled';
            break;
        case 'rejected':
            statusClass = 'bg-red-100 text-red-800';
            statusText = 'Rejected';
            break;
        default:
            statusClass = 'bg-gray-100 text-gray-800';
            statusText = status.charAt(0).toUpperCase() + status.slice(1);
    }
    
    // Determine if this is an upcoming or ongoing booking
    const currentDate = new Date();
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    
    let timingIndicator = '';
    if (checkIn > currentDate) {
        const daysUntil = Math.ceil((checkIn - currentDate) / (1000 * 60 * 60 * 24));
        timingIndicator = `
            <div class="mt-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                <i class="ri-time-line mr-1"></i>
                Check-in in ${daysUntil} day${daysUntil > 1 ? 's' : ''}
            </div>
        `;
    } else if (checkIn <= currentDate && checkOut >= currentDate) {
        timingIndicator = `
            <div class="mt-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                <i class="ri-home-line mr-1"></i>
                Currently checked in
            </div>
        `;
    }
    
    return `
        <div class="bg-white border rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-semibold text-gray-900">${propertyName}</h4>
                <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
                    ${statusText}
                </span>
            </div>
            <p class="text-sm text-gray-600 mb-2">${roomType} ${roomNumber !== 'N/A' ? `#${roomNumber}` : ''}</p>
            <div class="flex items-center text-sm text-gray-500 space-x-2 mb-2">
                <i class="ri-calendar-line"></i>
                <span>${checkInDate} → ${checkOutDate}</span>
            </div>
            ${timingIndicator}
            <div class="flex justify-between items-center mt-3">
                <span class="font-medium text-gray-900">₱${booking.totalPrice?.toLocaleString() || booking.totalAmount?.toLocaleString() || 'N/A'}</span>
                <div class="flex space-x-2">
                    <button class="text-blue-600 hover:text-blue-800 text-sm font-medium" 
                            onclick="window.showBookingDetailsHandler ? window.showBookingDetailsHandler(event) : showBookingDetails(${JSON.stringify(booking).replace(/"/g, '&quot;')})">
                        View Details
                    </button>
                    ${status.toLowerCase() === 'confirmed' || status.toLowerCase() === 'approved' ? `
                        <button class="text-green-600 hover:text-green-800 text-sm font-medium">
                            <i class="ri-phone-line mr-1"></i>
                            Contact
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

// Make showBookingsModal function available globally
window.showBookingsModal = showBookingsModal;

// Stub functions for references in the code
function initializeAllFunctionality() {
    console.log('initializeAllFunctionality - stub function');
    // This function would normally initialize various features
}

function updateLoginButtonVisibility(user) {
    console.log('Updating login button visibility based on user:', user ? 'logged in' : 'logged out');
    
    // Handle login button
    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
        loginButton.style.display = user ? 'none' : 'flex';
        console.log('Login button visibility updated:', user ? 'hidden' : 'visible');
    }
    
    // Handle mobile login button
    const mobileLoginButton = document.getElementById('mobileLoginButton');
    if (mobileLoginButton) {
        mobileLoginButton.style.display = user ? 'none' : 'block';
        console.log('Mobile login button visibility updated:', user ? 'hidden' : 'visible');
    }
    
    // Handle user icon button
    const userIconBtn = document.getElementById('userIconBtn');
    if (userIconBtn) {
        userIconBtn.classList.toggle('hidden', !user);
        console.log('User icon button visibility updated:', user ? 'visible' : 'hidden');
    }
}

function createLodgeCards() {
    console.log('createLodgeCards - stub function');
    // This would create lodge cards in the UI
}

function initializeNavigation() {
    console.log('Initializing navigation elements');
    
    // Mobile menu toggle
    const menuButton = document.querySelector('#userIconBtn');
    const mobileMenu = document.querySelector('#mobile-menu');
    
    if (menuButton && mobileMenu) {
        menuButton.addEventListener('click', function() {
            const isHidden = mobileMenu.classList.contains('hidden');
            if (isHidden) {
                mobileMenu.classList.remove('hidden');
            } else {
                mobileMenu.classList.add('hidden');
            }
        });
    }
    
    // Initialize login button state
    const currentUser = window.getFirebaseAuth().currentUser;
    updateLoginButtonVisibility(currentUser);
}

function initializeCheckInDateFilter() {
    console.log('initializeCheckInDateFilter - stub function');
    // This would initialize date filters
}

// Function to handle modal opening and display booking details
function showBookingDetails(booking) {
    console.log('DEBUG: showBookingDetails called with booking:', booking);
    
    // Get the modal element
    const modal = document.getElementById('bookingModal');
    if (!modal) {
        console.error('DEBUG: Modal element not found - cannot find #bookingModal');
        alert('Error: Cannot find the booking details modal. Please contact support.');
        return;
    }
    
    console.log('DEBUG: Found modal element:', modal);
    
    // Get or create the modal content
    let modalContent = document.getElementById('modalContent');
    if (!modalContent) {
        console.error('DEBUG: Modal content element not found - cannot find #modalContent');
        alert('Error: Cannot find the modal content area. Please contact support.');
        return;
    }

    console.log('DEBUG: Found modalContent element:', modalContent);
    
    try {
        console.log('DEBUG: Building modal content HTML');
        // Use the exact totalPrice value without modification
        const totalAmount = parseFloat(booking.totalPrice || 0);
        
        // Set the content of the modal with the booking details
        modalContent.innerHTML = `
            <div id="printable-content" class="relative overflow-hidden">
                <!-- Background watermark -->
                <div class="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none" style="z-index: 0;">
                    <img src="https://lms-app-2b903.web.app/components/LodgeEaseLogo.png" alt="LodgeEase Watermark" class="w-64 h-64">
                </div>
                
                <div class="relative z-10">
                    <!-- Header with logo -->
                    <div class="text-center mb-6 border-b pb-4">
                        <div class="flex items-center justify-center mb-2">
                            <img src="https://lms-app-2b903.web.app/components/LodgeEaseLogo.png" alt="LodgeEase Logo" class="h-16 w-16 mr-3">
                            <div class="text-left">
                                <h1 class="text-2xl font-bold text-blue-600">LodgeEase</h1>
                                <p class="text-sm text-gray-600">Aspiras Palispis Highway, Baguio City</p>
                            </div>
                        </div>
                        <h2 class="text-xl font-bold text-gray-800 mt-4">OFFICIAL BOOKING CONFIRMATION</h2>
                    </div>

                    <!-- Booking Reference and Status -->
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-gray-700 font-medium">Booking Reference:</span>
                            <span class="font-mono font-bold bg-blue-50 px-2 py-1 rounded">${booking.id || '---'}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-gray-700 font-medium">Status:</span>
                            <span class="font-medium px-2 py-1 rounded ${
                                booking.status === 'cancelled' || booking.status === 'rejected' ? 'bg-red-50 text-red-600' : 
                                booking.status === 'pending' ? 'bg-yellow-50 text-yellow-600' : 
                                booking.status === 'approved' ? 'bg-green-50 text-green-600' : 
                                booking.status === 'confirmed' && booking.approvedByAdmin === true ? 'bg-green-50 text-green-600' :
                                booking.status === 'confirmed' ? 'bg-yellow-50 text-yellow-600' : 'bg-blue-50 text-blue-600'
                            }">
                                ${booking.status ? (
                                    booking.status === 'approved' ? 'Confirmed' : 
                                    booking.status === 'confirmed' && booking.approvedByAdmin === true ? 'Confirmed' :
                                    booking.status === 'confirmed' ? 'Pending Approval' :
                                    booking.status.charAt(0).toUpperCase() + booking.status.slice(1)
                                ) : 'Unknown'}
                            </span>
                        </div>
                        ${booking.paymentStatus ? `
                        <div class="flex justify-between items-center mt-2">
                            <span class="text-gray-700 font-medium">Payment Status:</span>
                            <span class="font-medium px-2 py-1 rounded ${
                                booking.paymentStatus === 'approved' || booking.paymentStatus === 'verified' || booking.paymentStatus === 'paid' ? 'bg-green-50 text-green-600' : 
                                booking.paymentStatus === 'pending' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'
                            }">
                                ${booking.paymentStatus.charAt(0).toUpperCase() + 
                                booking.paymentStatus.slice(1)}
                            </span>
                        </div>
                        ` : ''}
                    </div>

                    <!-- Guest and Hotel Info -->
                    <div class="grid grid-cols-2 gap-6 mb-6">
                        <div class="border border-gray-200 rounded-lg p-4">
                            <h3 class="font-semibold mb-3 text-gray-800 border-b pb-2">Guest Information</h3>
                            <p class="text-gray-700 font-medium">${booking.guestName || '---'}</p>
                            <p class="text-gray-600">${booking.email || '---'}</p>
                            <p class="text-gray-600 mt-2">Number of Guests: ${booking.guests || '---'}</p>
                        </div>
                        <div class="border border-gray-200 rounded-lg p-4">
                            <h3 class="font-semibold mb-3 text-gray-800 border-b pb-2">Hotel Information</h3>
                            <p class="text-gray-700 font-medium">LodgeEase Hotel</p>
                            <p class="text-gray-600">Aspiras Palispis Highway</p>
                            <p class="text-gray-600">Baguio City, 2600</p>
                            <p class="text-gray-600 mt-2">+63 912 991 2658</p>
                        </div>
                    </div>

                    <!-- Stay Details -->
                    <div class="bg-blue-50 border border-blue-100 rounded-lg p-5 mb-6">
                        <h3 class="font-semibold mb-4 text-blue-800 border-b border-blue-200 pb-2">Stay Details</h3>
                        <div class="grid grid-cols-2 gap-6">
                            <div class="bg-white rounded-lg p-3 shadow-sm">
                                <p class="text-gray-600 text-sm">Check-in Date</p>
                                <p class="font-bold text-gray-800 text-lg">${formatDate(booking.checkIn)}</p>
                                <p class="text-sm text-gray-500 mt-1">After 2:00 PM</p>
                            </div>
                            <div class="bg-white rounded-lg p-3 shadow-sm">
                                <p class="text-gray-600 text-sm">Check-out Date</p>
                                <p class="font-bold text-gray-800 text-lg">${formatDate(booking.checkOut)}</p>
                                <p class="text-sm text-gray-500 mt-1">Before 12:00 PM</p>
                            </div>
                        </div>
                        
                        <!-- Payment Status Information -->
                        <div class="mt-4 pt-3 border-t border-blue-200">
                            <p class="text-gray-600 text-sm">Payment Status</p>
                            ${booking.paymentStatus === 'verified' ? `
                                <p class="font-medium text-green-600 bg-green-50 rounded-lg p-2 mt-1 inline-block">
                                    <i class="fas fa-check-circle mr-1"></i> Payment Verified
                                </p>
                            ` : booking.paymentStatus === 'pending' ? `
                                <p class="font-medium text-yellow-600 bg-yellow-50 rounded-lg p-2 mt-1 inline-block">
                                    <i class="fas fa-clock mr-1"></i> Payment Pending Verification
                                </p>
                                <p class="text-sm text-gray-500 mt-1">Please wait for admin verification</p>
                            ` : booking.paymentStatus === 'rejected' ? `
                                <p class="font-medium text-red-600 bg-red-50 rounded-lg p-2 mt-1 inline-block">
                                    <i class="fas fa-times-circle mr-1"></i> Payment Rejected
                                </p>
                                ${booking.rejectionReason ? `
                                    <p class="text-sm text-red-600 mt-1">Reason: ${booking.rejectionReason}</p>
                                ` : ''}
                            ` : `
                                <p class="font-medium text-gray-600">No Payment Status Available</p>
                            `}
                        </div>
                    </div>

                    <!-- Room Details -->
                    <div class="border border-gray-200 rounded-lg p-4 mb-6">
                        <h3 class="font-semibold mb-3 text-gray-800 border-b pb-2">Room Details</h3>
                        <div class="space-y-3">
                            <div class="flex justify-between items-center bg-gray-50 p-2 rounded">
                                <span class="text-gray-700 font-medium">Room Number</span>
                                <span class="font-bold">${booking.propertyDetails ? booking.propertyDetails.roomNumber || '---' : '---'}</span>
                            </div>
                            <div class="flex justify-between items-center bg-gray-50 p-2 rounded">
                                <span class="text-gray-700 font-medium">Room Type</span>
                                <span class="font-bold">${booking.propertyDetails ? booking.propertyDetails.roomType || '---' : '---'}</span>
                            </div>
                            <div class="flex justify-between items-center bg-gray-50 p-2 rounded">
                                <span class="text-gray-700 font-medium">Rate per Night</span>
                                <span class="font-bold">₱${booking.nightlyRate ? booking.nightlyRate.toLocaleString() : '---'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Total Amount -->
                    <div class="bg-gray-800 text-white rounded-lg p-4 mb-6">
                        <div class="flex justify-between items-center text-xl">
                            <span class="font-medium">Total Amount</span>
                            <span class="font-bold">₱${totalAmount.toLocaleString()}</span>
                        </div>
                    </div>

                    <!-- Footer Notes -->
                    <div class="mt-6 text-center border-t border-gray-200 pt-6">
                        <p class="font-medium text-gray-800 mb-2">Please present this booking confirmation upon check-in</p>
                        <div class="text-sm text-gray-600 space-y-1">
                            <p>Check-in time is 2:00 PM. Early check-in is subject to availability.</p>
                            <p>Check-out time is 12:00 PM. Late check-out may incur additional charges.</p>
                            <p>For inquiries, contact: +63 912 991 2658 or lodgeease@example.com</p>
                        </div>
                        <div class="mt-4 text-xs text-gray-500">
                            <p>Booking Reference: ${booking.id || 'N/A'}</p>
                            <p>Generated on: ${new Date().toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // IMPORTANT: Show the modal - first ensure any hidden class is removed and set display to flex
        console.log('DEBUG: Showing modal - removing hidden class and setting display style');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        
        // Create global closeModal function if it doesn't exist
        if (!window.closeModal) {
            window.closeModal = function() {
                console.log('DEBUG: closeModal function called');
                const modal = document.getElementById('bookingModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                }
            };
        }
        
        // Set up the close modal buttons
        const closeButtons = modal.querySelectorAll('#closeModal, button[onclick*="closeModal"]');
        closeButtons.forEach(btn => {
            // Remove any existing event listeners to prevent duplicates
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            // Add new event listener to close the modal
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('DEBUG: Close button clicked');
                window.closeModal();
                return false;
            });
            
            // Also set onclick for maximum compatibility
            newBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('DEBUG: Close button onclick triggered');
                window.closeModal();
                return false;
            };
        });
        
        // Add click outside to close
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                console.log('DEBUG: Clicked outside modal content, closing');
                window.closeModal();
            }
        });
        
        // Set up print and download buttons
        const printBooking = document.getElementById('printBooking');
        const downloadPDF = document.getElementById('downloadPDF');
        
        if (printBooking) {
            printBooking.addEventListener('click', function() {
                const modalContent = document.getElementById('modalContent');
                if (!modalContent) return;
    
                const printWindow = window.open('', '', 'width=800,height=600');
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <title>Booking Confirmation - ${booking.id || 'LodgeEase'}</title>
                            <link href="https://cdn.tailwindcss.com" rel="stylesheet">
                            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
                            <style>
                                @media print {
                                    @page {
                                        size: letter portrait;
                                        margin: 0.5in;
                                    }
                                    body {
                                        -webkit-print-color-adjust: exact;
                                        print-color-adjust: exact;
                                    }
                                }
                                body {
                                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                    line-height: 1.5;
                                    color: #333;
                                }
                            </style>
                        </head>
                        <body class="p-4" onload="window.print(); window.setTimeout(function(){ window.close(); }, 500);">
                            <div class="max-w-4xl mx-auto">${modalContent.innerHTML}</div>
                        </body>
                    </html>
                `);
                printWindow.document.close();
            });
        }
    
        if (downloadPDF) {
            downloadPDF.addEventListener('click', function() {
                const printSection = document.getElementById('printable-content');
                if (!printSection) return;
                
                const opt = {
                    margin: 0.5,
                    filename: `booking-confirmation-${booking.id || 'default'}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2 },
                    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
                };
                
                // Use html2pdf bundle
                html2pdf().set(opt).from(printSection).save();
            });
        }
        
        console.log('DEBUG: Modal displayed successfully with booking details');
        
    } catch (error) {
        console.error('DEBUG: Error showing booking details:', error);
        alert(`Error showing booking details: ${error.message}`);
    }
}

// Function to dump all storage contents to console
function dumpStorageToConsole() {
    console.log('===== DASHBOARD DEBUG: Storage Contents =====');
    
    // Dump localStorage
    console.log('--- localStorage ---');
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        let value = '';
        try {
            const rawValue = localStorage.getItem(key);
            // Try to parse as JSON, if not, just show as string
            try {
                const parsedValue = JSON.parse(rawValue);
                value = `[Object/Array with keys: ${Object.keys(parsedValue).join(', ')}]`;
            } catch (e) {
                value = rawValue.length > 50 ? rawValue.substring(0, 50) + '...' : rawValue;
            }
        } catch (e) {
            value = '[Error reading value]';
        }
        console.log(`${key}: ${value}`);
    }
    
    // Dump sessionStorage
    console.log('--- sessionStorage ---');
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        let value = '';
        try {
            const rawValue = sessionStorage.getItem(key);
            // Try to parse as JSON, if not, just show as string
            try {
                const parsedValue = JSON.parse(rawValue);
                value = `[Object/Array with keys: ${Object.keys(parsedValue).join(', ')}]`;
            } catch (e) {
                value = rawValue.length > 50 ? rawValue.substring(0, 50) + '...' : rawValue;
            }
        } catch (e) {
            value = '[Error reading value]';
        }
        console.log(`${key}: ${value}`);
    }
    
    console.log('=======================================');
}

// Function to check if all required dashboard UI elements exist
function verifyDashboardElements() {
    console.log('DASHBOARD DEBUG: Verifying UI elements...');
    
    const requiredElements = [
        { id: 'booking-status', description: 'Booking status message' },
        { id: 'guest-name', description: 'Guest name display' },
        { id: 'room-number', description: 'Room number display' },
        { id: 'guest-count', description: 'Guest count display' },
        { id: 'check-in-date', description: 'Check-in date display' },
        { id: 'check-out-date', description: 'Check-out date display' },
        { id: 'rate-per-night', description: 'Nightly rate display' },
        { id: 'total-amount', description: 'Total amount display' },
        { id: 'viewDetailsBtn', description: 'View details button' }
    ];
    
    let allElementsExist = true;
    const missingElements = [];
    
    requiredElements.forEach(element => {
        const domElement = document.getElementById(element.id);
        if (!domElement) {
            allElementsExist = false;
            missingElements.push(element);
            console.error(`DASHBOARD DEBUG: Missing UI element: ${element.id} (${element.description})`);
        }
    });
    
    if (allElementsExist) {
        console.log('DASHBOARD DEBUG: All required UI elements exist');
        return true;
    } else {
        console.error(`DASHBOARD DEBUG: Missing ${missingElements.length} elements:`, 
            missingElements.map(e => e.id).join(', '));
        return false;
    }
}

// Function to add debugging controls to the page
function addDebugControls() {
    const controlsContainer = document.createElement('div');
    controlsContainer.classList.add('debug-controls');
    controlsContainer.style.position = 'fixed';
    controlsContainer.style.bottom = '10px';
    controlsContainer.style.right = '10px';
    controlsContainer.style.zIndex = '9999';
    controlsContainer.style.background = '#f0f0f0';
    controlsContainer.style.padding = '10px';
    controlsContainer.style.border = '1px solid #ccc';
    controlsContainer.style.borderRadius = '5px';
    
    // Add a Force Load button
    const forceLoadBtn = document.createElement('button');
    forceLoadBtn.innerText = 'Force Load Booking';
    forceLoadBtn.style.padding = '5px 10px';
    forceLoadBtn.style.backgroundColor = '#4CAF50';
    forceLoadBtn.style.color = 'white';
    forceLoadBtn.style.border = 'none';
    forceLoadBtn.style.borderRadius = '3px';
    forceLoadBtn.style.cursor = 'pointer';
    
    forceLoadBtn.addEventListener('click', function() {
        console.log('Force Load button clicked');
        
        // Try to load from localStorage first
        const bookingId = localStorage.getItem('currentBookingId') || 
                          localStorage.getItem('lastConfirmedBookingId') ||
                          localStorage.getItem('dashboard_pendingBookingId');
        
        if (bookingId) {
            console.log(`Force loading booking ID: ${bookingId}`);
            fetchBookingById(bookingId, 'everlodgebookings')
                .then(bookingData => {
                    if (bookingData) {
                        console.log('Force loaded booking data:', bookingData);
                        displayBookingInfo(bookingData);
                        alert('Booking data loaded successfully!');
                    } else {
                        console.warn('Force load: No booking data found');
                        alert('No booking data found with ID: ' + bookingId);
                    }
                })
                .catch(error => {
                    console.error('Force load error:', error);
                    alert('Error loading booking: ' + error.message);
                });
        } else {
            console.warn('Force load: No booking ID found in storage');
            alert('No booking ID found in storage');
        }
    });
    
    // Add buttons to container
    controlsContainer.appendChild(forceLoadBtn);
    
    // Add container to body
    document.body.appendChild(controlsContainer);
}

// Function to initialize the bookings modal
function initializeBookingsModal() {
    console.log('Initializing bookings modal...');
    
    // Ensure the modal element has the correct structure and IDs
    const modal = document.getElementById('bookingModal');
    
    if (!modal) {
        console.error('Booking modal element not found in the DOM');
        return;
    }
    
    console.log('Modal found with classes:', modal.className);
    
    // Check if the main content div exists
    const modalContent = document.getElementById('modalContent');
    if (!modalContent) {
        console.error('Modal content element not found in the DOM');
    } else {
        console.log('Modal content element found');
    }
    
    // Check for the action buttons
    const closeBtn = document.getElementById('closeModal');
    const printBtn = document.getElementById('printBooking');
    const downloadBtn = document.getElementById('downloadPDF');
    
    console.log('Modal elements found:', {
        closeBtn: !!closeBtn,
        printBtn: !!printBtn,
        downloadBtn: !!downloadBtn
    });
    
    // Set up the print functionality
    if (printBtn) {
        printBtn.addEventListener('click', function() {
            console.log('Print button clicked');
            if (window.currentBookingData) {
                window.print();
            } else {
                console.error('No booking data available to print');
                alert('No booking information available to print');
            }
        });
    }
    
    // Set up the download PDF functionality
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            console.log('Download PDF button clicked');
            if (window.currentBookingData) {
                const printableContent = document.getElementById('printable-content');
                if (printableContent) {
                    const opt = {
                        margin: 10,
                        filename: `booking-confirmation-${window.currentBookingData.id || 'lodgeease'}.pdf`,
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { scale: 2 },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                    };
                    
                    // Generate PDF
                    html2pdf().set(opt).from(printableContent).save();
                } else {
                    console.error('Printable content element not found');
                    alert('Could not generate PDF. Please try again.');
                }
            } else {
                console.error('No booking data available to download');
                alert('No booking information available to download');
            }
        });
    }
    
    // Set up the close modal functionality
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            console.log('Close button clicked');
            modal.classList.add('hidden');
            modal.style.display = 'none';
        });
        
        // Add an additional onclick handler as a fallback
        closeBtn.onclick = function() {
            console.log('Close button clicked via onclick');
            modal.classList.add('hidden');
            modal.style.display = 'none';
            return false;
        };
    }
    
    // Add global closeModal function
    window.closeModal = function() {
        console.log('Global closeModal function called');
        const modal = document.getElementById('bookingModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    };
    
    // Add the ability to close the modal by clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            console.log('Clicked outside modal content, closing modal');
            window.closeModal();
        }
    });
}

// Function to initialize bookings modal tabs
function initializeBookingsTabs() {
    console.log('Initializing bookings tabs');
    const bookingsPopup = document.getElementById('bookingsPopup');
    if (!bookingsPopup) {
        console.error('Bookings popup not found');
        return;
    }
    
    // Log detection of function call
    console.log('initializeBookingsTabs function called');
    
    // Get all tab buttons and content containers
    const tabButtons = bookingsPopup.querySelectorAll('[data-tab]');
    const contentContainers = {
        current: document.getElementById('currentBookings'),
        previous: document.getElementById('previousBookings'),
        history: document.getElementById('bookingHistoryContainer')
    };
    
    // Verify all containers exist
    if (!contentContainers.current) {
        console.error('Current bookings container not found');
    }
    if (!contentContainers.previous) {
        console.error('Previous bookings container not found');
    }
    if (!contentContainers.history) {
        console.error('Booking history container not found');
    }
    
    // First, ensure the Current tab is selected by default
    const currentTab = Array.from(tabButtons).find(btn => btn.getAttribute('data-tab') === 'current');
    if (currentTab) {
        // Update tab button styles
        tabButtons.forEach(btn => {
            const isActive = btn.getAttribute('data-tab') === 'current';
            btn.classList.toggle('text-blue-600', isActive);
            btn.classList.toggle('border-b-2', isActive);
            btn.classList.toggle('border-blue-600', isActive);
            btn.classList.toggle('text-gray-500', !isActive);
        });
        
        // Show current content, hide others
        Object.entries(contentContainers).forEach(([name, container]) => {
            if (container) {
                const isVisible = name === 'current';
                container.classList.toggle('hidden', !isVisible);
                console.log(`Setting ${name} container visibility to ${isVisible ? 'visible' : 'hidden'}`);
            }
        });
    }
    
    // NOTE: The tab click event handlers are now set up directly in the showBookingsModal function
    // This function is kept for compatibility, but the actual event binding happens there
}

// Add a manual test function that can be called from the browser console
window.testViewDetailsButton = function() {
    console.log('DEBUG: Manual test of View Details button triggered');
    
    // Check if the View Details button exists
    const viewDetailsBtn = document.getElementById('viewDetailsBtn');
    console.log('DEBUG: viewDetailsBtn exists:', !!viewDetailsBtn);
    
    if (viewDetailsBtn) {
        console.log('DEBUG: Manually triggering click on viewDetailsBtn');
        viewDetailsBtn.click();
    } else {
        console.error('DEBUG: View Details button not found for testing');
    }
};

// Check if booking data is available in storage and load it
window.loadBookingData = function() {
    console.log('DEBUG: Manual test of loading booking data');
    
    // Try to load from various storage locations
    const sources = [
        { name: 'sessionStorage.bookingConfirmation', value: sessionStorage.getItem('bookingConfirmation') },
        { name: 'localStorage.bookingConfirmation', value: localStorage.getItem('bookingConfirmation') },
        { name: 'localStorage.currentBooking', value: localStorage.getItem('currentBooking') }
    ];
    
    console.log('DEBUG: Available data sources:', sources);
    
    // Try each source
    for (const source of sources) {
        if (source.value) {
            try {
                const bookingData = JSON.parse(source.value);
                console.log(`DEBUG: Successfully loaded booking data from ${source.name}:`, bookingData);
                
                // Set as current booking data
                window.currentBookingData = bookingData;
                
                // Try to display it
                if (typeof displayBookingInfo === 'function') {
                    displayBookingInfo(bookingData);
                    console.log('DEBUG: Displayed booking info from loaded data');
                }
                
                return bookingData;
            } catch (error) {
                console.error(`DEBUG: Error parsing data from ${source.name}:`, error);
            }
        }
    }
    
    console.error('DEBUG: No valid booking data found in any storage location');
    return null;
};

// Provide a direct function to show the modal with any booking data
window.showBookingModal = function(bookingData) {
    console.log('DEBUG: Manual test of showing booking modal');
    
    // Use provided booking data or existing data
    const dataToUse = bookingData || window.currentBookingData;
    
    if (dataToUse) {
        console.log('DEBUG: Showing booking details with data:', dataToUse);
        showBookingDetails(dataToUse);
    } else {
        console.error('DEBUG: No booking data available for modal');
        alert('No booking data available. Please load booking data first.');
    }
};

// Create a sample booking data for testing
window.createTestBookingData = function() {
    console.log('DEBUG: Creating test booking data');
    
    const testData = {
        id: 'test-booking-' + new Date().getTime(),
        guestName: 'Test Guest',
        email: 'testguest@example.com',
        status: 'confirmed',
        paymentStatus: 'verified',
        guests: 2,
        propertyDetails: {
            roomNumber: '101',
            roomType: 'Deluxe Room'
        },
        checkIn: new Date().toISOString(),
        checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        nightlyRate: 2500,
        totalPrice: 7500
    };
    
    console.log('DEBUG: Created test booking data:', testData);
    
    // Store in window and localStorage for future use
    window.currentBookingData = testData;
    localStorage.setItem('currentBooking', JSON.stringify(testData));
    
    return testData;
};

// Create a visible test button on the page
function addTestButtonToPage() {
    console.log('DEBUG: Adding test button to page');
    
    // Create a button container
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'debug-buttons';
    buttonContainer.style.position = 'fixed';
    buttonContainer.style.bottom = '20px';
    buttonContainer.style.left = '20px';
    buttonContainer.style.zIndex = '9999';
    buttonContainer.style.backgroundColor = '#f0f0f0';
    buttonContainer.style.padding = '10px';
    buttonContainer.style.borderRadius = '5px';
    buttonContainer.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
    
    // Create test button
    const testButton = document.createElement('button');
    testButton.textContent = 'Test View Details';
    testButton.style.backgroundColor = '#4CAF50';
    testButton.style.color = 'white';
    testButton.style.padding = '10px 15px';
    testButton.style.border = 'none';
    testButton.style.borderRadius = '4px';
    testButton.style.cursor = 'pointer';
    testButton.style.marginRight = '10px';
    
    // Add click handler
    testButton.addEventListener('click', function() {
        console.log('DEBUG: Test button clicked');
        
        // Check if we have booking data
        if (!window.currentBookingData) {
            console.log('DEBUG: No booking data found, creating test data');
            window.createTestBookingData();
        }
        
        // Show the modal
        window.showBookingModal();
    });
    
    // Create data load button
    const loadDataButton = document.createElement('button');
    loadDataButton.textContent = 'Load Booking Data';
    loadDataButton.style.backgroundColor = '#2196F3';
    loadDataButton.style.color = 'white';
    loadDataButton.style.padding = '10px 15px';
    loadDataButton.style.border = 'none';
    loadDataButton.style.borderRadius = '4px';
    loadDataButton.style.cursor = 'pointer';
    
    // Add click handler
    loadDataButton.addEventListener('click', function() {
        console.log('DEBUG: Load data button clicked');
        window.loadBookingData();
    });
    
    // Add buttons to container
    buttonContainer.appendChild(testButton);
    buttonContainer.appendChild(loadDataButton);
    
    // Add container to page
    document.body.appendChild(buttonContainer);
    
    console.log('DEBUG: Test buttons added to page');
}

// Add these test functions to console.log for visibility
console.log('DEBUG: Test functions available in browser console:');
console.log('- window.testViewDetailsButton() - Test the View Details button');
console.log('- window.loadBookingData() - Load booking data from storage');
console.log('- window.showBookingModal() - Directly show the booking modal');
console.log('- window.createTestBookingData() - Create test booking data');

// Function to initialize user drawer with firebase instances
function initializeUserDrawerModule() {
  try {
    console.log("Initializing user drawer from dashboard.js");
    
    // Check if Firebase has been initialized
    if (!firebase || !firebase.auth) {
      console.error("Firebase not initialized, cannot initialize user drawer");
      return false;
    }
    
    // Get Firebase instances
    const auth = firebase.auth();
    const db = firebase.firestore();
    
    // Check if we have flags for v9 compatibility
    if (window.firebaseCompat && window.setFirebaseVersion) {
      console.log("Setting Firebase version flag to " + (window.firebaseCompat.isV9 ? "v9" : "v8"));
      window.setFirebaseVersion(window.firebaseCompat.isV9);
    } else {
      // Default to v8 since we're using v8 APIs here
      console.log("No Firebase compat flags found, defaulting to v8");
      if (window.setFirebaseVersion) {
        window.setFirebaseVersion(false);
      }
    }
    
    // Use the function reference rather than direct function
    if (typeof _getInitializeUserDrawer === 'function') {
      // Initialize the user drawer with Firebase instances
      _getInitializeUserDrawer()(auth, db);
      window.userDrawerInitialized = true;
      console.log("User drawer initialized successfully from dashboard.js");
      return true;
    } else if (window.initializeUserDrawer) {
      // Fallback to direct global function
      window.initializeUserDrawer(auth, db);
      window.userDrawerInitialized = true;
      console.log("User drawer initialized via global function");
      return true;
    } else {
      console.error("User drawer module not loaded, cannot initialize");
      return false;
    }
  } catch (error) {
    console.error("Error initializing user drawer:", error);
    return false;
  }
}

// Call the initialization function when the page is loaded
window.addEventListener('DOMContentLoaded', function() {
  // Initialize user drawer after a short delay to ensure Firebase is ready
  setTimeout(initializeUserDrawerModule, 500);
});

// Function to update all booking containers based on user login state
function updateBookingContainersForUser() {
    console.log('Updating booking containers for current user');
    
    // Get all booking containers
    const containers = [
        document.getElementById('bookingHistoryContainer'),
        document.getElementById('currentBookings'),
        document.getElementById('previousBookings')
    ];
    
    // Check if user is logged in
    const auth = window.getFirebaseAuth();
    if (!auth || !auth.currentUser) {
        console.log('User not logged in, showing sign in message');
        
        const signInHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="ri-user-line text-2xl mb-2"></i>
                <p>Please sign in to view your bookings</p>
                <a href="../Login/index.html" class="mt-2 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Sign In
                </a>
            </div>
        `;
        
        containers.forEach(container => {
            if (container) {
                container.innerHTML = signInHTML;
            }
        });
        
        return false;
    }
    
    // User is logged in, try to load bookings
    console.log('User is logged in, loading bookings for user:', auth.currentUser.uid);
    
    // Show loading state in all containers
    const loadingHTML = `
        <div class="flex justify-center items-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span class="text-gray-600">Loading your bookings...</span>
        </div>
    `;
    
    containers.forEach(container => {
        if (container) {
            container.innerHTML = loadingHTML;
        }
    });
    
    // Try to load booking history
    if (typeof window.loadBookingHistory === 'function') {
        console.log('Using window.loadBookingHistory function');
        window.loadBookingHistory(auth.currentUser.uid, window.getFirestoreDb || window.firebaseDb);
        return true;
    } else {
        console.warn('loadBookingHistory function not available');
        return false;
    }
}

// Function to load booking history with retry mechanism
function loadBookingHistoryWithRetry(maxRetries = 3, retryDelay = 500) {
    console.log('Loading booking history with retry mechanism');
    
    // Try to update booking containers first
    if (updateBookingContainersForUser()) {
        // Successfully updated, no need for retry
        return true;
    }
    
    // Check if user is logged in but loading failed
    const auth = window.getFirebaseAuth();
    if (auth && auth.currentUser) {
        // Function to try loading booking history
        const tryLoadBookingHistory = (retryCount = 0) => {
            console.log(`Attempt ${retryCount + 1} to load booking history`);
            
            // First try window.loadBookingHistory
            if (typeof window.loadBookingHistory === 'function') {
                console.log('Using window.loadBookingHistory function');
                window.loadBookingHistory(auth.currentUser.uid, window.getFirestoreDb || window.firebaseDb);
                return true;
            }
            
            // Then try local loadBookingHistory
            if (typeof loadBookingHistory === 'function') {
                console.log('Using local loadBookingHistory function');
                loadBookingHistory(auth.currentUser.uid, window.getFirestoreDb || window.firebaseDb);
                return true;
            }
            
            // If we've reached max retries, show error
            if (retryCount >= maxRetries) {
                console.error('Failed to find loadBookingHistory function after multiple retries');
                
                // Show error message in all containers
                const containers = [
                    document.getElementById('bookingHistoryContainer'),
                    document.getElementById('currentBookings'),
                    document.getElementById('previousBookings')
                ];
                
                const errorHTML = `
                    <div class="text-center text-amber-500 py-8">
                        <i class="ri-error-warning-line text-2xl mb-2"></i>
                        <p>Unable to load your bookings. Please try again later.</p>
                        <button class="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" 
                                onclick="window.location.reload()">
                            Refresh Page
                        </button>
                    </div>
                `;
                
                containers.forEach(container => {
                    if (container) {
                        container.innerHTML = errorHTML;
                    }
                });
                
                return false;
            }
            
            // Schedule retry
            console.log(`Booking history function not available, retrying in ${retryDelay}ms...`);
            setTimeout(() => tryLoadBookingHistory(retryCount + 1), retryDelay);
            return false;
        };
        
        // Start the retry process
        return tryLoadBookingHistory();
    }
    
    return false;
}

// Add a global function to manually close the bookings popup
window.closeBookingsPopup = function() {
    console.log('Manual closeBookingsPopup called');
    const bookingsPopup = document.getElementById('bookingsPopup');
    if (bookingsPopup) {
        console.log('Found bookingsPopup, hiding it');
        bookingsPopup.classList.add('hidden');
        return true;
    } else {
        console.error('bookingsPopup not found in DOM');
        return false;
    }
};

// Settings modal functionality
function initializeSettingsModal() {
  console.log('Initializing settings modal');
  
  // Profile picture input handling
  const profilePictureInput = document.getElementById('profilePictureInput');
  if (profilePictureInput) {
    profilePictureInput.addEventListener('change', function(e) {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        
        // Only accept images
        if (!file.type.match('image.*')) {
          alert('Please select an image file');
          return;
        }
        
        // File size check (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
          alert('Image size should not exceed 2MB');
          return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
          const profilePictureDisplay = document.getElementById('profilePictureDisplay');
          const profileIconContainer = document.getElementById('profileIconContainer_settings');
          
          if (profilePictureDisplay && profileIconContainer) {
            profilePictureDisplay.src = e.target.result;
            profilePictureDisplay.classList.remove('hidden');
            profileIconContainer.classList.add('hidden');
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }
  
  // Change password button handling
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', function() {
      const auth = firebase.auth();
      const user = auth.currentUser;
      
      if (user) {
        const email = user.email;
        if (email) {
          // Send password reset email
          auth.sendPasswordResetEmail(email)
            .then(() => {
              alert('Password reset email sent to ' + email);
            })
            .catch((error) => {
              console.error('Error sending password reset email:', error);
              alert('Error sending password reset email: ' + error.message);
            });
        } else {
          alert('No email associated with this account');
        }
      } else {
        alert('You must be logged in to change your password');
      }
    });
  }
  
  // Settings form submission
  const settingsForm = document.getElementById('settingsForm');
  if (settingsForm) {
    settingsForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const auth = firebase.auth();
      const user = auth.currentUser;
      
      if (!user) {
        alert('You must be logged in to update your profile');
        return;
      }
      
      const fullname = settingsForm.elements['fullname'].value.trim();
      const phone = settingsForm.elements['phone'].value.trim();
      const emailNotifications = settingsForm.elements['emailNotifications'].checked;
      
      // Update user profile in Firebase
      user.updateProfile({
        displayName: fullname
      }).then(() => {
        // Update user data in Firestore
        const db = firebase.firestore();
        return db.collection('users').doc(user.uid).set({
          displayName: fullname,
          phone: phone,
          emailNotifications: emailNotifications,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }).then(() => {
        // Handle profile picture upload if changed
        const profilePictureInput = document.getElementById('profilePictureInput');
        if (profilePictureInput.files && profilePictureInput.files[0]) {
          const file = profilePictureInput.files[0];
          const storageRef = firebase.storage().ref();
          const profilePicRef = storageRef.child(`profile_pictures/${user.uid}`);
          
          return profilePicRef.put(file).then(function(snapshot) {
            return snapshot.ref.getDownloadURL();
          }).then(function(downloadURL) {
            return user.updateProfile({
              photoURL: downloadURL
            });
          });
        }
        return Promise.resolve();
      }).then(() => {
        alert('Profile updated successfully!');
        document.getElementById('settingsPopup').classList.add('hidden');
        
        // Update UI with new user data
        updateUserDrawerUI();
      }).catch((error) => {
        console.error('Error updating profile:', error);
        alert('Error updating profile: ' + error.message);
      });
    });
  }
}

// Update user drawer UI with latest user data
function updateUserDrawerUI() {
  const auth = firebase.auth();
  const user = auth.currentUser;
  
  if (!user) return;
  
  // Update user name and email in the drawer
  const userNameElement = document.getElementById('drawerUserName');
  const userEmailElement = document.getElementById('drawerUserEmail');
  
  if (userNameElement) {
    userNameElement.textContent = user.displayName || 'User';
  }
  
  if (userEmailElement) {
    userEmailElement.textContent = user.email || '';
  }
  
  // Update user avatar
  const userAvatar = document.getElementById('drawerUserAvatar');
  const defaultAvatar = document.getElementById('drawerDefaultAvatar');
  
  if (userAvatar && defaultAvatar) {
    if (user.photoURL) {
      userAvatar.src = user.photoURL;
      userAvatar.classList.remove('hidden');
      defaultAvatar.classList.add('hidden');
    } else {
      userAvatar.classList.add('hidden');
      defaultAvatar.classList.remove('hidden');
    }
  }
}

// Initialize settings modal when document is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Initialize existing functionality
  
  // Initialize settings modal
  setTimeout(function() {
    initializeSettingsModal();
  }, 1000); // Delay to ensure Firebase auth is initialized
});

// Add settings button to user dropdown
function initializeUserDropdown() {
  console.log('Initializing user dropdown with settings button');
  
  // Get the user dropdown element if it exists
  const userDropdown = document.querySelector('.user-dropdown-menu');
  if (!userDropdown) {
    console.log('User dropdown menu not found');
    return;
  }
  
  // Check if the settings button already exists
  if (userDropdown.querySelector('#settingsButton')) {
    console.log('Settings button already exists');
    return;
  }
  
  // Create settings button
  const settingsButton = document.createElement('button');
  settingsButton.id = 'settingsButton';
  settingsButton.className = 'dropdown-item flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100';
  settingsButton.innerHTML = '<i class="ri-settings-line"></i><span>Settings</span>';
  
  // Add click event listener
  settingsButton.addEventListener('click', function() {
    console.log('Settings button clicked from dropdown');
    // Close the dropdown
    document.querySelector('.user-dropdown-menu').classList.add('hidden');
    
    // Show settings popup
    const settingsPopup = document.getElementById('settingsPopup');
    if (settingsPopup) {
      settingsPopup.classList.remove('hidden');
      
      // Populate settings form with user data
      const auth = firebase.auth();
      const user = auth.currentUser;
      
      if (user) {
        const settingsForm = document.getElementById('settingsForm');
        if (settingsForm) {
          // Set user data in form
          if (settingsForm.elements['fullname']) {
            settingsForm.elements['fullname'].value = user.displayName || '';
          }
          
          if (settingsForm.elements['email']) {
            settingsForm.elements['email'].value = user.email || '';
          }
          
          // Handle profile picture if available
          const profilePictureDisplay = document.getElementById('profilePictureDisplay');
          const profileIconContainer = document.getElementById('profileIconContainer_settings');
          
          if (profilePictureDisplay && profileIconContainer) {
            if (user.photoURL) {
              profilePictureDisplay.src = user.photoURL;
              profilePictureDisplay.classList.remove('hidden');
              profileIconContainer.classList.add('hidden');
            } else {
              profilePictureDisplay.classList.add('hidden');
              profileIconContainer.classList.remove('hidden');
            }
          }
        }
      }
    } else {
      console.error('Settings popup not found in the DOM');
    }
  });
  
  // Find the position to insert the button (before the logout button)
  const logoutButton = userDropdown.querySelector('.logout-button');
  if (logoutButton) {
    userDropdown.insertBefore(settingsButton, logoutButton);
  } else {
    // If logout button not found, just append to the end
    userDropdown.appendChild(settingsButton);
  }
  
  console.log('Settings button added to user dropdown');
}

// Run initialization when document is ready
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    initializeUserDropdown();
  }, 2000); // Delay to ensure dropdown is loaded
});

// Add a cleanup event to remove the listener when page unloads
window.addEventListener('beforeunload', function() {
    console.log('Page unloading, cleaning up listeners');
    if (window.bookingStatusUnsubscribe) {
        try {
            console.log('Unsubscribing from booking status updates');
            window.bookingStatusUnsubscribe();
        } catch (error) {
            console.error('Error unsubscribing from booking status:', error);
        }
    }
});

// Add a test function to help debug any remaining issues
function testBookingHistoryIntegration() {
    console.log('Testing bookingHistory integration...');
    console.log('window.loadBookingHistory:', typeof window.loadBookingHistory);
    console.log('window.navigateToBookingDetails:', typeof window.navigateToBookingDetails);
    
    // Try to call the function with a test user ID
    if (typeof window.loadBookingHistory === 'function') {
        try {
            console.log('Attempting to call loadBookingHistory with test user ID...');
            window.loadBookingHistory('test-user-id', window.firebaseDb || window.getFirestoreDb);
            console.log('loadBookingHistory called successfully');
        } catch (error) {
            console.error('Error calling loadBookingHistory:', error);
        }
    }
    
    return {
        loadBookingHistoryAvailable: typeof window.loadBookingHistory === 'function',
        navigateToBookingDetailsAvailable: typeof window.navigateToBookingDetails === 'function'
    };
}

// Expose the test function to the global scope
window.testBookingHistoryIntegration = testBookingHistoryIntegration;

// Run the test after a short delay to ensure all scripts are loaded
setTimeout(() => {
    console.log('Running automatic test of bookingHistory integration...');
    testBookingHistoryIntegration();
}, 2000);

// Function to ensure booking data has correct approvedByAdmin flag
function ensureCorrectBookingFlags(bookingData) {
    if (!bookingData) return bookingData;
    
    // Make a copy to avoid modifying the original object directly
    const updatedBooking = {...bookingData};
    
    // For confirmed status, ensure approvedByAdmin flag is explicitly set
    if (updatedBooking.status === 'confirmed' && updatedBooking.approvedByAdmin === undefined) {
        console.log('Setting explicit approvedByAdmin=false for confirmed booking');
        updatedBooking.approvedByAdmin = false;
    }
    
    return updatedBooking;
}

// Add the function to window for access from other scripts
window.ensureCorrectBookingFlags = ensureCorrectBookingFlags;

// Function to update booking status display
function updateBookingStatusDisplay() {
    console.log('Updating booking status display');
    
    if (!window.currentBookingData) {
        console.log('No current booking data available');
        return;
    }
    
    const statusElement = document.getElementById('booking-status');
    if (!statusElement) {
        console.log('No status element found');
        return;
    }
    
    const bookingData = window.currentBookingData;
    const bookingStatus = bookingData.status || 'pending';
    const paymentStatus = bookingData.paymentStatus || 'pending';
    let statusMessage = '';
    
    switch (bookingStatus.toLowerCase()) {
        case 'approved':
            statusMessage = 'Your booking is confirmed';
            statusElement.style.color = '#047857'; // Green
            break;
        case 'confirmed':
            // Only treat as confirmed if it's explicitly been approved by admin
            if (bookingData.approvedByAdmin === true) {
                statusMessage = 'Your booking is confirmed';
                statusElement.style.color = '#047857'; // Green
            } else {
                statusMessage = 'Your booking is pending approval';
                statusElement.style.color = '#B45309'; // Amber
            }
            break;
        case 'pending':
            if (paymentStatus === 'rejected') {
                statusMessage = 'Your payment has been rejected';
                statusElement.style.color = '#DC2626'; // Red
            } else {
                statusMessage = 'Your booking is pending approval';
                statusElement.style.color = '#B45309'; // Amber
            }
            break;
        case 'rejected':
            statusMessage = 'Your booking has been rejected';
            statusElement.style.color = '#DC2626'; // Red
            
            // Add rejection reason if available
            if (bookingData.rejectionReason) {
                statusMessage += `: ${bookingData.rejectionReason}`;
            }
            break;
        case 'payment_rejected':
            statusMessage = 'Your payment has been rejected';
            statusElement.style.color = '#DC2626'; // Red
            
            // Add rejection reason if available
            if (bookingData.rejectionReason) {
                statusMessage += `. Reason: ${bookingData.rejectionReason}`;
            }
            break;
        case 'completed':
            statusMessage = 'Your stay has been completed';
            statusElement.style.color = '#1F2937'; // Gray
            break;
        case 'cancelled':
            statusMessage = 'This booking has been cancelled';
            statusElement.style.color = '#DC2626'; // Red
            break;
        default:
            statusMessage = `Booking status: ${bookingStatus}`;
            statusElement.style.color = '#2563EB'; // Blue
    }
    
    statusElement.textContent = statusMessage;
    console.log('Updated status display to:', statusMessage);
}

// Make the function available globally
window.updateBookingStatusDisplay = updateBookingStatusDisplay;

// Run the function after a delay to ensure everything is loaded
setTimeout(updateBookingStatusDisplay, 1000);

// Function to initialize all functionality
function initializeAllFunctionality() {
    console.log('DEBUG: Initializing all functionality');
    
    // Define global closeModal function if it doesn't already exist
    if (!window.closeModal) {
        window.closeModal = function() {
            console.log('DEBUG: closeModal function created in initializeAllFunctionality');
            const modal = document.getElementById('bookingModal');
            if (modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
            }
        };
    }
    
    // Set up the View Details button
    setupViewDetailsButton();
    
    // Set up the bookings modal
    initializeBookingsModal();
    
    // Initialize the user drawer
    initializeUserDrawerModule();
    
    // Initialize the settings modal
    initializeSettingsModal();
    
    // Initialize the tabs in the bookings modal
    initializeBookingsTabs();
    
    // Initialize the user dropdown
    initializeUserDropdown();
    
    // Update the booking status display
    updateBookingStatusDisplay();
    
    // Verify all dashboard elements are present
    verifyDashboardElements();
    
    // Ensure showBookingsModal is available globally
    if (typeof window.showBookingsModal !== 'function') {
        window.showBookingsModal = showBookingsModal;
    }
    
    // Load booking history if user is logged in
    const auth = window.getFirebaseAuth();
    if (auth && auth.currentUser && typeof window.loadBookingHistory === 'function') {
        const bookingHistoryContainer = document.getElementById('bookingHistoryContainer');
        if (bookingHistoryContainer) {
            console.log('Loading booking history on initialization');
            window.loadBookingHistory(auth.currentUser.uid, window.getFirestoreDb);
        }
    }
    
    // Make sure the bookings popup exists with the right structure
    ensureBookingsPopupExists();
    
    // Add test button for debugging (only in development)
    if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
        try {
            window.addTestButton();
            console.log('✅ Test button added for development environment');
        } catch (error) {
            console.warn('Could not add test button:', error);
        }
    }
    
    console.log('✅ All functionality initialized successfully');
}

// Also add this for document click delegation
document.addEventListener('click', function(event) {
  if (event.target && event.target.closest('.view-details-btn')) {
    console.log('DEBUG: View Details button clicked via delegation');
    if (window.showBookingDetailsHandler) {
      window.showBookingDetailsHandler(event);
    } else {
      console.error('ERROR: Global showBookingDetailsHandler function not found');
    }
  }
});

// Function to ensure the bookings popup exists with the right structure
function ensureBookingsPopupExists() {
    // Check if the popup already exists
    let bookingsPopup = document.getElementById('bookingsPopup');
    
    if (!bookingsPopup) {
        console.log('Creating new bookings popup from scratch');
        
        // Create the popup element with TRANSPARENT background (no grey overlay)
        bookingsPopup = document.createElement('div');
        bookingsPopup.id = 'bookingsPopup';
        // IMPORTANT: Use bg-transparent instead of bg-black bg-opacity-0
        bookingsPopup.className = 'fixed inset-0 bg-transparent hidden z-50';
        
        // Create the bookings modal structure
        bookingsPopup.innerHTML = `
            <div class="fixed right-0 top-0 w-96 h-full bg-white shadow-2xl overflow-y-auto">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-2xl font-bold text-gray-900">My Bookings</h3>
                        <button id="closeBookingsPopup" class="text-gray-500 hover:text-gray-700">
                            <i class="ri-close-line text-2xl"></i>
                        </button>
                    </div>
                    
                    <!-- Booking Tabs -->
                    <div class="flex border-b mb-6">
                        <button class="flex-1 py-3 text-blue-600 border-b-2 border-blue-600 font-medium" data-tab="current">
                            Current
                        </button>
                        <button class="flex-1 py-3 text-gray-500 font-medium" data-tab="previous">
                            Previous
                        </button>
                        <button class="flex-1 py-3 text-gray-500 font-medium" data-tab="history">
                            History
                        </button>
                    </div>
                    
                    <!-- Bookings Content -->
                    <div id="currentBookings" class="space-y-4">
                        <p class="text-gray-500 text-center py-16">No bookings found</p>
                    </div>
                    
                    <div id="previousBookings" class="hidden space-y-4">
                        <p class="text-gray-500 text-center py-16">No bookings found</p>
                    </div>
                    
                    <div id="bookingHistoryContainer" class="hidden space-y-4">
                        <p class="text-gray-500 text-center py-16">Loading booking history...</p>
                    </div>
                </div>
            </div>
        `;
        
        // Add the popup to the document body
        document.body.appendChild(bookingsPopup);
        
        // Add event listeners
        setupBookingsPopupEventListeners(bookingsPopup);
    } else {
        console.log('Updating existing bookings popup');
        
        // Make sure there's NO grey background
        bookingsPopup.classList.remove('bg-black', 'bg-opacity-0', 'bg-opacity-50');
        bookingsPopup.classList.add('bg-transparent');
        
        // Ensure drawer content has shadow
        const drawerContent = bookingsPopup.querySelector('.fixed.right-0');
        if (drawerContent) {
            drawerContent.classList.add('shadow-2xl');
        }
        
        // Make sure event listeners are set up
        setupBookingsPopupEventListeners(bookingsPopup);
    }
    
    return bookingsPopup;
}

// Function to set up event listeners for the bookings popup
function setupBookingsPopupEventListeners(popup) {
    if (!popup) return;
    
    // Close button event listener
    const closeBtn = popup.querySelector('#closeBookingsPopup');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            popup.classList.add('hidden');
        });
    }
    
    // Add click listener to close when clicking outside the drawer
    popup.addEventListener('click', (e) => {
        // If clicking on the backdrop (the popup element itself), close the popup
        if (e.target === popup) {
            popup.classList.add('hidden');
        }
    });
    
    // Set up tab buttons
    const tabButtons = popup.querySelectorAll('[data-tab]');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active state from all tabs
            tabButtons.forEach(btn => {
                btn.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
                btn.classList.add('text-gray-500');
            });
            
            // Add active state to clicked tab
            button.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
            button.classList.remove('text-gray-500');
            
            // Show corresponding content
            const tabName = button.dataset.tab;
            const currentTab = document.getElementById('currentBookings');
            const previousTab = document.getElementById('previousBookings');
            const historyTab = document.getElementById('bookingHistoryContainer');
            
            if (currentTab) currentTab.classList.toggle('hidden', tabName !== 'current');
            if (previousTab) previousTab.classList.toggle('hidden', tabName !== 'previous');
            if (historyTab) {
                historyTab.classList.toggle('hidden', tabName !== 'history');
                // IMPORTANT: Ensure the history tab has the correct styling
                if (tabName === 'history') {
                    historyTab.style.backgroundColor = 'transparent';
                    historyTab.style.overflow = 'auto';
                    historyTab.style.maxHeight = '85vh';
                }
            }
        });
    });
}

// Add comprehensive debug function to help troubleshoot the issue
window.debugDashboard = function() {
    console.log('=== DASHBOARD DEBUG REPORT ===');
    
    // Check Firebase initialization
    console.log('1. FIREBASE STATUS:');
    console.log('   - window.firebase available:', !!window.firebase);
    console.log('   - firebase.auth available:', !!(window.firebase && window.firebase.auth));
    console.log('   - firebase.firestore available:', !!(window.firebase && window.firebase.firestore));
    console.log('   - window.getFirebaseAuth function:', typeof window.getFirebaseAuth);
    console.log('   - window.getFirestoreDb function:', typeof window.getFirestoreDb);
    
    // Check authentication
    console.log('2. AUTHENTICATION STATUS:');
    const auth = window.getFirebaseAuth();
    if (auth) {
        const currentUser = auth.currentUser;
        console.log('   - Auth instance available:', !!auth);
        console.log('   - Current user:', !!currentUser);
        if (currentUser) {
            console.log('   - User ID:', currentUser.uid);
            console.log('   - User email:', currentUser.email);
            console.log('   - User display name:', currentUser.displayName);
        }
    } else {
        console.log('   - Auth instance NOT available');
    }
    
    // Check storage
    console.log('3. STORAGE STATUS:');
    const localBooking = localStorage.getItem('currentBooking');
    const sessionBooking = sessionStorage.getItem('bookingConfirmation');
    console.log('   - localStorage.currentBooking:', !!localBooking);
    console.log('   - sessionStorage.bookingConfirmation:', !!sessionBooking);
    console.log('   - window.currentBookingData:', !!window.currentBookingData);
    
    if (localBooking) {
        try {
            const parsed = JSON.parse(localBooking);
            console.log('   - localStorage booking ID:', parsed.id);
            console.log('   - localStorage booking status:', parsed.status);
            console.log('   - localStorage booking userId:', parsed.userId);
        } catch (e) {
            console.log('   - Error parsing localStorage booking:', e.message);
        }
    }
    
    // Check DOM elements
    console.log('4. DOM ELEMENTS STATUS:');
    const elements = [
        'guest-name', 'booking-status', 'room-number', 'guest-count',
        'check-in-date', 'check-out-date', 'rate-per-night', 'total-amount'
    ];
    
    elements.forEach(id => {
        const element = document.getElementById(id);
        console.log(`   - ${id}:`, !!element, element ? `(text: "${element.textContent}")` : '');
    });
    
    // Manual fetch attempt
    console.log('5. MANUAL FETCH TEST:');
    if (auth && auth.currentUser) {
        console.log('   - Attempting manual booking fetch...');
        return loadUserLatestBooking(auth.currentUser)
            .then(result => {
                console.log('   - Manual fetch result:', result);
                console.log('=== END DEBUG REPORT ===');
                return result;
            })
            .catch(error => {
                console.log('   - Manual fetch error:', error);
                console.log('=== END DEBUG REPORT ===');
                return false;
            });
    } else {
        console.log('   - Cannot perform manual fetch - no authenticated user');
        console.log('=== END DEBUG REPORT ===');
        return Promise.resolve(false);
    }
};

// Add simple test function to help verify the fixes
window.testCompleteBookingData = function() {
    console.log('DASHBOARD DEBUG: Creating complete test booking data...');
    
    const testBooking = {
        id: 'test-' + Date.now(),
        userId: window.getFirebaseAuth()?.currentUser?.uid || 'test-user',
        guestName: 'Test Guest User',
        email: 'test@example.com',
        status: 'confirmed',
        paymentStatus: 'verified',
        approvedByAdmin: true,
        guests: 2,
        checkIn: new Date().toISOString(),
        checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
        nightlyRate: 2500,
        totalPrice: 7500,
        createdAt: new Date().toISOString(),
        propertyDetails: {
            roomNumber: '101',
            roomType: 'Deluxe Room',
            roomNo: '101',
            room: '101'
        }
    };
    
    console.log('DASHBOARD DEBUG: Test booking created:', testBooking);
    
    // Store and display the test data
    window.currentBookingData = testBooking;
    localStorage.setItem('currentBooking', JSON.stringify(testBooking));
    sessionStorage.setItem('bookingConfirmation', JSON.stringify(testBooking));
    
    // Display the test booking
    displayBookingInfo(testBooking);
    
    console.log('DASHBOARD DEBUG: Test booking data set and displayed');
    return testBooking;
};

// Enhanced test function specifically for My Bookings modal
window.testMyBookingsModal = function() {
    console.log('🔍 TESTING MY BOOKINGS MODAL');
    
    // Create sample bookings data for testing all three tabs
    const sampleBookings = [
        {
            id: 'current-booking-1',
            userId: window.getFirebaseAuth()?.currentUser?.uid || 'test-user',
            status: 'confirmed',
            checkIn: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
            checkOut: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // In 5 days
            propertyDetails: {
                name: 'Pine Haven Lodge',
                roomType: 'Deluxe Suite',
                roomNumber: '304'
            },
            totalPrice: 7410,
            collectionSource: 'everlodgebookings'
        },
        {
            id: 'current-booking-2',
            userId: window.getFirebaseAuth()?.currentUser?.uid || 'test-user',
            status: 'pending',
            checkIn: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // In 10 days
            checkOut: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(), // In 12 days
            propertyDetails: {
                name: 'Ever Lodge',
                roomType: 'Premium Suite',
                roomNumber: '205'
            },
            totalPrice: 5928,
            collectionSource: 'everlodgebookings'
        },
        {
            id: 'previous-booking-1',
            userId: window.getFirebaseAuth()?.currentUser?.uid || 'test-user',
            status: 'completed',
            checkIn: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
            checkOut: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(), // 28 days ago
            propertyDetails: {
                name: 'Pine Haven Lodge',
                roomType: 'Standard Room',
                roomNumber: '102'
            },
            totalPrice: 4500,
            collectionSource: 'bookings'
        },
        {
            id: 'previous-booking-2',
            userId: window.getFirebaseAuth()?.currentUser?.uid || 'test-user',
            status: 'cancelled',
            checkIn: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
            checkOut: new Date(Date.now() - 58 * 24 * 60 * 60 * 1000).toISOString(), // 58 days ago
            propertyDetails: {
                name: 'Mountain View Resort',
                roomType: 'Family Suite',
                roomNumber: '401'
            },
            totalPrice: 8200,
            collectionSource: 'cancelledBookings'
        }
    ];
    
    console.log('📊 Created sample bookings:', sampleBookings);
    
    // Get the containers
    const currentContainer = document.getElementById('currentBookings');
    const previousContainer = document.getElementById('previousBookings');
    const historyContainer = document.getElementById('bookingHistoryContainer');
    
    if (!currentContainer || !previousContainer || !historyContainer) {
        console.error('❌ Modal containers not found. Make sure the modal is open first.');
        
        // Try to open the modal
        console.log('🔄 Attempting to open My Bookings modal...');
        if (typeof showBookingsModal === 'function') {
            showBookingsModal();
            
            // Retry after a short delay
            setTimeout(() => {
                window.testMyBookingsModal();
            }, 500);
        } else {
            console.error('❌ showBookingsModal function not available');
        }
        return;
    }
    
    console.log('✅ Modal containers found, testing data display...');
    
    // Test the displayAllBookings function with sample data
    if (typeof window.displayAllBookings === 'function') {
        window.displayAllBookings(sampleBookings, historyContainer, currentContainer, previousContainer);
        console.log('✅ Sample bookings displayed successfully');
    } else if (typeof displayAllBookings === 'function') {
        displayAllBookings(sampleBookings, historyContainer, currentContainer, previousContainer);
        console.log('✅ Sample bookings displayed successfully');
    } else {
        console.error('❌ displayAllBookings function not available');
        
        // Manually populate the containers for testing
        console.log('🔄 Manually populating containers...');
        
        const currentBookings = sampleBookings.filter(b => 
            ['confirmed', 'pending', 'active'].includes(b.status) && 
            new Date(b.checkOut) >= new Date()
        );
        
        const previousBookings = sampleBookings.filter(b => 
            !currentBookings.includes(b)
        );
        
        // Simple display for testing
        currentContainer.innerHTML = `
            <div class="space-y-4">
                <p class="text-sm text-gray-600">${currentBookings.length} current booking(s)</p>
                ${currentBookings.map(b => `
                    <div class="bg-white border p-4 rounded-lg">
                        <h4 class="font-semibold">${b.propertyDetails.name}</h4>
                        <p class="text-sm text-gray-600">${b.propertyDetails.roomType} #${b.propertyDetails.roomNumber}</p>
                        <p class="text-sm">Status: ${b.status}</p>
                        <p class="font-medium">₱${b.totalPrice.toLocaleString()}</p>
                    </div>
                `).join('')}
            </div>
        `;
        
        previousContainer.innerHTML = `
            <div class="space-y-4">
                <p class="text-sm text-gray-600">${previousBookings.length} previous booking(s)</p>
                ${previousBookings.map(b => `
                    <div class="bg-white border p-4 rounded-lg">
                        <h4 class="font-semibold">${b.propertyDetails.name}</h4>
                        <p class="text-sm text-gray-600">${b.propertyDetails.roomType} #${b.propertyDetails.roomNumber}</p>
                        <p class="text-sm">Status: ${b.status}</p>
                        <p class="font-medium">₱${b.totalPrice.toLocaleString()}</p>
                    </div>
                `).join('')}
            </div>
        `;
        
        historyContainer.innerHTML = `
            <div class="space-y-4">
                <h3 class="text-lg font-semibold">All Bookings (${sampleBookings.length})</h3>
                ${sampleBookings.map(b => `
                    <div class="bg-white border p-4 rounded-lg">
                        <h4 class="font-semibold">${b.propertyDetails.name}</h4>
                        <p class="text-sm text-gray-600">${b.propertyDetails.roomType} #${b.propertyDetails.roomNumber}</p>
                        <p class="text-sm">Status: ${b.status}</p>
                        <p class="font-medium">₱${b.totalPrice.toLocaleString()}</p>
                    </div>
                `).join('')}
            </div>
        `;
        
        console.log('✅ Manual population completed');
    }
    
    // Test tab switching
    console.log('🔄 Testing tab switching...');
    const tabButtons = document.querySelectorAll('[data-tab]');
    
    if (tabButtons.length > 0) {
        console.log(`✅ Found ${tabButtons.length} tab buttons`);
        
        // Test clicking each tab
        ['current', 'previous', 'history'].forEach((tabName, index) => {
            setTimeout(() => {
                const tabButton = Array.from(tabButtons).find(btn => btn.getAttribute('data-tab') === tabName);
                if (tabButton) {
                    console.log(`🔄 Testing ${tabName} tab...`);
                    tabButton.click();
                    
                    setTimeout(() => {
                        const container = document.getElementById(
                            tabName === 'current' ? 'currentBookings' :
                            tabName === 'previous' ? 'previousBookings' :
                            'bookingHistoryContainer'
                        );
                        
                        if (container && !container.classList.contains('hidden')) {
                            console.log(`✅ ${tabName} tab is now visible`);
                        } else {
                            console.error(`❌ ${tabName} tab is not visible`);
                        }
                    }, 100);
                } else {
                    console.error(`❌ ${tabName} tab button not found`);
                }
            }, index * 300);
        });
    } else {
        console.error('❌ No tab buttons found');
    }
    
    console.log('🎉 My Bookings modal test completed!');
    return sampleBookings;
};

// Add a quick test button for easy access
window.addTestButton = function() {
    const existingButton = document.getElementById('test-bookings-btn');
    if (existingButton) {
        existingButton.remove();
    }
    
    const testButton = document.createElement('button');
    testButton.id = 'test-bookings-btn';
    testButton.innerHTML = '🧪 Test My Bookings';
    testButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #3B82F6;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
        z-index: 9999;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: background 0.2s;
    `;
    
    testButton.addEventListener('click', () => {
        console.log('🧪 Test button clicked');
        showBookingsModal();
        setTimeout(() => {
            window.testMyBookingsModal();
        }, 500);
    });
    
    testButton.addEventListener('mouseover', () => {
        testButton.style.background = '#2563EB';
    });
    
    testButton.addEventListener('mouseout', () => {
        testButton.style.background = '#3B82F6';
    });
    
    document.body.appendChild(testButton);
    console.log('✅ Test button added to page');
};

// Add a quick test function for current booking display
window.testCurrentBookingDisplay = function() {
    console.log('🧪 Testing current booking display');
    
    const auth = window.getFirebaseAuth();
    const currentUser = auth?.currentUser;
    
    if (!currentUser) {
        console.error('❌ No user logged in');
        return;
    }
    
    if (!window.currentBookingData) {
        console.error('❌ No current booking data available');
        console.log('💡 You can create test data with: window.createTestBookingData()');
        return;
    }
    
    console.log('✅ Found current booking data:', window.currentBookingData.id);
    console.log('✅ User ID:', currentUser.uid);
    console.log('✅ Booking user ID:', window.currentBookingData.userId);
    
    // Ensure booking has user ID
    if (!window.currentBookingData.userId) {
        console.log('🔧 Setting booking user ID to current user');
        window.currentBookingData.userId = currentUser.uid;
    }
    
    // Open My Bookings modal and force load with current booking
    console.log('🔄 Opening My Bookings modal...');
    showBookingsModal();
    
    setTimeout(() => {
        console.log('🔄 Force loading current booking into modal...');
        loadAllBookingTabs(currentUser.uid);
    }, 500);
    
    console.log('✅ Test complete! Check the My Bookings modal.');
};

// Debug function to check current booking status and My Bookings modal
window.debugBookingStatus = function() {
    console.log('🔍 DEBUGGING BOOKING STATUS');
    
    // Check current booking data
    console.log('📋 Current booking data:');
    console.log('   - window.currentBookingData:', !!window.currentBookingData);
    console.log('   - localStorage.currentBooking:', !!localStorage.getItem('currentBooking'));
    console.log('   - sessionStorage.bookingConfirmation:', !!sessionStorage.getItem('bookingConfirmation'));
    
    if (window.currentBookingData) {
        console.log('   - Booking ID:', window.currentBookingData.id);
        console.log('   - Status:', window.currentBookingData.status);
        console.log('   - User ID:', window.currentBookingData.userId);
        console.log('   - Check-in:', window.currentBookingData.checkIn);
        console.log('   - Check-out:', window.currentBookingData.checkOut);
        console.log('   - Approved by admin:', window.currentBookingData.approvedByAdmin);
    }
    
    // Check authentication
    const auth = window.getFirebaseAuth();
    const currentUser = auth?.currentUser;
    console.log('🔐 Authentication:');
    console.log('   - User logged in:', !!currentUser);
    if (currentUser) {
        console.log('   - User ID:', currentUser.uid);
        console.log('   - User email:', currentUser.email);
    }
    
    // Check modal containers
    console.log('📱 Modal containers:');
    const containers = [
        'currentBookings',
        'previousBookings', 
        'bookingHistoryContainer'
    ];
    
    containers.forEach(id => {
        const container = document.getElementById(id);
        console.log(`   - ${id}:`, !!container);
        if (container) {
            console.log(`     - Hidden:`, container.classList.contains('hidden'));
            console.log(`     - Content length:`, container.innerHTML.length);
            console.log(`     - Has booking cards:`, container.querySelectorAll('.bg-white.border').length);
        }
    });
    
    // Check if booking should be current
    if (window.currentBookingData) {
        const booking = window.currentBookingData;
        const currentDate = new Date();
        const checkIn = new Date(booking.checkIn);
        const checkOut = new Date(booking.checkOut);
        const status = (booking.status || 'pending').toLowerCase();
        
        console.log('📅 Booking categorization analysis:');
        console.log('   - Current date:', currentDate.toLocaleDateString());
        console.log('   - Check-in date:', checkIn.toLocaleDateString());
        console.log('   - Check-out date:', checkOut.toLocaleDateString());
        console.log('   - Status:', status);
        console.log('   - Is upcoming:', checkIn > currentDate);
        console.log('   - Is ongoing:', checkIn <= currentDate && checkOut >= currentDate);
        console.log('   - Is active status:', ['pending', 'confirmed', 'active', 'checked in', 'approved'].includes(status));
        
        const isUpcoming = checkIn > currentDate;
        const isOngoing = checkIn <= currentDate && checkOut >= currentDate;
        const isActiveStatus = ['pending', 'confirmed', 'active', 'checked in', 'approved'].includes(status);
        
        console.log('   - Should be in current tab:', (isUpcoming || isOngoing) && isActiveStatus);
    }
    
    // Test manual booking display
    console.log('🧪 Testing manual booking display...');
    if (window.currentBookingData && currentUser) {
        console.log('   - Calling loadAllBookingTabs manually...');
        try {
            loadAllBookingTabs(currentUser.uid);
            console.log('   - Manual call successful');
        } catch (error) {
            console.error('   - Manual call failed:', error);
        }
    }
    
    console.log('🎉 Debug complete!');
};

// Add quick access to debug function
console.log('🔧 Debug function available: window.debugBookingStatus()');

// Dashboard helper functions available in console
console.log('📋 LODGEEASE DASHBOARD - Available Functions:');
console.log('   🧪 window.testCurrentBookingDisplay() - Test your current booking in My Bookings modal');
console.log('   🔍 window.debugBookingStatus() - Debug why bookings might not be showing');
console.log('   🎯 window.testMyBookingsModal() - Test the modal with sample data');
console.log('   📊 window.createTestBookingData() - Create test booking data');
console.log('   📄 window.showBookingModal() - Show booking details modal');
console.log('   💾 window.loadBookingData() - Load booking from storage');
console.log('');
console.log('❓ If your booking is not showing in "My Bookings":\n   1. Run: window.debugBookingStatus()\n   2. Run: window.testCurrentBookingDisplay()');
}
import { 
    auth,
    db,
    collection, 
    query, 
    where, 
    getDocs,
    getDoc,
    updateDoc, 
    doc, 
    Timestamp,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp,
    limit,
    onAuthStateChanged
} from "../firebase.js";

// Set up authentication check using the shared module
const authInstance = auth();
const dbInstance = db();

// Function declarations moved outside DOMContentLoaded
async function loadModificationRequests() {
    try {
        const requestsRef = collection(dbInstance, 'modificationRequests');
        const q = query(
            requestsRef,
            where('status', '==', 'pending')
        );

        const container = document.getElementById('modificationRequests');
        container.innerHTML = `
            <div class="text-gray-500 text-center py-10">
                <svg class="mx-auto h-12 w-12 text-gray-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="mt-2">Loading requests...</p>
            </div>
        `;

        try {
            const snapshot = await getDocs(q);
            container.innerHTML = '';

            if (snapshot.empty) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-10 text-gray-500">
                        <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p class="text-lg font-medium">No pending modification requests</p>
                        <p class="text-sm">When guests request booking changes, they'll appear here</p>
                    </div>
                `;
                return;
            }

            // Load requests without duplicate filtering and sort by created date descending
            const validRequests = [];
            snapshot.forEach(doc => {
                const request = doc.data();
                if (request.status !== 'duplicate_removed') {
                    validRequests.push({ id: doc.id, data: request });
                }
            });

            // Sort by createdAt descending (newest first) in JavaScript
            validRequests.sort((a, b) => {
                const dateA = a.data.createdAt?.toDate?.() || new Date(a.data.createdAt || 0);
                const dateB = b.data.createdAt?.toDate?.() || new Date(b.data.createdAt || 0);
                return dateB - dateA;
            });

            if (validRequests.length === 0) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-10 text-gray-500">
                        <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p class="text-lg font-medium">No pending modification requests</p>
                        <p class="text-sm">When guests request booking changes, they'll appear here</p>
                    </div>
                `;
                return;
            }

            // Create cards for each request
            validRequests.forEach(({ id, data }) => {
                const card = createModificationRequestCard(id, data);
                container.appendChild(card);
            });

        } catch (queryError) {
            console.error('Error in modification requests query:', queryError);
            container.innerHTML = `
                <div class="text-red-500 text-center py-10">
                    <p>Error loading modification requests: ${queryError.message}</p>
                    <button onclick="loadModificationRequests()" class="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Retry
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading modification requests:', error);
        const container = document.getElementById('modificationRequests');
        if (container) {
            container.innerHTML = `
                <div class="text-red-500 text-center py-10">
                    <p>Error loading modification requests: ${error.message}</p>
                    <button onclick="loadModificationRequests()" class="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Retry
                    </button>
                </div>
            `;
        }
    }
}

async function loadCancellationRequests() {
    try {
        const requestsRef = collection(dbInstance, 'cancellationRequests');
        const q = query(
            requestsRef,
            where('status', '==', 'pending')
        );

        const container = document.getElementById('cancellationRequests');
        container.innerHTML = `
            <div class="text-gray-500 text-center py-10">
                <svg class="mx-auto h-12 w-12 text-gray-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="mt-2">Loading requests...</p>
            </div>
        `;

        try {
            const snapshot = await getDocs(q);
            container.innerHTML = '';

            if (snapshot.empty) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-10 text-gray-500">
                        <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <p class="text-lg font-medium">No pending cancellation requests</p>
                        <p class="text-sm">When guests request booking cancellations, they'll appear here</p>
                    </div>
                `;
                return;
            }

            // Load requests without duplicate filtering and sort by created date descending
            const requestsWithData = [];
            snapshot.forEach(doc => {
                const request = doc.data();
                if (request.status !== 'duplicate_removed') {
                    requestsWithData.push({ id: doc.id, ...request });
                }
            });

            // Sort by createdAt descending (newest first) in JavaScript
            requestsWithData.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                return dateB - dateA;
            });

            if (requestsWithData.length === 0) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-10 text-gray-500">
                        <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <p class="text-lg font-medium">No pending cancellation requests</p>
                        <p class="text-sm">When guests request booking cancellations, they'll appear here</p>
                    </div>
                `;
                return;
            }

            // Create cards for each request
            requestsWithData.forEach(request => {
                const card = createCancellationRequestCard(request.id, request);
                container.appendChild(card);
            });

        } catch (queryError) {
            console.error('Error in cancellation requests query:', queryError);
            container.innerHTML = `
                <div class="text-red-500 text-center py-10">
                    <p>Error loading cancellation requests: ${queryError.message}</p>
                    <button onclick="loadCancellationRequests()" class="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Retry
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading cancellation requests:', error);
        const container = document.getElementById('cancellationRequests');
        if (container) {
            container.innerHTML = `
                <div class="text-red-500 text-center py-10">
                    <p>Error loading cancellation requests: ${error.message}</p>
                    <button onclick="loadCancellationRequests()" class="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Retry
                    </button>
                </div>
            `;
        }
    }
}

async function loadPaymentVerificationRequests() {
    try {
        const requestsRef = collection(dbInstance, 'paymentVerificationRequests');
        const q = query(
            requestsRef,
            where('status', '==', 'pending')
        );

        const container = document.getElementById('paymentVerificationRequests');
        container.innerHTML = `
            <div class="text-gray-500 text-center py-10">
                <svg class="mx-auto h-12 w-12 text-gray-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="mt-2">Loading requests...</p>
            </div>
        `;

        try {
            const snapshot = await getDocs(q);
            container.innerHTML = '';

            if (snapshot.empty) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-10 text-gray-500">
                        <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                        <p class="text-lg font-medium">No pending payment verification requests</p>
                        <p class="text-sm">When guests submit payment proofs, they'll appear here</p>
                    </div>
                `;
                return;
            }

            // Load requests without duplicate filtering and sort by created date descending
            const requestsWithData = [];
            snapshot.forEach(doc => {
                const request = doc.data();
                if (request.status !== 'duplicate_removed') {
                    requestsWithData.push({ id: doc.id, ...request });
                }
            });

            // Sort by createdAt descending (newest first) in JavaScript
            requestsWithData.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                return dateB - dateA;
            });

            if (requestsWithData.length === 0) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-10 text-gray-500">
                        <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                        <p class="text-lg font-medium">No pending payment verification requests</p>
                        <p class="text-sm">When guests submit payment proofs, they'll appear here</p>
                    </div>
                `;
                return;
            }

            // Create cards for each request
            requestsWithData.forEach(request => {
                // Add debug logging to see the actual data structure
                console.log('Payment verification request data:', request);
                console.log('BookingDetails:', request.bookingDetails);
                console.log('CheckIn field:', request.bookingDetails?.checkIn);
                console.log('CheckOut field:', request.bookingDetails?.checkOut);
                console.log('UserDetails:', request.userDetails);
                const card = createPaymentVerificationCard(request.id, request);
                container.appendChild(card);
            });

        } catch (queryError) {
            console.error('Error in payment verification requests query:', queryError);
            container.innerHTML = `
                <div class="text-red-500 text-center py-10">
                    <p>Error loading payment verification requests: ${queryError.message}</p>
                    <button onclick="loadPaymentVerificationRequests()" class="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Retry
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading payment verification requests:', error);
        const container = document.getElementById('paymentVerificationRequests');
        if (container) {
            container.innerHTML = `
                <div class="text-red-500 text-center py-10">
                    <p>Error loading payment verification requests: ${error.message}</p>
                    <button onclick="loadPaymentVerificationRequests()" class="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Retry
                    </button>
                </div>
            `;
        }
    }
}

// Function to setup real-time listeners
function setupRequestListeners() {
    console.log('Setting up request listeners...');
    const unsubscribers = [];

    try {
        // Payment verification requests listener
        const paymentQuery = query(
            collection(dbInstance, 'paymentVerificationRequests'),
            where('status', '==', 'pending')
        );
        
        const unsubscribePayment = onSnapshot(paymentQuery, (snapshot) => {
            console.log('Payment verification requests updated');
            loadPaymentVerificationRequests();
        }, (error) => {
            console.error('Payment requests listener error:', error);
        });
        
        unsubscribers.push(unsubscribePayment);

        // Modification requests listener
        const modificationQuery = query(
            collection(dbInstance, 'modificationRequests'),
            where('status', '==', 'pending')
        );
        
        const unsubscribeModification = onSnapshot(modificationQuery, (snapshot) => {
            console.log('Modification requests updated');
            loadModificationRequests();
        }, (error) => {
            console.error('Modification requests listener error:', error);
        });
        
        unsubscribers.push(unsubscribeModification);

        // Cancellation requests listener
        const cancellationQuery = query(
            collection(dbInstance, 'cancellationRequests'),
            where('status', '==', 'pending')
        );
        
        const unsubscribeCancellation = onSnapshot(cancellationQuery, (snapshot) => {
            console.log('Cancellation requests updated');
            loadCancellationRequests();
        }, (error) => {
            console.error('Cancellation requests listener error:', error);
        });
        
        unsubscribers.push(unsubscribeCancellation);

        console.log('All listeners set up successfully');
        
        // Return cleanup function
        return () => {
            console.log('Cleaning up listeners...');
            unsubscribers.forEach(unsubscribe => unsubscribe());
        };
        
    } catch (error) {
        console.error('Error setting up listeners:', error);
        return () => {}; // Return empty cleanup function
    }
}

// Helper functions
function formatDate(date) {
    try {
        if (date && typeof date.toDate === 'function') {
            return date.toDate().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
        
        if (date && (date instanceof Date || !isNaN(new Date(date).getTime()))) {
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
        
        return 'Not Available';
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Not Available';
    }
}

function showNotification(message, type = 'info') {
    const styles = {
        info: { bgColor: 'bg-blue-600', icon: 'fas fa-info-circle' },
        success: { bgColor: 'bg-green-600', icon: 'fas fa-check-circle' },
        error: { bgColor: 'bg-red-600', icon: 'fas fa-exclamation-circle' },
        warning: { bgColor: 'bg-yellow-600', icon: 'fas fa-exclamation-triangle' }
    };
    
    const style = styles[type] || styles.info;
    
    const notification = document.createElement('div');
    notification.className = `fixed bottom-4 right-4 ${style.bgColor} text-white px-6 py-3 rounded-lg shadow-lg transform transition-transform duration-300 translate-y-0 z-50`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="${style.icon} mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateY(200%)';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Create card functions (simplified versions for now)
function createPaymentVerificationCard(requestId, request) {
    const card = document.createElement('div');
    card.className = 'bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200 mb-4';
    
    // Extract data from the correct nested structure
    const guestName = request.userDetails?.name || 'N/A';
    
    // Enhanced date handling with better fallbacks
    let checkInDate = 'N/A';
    let checkOutDate = 'N/A';
    let checkInTime = '2:00 PM';
    let checkOutTime = '11:00 AM';
    
    // Try to get check-in date and time - handle both field name variations
    const checkInField = request.bookingDetails?.checkIn || request.bookingDetails?.checkInDate;
    if (checkInField) {
        const formattedDate = formatDate(checkInField);
        if (formattedDate !== 'Not Available') {
            checkInDate = formattedDate;
        }
        
        // Try to extract time
        if (checkInField.toDate) {
            try {
                checkInTime = checkInField.toDate().toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            } catch (e) {
                checkInTime = '2:00 PM';
            }
        }
    }
    
    // Try to get check-out date and time - handle both field name variations
    const checkOutField = request.bookingDetails?.checkOut || request.bookingDetails?.checkOutDate;
    if (checkOutField) {
        const formattedDate = formatDate(checkOutField);
        if (formattedDate !== 'Not Available') {
            checkOutDate = formattedDate;
        }
        
        // Try to extract time
        if (checkOutField.toDate) {
            try {
                checkOutTime = checkOutField.toDate().toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            } catch (e) {
                checkOutTime = '11:00 AM';
            }
        }
    }
    
    // Get room type if available
    const roomType = request.bookingDetails?.roomType || request.bookingDetails?.propertyDetails?.room || 'N/A';
    
    card.innerHTML = `
        <div class="p-6">
            <div class="flex justify-between items-start mb-4">
                <h3 class="text-lg font-semibold text-gray-800">Payment Verification Request</h3>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pending
                </span>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div class="space-y-2">
                    <div class="flex items-center">
                        <svg class="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span class="text-sm font-medium text-gray-700">Guest:</span>
                        <span class="text-sm text-gray-900 ml-1">${guestName}</span>
                    </div>
                    
                    <div class="flex items-center">
                        <svg class="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                        <span class="text-sm font-medium text-gray-700">Amount:</span>
                        <span class="text-sm text-green-600 font-semibold ml-1">₱${request.amount || 'N/A'}</span>
                    </div>
                    
                    <div class="flex items-center">
                        <svg class="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        <span class="text-sm font-medium text-gray-700">Method:</span>
                        <span class="text-sm text-gray-900 ml-1">${request.paymentMethod || 'N/A'}</span>
                    </div>
                    
                    <div class="flex items-center">
                        <svg class="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h4a1 1 0 011 1v5m-6 0V9a1 1 0 011-1h4a1 1 0 011 1v12" />
                        </svg>
                        <span class="text-sm font-medium text-gray-700">Room:</span>
                        <span class="text-sm text-gray-900 ml-1">${roomType}</span>
                    </div>
                </div>
                
                <div class="space-y-2">
                    <div class="flex items-center">
                        <svg class="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4m-6 9l6-6m-6 0l6 6" />
                        </svg>
                        <span class="text-sm font-medium text-gray-700">Check-in:</span>
                        <span class="text-sm text-gray-900 ml-1">${checkInDate}</span>
                    </div>
                    
                    <div class="flex items-center">
                        <svg class="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span class="text-sm font-medium text-gray-700">Time:</span>
                        <span class="text-sm text-gray-900 ml-1">${checkInTime}</span>
                    </div>
                    
                    <div class="flex items-center">
                        <svg class="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span class="text-sm font-medium text-gray-700">Check-out:</span>
                        <span class="text-sm text-gray-900 ml-1">${checkOutDate}</span>
                    </div>
                    
                    <div class="flex items-center">
                        <svg class="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span class="text-sm font-medium text-gray-700">Time:</span>
                        <span class="text-sm text-gray-900 ml-1">${checkOutTime}</span>
                    </div>
                </div>
            </div>
            
            <div class="border-t pt-4">
                <div class="flex items-center text-xs text-gray-500 mb-3">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Reference Number: ${requestId}
                </div>
                <div class="flex space-x-3">
                    <button id="approve-${requestId}" class="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors">
                        <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Approve
                    </button>
                    <button id="reject-${requestId}" class="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors">
                        <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Reject
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add event listeners after the card is created
    setTimeout(() => {
        const approveBtn = document.getElementById(`approve-${requestId}`);
        const rejectBtn = document.getElementById(`reject-${requestId}`);
        
        if (approveBtn) {
            approveBtn.addEventListener('click', () => handleApprovePayment(requestId, request));
        }
        
        if (rejectBtn) {
            rejectBtn.addEventListener('click', () => handleRejectPayment(requestId, request));
        }
    }, 0);
    
    return card;
}

// Handle payment approval
async function handleApprovePayment(requestId, request) {
    try {
        // Show loading state
        const approveBtn = document.getElementById(`approve-${requestId}`);
        const rejectBtn = document.getElementById(`reject-${requestId}`);
        
        if (approveBtn) {
            approveBtn.disabled = true;
            approveBtn.innerHTML = '<span class="animate-spin">⏳</span> Approving...';
        }
        if (rejectBtn) rejectBtn.disabled = true;

        // Update the payment verification request status
        const verificationRef = doc(dbInstance, 'paymentVerificationRequests', requestId);
        await updateDoc(verificationRef, {
            status: 'approved',
            approvedAt: Timestamp.now(),
            approvedBy: authInstance.currentUser?.email || 'Admin'
        });

        // Update the corresponding booking status if bookingId exists
        if (request.bookingId) {
            try {
                const bookingRef = doc(dbInstance, 'everlodgebookings', request.bookingId);
                
                // Check if the booking document exists before trying to update it
                const bookingDoc = await getDoc(bookingRef);
                if (bookingDoc.exists()) {
                    await updateDoc(bookingRef, {
                        paymentStatus: 'verified',
                        status: 'confirmed',
                        approvedByAdmin: true,
                        verifiedAt: Timestamp.now(),
                        verifiedBy: authInstance.currentUser?.email || 'Admin'
                    });
                    
                    console.log(`Booking ${request.bookingId} status updated to confirmed`);
                } else {
                    console.warn(`Booking document ${request.bookingId} not found in everlodgebookings collection. Payment verification request will still be marked as approved.`);
                }
            } catch (bookingUpdateError) {
                console.error(`Error updating booking ${request.bookingId}:`, bookingUpdateError);
                // Don't throw the error, just log it - the payment verification request should still be updated
            }
        }

        showNotification('Payment approved successfully!', 'success');
        
        // Trigger cross-tab notification for dashboard refresh
        try {
            const refreshData = {
                action: 'booking_approved',
                bookingId: request.bookingId,
                timestamp: new Date().getTime()
            };
            
            localStorage.setItem('dashboard:refresh', JSON.stringify(refreshData));
            
            // Also trigger a custom event for same-tab notifications
            window.dispatchEvent(new CustomEvent('dashboardRefresh', { detail: refreshData }));
            
        } catch (error) {
            console.warn('Could not trigger cross-tab notification:', error);
        }
        
        // The real-time listener will automatically refresh the list
        // but we can also manually refresh to ensure immediate update
        setTimeout(() => {
            loadPaymentVerificationRequests();
        }, 500);

    } catch (error) {
        console.error('Error approving payment:', error);
        showNotification('Error approving payment: ' + error.message, 'error');
        
        // Reset button state on error
        const approveBtn = document.getElementById(`approve-${requestId}`);
        const rejectBtn = document.getElementById(`reject-${requestId}`);
        
        if (approveBtn) {
            approveBtn.disabled = false;
            approveBtn.innerHTML = `
                <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Approve
            `;
        }
        if (rejectBtn) rejectBtn.disabled = false;
    }
}

// Handle payment rejection
async function handleRejectPayment(requestId, request) {
    try {
        // Ask for rejection reason
        const reason = prompt('Please provide a reason for rejection (optional):') || 'No reason provided';
        
        // Show loading state
        const approveBtn = document.getElementById(`approve-${requestId}`);
        const rejectBtn = document.getElementById(`reject-${requestId}`);
        
        if (rejectBtn) {
            rejectBtn.disabled = true;
            rejectBtn.innerHTML = '<span class="animate-spin">⏳</span> Rejecting...';
        }
        if (approveBtn) approveBtn.disabled = true;

        // Update the payment verification request status
        const verificationRef = doc(dbInstance, 'paymentVerificationRequests', requestId);
        await updateDoc(verificationRef, {
            status: 'rejected',
            rejectedAt: Timestamp.now(),
            rejectedBy: authInstance.currentUser?.email || 'Admin',
            rejectionReason: reason
        });

        // Update the corresponding booking status if bookingId exists
        if (request.bookingId) {
            try {
                const bookingRef = doc(dbInstance, 'everlodgebookings', request.bookingId);
                
                // Check if the booking document exists before trying to update it
                const bookingDoc = await getDoc(bookingRef);
                if (bookingDoc.exists()) {
                    await updateDoc(bookingRef, {
                        paymentStatus: 'rejected',
                        status: 'payment_rejected',
                        approvedByAdmin: false,
                        rejectedAt: Timestamp.now(),
                        rejectedBy: authInstance.currentUser?.email || 'Admin',
                        rejectionReason: reason
                    });
                    
                    console.log(`Booking ${request.bookingId} status updated to payment_rejected`);
                } else {
                    console.warn(`Booking document ${request.bookingId} not found in everlodgebookings collection. Payment verification request will still be marked as rejected.`);
                }
            } catch (bookingUpdateError) {
                console.error(`Error updating booking ${request.bookingId}:`, bookingUpdateError);
                // Don't throw the error, just log it - the payment verification request should still be updated
            }
        }

        showNotification('Payment rejected successfully!', 'success');
        
        // Trigger cross-tab notification for dashboard refresh
        try {
            const refreshData = {
                action: 'booking_rejected',
                bookingId: request.bookingId,
                timestamp: new Date().getTime()
            };
            
            localStorage.setItem('dashboard:refresh', JSON.stringify(refreshData));
            
            // Also trigger a custom event for same-tab notifications
            window.dispatchEvent(new CustomEvent('dashboardRefresh', { detail: refreshData }));
            
        } catch (error) {
            console.warn('Could not trigger cross-tab notification:', error);
        }
        
        // The real-time listener will automatically refresh the list
        // but we can also manually refresh to ensure immediate update
        setTimeout(() => {
            loadPaymentVerificationRequests();
        }, 500);

    } catch (error) {
        console.error('Error rejecting payment:', error);
        showNotification('Error rejecting payment: ' + error.message, 'error');
        
        // Reset button state on error
        const approveBtn = document.getElementById(`approve-${requestId}`);
        const rejectBtn = document.getElementById(`reject-${requestId}`);
        
        if (rejectBtn) {
            rejectBtn.disabled = false;
            rejectBtn.innerHTML = `
                <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject
            `;
        }
        if (approveBtn) approveBtn.disabled = false;
    }
}

function createModificationRequestCard(requestId, request) {
    const card = document.createElement('div');
    card.className = 'bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200 mb-4';
    card.innerHTML = `
        <div class="p-4">
            <h3 class="text-lg font-semibold text-gray-800 mb-2">Modification Request</h3>
            <p class="text-sm text-gray-600">Reference Number: ${requestId}</p>
            <p class="text-sm text-gray-600">Reason: ${request.reason || 'N/A'}</p>
            <div class="mt-4 flex space-x-2">
                <button id="approve-mod-${requestId}" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Approve</button>
                <button id="reject-mod-${requestId}" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Reject</button>
            </div>
        </div>
    `;
    
    // Add event listeners after the card is created
    setTimeout(() => {
        const approveBtn = document.getElementById(`approve-mod-${requestId}`);
        const rejectBtn = document.getElementById(`reject-mod-${requestId}`);
        
        if (approveBtn) {
            approveBtn.addEventListener('click', () => handleApproveModification(requestId, request));
        }
        
        if (rejectBtn) {
            rejectBtn.addEventListener('click', () => handleRejectModification(requestId, request));
        }
    }, 0);
    
    return card;
}

// Handle modification request approval
async function handleApproveModification(requestId, request) {
    try {
        const approveBtn = document.getElementById(`approve-mod-${requestId}`);
        const rejectBtn = document.getElementById(`reject-mod-${requestId}`);
        
        if (approveBtn) {
            approveBtn.disabled = true;
            approveBtn.innerHTML = '<span class="animate-spin">⏳</span> Approving...';
        }
        if (rejectBtn) rejectBtn.disabled = true;

        // Update the modification request status
        const requestRef = doc(dbInstance, 'modificationRequests', requestId);
        await updateDoc(requestRef, {
            status: 'approved',
            approvedAt: Timestamp.now(),
            approvedBy: authInstance.currentUser?.email || 'Admin'
        });

        showNotification('Modification request approved successfully!', 'success');
        
        setTimeout(() => {
            loadModificationRequests();
        }, 500);

    } catch (error) {
        console.error('Error approving modification request:', error);
        showNotification('Error approving modification request: ' + error.message, 'error');
        
        // Reset button state on error
        const approveBtn = document.getElementById(`approve-mod-${requestId}`);
        const rejectBtn = document.getElementById(`reject-mod-${requestId}`);
        
        if (approveBtn) {
            approveBtn.disabled = false;
            approveBtn.innerHTML = 'Approve';
        }
        if (rejectBtn) rejectBtn.disabled = false;
    }
}

// Handle modification request rejection
async function handleRejectModification(requestId, request) {
    try {
        const reason = prompt('Please provide a reason for rejection (optional):') || 'No reason provided';
        
        const approveBtn = document.getElementById(`approve-mod-${requestId}`);
        const rejectBtn = document.getElementById(`reject-mod-${requestId}`);
        
        if (rejectBtn) {
            rejectBtn.disabled = true;
            rejectBtn.innerHTML = '<span class="animate-spin">⏳</span> Rejecting...';
        }
        if (approveBtn) approveBtn.disabled = true;

        // Update the modification request status
        const requestRef = doc(dbInstance, 'modificationRequests', requestId);
        await updateDoc(requestRef, {
            status: 'rejected',
            rejectedAt: Timestamp.now(),
            rejectedBy: authInstance.currentUser?.email || 'Admin',
            rejectionReason: reason
        });

        showNotification('Modification request rejected successfully!', 'success');
        
        setTimeout(() => {
            loadModificationRequests();
        }, 500);

    } catch (error) {
        console.error('Error rejecting modification request:', error);
        showNotification('Error rejecting modification request: ' + error.message, 'error');
        
        // Reset button state on error
        const approveBtn = document.getElementById(`approve-mod-${requestId}`);
        const rejectBtn = document.getElementById(`reject-mod-${requestId}`);
        
        if (rejectBtn) {
            rejectBtn.disabled = false;
            rejectBtn.innerHTML = 'Reject';
        }
        if (approveBtn) approveBtn.disabled = false;
    }
}

function createCancellationRequestCard(requestId, request) {
    const card = document.createElement('div');
    card.className = 'bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200 mb-4';
    card.innerHTML = `
        <div class="p-4">
            <h3 class="text-lg font-semibold text-gray-800 mb-2">Cancellation Request</h3>
            <p class="text-sm text-gray-600">Reference Number: ${requestId}</p>
            <p class="text-sm text-gray-600">Reason: ${request.reason || 'N/A'}</p>
            <div class="mt-4 flex space-x-2">
                <button id="approve-cancel-${requestId}" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Approve</button>
                <button id="reject-cancel-${requestId}" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Reject</button>
            </div>
        </div>
    `;
    
    // Add event listeners after the card is created
    setTimeout(() => {
        const approveBtn = document.getElementById(`approve-cancel-${requestId}`);
        const rejectBtn = document.getElementById(`reject-cancel-${requestId}`);
        
        if (approveBtn) {
            approveBtn.addEventListener('click', () => handleApproveCancellation(requestId, request));
        }
        
        if (rejectBtn) {
            rejectBtn.addEventListener('click', () => handleRejectCancellation(requestId, request));
        }
    }, 0);
    
    return card;
}

// Handle cancellation request approval
async function handleApproveCancellation(requestId, request) {
    try {
        const approveBtn = document.getElementById(`approve-cancel-${requestId}`);
        const rejectBtn = document.getElementById(`reject-cancel-${requestId}`);
        
        if (approveBtn) {
            approveBtn.disabled = true;
            approveBtn.innerHTML = '<span class="animate-spin">⏳</span> Approving...';
        }
        if (rejectBtn) rejectBtn.disabled = true;

        // Update the cancellation request status
        const requestRef = doc(dbInstance, 'cancellationRequests', requestId);
        await updateDoc(requestRef, {
            status: 'approved',
            approvedAt: Timestamp.now(),
            approvedBy: authInstance.currentUser?.email || 'Admin'
        });

        // If there's a booking ID associated, update the booking status to cancelled
        if (request.bookingId) {
            try {
                const bookingRef = doc(dbInstance, 'everlodgebookings', request.bookingId);
                
                // Check if the booking document exists before trying to update it
                const bookingDoc = await getDoc(bookingRef);
                if (bookingDoc.exists()) {
                    await updateDoc(bookingRef, {
                        status: 'cancelled',
                        cancelledAt: Timestamp.now(),
                        cancelledBy: authInstance.currentUser?.email || 'Admin',
                        cancellationReason: request.reason || 'Approved by admin'
                    });
                    
                    console.log(`Booking ${request.bookingId} status updated to cancelled`);
                } else {
                    console.warn(`Booking document ${request.bookingId} not found in everlodgebookings collection. Cancellation request will still be marked as approved.`);
                }
            } catch (bookingUpdateError) {
                console.error(`Error updating booking ${request.bookingId}:`, bookingUpdateError);
                // Don't throw the error, just log it - the cancellation request should still be updated
            }
        }

        showNotification('Cancellation request approved successfully!', 'success');
        
        setTimeout(() => {
            loadCancellationRequests();
        }, 500);

    } catch (error) {
        console.error('Error approving cancellation request:', error);
        showNotification('Error approving cancellation request: ' + error.message, 'error');
        
        // Reset button state on error
        const approveBtn = document.getElementById(`approve-cancel-${requestId}`);
        const rejectBtn = document.getElementById(`reject-cancel-${requestId}`);
        
        if (approveBtn) {
            approveBtn.disabled = false;
            approveBtn.innerHTML = 'Approve';
        }
        if (rejectBtn) rejectBtn.disabled = false;
    }
}

// Handle cancellation request rejection
async function handleRejectCancellation(requestId, request) {
    try {
        const reason = prompt('Please provide a reason for rejection (optional):') || 'No reason provided';
        
        const approveBtn = document.getElementById(`approve-cancel-${requestId}`);
        const rejectBtn = document.getElementById(`reject-cancel-${requestId}`);
        
        if (rejectBtn) {
            rejectBtn.disabled = true;
            rejectBtn.innerHTML = '<span class="animate-spin">⏳</span> Rejecting...';
        }
        if (approveBtn) approveBtn.disabled = true;

        // Update the cancellation request status
        const requestRef = doc(dbInstance, 'cancellationRequests', requestId);
        await updateDoc(requestRef, {
            status: 'rejected',
            rejectedAt: Timestamp.now(),
            rejectedBy: authInstance.currentUser?.email || 'Admin',
            rejectionReason: reason
        });

        showNotification('Cancellation request rejected successfully!', 'success');
        
        setTimeout(() => {
            loadCancellationRequests();
        }, 500);

    } catch (error) {
        console.error('Error rejecting cancellation request:', error);
        showNotification('Error rejecting cancellation request: ' + error.message, 'error');
        
        // Reset button state on error
        const approveBtn = document.getElementById(`approve-cancel-${requestId}`);
        const rejectBtn = document.getElementById(`reject-cancel-${requestId}`);
        
        if (rejectBtn) {
            rejectBtn.disabled = false;
            rejectBtn.innerHTML = 'Reject';
        }
        if (approveBtn) approveBtn.disabled = false;
    }
}

async function loadPaymentHistory() {
    try {
        console.log('Loading payment history...');
        
        // Query for approved and rejected payment verification requests
        const requestsRef = collection(dbInstance, 'paymentVerificationRequests');
        const approvedQuery = query(
            requestsRef,
            where('status', '==', 'approved')
        );
        const rejectedQuery = query(
            requestsRef,
            where('status', '==', 'rejected')
        );

        // Fetch both approved and rejected requests
        const [approvedSnapshot, rejectedSnapshot] = await Promise.all([
            getDocs(approvedQuery),
            getDocs(rejectedQuery)
        ]);

        // Combine and format the data
        const historyData = [];
        
        approvedSnapshot.forEach(doc => {
            const data = doc.data();
            historyData.push({
                id: doc.id,
                ...data,
                status: 'approved',
                processedAt: data.approvedAt || data.createdAt
            });
        });

        rejectedSnapshot.forEach(doc => {
            const data = doc.data();
            historyData.push({
                id: doc.id,
                ...data,
                status: 'rejected',
                processedAt: data.rejectedAt || data.createdAt
            });
        });

        // Sort by processedAt date (newest first)
        historyData.sort((a, b) => {
            const dateA = a.processedAt?.toDate?.() || new Date(a.processedAt || 0);
            const dateB = b.processedAt?.toDate?.() || new Date(b.processedAt || 0);
            return dateB - dateA;
        });

        // Store the data for filtering
        window.paymentHistoryData = historyData;
        console.log('Payment history loaded:', historyData.length, 'records');
        
        return historyData;
    } catch (error) {
        console.error('Error loading payment history:', error);
        throw error;
    }
}

function displayPaymentHistory(data, filter = 'all') {
    const tableBody = document.getElementById('paymentHistoryTableBody');
    if (!tableBody) {
        console.error('Payment history table body not found');
        return;
    }

    // Filter data based on the selected filter
    let filteredData = data;
    if (filter === 'approved') {
        filteredData = data.filter(item => item.status === 'approved');
    } else if (filter === 'rejected') {
        filteredData = data.filter(item => item.status === 'rejected');
    }

    // Clear existing content
    tableBody.innerHTML = '';

    if (filteredData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-4 text-center text-gray-500">
                    No ${filter === 'all' ? '' : filter + ' '}payment history found
                </td>
            </tr>
        `;
        return;
    }

    // Create table rows
    filteredData.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const processedDate = item.processedAt?.toDate?.() || new Date(item.processedAt || 0);
        const statusClass = item.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        const statusIcon = item.status === 'approved' ? 'fas fa-check' : 'fas fa-times';
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${formatDate(processedDate)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${item.guestName || item.guestId || 'N/A'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${item.roomType || item.room || 'N/A'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                ₱${item.amount || 'N/A'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${item.paymentMethod || 'N/A'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">
                    <i class="${statusIcon} mr-1"></i>
                    ${item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${item.rejectionReason || item.reason || (item.status === 'approved' ? 'Payment verified' : 'N/A')}
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

function setupPaymentHistoryModal() {
    const viewHistoryBtn = document.getElementById('viewPaymentHistoryBtn');
    const modal = document.getElementById('paymentHistoryModal');
    const closeBtn = document.getElementById('closePaymentHistoryModal');
    const showAllBtn = document.getElementById('showAllHistory');
    const showApprovedBtn = document.getElementById('showApproved');
    const showRejectedBtn = document.getElementById('showRejected');

    if (!viewHistoryBtn || !modal || !closeBtn) {
        console.error('Payment history modal elements not found');
        return;
    }

    // Show modal when button is clicked
    viewHistoryBtn.addEventListener('click', async () => {
        try {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent body scroll
            
            // Show loading state
            const tableBody = document.getElementById('paymentHistoryTableBody');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-4 text-center">
                            <div class="flex items-center justify-center space-x-2">
                                <svg class="h-5 w-5 text-gray-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span class="text-gray-500">Loading payment history...</span>
                            </div>
                        </td>
                    </tr>
                `;
            }
            
            // Load and display data
            const historyData = await loadPaymentHistory();
            displayPaymentHistory(historyData, 'all');
            
            // Reset filter buttons
            const filterBtns = [showAllBtn, showApprovedBtn, showRejectedBtn];
            filterBtns.forEach(btn => {
                if (btn) {
                    btn.classList.remove('bg-blue-500', 'text-white');
                    btn.classList.add('bg-gray-200', 'hover:bg-gray-300');
                }
            });
            
            // Set "All" as active
            if (showAllBtn) {
                showAllBtn.classList.remove('bg-gray-200', 'hover:bg-gray-300');
                showAllBtn.classList.add('bg-blue-500', 'text-white');
            }
            
        } catch (error) {
            console.error('Error loading payment history:', error);
            showNotification('Error loading payment history: ' + error.message, 'error');
            
            const tableBody = document.getElementById('paymentHistoryTableBody');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="px-6 py-4 text-center text-red-500">
                            Error loading payment history: ${error.message}
                        </td>
                    </tr>
                `;
            }
        }
    });

    // Hide modal when close button is clicked
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Restore body scroll
    });

    // Hide modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto'; // Restore body scroll
        }
    });

    // Filter button event listeners
    if (showAllBtn) {
        showAllBtn.addEventListener('click', () => {
            if (window.paymentHistoryData) {
                displayPaymentHistory(window.paymentHistoryData, 'all');
                updateFilterButtons(showAllBtn, [showApprovedBtn, showRejectedBtn]);
            }
        });
    }

    if (showApprovedBtn) {
        showApprovedBtn.addEventListener('click', () => {
            if (window.paymentHistoryData) {
                displayPaymentHistory(window.paymentHistoryData, 'approved');
                updateFilterButtons(showApprovedBtn, [showAllBtn, showRejectedBtn]);
            }
        });
    }

    if (showRejectedBtn) {
        showRejectedBtn.addEventListener('click', () => {
            if (window.paymentHistoryData) {
                displayPaymentHistory(window.paymentHistoryData, 'rejected');
                updateFilterButtons(showRejectedBtn, [showAllBtn, showApprovedBtn]);
            }
        });
    }

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
}

function updateFilterButtons(activeBtn, inactiveBtns) {
    // Set active button style
    activeBtn.classList.remove('bg-gray-200', 'hover:bg-gray-300');
    activeBtn.classList.add('bg-blue-500', 'text-white');
    
    // Set inactive buttons style
    inactiveBtns.forEach(btn => {
        if (btn) {
            btn.classList.remove('bg-blue-500', 'text-white');
            btn.classList.add('bg-gray-200', 'hover:bg-gray-300');
        }
    });
}

function handleLoadError(error) {
    console.error('Load error:', error);
    showNotification('Error loading data: ' + error.message, 'error');
}

// Function to load all requests
async function loadAllRequests() {
    try {
        console.log('Loading all requests...');
        await Promise.all([
            loadPaymentVerificationRequests(),
            loadModificationRequests(),
            loadCancellationRequests(),
            loadPaymentHistory()
        ]);
        console.log('All requests loaded successfully');
    } catch (error) {
        console.error('Error loading requests:', error);
        handleLoadError(error);
    }
}

// Main initialization function
async function initializePage() {
    try {
        console.log('🚀 Initializing booking requests page...');
        
        // Initialize tab switching
        initializeTabSwitching();
        
        // Set up payment history modal
        setupPaymentHistoryModal();
        
        // Set up real-time listeners
        console.log('📡 Setting up real-time listeners...');
        const cleanup = setupRequestListeners();
        
        // Load all requests initially
        console.log('📋 Loading all requests...');
        await loadAllRequests();
        
        // Store cleanup function for later use
        window.addEventListener('unload', cleanup);
        
        console.log('🎉 Page initialization complete');
    } catch (error) {
        console.error('❌ Error initializing page:', error);
        handleLoadError(error);
    }
}

// Tab switching functionality - moved to top for better loading
function initializeTabSwitching() {
    console.log('🔧 Initializing tab switching...');
    
    const tabs = {
        'tab-payment-verification': 'payment-verification-content',
        'tab-modification': 'modification-content', 
        'tab-cancellation': 'cancellation-content'
    };
    
    let tabsFound = 0;
    Object.keys(tabs).forEach(tabId => {
        const tabButton = document.getElementById(tabId);
        if (tabButton) {
            tabsFound++;
            tabButton.addEventListener('click', () => {
                console.log(`🔄 Switching to tab: ${tabId}`);
                
                // Remove active class from all tabs
                Object.keys(tabs).forEach(id => {
                    const btn = document.getElementById(id);
                    if (btn) {
                        btn.classList.remove('text-indigo-600', 'border-indigo-600', 'border-b-2');
                        btn.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
                        btn.setAttribute('aria-selected', 'false');
                    }
                });
                
                // Add active class to clicked tab
                tabButton.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
                tabButton.classList.add('text-indigo-600', 'border-indigo-600', 'border-b-2');
                tabButton.setAttribute('aria-selected', 'true');
                
                // Hide all content sections
                Object.values(tabs).forEach(contentId => {
                    const contentSection = document.getElementById(contentId);
                    if (contentSection) {
                        contentSection.classList.add('hidden');
                    }
                });
                
                // Show selected content section
                const contentSection = document.getElementById(tabs[tabId]);
                if (contentSection) {
                    contentSection.classList.remove('hidden');
                }
            });
        } else {
            console.warn(`⚠️ Tab button not found: ${tabId}`);
        }
    });
    
    console.log(`✅ Tab switching initialized. Found ${tabsFound}/${Object.keys(tabs).length} tabs`);
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔄 DOM loaded, starting initialization...');
    
    let unsubscribeAuth = null;
    let authInitialized = false;
    let initializationTimeout;

    // Add a fallback initialization after 3 seconds if auth doesn't complete
    const fallbackInit = () => {
        console.log('⚠️ Fallback initialization triggered - loading page without full auth verification');
        if (!authInitialized) {
            authInitialized = true;
            initializePage().catch(error => {
                console.error('Fallback initialization failed:', error);
                showNotification('Error loading page: ' + error.message, 'error');
            });
        }
    };

    // Set fallback timeout
    initializationTimeout = setTimeout(fallbackInit, 3000);

    try {
        // Check if Firebase auth is available
        if (!authInstance) {
            console.error('❌ Firebase auth instance not available');
            fallbackInit();
            return;
        }

        // Check if user is already authenticated
        const currentUser = authInstance.currentUser;
        if (currentUser) {
            console.log("✅ User already authenticated:", currentUser.email);
            clearTimeout(initializationTimeout);
            authInitialized = true;
            initializePage().catch(error => {
                console.error('Initialization failed with authenticated user:', error);
                showNotification('Error loading page: ' + error.message, 'error');
            });
            return;
        }

        console.log('🔑 Setting up auth state listener...');
        unsubscribeAuth = onAuthStateChanged(authInstance, async (user) => {
            try {
                console.log("🔄 Auth state changed:", user ? `User: ${user.email}` : "No user");
                
                if (authInitialized) {
                    console.log("⏭️ Auth already initialized, skipping");
                    return;
                }

                clearTimeout(initializationTimeout);

                if (user) {
                    try {
                        authInitialized = true;
                        console.log('👤 Verifying user admin status...');
                        
                        // Add timeout for user verification
                        const userVerificationPromise = getDoc(doc(dbInstance, "users", user.uid));
                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('User verification timeout')), 5000)
                        );
                        
                        const userDoc = await Promise.race([userVerificationPromise, timeoutPromise]);
                        
                        if (userDoc.exists() && userDoc.data().role === 'admin') {
                            sessionStorage.setItem('userAuthenticated', 'true');
                            sessionStorage.setItem('userId', user.uid);
                            sessionStorage.setItem('userEmail', user.email);
                            
                            console.log("✅ Admin user verified, initializing page");
                            await initializePage();
                        } else {
                            console.error('❌ User is not an admin');
                            showNotification('Access denied: Admin privileges required', 'error');
                            setTimeout(() => {
                                sessionStorage.clear();
                                window.location.href = '../Login/index.html';
                            }, 2000);
                        }
                    } catch (error) {
                        console.error('❌ Error verifying user:', error);
                        showNotification('Authentication error: ' + error.message, 'error');
                        // Try fallback initialization
                        fallbackInit();
                    }
                } else {
                    if (sessionStorage.getItem('userAuthenticated') === 'true') {
                        console.log("🔄 User was authenticated but is now null");
                        showNotification('Session expired, redirecting to login...', 'warning');
                        setTimeout(() => {
                            sessionStorage.clear();
                            window.location.href = '../Login/index.html';
                        }, 2000);
                    } else {
                        console.log('⚠️ No user found, trying fallback initialization');
                        fallbackInit();
                    }
                }
            } catch (error) {
                console.error('❌ Auth state error:', error);
                showNotification('Authentication error: ' + error.message, 'error');
                fallbackInit();
            }
        }, (error) => {
            console.error('❌ Auth listener error:', error);
            clearTimeout(initializationTimeout);
            fallbackInit();
        });
    } catch (error) {
        console.error('❌ Auth setup error:', error);
        clearTimeout(initializationTimeout);
        fallbackInit();
    }

    // Cleanup on page unload
    window.addEventListener('unload', () => {
        if (unsubscribeAuth) {
            unsubscribeAuth();
        }
        if (initializationTimeout) {
            clearTimeout(initializationTimeout);
        }
    });
});
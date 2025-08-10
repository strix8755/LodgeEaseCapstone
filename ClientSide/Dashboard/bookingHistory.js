/**
 * LodgeEase Booking History Module
 * Handles fetching and displaying booking history for a user
 * Compatible with both module and non-module environments
 */

// Explicitly declare functions in the global scope
window.loadBookingHistory = loadBookingHistory;
window.navigateToBookingDetails = navigateToBookingDetails;

// Main function to load booking history
function loadBookingHistory(userId, dbInstance) {
    console.log('Loading booking history for user:', userId);
    const historyContainer = document.getElementById('bookingHistoryContainer');
    const currentBookingsContainer = document.getElementById('currentBookings');
    const previousBookingsContainer = document.getElementById('previousBookings');
    
    if (!historyContainer) {
        console.error('History container not found');
        return;
    }
    
    // Check for current and previous containers as well
    if (!currentBookingsContainer) {
        console.error('Current bookings container not found');
    }
    
    if (!previousBookingsContainer) {
        console.error('Previous bookings container not found');
    }
    
    // Show loading indicator in all containers
    const loadingHTML = `
        <div class="flex justify-center items-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span class="text-gray-600">Loading your bookings...</span>
        </div>
    `;
    
    historyContainer.innerHTML = loadingHTML;
    
    if (currentBookingsContainer) {
        currentBookingsContainer.innerHTML = loadingHTML;
    }
    
    if (previousBookingsContainer) {
        previousBookingsContainer.innerHTML = loadingHTML;
    }
    
    // Check if we should use mock data for fallback
    let useMockData = false;
    
    // Get Firestore instance
    let db = dbInstance;
    
    // First, check if the dbInstance is a function (like getDb)
    if (typeof dbInstance === 'function') {
        try {
            console.log('dbInstance is a function, attempting to call it');
            db = dbInstance();
        } catch (error) {
            console.error('Error calling dbInstance function:', error);
            db = null;
        }
    }
    
    // Now check if db has the collection method
    if (db && typeof db.collection !== 'function') {
        console.error('db does not have a collection method:', db);
        // Try to fix the db by creating a wrapper with collection method
        try {
            console.log('Attempting to create a wrapper with collection method');
            if (db.firestore && typeof db.firestore === 'function') {
                db = db.firestore();
            } else if (window.firebase && window.firebase.firestore) {
                db = window.firebase.firestore();
            } else {
                // Check if we have access to firebase functions from window.firebaseModule
                if (window.firebaseModule && window.firebaseModule.db) {
                    db = window.firebaseModule.db;
                }
            }
            
            // Final check if we now have a db with collection method
            if (!db || typeof db.collection !== 'function') {
                throw new Error('Failed to initialize a valid Firestore instance with collection method');
            }
        } catch (error) {
            console.error('Error creating wrapper:', error);
            db = null;
            useMockData = true; // Use mock data as a fallback
        }
    }
    
    // If we still don't have a valid db, try other sources
    if (!db) {
        try {
            if (typeof getFirestoreDb === 'function') {
                db = getFirestoreDb();
            } else if (window.firebaseDb) {
                db = window.firebaseDb;
            } else if (window.firebase && window.firebase.firestore) {
                db = window.firebase.firestore();
            } else if (window.directDb) {
                db = window.directDb;
            } else {
                throw new Error('Firestore instance not available');
            }
            
            // Check that the db has a collection method
            if (!db || typeof db.collection !== 'function') {
                throw new Error('Failed to initialize a valid Firestore instance with collection method');
            }
        } catch (error) {
            console.error('Error getting Firestore instance:', error);
            useMockData = true; // Use mock data as a fallback
            
            // Show error message with retry button
            const errorHTML = `
                <div class="text-center text-red-500 py-8">
                    <i class="ri-error-warning-line text-2xl mb-2"></i>
                    <p>Error loading booking data: ${error.message}</p>
                    <div class="mt-4 flex gap-2 justify-center">
                        <button id="retry-booking-load" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors">
                            Retry
                        </button>
                        <button id="use-mock-data" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors">
                            Use Sample Data
                        </button>
                    </div>
                </div>
            `;
            historyContainer.innerHTML = errorHTML;
            
            if (currentBookingsContainer) {
                currentBookingsContainer.innerHTML = errorHTML;
            }
            
            if (previousBookingsContainer) {
                previousBookingsContainer.innerHTML = errorHTML;
            }
            
            // Add event listener for retry button
            const retryButton = document.getElementById('retry-booking-load');
            if (retryButton) {
                retryButton.addEventListener('click', function() {
                    // Try again with a small delay
                    setTimeout(() => loadBookingHistory(userId, dbInstance), 500);
                });
            }
            
            // Add event listener for using mock data
            const useMockButton = document.getElementById('use-mock-data');
            if (useMockButton) {
                useMockButton.addEventListener('click', function() {
                    displayMockBookings(historyContainer, currentBookingsContainer, previousBookingsContainer);
                });
            }
            
            return;
        }
    }
    
    console.log('Using Firestore instance with collection method available:', !!db.collection);
    
    // If we're using mock data, display it and return
    if (useMockData) {
        displayMockBookings(historyContainer, currentBookingsContainer, previousBookingsContainer);
        return;
    }
    
    // Collections to check for bookings
    const collections = ['bookings', 'everlodgebookings', 'completedBookings', 'cancelledBookings'];
    let allBookings = [];
    let completedQueries = 0;
    let hasError = false;
    
    // Start a timeout to detect if queries are taking too long
    const timeoutId = setTimeout(() => {
        if (completedQueries < collections.length) {
            console.warn('Query timeout reached, using mock data as fallback');
            displayMockBookings(historyContainer, currentBookingsContainer, previousBookingsContainer);
            hasError = true; // Prevent the original callbacks from running
        }
    }, 8000); // 8 second timeout
    
    collections.forEach(collection => {
        try {
            // Create a timeout for each collection query
            const queryTimeout = setTimeout(() => {
                completedQueries++;
                console.warn(`Query timeout for collection ${collection}`);
                
                if (completedQueries === collections.length && !hasError) {
                    clearTimeout(timeoutId);
                    if (allBookings.length > 0) {
                        displayAllBookings(allBookings, historyContainer, currentBookingsContainer, previousBookingsContainer);
                    } else {
                        displayMockBookings(historyContainer, currentBookingsContainer, previousBookingsContainer);
                    }
                }
            }, 5000); // 5 second timeout per collection
            
            db.collection(collection)
                .where('userId', '==', userId)
                .get()
                .then(querySnapshot => {
                    clearTimeout(queryTimeout);
                    
                    querySnapshot.forEach(doc => {
                        const booking = doc.data();
                        booking.id = doc.id;
                        booking.collection = collection;
                        allBookings.push(booking);
                    });
                    
                    completedQueries++;
                    
                    // When all queries are complete, display the bookings
                    if (completedQueries === collections.length && !hasError) {
                        clearTimeout(timeoutId);
                        if (allBookings.length > 0) {
                            displayAllBookings(allBookings, historyContainer, currentBookingsContainer, previousBookingsContainer);
                        } else {
                            const noBookingsHTML = `
                                <div class="text-center text-gray-500 py-8">
                                    <i class="ri-calendar-line text-2xl mb-2"></i>
                                    <p>No booking history found.</p>
                                    <button id="use-mock-data" class="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors">
                                        View Sample Bookings
                                    </button>
                                </div>
                            `;
                            historyContainer.innerHTML = noBookingsHTML;
                            
                            if (currentBookingsContainer) {
                                currentBookingsContainer.innerHTML = noBookingsHTML;
                            }
                            
                            if (previousBookingsContainer) {
                                previousBookingsContainer.innerHTML = noBookingsHTML;
                            }
                            
                            // Add event listener for using mock data
                            const useMockButton = document.getElementById('use-mock-data');
                            if (useMockButton) {
                                useMockButton.addEventListener('click', function() {
                                    displayMockBookings(historyContainer, currentBookingsContainer, previousBookingsContainer);
                                });
                            }
                        }
                    }
                })
                .catch(error => {
                    clearTimeout(queryTimeout);
                    console.error(`Error getting ${collection}:`, error);
                    completedQueries++;
                    
                    // Even if there's an error, check if all queries are complete
                    if (completedQueries === collections.length && !hasError) {
                        clearTimeout(timeoutId);
                        if (allBookings.length > 0) {
                            displayAllBookings(allBookings, historyContainer, currentBookingsContainer, previousBookingsContainer);
                        } else {
                            displayMockBookings(historyContainer, currentBookingsContainer, previousBookingsContainer);
                        }
                    }
                });
        } catch (error) {
            console.error(`Error accessing collection ${collection}:`, error);
            completedQueries++;
            
            if (completedQueries === collections.length && !hasError) {
                clearTimeout(timeoutId);
                if (allBookings.length === 0) {
                    displayMockBookings(historyContainer, currentBookingsContainer, previousBookingsContainer);
                }
            }
        }
    });
}

// Function to navigate to booking details
function navigateToBookingDetails(bookingId, collection) {
    console.log('Navigating to booking details:', bookingId, collection);
    // Store booking ID and collection in session storage
    sessionStorage.setItem('selectedBookingId', bookingId);
    sessionStorage.setItem('selectedBookingCollection', collection);
    
    // Navigate to booking details page
    window.location.href = '../BookingDetails/bookingDetails.html';
}

// Function to display all bookings, categorizing them into current and previous
function displayAllBookings(bookings, historyContainer, currentBookingsContainer, previousBookingsContainer) {
    console.log('Displaying all bookings with count:', bookings?.length || 0);
    
    // Safety check for containers
    if (!historyContainer) {
        console.error('History container is missing');
        return;
    }
    
    // First, ensure the history container is properly styled and visible
    historyContainer.classList.remove('hidden');
    // IMPORTANT: Set background to transparent, not grey
    historyContainer.style.backgroundColor = 'transparent';
    historyContainer.style.overflow = 'auto';
    historyContainer.style.maxHeight = '85vh';
    
    // If no bookings, show a message in all containers
    if (!bookings || bookings.length === 0) {
        const noBookingsMessage = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-calendar-times text-4xl mb-4 text-gray-300"></i>
                <p class="text-lg mb-2">No bookings found</p>
                <p class="text-sm">Your booking history will appear here</p>
            </div>
        `;
        
        historyContainer.innerHTML = noBookingsMessage;
        if (currentBookingsContainer) currentBookingsContainer.innerHTML = noBookingsMessage;
        if (previousBookingsContainer) previousBookingsContainer.innerHTML = noBookingsMessage;
        return;
    }
    
    // Clear any existing "no bookings" messages
    clearNoBookingsMessage(historyContainer);
    if (currentBookingsContainer) clearNoBookingsMessage(currentBookingsContainer);
    if (previousBookingsContainer) clearNoBookingsMessage(previousBookingsContainer);
    
    // Get the current date for comparison
    const currentDate = new Date();
    
    // Sort bookings by check-in date (most recent first)
    bookings.sort((a, b) => {
        const dateA = getDateFromBooking(a, 'checkIn');
        const dateB = getDateFromBooking(b, 'checkIn');
        return dateB - dateA;
    });
    
    // Separate bookings into current and previous with enhanced logic
    const currentBookings = [];
    const previousBookings = [];
    
    // Categorize bookings with improved logic
    bookings.forEach(booking => {
        try {
            // Extract dates safely
            const checkInDate = getDateFromBooking(booking, 'checkIn');
            const checkOutDate = getDateFromBooking(booking, 'checkOut');
            const status = (booking.status || 'pending').toLowerCase();
            
            // Enhanced current booking criteria:
            // 1. Status is pending, confirmed, or active
            // 2. Check-out date is in the future
            // 3. Currently checked in (check-in past, check-out future)
            // 4. Upcoming booking (check-in in future)
            const isUpcoming = checkInDate > currentDate;
            const isOngoing = checkInDate <= currentDate && checkOutDate >= currentDate;
            const isActiveStatus = ['pending', 'confirmed', 'active', 'checked in', 'approved'].includes(status);
            
            if ((isUpcoming || isOngoing) && isActiveStatus) {
                currentBookings.push({
                    ...booking,
                    bookingType: isUpcoming ? 'upcoming' : 'ongoing'
                });
            } else {
                // Previous bookings:
                // - Check-out date is in the past OR
                // - Status is completed, cancelled, or rejected
                previousBookings.push({
                    ...booking,
                    bookingType: 'completed'
                });
            }
        } catch (error) {
            console.error('Error categorizing booking:', error, booking);
            // In case of error, put it in the previous bookings as a fallback
            previousBookings.push(booking);
        }
    });
    
    // Log the counts for debugging
    console.log(`Enhanced categorization: ${currentBookings.length} current, ${previousBookings.length} previous`);
    
    // Display all bookings in the history container with section headers
    if (historyContainer) {
        if (bookings.length > 0) {
            const allBookingsHTML = `
                <div class="space-y-6">
                    ${currentBookings.length > 0 ? `
                        <div>
                            <h4 class="text-lg font-semibold mb-3 text-green-600 flex items-center">
                                <i class="ri-time-line mr-2"></i>
                                Current Bookings (${currentBookings.length})
                            </h4>
                            <div class="space-y-4">
                                ${currentBookings.map(booking => createBookingCard(booking)).join('')}
                            </div>
                        </div>
                    ` : ''}
                    ${previousBookings.length > 0 ? `
                        <div>
                            <h4 class="text-lg font-semibold mb-3 text-gray-600 flex items-center">
                                <i class="ri-history-line mr-2"></i>
                                Previous Bookings (${previousBookings.length})
                            </h4>
                            <div class="space-y-4">
                                ${previousBookings.map(booking => createBookingCard(booking)).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
            
            historyContainer.innerHTML = allBookingsHTML;
        } else {
            historyContainer.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-calendar-times text-2xl mb-2"></i>
                    <p>No bookings found</p>
                </div>
            `;
        }
    }
    
    // Display current bookings if container exists
    if (currentBookingsContainer) {
        if (currentBookings.length > 0) {
            const currentBookingsHTML = `
                <div class="space-y-4">
                    <div class="mb-4">
                        <p class="text-sm text-gray-600">
                            <i class="ri-information-line mr-1"></i>
                            ${currentBookings.length} active booking${currentBookings.length > 1 ? 's' : ''}
                        </p>
                    </div>
                    ${currentBookings.map(booking => createEnhancedBookingCard(booking)).join('')}
                </div>
            `;
            
            currentBookingsContainer.innerHTML = currentBookingsHTML;
        } else {
            currentBookingsContainer.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="ri-calendar-check-line text-4xl mb-4 text-gray-300"></i>
                    <p class="text-lg mb-2">No current bookings</p>
                    <p class="text-sm">Your active bookings will appear here</p>
                    <a href="../Homepage/rooms.html" class="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors">
                        Make a Booking
                    </a>
                </div>
            `;
        }
    }
    
    // Display previous bookings if container exists
    if (previousBookingsContainer) {
        if (previousBookings.length > 0) {
            const previousBookingsHTML = `
                <div class="space-y-4">
                    <div class="mb-4">
                        <p class="text-sm text-gray-600">
                            <i class="ri-information-line mr-1"></i>
                            ${previousBookings.length} completed booking${previousBookings.length > 1 ? 's' : ''}
                        </p>
                    </div>
                    ${previousBookings.map(booking => createBookingCard(booking)).join('')}
                </div>
            `;
            
            previousBookingsContainer.innerHTML = previousBookingsHTML;
        } else {
            previousBookingsContainer.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <i class="ri-history-line text-4xl mb-4 text-gray-300"></i>
                    <p class="text-lg mb-2">No previous bookings</p>
                    <p class="text-sm">Your booking history will appear here</p>
                </div>
            `;
        }
    }
    
    // Add event listeners to booking cards with enhanced error handling
    setTimeout(() => {
        const viewDetailsBtns = document.querySelectorAll('[data-booking-id]');
        viewDetailsBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const bookingId = btn.getAttribute('data-booking-id');
                const collection = btn.getAttribute('data-collection') || 'bookings';
                
                if (bookingId) {
                    navigateToBookingDetails(bookingId, collection);
                } else {
                    console.error('No booking ID found for button');
                }
            });
        });
    }, 100);
}

// Helper function to create a booking card
function createBookingCard(booking) {
    // Extract and format date information with enhanced logic
    const checkInDate = formatDate(getDateFromBooking(booking, 'checkIn'));
    const checkOutDate = formatDate(getDateFromBooking(booking, 'checkOut'));
    
    // Enhanced property name extraction with multiple fallbacks
    const propertyName = booking.propertyDetails?.name || 
                        booking.lodgeName || 
                        booking.propertyName ||
                        booking.property?.name ||
                        booking.lodge?.name ||
                        'Property';
    
    // Enhanced room information extraction
    const roomType = booking.propertyDetails?.roomType || 
                    booking.roomType || 
                    booking.room?.type ||
                    'Standard Room';
    
    const roomNumber = booking.propertyDetails?.roomNumber || 
                      booking.roomNumber || 
                      booking.room?.number ||
                      booking.room || '';
    
    // Enhanced price extraction
    const totalPrice = booking.totalPrice || 
                      booking.price || 
                      booking.amount || 
                      booking.cost ||
                      booking.totalAmount ||
                      0;
    
    // Get status with enhanced handling
    const status = (booking.status || 'pending').toLowerCase();
    const statusClass = getStatusClass(status);
    
    return `
        <div class="bg-white border rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-semibold text-gray-800">${propertyName}</h4>
                <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
                    ${getStatusText(status)}
                </span>
            </div>
            <p class="text-sm text-gray-600 mb-2">
                ${roomType}${roomNumber ? ` #${roomNumber}` : ''}
            </p>
            <div class="flex items-center text-sm text-gray-500 space-x-2 mb-2">
                <i class="ri-calendar-line"></i>
                <span>${checkInDate} → ${checkOutDate}</span>
            </div>
            <div class="flex items-center text-sm text-gray-500 mb-2">
                <i class="ri-user-line mr-1"></i>
                <span>Booking ID: ${booking.id || booking.bookingId || 'N/A'}</span>
            </div>
            <div class="flex justify-between items-center mt-2">
                <span class="font-semibold text-purple-600">₱${parseFloat(totalPrice || 0).toLocaleString()}</span>
                <button class="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors" 
                        data-booking-id="${booking.id || booking.bookingId}" 
                        data-collection="${booking.collectionSource || 'bookings'}">
                    View Details
                </button>
            </div>
        </div>
    `;
}

// Helper function to get date from booking object (handles different date formats)
function getDateFromBooking(booking, dateField) {
    if (!booking) return new Date();
    
    // Comprehensive list of possible date field names
    const fieldNames = [
        dateField, 
        `${dateField}Date`, 
        `${dateField}DateTime`,
        dateField.toLowerCase(),
        `${dateField.toLowerCase()}Date`,
        `${dateField.toLowerCase()}DateTime`
    ];
    
    // Enhanced search function that looks in nested objects
    function findDateInObject(obj, fieldNames, depth = 3) {
        if (!obj || typeof obj !== 'object' || depth <= 0) {
            return null;
        }
        
        // First check direct properties
        for (const fieldName of fieldNames) {
            if (obj[fieldName] !== undefined) {
                return obj[fieldName];
            }
        }
        
        // Then search in nested objects
        for (const key in obj) {
            if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                const result = findDateInObject(obj[key], fieldNames, depth - 1);
                if (result) {
                    return result;
                }
            }
        }
        
        return null;
    }
    
    // Use enhanced search to find date value
    const dateValue = findDateInObject(booking, fieldNames);
    
    if (dateValue) {
        return convertToDate(dateValue);
    }
    
    // Default to current date if no valid date found
    console.warn(`No valid ${dateField} date found for booking`, booking);
    return new Date();
}

// Enhanced date conversion function
function convertToDate(dateValue) {
    if (!dateValue) return new Date();
    
    try {
        // Handle Firebase Timestamp objects
        if (dateValue && typeof dateValue.toDate === 'function') {
            return dateValue.toDate();
        }
        
        // Handle Firebase timestamp with seconds
        if (dateValue && dateValue.seconds !== undefined) {
            return new Date(dateValue.seconds * 1000);
        }
        
        // Handle Date objects
        if (dateValue instanceof Date) {
            return dateValue;
        }
        
        // Handle numeric timestamp
        if (typeof dateValue === 'number') {
            return new Date(dateValue);
        }
        
        // Handle string dates with multiple formats
        if (typeof dateValue === 'string') {
            // Try different date formats
            const formats = [
                // Direct parsing
                () => new Date(dateValue),
                // MM/DD/YYYY or MM-DD-YYYY
                () => {
                    const parts = dateValue.split(/[\/\-\.]/);
                    if (parts.length === 3) {
                        return new Date(parts[2], parts[0] - 1, parts[1]);
                    }
                    return null;
                },
                // DD/MM/YYYY or DD-MM-YYYY  
                () => {
                    const parts = dateValue.split(/[\/\-\.]/);
                    if (parts.length === 3) {
                        return new Date(parts[2], parts[1] - 1, parts[0]);
                    }
                    return null;
                },
                // YYYY/MM/DD or YYYY-MM-DD
                () => {
                    const parts = dateValue.split(/[\/\-\.]/);
                    if (parts.length === 3) {
                        return new Date(parts[0], parts[1] - 1, parts[2]);
                    }
                    return null;
                }
            ];
            
            for (const formatFn of formats) {
                const attemptedDate = formatFn();
                if (attemptedDate && !isNaN(attemptedDate.getTime())) {
                    return attemptedDate;
                }
            }
        }
        
        // Handle object with date parts
        if (typeof dateValue === 'object' && dateValue.date && dateValue.month && dateValue.year) {
            return new Date(dateValue.year, dateValue.month - 1, dateValue.date);
        }
        
    } catch (error) {
        console.error('Error converting date:', error);
    }
    
    return new Date();
}

// Helper function to format date
function formatDate(date) {
    if (!date) return 'N/A';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
}

// Helper function to get status class
function getStatusClass(status) {
    switch (status.toLowerCase()) {
        case 'active':
        case 'confirmed':
            return 'bg-green-100 text-green-800';
        case 'pending':
            return 'bg-yellow-100 text-yellow-800';
        case 'completed':
            return 'bg-blue-100 text-blue-800';
        case 'cancelled':
            return 'bg-red-100 text-red-800';
        case 'rejected':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

// Helper function to get status text
function getStatusText(status) {
    switch (status.toLowerCase()) {
        case 'active':
        case 'confirmed':
            return 'Confirmed';
        case 'pending':
            return 'Pending';
        case 'completed':
            return 'Completed';
        case 'cancelled':
            return 'Cancelled';
        case 'rejected':
            return 'Rejected';
        default:
            return status.charAt(0).toUpperCase() + status.slice(1);
    }
}

// Helper function to clear no bookings messages
function clearNoBookingsMessage(container) {
    if (!container) return;
    
    // Find all potential "no bookings" message elements
    const noBookingsMessages = container.querySelectorAll('.text-center.text-gray-500.py-8');
    const loadingIndicators = container.querySelectorAll('.flex.justify-center.items-center.py-8');
    
    // Remove each element if it contains text about no bookings
    noBookingsMessages.forEach(element => {
        if (element.textContent.toLowerCase().includes('no booking') || 
            element.textContent.toLowerCase().includes('found')) {
            element.remove();
        }
    });
    
    // Remove loading indicators
    loadingIndicators.forEach(element => {
        element.remove();
    });
}

// Self-test function to verify function availability
function testBookingHistoryFunctions() {
    console.log('Testing booking history functions:');
    console.log('- loadBookingHistory available globally:', typeof window.loadBookingHistory === 'function');
    console.log('- navigateToBookingDetails available globally:', typeof window.navigateToBookingDetails === 'function');
    console.log('- loadBookingHistory available locally:', typeof loadBookingHistory === 'function');
    console.log('- navigateToBookingDetails available locally:', typeof navigateToBookingDetails === 'function');
}

// Run self-test on load
document.addEventListener('DOMContentLoaded', testBookingHistoryFunctions);

// If using CommonJS or ES modules, export the functions
try {
    if (typeof module !== 'undefined' && module.exports) {
        // CommonJS environment
        module.exports = {
            loadBookingHistory,
            navigateToBookingDetails
        };
    } else if (typeof exports !== 'undefined') {
        // Another CommonJS variant
        exports.loadBookingHistory = loadBookingHistory;
        exports.navigateToBookingDetails = navigateToBookingDetails;
    }
} catch (e) {
    console.log('Not running in a module environment');
}

// Function to display mock booking data when Firestore is unavailable
function displayMockBookings(historyContainer, currentBookingsContainer, previousBookingsContainer) {
    console.log('Displaying mock booking data');
    
    // Generate mock booking data
    const mockBookings = [
        {
            id: 'mock-booking-1',
            collection: 'bookings',
            userId: 'mock-user',
            status: 'confirmed',
            checkIn: new Date(Date.now() + 86400000), // Tomorrow
            checkOut: new Date(Date.now() + 86400000 * 3), // 3 days later
            propertyDetails: {
                name: 'Ever Lodge',
                roomType: 'Deluxe Room',
                roomNumber: '101',
                location: 'Baguio City'
            },
            totalPrice: 3900,
            guests: 2,
            contactNumber: '09123456789'
        },
        {
            id: 'mock-booking-2',
            collection: 'bookings',
            userId: 'mock-user',
            status: 'completed',
            checkIn: new Date(Date.now() - 86400000 * 10), // 10 days ago
            checkOut: new Date(Date.now() - 86400000 * 7), // 7 days ago
            propertyDetails: {
                name: 'Ever Lodge',
                roomType: 'Standard Room',
                roomNumber: '205',
                location: 'Baguio City'
            },
            totalPrice: 2600,
            guests: 1,
            contactNumber: '09123456789'
        },
        {
            id: 'mock-booking-3',
            collection: 'everlodgebookings',
            userId: 'mock-user',
            status: 'pending',
            checkIn: new Date(Date.now() + 86400000 * 14), // 14 days later
            checkOut: new Date(Date.now() + 86400000 * 15), // 15 days later
            propertyDetails: {
                name: 'Ever Lodge',
                roomType: 'Family Suite',
                roomNumber: '302',
                location: 'Baguio City'
            },
            totalPrice: 1580,
            guests: 4,
            contactNumber: '09123456789'
        }
    ];
    
    // Display the mock bookings
    displayAllBookings(mockBookings, historyContainer, currentBookingsContainer, previousBookingsContainer);
    
    // Add notice that these are sample bookings
    const sampleNotice = document.createElement('div');
    sampleNotice.className = 'text-center text-sm text-orange-500 mt-4 p-2 bg-orange-50 rounded';
    sampleNotice.innerHTML = '<i class="ri-information-line mr-1"></i> Showing sample booking data. Database connection unavailable.';
    
    if (historyContainer) {
        historyContainer.prepend(sampleNotice.cloneNode(true));
    }
    
    if (currentBookingsContainer) {
        currentBookingsContainer.prepend(sampleNotice.cloneNode(true));
    }
    
    if (previousBookingsContainer) {
        previousBookingsContainer.prepend(sampleNotice.cloneNode(true));
    }
}

// Enhanced booking card for current bookings with additional status indicators
function createEnhancedBookingCard(booking) {
    // Extract and format date information
    const checkInDate = formatDate(getDateFromBooking(booking, 'checkIn'));
    const checkOutDate = formatDate(getDateFromBooking(booking, 'checkOut'));
    
    // Enhanced property name extraction
    const propertyName = booking.propertyDetails?.name || 
                        booking.lodgeName || 
                        booking.propertyName ||
                        booking.property?.name ||
                        booking.lodge?.name ||
                        'Property';
    
    // Enhanced room information
    const roomType = booking.propertyDetails?.roomType || 
                    booking.roomType || 
                    booking.room?.type ||
                    'Standard Room';
    
    const roomNumber = booking.propertyDetails?.roomNumber || 
                      booking.roomNumber || 
                      booking.room?.number ||
                      booking.room || '';
    
    // Enhanced price extraction
    const totalPrice = booking.totalPrice || 
                      booking.price || 
                      booking.amount || 
                      booking.cost ||
                      booking.totalAmount ||
                      0;
    
    // Determine booking type for appropriate styling
    const bookingType = booking.bookingType || 'current';
    const typeIcon = bookingType === 'upcoming' ? 'ri-time-line' : 
                    bookingType === 'ongoing' ? 'ri-play-circle-line' : 
                    'ri-check-line';
    const typeText = bookingType === 'upcoming' ? 'Upcoming' : 
                    bookingType === 'ongoing' ? 'Ongoing' : 
                    'Current';
    
    // Get status
    const status = (booking.status || 'pending').toLowerCase();
    const statusClass = getStatusClass(status);
    
    return `
        <div class="bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-500 rounded-lg shadow-sm p-4 hover:shadow-md transition-all">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="font-semibold text-gray-800 text-lg">${propertyName}</h4>
                    <p class="text-sm text-gray-600">${roomType}${roomNumber ? ` #${roomNumber}` : ''}</p>
                </div>
                <div class="text-right">
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
                        ${getStatusText(status)}
                    </span>
                    <div class="flex items-center text-xs text-blue-600 mt-1">
                        <i class="${typeIcon} mr-1"></i>
                        <span>${typeText}</span>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div class="flex items-center text-sm text-gray-600">
                    <i class="ri-calendar-check-line mr-2 text-green-500"></i>
                    <span>Check-in: ${checkInDate}</span>
                </div>
                <div class="flex items-center text-sm text-gray-600">
                    <i class="ri-calendar-event-line mr-2 text-red-500"></i>
                    <span>Check-out: ${checkOutDate}</span>
                </div>
            </div>
            
            <div class="flex items-center text-sm text-gray-500 mb-3">
                <i class="ri-user-line mr-2"></i>
                <span>Booking ID: ${booking.id || booking.bookingId || 'N/A'}</span>
            </div>
            
            <div class="flex justify-between items-center pt-2 border-t border-gray-200">
                <span class="font-bold text-purple-600 text-lg">₱${parseFloat(totalPrice || 0).toLocaleString()}</span>
                <button class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 text-sm font-medium transition-colors" 
                        data-booking-id="${booking.id || booking.bookingId}" 
                        data-collection="${booking.collectionSource || 'bookings'}">
                    <i class="ri-eye-line mr-1"></i>
                    View Details
                </button>
            </div>
        </div>
    `;
} 
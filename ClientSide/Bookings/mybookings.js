import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.18.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, Timestamp, getDoc, addDoc } from "https://www.gstatic.com/firebasejs/9.18.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.18.0/firebase-app.js";

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyBAJr0JQgWRfGTmSXTK6P7Yn8fkHXG2YeE",
        authDomain: "lms-app-2b903.firebaseapp.com",
        projectId: "lms-app-2b903",
        storageBucket: "lms-app-2b903.appspot.com",
        messagingSenderId: "1046108373013",
        appId: "1:1046108373013:web:fc366db1d92b9c4b860e1c",
        measurementId: "G-WRMW9Z8867"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Initialize user drawer
    import('../components/userDrawer.js').then(module => {
        module.initializeUserDrawer(auth, db);
    });

    // Tab switching functionality
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active', 'border-blue-500', 'text-blue-600'));
            tab.classList.add('active', 'border-blue-500', 'text-blue-600');

            tabContents.forEach(content => content.classList.add('hidden'));
            const targetContent = document.getElementById(`${tab.dataset.tab}Bookings`);
            targetContent.classList.remove('hidden');
        });
    });

    // Load bookings when user is authenticated
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            await loadBookings(user.uid);
        } else {
            console.log('No user authenticated, redirecting to login');
            window.location.href = '../Login/index.html';
        }
    });

    async function loadBookings(userId) {
        try {
            console.log('Loading bookings for user:', userId);
            const bookingsRef = collection(db, 'bookings');
            const currentDate = Timestamp.fromDate(new Date());

            // Query all bookings for the current user
            const bookingsQuery = query(
                bookingsRef,
                where('userId', '==', userId)
            );

            const bookingsSnapshot = await getDocs(bookingsQuery);
            
            const currentBookings = [];
            const pastBookings = [];

            bookingsSnapshot.forEach(doc => {
                const booking = { id: doc.id, ...doc.data() };
                if (booking.checkOut >= currentDate) {
                    currentBookings.push(booking);
                } else {
                    pastBookings.push(booking);
                }
            });

            console.log('Current bookings:', currentBookings);
            console.log('Past bookings:', pastBookings);

            renderBookings(currentBookings, 'currentBookings');
            renderBookings(pastBookings, 'pastBookings');

        } catch (error) {
            console.error('Error loading bookings:', error);
            showError('Failed to load bookings. Please try again later.');
        }
    }

    function renderBookings(bookings, containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container ${containerId} not found`);
            return;
        }
        
        container.innerHTML = '';

        if (bookings.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <i class="ri-hotel-bed-line text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500">No bookings found</p>
                </div>
            `;
            return;
        }

        bookings.forEach(booking => {
            console.log(`Rendering booking:`, booking);
            const bookingCard = createBookingCard(booking, booking.id);
            container.appendChild(bookingCard);
        });
    }

    function createBookingCard(booking, bookingId) {
        console.log('Creating card for booking:', booking);
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl shadow-md overflow-hidden';
        
        try {
            // Handle property name and location
            const propertyName = booking.propertyDetails?.name || booking.propertyName || 'Property Name Not Available';
            const propertyLocation = booking.propertyDetails?.location || 'Location not specified';
            const roomType = booking.propertyDetails?.roomType || booking.roomType || 'Standard Room';
            const roomNumber = booking.propertyDetails?.roomNumber || '';
            const floorLevel = booking.propertyDetails?.floorLevel || '';

            // Handle dates
            const checkInDate = booking.checkIn instanceof Timestamp ? 
                booking.checkIn.toDate() : 
                new Date(booking.checkIn);
            
            const checkOutDate = booking.checkOut instanceof Timestamp ? 
                booking.checkOut.toDate() : 
                new Date(booking.checkOut);

            const formattedCheckIn = formatDate(checkInDate);
            const formattedCheckOut = formatDate(checkOutDate);
            
            // Handle status
            const status = booking.status || 'Pending';
            const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
            
            card.innerHTML = `
                <div class="p-6">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="text-xl font-bold text-gray-900 mb-2">${propertyName}</h3>
                            <div class="flex items-center text-sm text-gray-500 mb-4">
                                <i class="ri-map-pin-line mr-2"></i>
                                <span>${propertyLocation}</span>
                            </div>
                        </div>
                        <span class="px-4 py-2 bg-${getStatusColor(status)} rounded-full text-sm font-medium">
                            ${formattedStatus}
                        </span>
                    </div>

                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <p class="text-sm text-gray-500">Check-in</p>
                            <p class="font-medium">${formattedCheckIn}</p>
                            <p class="text-sm text-gray-500">From 2:00 PM</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Check-out</p>
                            <p class="font-medium">${formattedCheckOut}</p>
                            <p class="text-sm text-gray-500">Until 12:00 PM</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Room Details</p>
                            <p class="font-medium">${roomType}</p>
                            <p class="text-sm text-gray-500">${roomNumber ? `Room ${roomNumber}` : ''} ${floorLevel ? `, ${floorLevel}` : ''}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Guest Details</p>
                            <p class="font-medium">${booking.guestName || 'Guest'}</p>
                            <p class="text-sm text-gray-500">${booking.guests || '1 guest'}</p>
                        </div>
                    </div>

                    <div class="border-t pt-4">
                        <div class="flex justify-between items-center mb-4">
                            <div>
                                <p class="text-sm text-gray-500">Contact Information</p>
                                <p class="font-medium">${booking.contactNumber || 'N/A'}</p>
                                <p class="text-sm text-gray-500">${booking.email || booking.userEmail || 'N/A'}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-sm text-gray-500">Total Amount</p>
                                <p class="text-xl font-bold text-blue-600">₱${(booking.totalPrice || booking.total || 0).toLocaleString()}</p>
                                <p class="text-sm text-gray-500">Payment: ${(booking.paymentStatus || 'Pending').charAt(0).toUpperCase() + (booking.paymentStatus || 'Pending').slice(1).toLowerCase()}</p>
                            </div>
                        </div>
                        ${createActionButtons(booking)}
                    </div>
                </div>
            `;

            // After creating the card HTML, add event listeners to the buttons
            setTimeout(() => {
                // Get all buttons in this card
                const modifyBtn = card.querySelector('.modify-btn');
                const cancelBtn = card.querySelector('.cancel-btn');
                const viewDetailsBtn = card.querySelector('.view-details-btn');
                const bookAgainBtn = card.querySelector('.book-again-btn');

                // Add event listeners if buttons exist
                if (modifyBtn) {
                    modifyBtn.addEventListener('click', () => handleModifyBooking(bookingId));
                }
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', () => handleCancelBooking(bookingId));
                }
                if (viewDetailsBtn) {
                    viewDetailsBtn.addEventListener('click', () => handleViewDetails(booking));
                }
                if (bookAgainBtn) {
                    bookAgainBtn.addEventListener('click', () => handleBookAgain(booking));
                }
            }, 0);

            return card;
        } catch (error) {
            console.error('Error creating booking card:', error);
            card.innerHTML = `
                <div class="p-6">
                    <p class="text-red-500">Error displaying booking information</p>
                </div>
            `;
            return card;
        }
    }

    function createActionButtons(booking) {
        // Check if the booking is past
        const isPastBooking = booking.checkOut && new Date(booking.checkOut) < new Date();
        
        if (isPastBooking) {
            return `
                <div class="flex space-x-4">
                    <button class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition view-details-btn">
                        View Details
                    </button>
                    <button class="flex-1 border border-blue-600 text-blue-600 py-2 rounded-lg hover:bg-blue-50 transition book-again-btn">
                        Book Again
                    </button>
                </div>
            `;
        }

        return `
            <div class="flex space-x-4">
                <button class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition modify-btn">
                    Modify Booking
                </button>
                <button class="flex-1 border border-red-600 text-red-600 py-2 rounded-lg hover:bg-red-50 transition cancel-btn">
                    Cancel Booking
                </button>
            </div>
        `;
    }

    function getStatusColor(status = 'pending') {
        const colors = {
            'confirmed': 'green-100 text-green-800',
            'completed': 'gray-100 text-gray-800',
            'cancelled': 'red-100 text-red-800',
            'pending': 'yellow-100 text-yellow-800'
        };
        return colors[status.toLowerCase()] || 'gray-100 text-gray-800';
    }

    function formatDate(date) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    async function handleModifyBooking(bookingId) {
        try {
            // Get the booking reference
            const bookingRef = doc(db, 'bookings', bookingId);
            const bookingDoc = await getDoc(bookingRef);
            
            if (!bookingDoc.exists()) {
                throw new Error('Booking not found');
            }

            const booking = bookingDoc.data();

            // Create modal HTML for modification request
            const modalHtml = `
                <div id="modifyBookingModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div class="mt-3">
                            <h3 class="text-lg font-medium leading-6 text-gray-900 mb-4">Request Booking Modification</h3>
                            <form id="modifyBookingForm" class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700">Requested Check-in Date</label>
                                    <input type="date" id="modifyCheckIn" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
                                        value="${formatDateForInput(booking.checkIn.toDate())}" min="${formatDateForInput(new Date())}">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700">Requested Check-out Date</label>
                                    <input type="date" id="modifyCheckOut" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
                                        value="${formatDateForInput(booking.checkOut.toDate())}" min="${formatDateForInput(new Date())}">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700">Reason for Modification</label>
                                    <textarea id="modifyReason" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
                                        rows="3" required placeholder="Please provide a reason for the modification request"></textarea>
                                </div>
                                <div class="flex justify-end space-x-3 mt-5">
                                    <button type="button" id="cancelModify" class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">
                                        Cancel
                                    </button>
                                    <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                                        Submit Request
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            // Add modal to document
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Get modal elements
            const modal = document.getElementById('modifyBookingModal');
            const form = document.getElementById('modifyBookingForm');
            const cancelBtn = document.getElementById('cancelModify');

            // Add event listeners
            cancelBtn.addEventListener('click', () => {
                modal.remove();
            });

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                try {
                    const checkIn = new Date(document.getElementById('modifyCheckIn').value);
                    const checkOut = new Date(document.getElementById('modifyCheckOut').value);
                    const reason = document.getElementById('modifyReason').value;

                    // Validate dates
                    if (checkIn >= checkOut) {
                        throw new Error('Check-out date must be after check-in date');
                    }

                    // Create modification request in Firestore
                    const modificationRequestsRef = collection(db, 'modificationRequests');
                    await addDoc(modificationRequestsRef, {
                        bookingId: bookingId,
                        userId: auth.currentUser.uid,
                        currentBooking: booking,
                        requestedChanges: {
                            checkIn: Timestamp.fromDate(checkIn),
                            checkOut: Timestamp.fromDate(checkOut)
                        },
                        reason: reason,
                        status: 'pending',
                        createdAt: Timestamp.fromDate(new Date())
                    });

                    // Update booking status to indicate pending modification
                    await updateDoc(bookingRef, {
                        modificationRequested: true,
                        modificationRequestedAt: Timestamp.fromDate(new Date())
                    });

                    // Show success message
                    alert('Modification request submitted successfully. Please wait for admin approval.');
                    
                    // Remove modal and reload bookings
                    modal.remove();
                    await loadBookings(auth.currentUser.uid);
                    
                } catch (error) {
                    console.error('Error submitting modification request:', error);
                    alert(error.message || 'Failed to submit modification request');
                }
            });

        } catch (error) {
            console.error('Error creating modification request:', error);
            showError('Failed to create modification request. Please try again later.');
        }
    }

    async function handleCancelBooking(bookingId) {
        try {
            // Get the booking reference
            const bookingRef = doc(db, 'bookings', bookingId);
            const bookingDoc = await getDoc(bookingRef);
            
            if (!bookingDoc.exists()) {
                throw new Error('Booking not found');
            }

            const booking = bookingDoc.data();

            // Add debug logging
            console.log('Creating cancellation request for booking:', booking);

            // Show confirmation modal with reason input
            const modalHtml = `
                <div id="cancelBookingModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div class="mt-3">
                            <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">Request Booking Cancellation</h3>
                            <form id="cancelBookingForm" class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700">Reason for Cancellation</label>
                                    <textarea id="cancelReason" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
                                        rows="3" required placeholder="Please provide a reason for the cancellation request"></textarea>
                                </div>
                                <div class="flex justify-center space-x-4 mt-5">
                                    <button type="submit" class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                                        Submit Cancellation Request
                                    </button>
                                    <button type="button" id="cancelCancel" class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">
                                        Keep Booking
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            // Add modal to document
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Get modal elements
            const modal = document.getElementById('cancelBookingModal');
            const form = document.getElementById('cancelBookingForm');
            const cancelBtn = document.getElementById('cancelCancel');

            // Add event listeners
            cancelBtn.addEventListener('click', () => {
                modal.remove();
            });

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                try {
                    const reason = document.getElementById('cancelReason').value;

                    // Debug log the request data
                    const requestData = {
                        bookingId: bookingId,
                        userId: auth.currentUser.uid,
                        booking: booking,
                        reason: reason,
                        status: 'pending',
                        createdAt: Timestamp.fromDate(new Date())
                    };
                    console.log('Submitting cancellation request:', requestData);

                    // Create cancellation request in Firestore
                    const cancellationRequestsRef = collection(db, 'cancellationRequests');
                    const docRef = await addDoc(cancellationRequestsRef, requestData);
                    
                    console.log('Cancellation request created with ID:', docRef.id);

                    // Update booking status
                    await updateDoc(bookingRef, {
                        cancellationRequested: true,
                        cancellationRequestedAt: Timestamp.fromDate(new Date()),
                        cancellationRequestId: docRef.id // Add reference to the request
                    });

                    console.log('Booking updated with cancellation request');

                    alert('Cancellation request submitted successfully. Please wait for admin approval.');
                    modal.remove();
                    await loadBookings(auth.currentUser.uid);
                    
                } catch (error) {
                    console.error('Detailed error submitting cancellation request:', error);
                    alert(`Failed to submit cancellation request: ${error.message}`);
                }
            });

        } catch (error) {
            console.error('Error handling cancellation:', error);
            alert('Failed to process cancellation request. Please try again later.');
        }
    }

    // Helper function to format date for input fields
    function formatDateForInput(date) {
        return date.toISOString().split('T')[0];
    }

    function handleBookAgain(booking) {
        // Redirect to the booking page with pre-filled information
        const queryParams = new URLSearchParams({
            propertyName: booking.propertyDetails?.name || booking.propertyName,
            roomType: booking.propertyDetails?.roomType || booking.roomType,
            guests: booking.guests,
            // Add any other relevant booking information
        });

        window.location.href = `../Lodge/lodge1.html?${queryParams.toString()}`;
    }

    function showError(message) {
        console.error('Error:', message);
        alert(message);
    }

    // Add this new function for viewing details
    function handleViewDetails(booking) {
        // Create modal HTML for viewing details
        const modalHtml = `
            <div id="viewDetailsModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                    <div class="mt-3">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-lg font-medium leading-6 text-gray-900">Booking Details</h3>
                            <button id="closeDetails" class="text-gray-500 hover:text-gray-700">
                                <i class="ri-close-line text-2xl"></i>
                            </button>
                        </div>
                        <div class="space-y-4">
                            <div>
                                <p class="text-sm text-gray-500">Property</p>
                                <p class="font-medium">${booking.propertyDetails?.name || booking.propertyName}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Booking Reference</p>
                                <p class="font-medium">${booking.id}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Dates</p>
                                <p class="font-medium">Check-in: ${formatDate(new Date(booking.checkIn))}</p>
                                <p class="font-medium">Check-out: ${formatDate(new Date(booking.checkOut))}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Room Details</p>
                                <p class="font-medium">${booking.propertyDetails?.roomType || booking.roomType}</p>
                                <p class="font-medium">Room ${booking.propertyDetails?.roomNumber || ''}</p>
                            </div>
                            <div>
                                <p class="text-sm text-gray-500">Payment Details</p>
                                <p class="font-medium">Total Amount: ₱${(booking.totalPrice || booking.total || 0).toLocaleString()}</p>
                                <p class="font-medium">Status: ${(booking.paymentStatus || 'Pending').charAt(0).toUpperCase() + (booking.paymentStatus || 'Pending').slice(1).toLowerCase()}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to document
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Add event listener to close button
        const modal = document.getElementById('viewDetailsModal');
        const closeBtn = document.getElementById('closeDetails');
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });
    }
});
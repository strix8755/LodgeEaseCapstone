import { auth, db, confirmDraftBooking } from '../firebase.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { generateEmailTemplate } from './emailTemplate.js';
import { initializePaymentListeners } from './payment.js';
import { GCashPayment } from './gcashPayment.js';
import { doc, getDoc, collection, addDoc, Timestamp, updateDoc, query, where, getDocs, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Constants
const NIGHTLY_RATE = 6500;
const SERVICE_FEE_PERCENTAGE = 0.14;

// Auth state flag
let userAuthenticated = false;
let currentUser = null;
let pageInitialized = false; // Add flag to prevent duplicate initialization
let confirmButtonListenerAttached = false; // Add flag to track listener attachment
let paymentMethodListenersAttached = false; // Add flag to track payment method listeners
let validationListenersAttached = false; // Add flag to track validation listeners

// Get UI elements
const confirmButton = document.getElementById('confirm-button');
const paymentSuccessModal = document.getElementById('payment-success-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const loginButton = document.getElementById('loginButton');

// Initialize authentication listener immediately
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('User authenticated in payment page:', user.email);
        userAuthenticated = true;
        currentUser = user;
        
        // Hide login button when user is authenticated
        if (loginButton) {
            loginButton.style.display = 'none';
        }
        
        // Check for pending booking
        if (sessionStorage.getItem('pendingBooking')) {
            sessionStorage.removeItem('pendingBooking');
            handlePaymentSuccess();
        }
    } else {
        console.log('No user is signed in on payment page');
        userAuthenticated = false;
        currentUser = null;
        
        // Show login button when user is not authenticated
        if (loginButton) {
            loginButton.style.display = 'block';
        }
        
        // Redirect to login if not authenticated
        alert('Please log in to complete your booking');
        const returnUrl = encodeURIComponent(window.location.href);
        window.location.href = `../Login/index.html?redirect=${returnUrl}`;
    }
});

// Card input fields
const cardNumberInput = document.getElementById('card-number');
const cardExpirationInput = document.getElementById('card-expiration');
const cardCvvInput = document.getElementById('card-cvv');
const cardZipInput = document.getElementById('card-zip');
const cardCountrySelect = document.getElementById('card-country');

// Function to copy GCash number
function copyGcashNumber() {
  const gcashNumber = "0917 123 4567";
  navigator.clipboard.writeText(gcashNumber).then(() => {
    const copyMessage = document.getElementById('copyMessage');
    copyMessage.classList.remove('hidden');
    setTimeout(() => {
      copyMessage.classList.add('hidden');
    }, 2000);
  });
}
window.copyGcashNumber = copyGcashNumber;

// Update verification function to use same constants
function verifyBookingCosts(bookingData) {
    if (!bookingData.nightlyRate || !bookingData.numberOfNights) {
        throw new Error('Invalid booking data: missing rate information');
    }

    // Use the actual rate from the booking data instead of a constant
    const nightlyRate = bookingData.nightlyRate;
    const numberOfNights = bookingData.numberOfNights;
    
    // Recalculate using the same formula as in lodge files
    const subtotal = nightlyRate * numberOfNights;
    const serviceFee = Math.round(subtotal * SERVICE_FEE_PERCENTAGE);
    const totalPrice = subtotal + serviceFee;

    // Verify the calculations match
    if (Math.abs(bookingData.subtotal - subtotal) > 1 || 
        Math.abs(bookingData.serviceFee - serviceFee) > 1 || 
        Math.abs(bookingData.totalPrice - totalPrice) > 1) {
        console.warn('Price mismatch detected', {
            original: {
                subtotal: bookingData.subtotal,
                serviceFee: bookingData.serviceFee,
                totalPrice: bookingData.totalPrice
            },
            recalculated: {
                subtotal,
                serviceFee, 
                totalPrice
            }
        });
    }

    return {
        nightlyRate,
        subtotal,
        serviceFee,
        totalPrice
    };
}

function checkPaymentSelections() {
  const selectedPaymentType = document.querySelector('input[name="payment_type"]:checked');
  const selectedPaymentMethod = document.querySelector('input[name="payment_method"]:checked');

  // Check if payment method is card
  const isCardMethod = selectedPaymentMethod && selectedPaymentMethod.value === 'card';
  
  if (selectedPaymentType && selectedPaymentMethod) {
    // If card method, check if all card fields have some input
    if (isCardMethod) {
      const hasCardDetails = cardNumberInput.value.trim() !== '' &&
                             cardExpirationInput.value.trim() !== '' &&
                             cardCvvInput.value.trim() !== '' &&
                             cardZipInput.value.trim() !== '' &&
                             cardCountrySelect.value !== '';
      
      confirmButton.disabled = !hasCardDetails;
    } else {
      // For other payment methods, just need payment type and method
      confirmButton.disabled = false;
    }
  } else {
    confirmButton.disabled = true;
  }
}

// Function to attach confirm button event listener (only once)
function attachConfirmButtonListener() {
    if (confirmButtonListenerAttached || !confirmButton) {
        return; // Already attached or button doesn't exist
    }
    
    console.log('Attaching confirm button event listener');
    confirmButtonListenerAttached = true;
    
    confirmButton.addEventListener('click', async (event) => {
        event.preventDefault();
        
        // Re-validate form just before processing
        const isFormValidOnClick = validatePaymentForm();
        console.log(`[Debug] Click Handler - Is Form Valid (Initial Check): ${isFormValidOnClick}`); 
        if (!isFormValidOnClick) {
            console.warn('Confirm button clicked, but initial validation failed. Aborting.');
            alert('Please ensure you have selected a payment type and method, and completed any required fields.');
            return; // Prevent processing if form is invalid
        }
        
        // === Specific GCash Reference Check ===
        const selectedPaymentMethod = document.querySelector('input[name="payment_method"]:checked')?.value;
        if (selectedPaymentMethod === 'gcash') {
            const gcashRefInput = document.getElementById('gcash-reference');
            const gcashRefValue = gcashRefInput ? gcashRefInput.value.trim() : '';
            const minLength = 6; // Define minimum length for reference number
            if (gcashRefValue.length < minLength) {
                console.warn(`[Debug] GCash reference check failed. Length: ${gcashRefValue.length}, Required: ${minLength}`);
                alert(`Please enter a valid GCash reference number (at least ${minLength} characters).`);
                return; // Stop processing
            }
            console.log('[Debug] GCash reference check passed.');
        }
        // ====================================

        try {
            // Show processing state
            confirmButton.disabled = true;
            updateButtonText('Processing...');
            document.getElementById('loading-spinner').classList.remove('hidden');
            
            // Make sure we have a user
            if (!userAuthenticated || !currentUser) {
                console.log('Waiting for authentication...');
                // Wait a bit for auth to initialize if it hasn't already
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                if (!userAuthenticated || !currentUser) {
                    throw new Error('Authentication required');
                }
            }
            
            // Process the payment and create booking
            await processPaymentAndBooking();
            
            // Show success modal
            paymentSuccessModal.classList.remove('hidden');
        } catch (error) {
            console.error('Payment processing error:', error);
            alert(error.message || 'An error occurred during payment processing');
            
            // Reset button
            confirmButton.disabled = false;
            updateButtonText('Confirm and Pay');
            document.getElementById('loading-spinner').classList.add('hidden');
        } finally {
            // Clear the payment processing flag
            window.paymentInProgress = false;
        }
    });
}

// Close modal functionality
closeModalBtn.addEventListener('click', () => {
    paymentSuccessModal.classList.add('hidden');
    
    // Get booking ID before redirecting
    const bookingId = localStorage.getItem('currentBookingId');
    
    // Store booking confirmation in sessionStorage for dashboard to detect
    if (bookingId) {
        sessionStorage.setItem('bookingConfirmation', JSON.stringify({
            bookingId: bookingId,
            collection: 'everlodgebookings',
            timestamp: new Date().toISOString()
        }));
    }
    
    // Redirect to dashboard with booking ID parameter
    window.location.href = `../Dashboard/Dashboard.html${bookingId ? `?bookingId=${bookingId}` : ''}`;
});

// Initial state
confirmButton.disabled = true;

// Consolidate booking data handling
function getBookingData() {
    console.log('Getting booking data from localStorage');
    
    // Try to retrieve from multiple storage locations
    let rawBookingData = localStorage.getItem('tempBookingData');
    if (!rawBookingData) {
        console.log('tempBookingData not found, trying bookingData');
        rawBookingData = localStorage.getItem('bookingData');
    }
    
    // If still no data, look for older format
    if (!rawBookingData) {
        console.log('bookingData not found, trying currentBooking');
        rawBookingData = localStorage.getItem('currentBooking');
    }
    
    // Check if we have any data at this point
    if (!rawBookingData) {
        console.warn('No booking data found in any localStorage keys');
        return null;
    }
    
    console.log('Raw booking data found:', rawBookingData.substring(0, 100) + '...');
    
    try {
        // Parse the booking data
        const bookingData = JSON.parse(rawBookingData);
        
        // Log what we found
        console.log('Successfully parsed booking data with keys:', Object.keys(bookingData));
        
        // Backup to sessionStorage for persistence across page navigations
        sessionStorage.setItem('backupBookingData', rawBookingData);
        
        // Add timestamp check
        const createdAt = bookingData.createdAt;
        if (createdAt) {
            const createdDate = new Date(createdAt);
            const ageInMinutes = (new Date() - createdDate) / (1000 * 60);
            
            if (ageInMinutes > 30) {
                console.warn(`Booking data is ${Math.round(ageInMinutes)} minutes old, which may be stale`);
            } else {
                console.log(`Booking data is ${Math.round(ageInMinutes)} minutes old`);
            }
        }
        
        // Ensure date fields are properly formatted
        if (bookingData.checkIn) {
            // Handle different date formats
            if (typeof bookingData.checkIn === 'string') {
                console.log('Converting checkIn from string to Date');
                bookingData.checkIn = new Date(bookingData.checkIn);
            } else if (bookingData.checkIn.seconds && bookingData.checkIn.nanoseconds) {
                console.log('Converting checkIn from Firestore Timestamp to Date');
                bookingData.checkIn = new Date(bookingData.checkIn.seconds * 1000);
            }
        }
        
        if (bookingData.checkOut) {
            // Handle different date formats
            if (typeof bookingData.checkOut === 'string') {
                console.log('Converting checkOut from string to Date');
                bookingData.checkOut = new Date(bookingData.checkOut);
            } else if (bookingData.checkOut.seconds && bookingData.checkOut.nanoseconds) {
                console.log('Converting checkOut from Firestore Timestamp to Date');
                bookingData.checkOut = new Date(bookingData.checkOut.seconds * 1000);
            }
        }
        
        // Ensure numeric values are numbers
        if (bookingData.nightlyRate && typeof bookingData.nightlyRate !== 'number') {
            bookingData.nightlyRate = parseFloat(bookingData.nightlyRate);
        }
        
        if (bookingData.totalPrice && typeof bookingData.totalPrice !== 'number') {
            bookingData.totalPrice = parseFloat(bookingData.totalPrice);
        }
        
        if (bookingData.serviceFee && typeof bookingData.serviceFee !== 'number') {
            bookingData.serviceFee = parseFloat(bookingData.serviceFee);
        }
        
        if (bookingData.subtotal && typeof bookingData.subtotal !== 'number') {
            bookingData.subtotal = parseFloat(bookingData.subtotal);
        }
        
        if (bookingData.guests && typeof bookingData.guests !== 'number') {
            bookingData.guests = parseInt(bookingData.guests, 10);
        }
        
        // Calculate numberOfNights if not provided
        if (!bookingData.numberOfNights && bookingData.checkIn && bookingData.checkOut) {
            bookingData.numberOfNights = calculateNights(bookingData.checkIn, bookingData.checkOut);
        }
        
        // Ensure contact information is available
        if (!bookingData.contactNumber) {
            console.warn('Contact number missing from booking data');
        }
        
        console.log('Final processed booking data:', bookingData);
        return bookingData;
    } catch (error) {
        console.error('Error parsing booking data:', error);
        return null;
    }
}

// Single function to initialize page
function initializePage() {
    // Prevent duplicate initialization
    if (pageInitialized) {
        console.log('Page already initialized, skipping duplicate call');
        return;
    }
    
    console.log('Initializing payment page');
    pageInitialized = true; // Set flag to prevent duplicate calls
    
    // Clear any default values first
    clearDefaultSummaryValues();
    
    // Get URL parameters
    const bookingId = getUrlParameter('bookingId');
    const source = getUrlParameter('source');
    
    let bookingData = null;
    
    if (bookingId && source === 'draft') {
        // Fetch booking from Firebase draftBookings collection
        console.log('Attempting to fetch booking from Firebase with ID:', bookingId);
        
        fetchDraftBookingFromFirebase(bookingId)
            .then(fetchedBookingData => {
                if (fetchedBookingData) {
                    // Set up page with the Firebase booking data
                    bookingData = fetchedBookingData;
                    setupPageWithBookingData(bookingData);
                    
                    // Store the booking ID for later use
                    localStorage.setItem('tempBookingId', bookingId);
                } else {
                    // Fallback to localStorage if Firebase lookup fails
                    console.warn('Firebase lookup failed, falling back to localStorage');
                    const storedData = getBookingData();
                    if (storedData) {
                        bookingData = storedData;
                        setupPageWithBookingData(bookingData);
                    } else {
                        console.error('No booking data found in Firebase or localStorage');
                        alert('Could not retrieve your booking information. Please try again.');
                        window.location.href = '../Homepage/rooms.html';
                    }
                }
            })
            .catch(error => {
                console.error('Error fetching draft booking:', error);
                throw error;
            });
    } else {
        // Fallback to localStorage
        console.log('No Firebase ID or source provided, using localStorage');
        const storedData = getBookingData();
        if (storedData) {
            bookingData = storedData;
            setupPageWithBookingData(bookingData);
        } else {
            alert('Could not retrieve your booking information. Please try again.');
            window.location.href = '../Homepage/rooms.html';
        }
    }
}

// New consolidated function to set up the page with booking data
function setupPageWithBookingData(bookingData) {
    console.log('Setting up page with booking data:', bookingData);
    
    // Set up all components (these functions now have their own duplicate prevention flags)
    setupPaymentHandlers(bookingData);
    updateSummaryDisplay(bookingData);
    setupPaymentOptions(bookingData);
    setupPaymentMethodListeners();
    addValidationListeners();
}

// Setup payment handlers
function setupPaymentHandlers(bookingData) {
    console.log('Setting up payment handlers with booking data:', bookingData);
    
    // Attach confirm button listener (only once)
    attachConfirmButtonListener();
    
    // Add button validation
    validatePaymentForm();
}

// Validate payment form fields
function validatePaymentForm() {
    console.log('Validating payment form');
    
    const confirmButton = document.getElementById('confirm-button');
    if (!confirmButton) {
        console.warn('Confirm button not found for validation');
        return false;
    }
    
    // Get selected payment method
    const selectedPaymentMethod = document.querySelector('input[name="payment_method"]:checked');
    if (!selectedPaymentMethod) {
        console.warn('No payment method selected');
        confirmButton.disabled = true;
        return false;
    }
    
    // Get selected payment type
    const selectedPaymentType = document.querySelector('input[name="payment_type"]:checked');
    if (!selectedPaymentType) {
        console.warn('No payment type selected');
        confirmButton.disabled = true;
        return false;
    }
    
    const paymentMethod = selectedPaymentMethod.value;
    console.log('Selected payment method:', paymentMethod);
    
    // Check validation based on payment method
    let isValid = false;
    
    if (paymentMethod === 'card') {
        const cardInputs = [
            document.getElementById('card-number'),
            document.getElementById('card-expiration'),
            document.getElementById('card-cvv'),
            document.getElementById('card-zip'),
            document.getElementById('card-country')
        ];
        
        const allFieldsFilled = cardInputs.every(input => {
            if (!input) {
                console.warn(`Card input field not found: ${input}`);
                return false;
            }
            return input.value.trim() !== '';
        });
        
        isValid = allFieldsFilled;
        confirmButton.disabled = !isValid;
        console.log('Card validation result:', isValid);
        
    } else if (paymentMethod === 'gcash') {
        const gcashRef = document.getElementById('gcash-reference');
        isValid = gcashRef && gcashRef.value.trim() !== '';
        confirmButton.disabled = !isValid;
        console.log('GCash validation result:', isValid);
        
    } else if (paymentMethod === 'paypal') {
        // PayPal doesn't need any additional validation
        isValid = true;
        confirmButton.disabled = false;
        console.log('PayPal selected, no validation needed');
    }
    
    return isValid;
}

// Add input listeners for form validation
function addValidationListeners() {
    // Prevent multiple executions
    if (validationListenersAttached) {
        console.log('Validation listeners already attached, skipping');
        return;
    }
    
    console.log('Setting up validation listeners');
    validationListenersAttached = true;
    
    const cardInputs = [
        document.getElementById('card-number'),
        document.getElementById('card-expiration'),
        document.getElementById('card-cvv'),
        document.getElementById('card-zip'),
        document.getElementById('card-country')
    ];
    
    const gcashRef = document.getElementById('gcash-reference');
    
    // Add event listeners to card inputs
    cardInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', validatePaymentForm);
            console.log('Added validation listener to', input.id);
        }
    });
    
    // Add event listener to GCash reference
    if (gcashRef) {
        gcashRef.addEventListener('input', validatePaymentForm);
        console.log('Added validation listener to gcash-reference');
    }
    
    // Add event listeners to payment method radio buttons
    const paymentMethods = document.querySelectorAll('input[name="payment_method"]');
    paymentMethods.forEach(method => {
        if (method) {
            method.addEventListener('change', validatePaymentForm);
            console.log('Added validation listener to payment method:', method.value);
        }
    });
}

function updateSummaryDisplay(bookingData) {
    console.log('updateSummaryDisplay called with:', bookingData);
    if (!bookingData) {
        console.error('No booking data provided to updateSummaryDisplay');
        return;
    }

    try {
        // Format dates for display with time
        const formatDate = (date) => {
            console.log('Formatting date:', date);
            if (!date) {
                console.warn('Invalid date provided for formatting');
                return 'N/A';
            }
            
            let dateObj = date;
            if (typeof date === 'string') {
                console.log('Converting string date to Date object:', date);
                dateObj = new Date(date);
            }
            
            if (dateObj instanceof Date && !isNaN(dateObj)) {
                // Format with date and time
                const dateOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
                const timeOptions = { hour: 'numeric', minute: 'numeric', hour12: true };
                
                return `${dateObj.toLocaleDateString('en-US', dateOptions)}, ${dateObj.toLocaleTimeString('en-US', timeOptions)}`;
            } else {
                console.warn('Invalid date after conversion:', dateObj);
                return 'Invalid Date';
            }
        };

        // Define currency symbol - use Philippine Peso (₱)
        const currencySymbol = '₱';

        // Update check-in date
        const checkInElement = document.getElementById('summary-checkin');
        if (checkInElement) {
            checkInElement.textContent = formatDate(bookingData.checkIn);
            console.log('Updated check-in date:', checkInElement.textContent);
        } else {
            console.warn('Element summary-checkin not found');
        }

        // Update check-out date
        const checkOutElement = document.getElementById('summary-checkout');
        if (checkOutElement) {
            checkOutElement.textContent = formatDate(bookingData.checkOut);
            console.log('Updated check-out date:', checkOutElement.textContent);
        } else {
            console.warn('Element summary-checkout not found');
        }

        // Update guests
        const guestsElement = document.getElementById('summary-guests');
        if (guestsElement) {
            guestsElement.textContent = bookingData.guests ? `${bookingData.guests} guest${bookingData.guests !== 1 ? 's' : ''}` : 'N/A';
            console.log('Updated guests:', guestsElement.textContent);
        } else {
            console.warn('Element summary-guests not found');
        }

        // Update contact - prioritize contact number from the booking data
        const contactElement = document.getElementById('summary-contact');
        if (contactElement) {
            contactElement.textContent = bookingData.contactNumber || bookingData.contact || bookingData.email || 'N/A';
            console.log('Updated contact:', contactElement.textContent);
        } else {
            console.warn('Element summary-contact not found');
        }

        // Calculate and display nights or hours based on booking type
        const nightsElement = document.getElementById('summary-nights');
        if (nightsElement) {
            if (bookingData.isHourlyRate || bookingData.bookingType === 'hourly') {
                // For hourly bookings
                const hours = bookingData.duration || 
                    (bookingData.numberOfHours || 
                        Math.ceil(Math.abs(new Date(bookingData.checkOut) - new Date(bookingData.checkIn)) / (1000 * 60 * 60)));
                
                nightsElement.textContent = `${hours} hour${hours !== 1 ? 's' : ''}`;
            } else {
                // For nightly bookings
                const nights = bookingData.numberOfNights || 
                    Math.ceil(Math.abs(new Date(bookingData.checkOut) - new Date(bookingData.checkIn)) / (1000 * 60 * 60 * 24));
                
                nightsElement.textContent = `${nights} night${nights !== 1 ? 's' : ''}`;
            }
            console.log('Updated length of stay:', nightsElement.textContent);
        } else {
            console.warn('Element summary-nights not found');
        }

        // Update rate per night/hour
        const rateElement = document.getElementById('summary-rate');
        if (rateElement) {
            if (bookingData.isHourlyRate || bookingData.bookingType === 'hourly') {
                // Use hourly rate
                rateElement.textContent = `${currencySymbol}${bookingData.hourlyRate || 
                    (bookingData.subtotal / bookingData.duration) || 
                    bookingData.nightlyRate || 0}`;
            } else {
                // Use nightly rate
                rateElement.textContent = `${currencySymbol}${bookingData.nightlyRate || 0}`;
            }
            console.log('Updated rate:', rateElement.textContent);
        } else {
            console.warn('Element summary-rate not found');
        }

        // Update subtotal
        const subtotalElement = document.getElementById('summary-subtotal');
        if (subtotalElement) {
            subtotalElement.textContent = `${currencySymbol}${bookingData.subtotal || 0}`;
            console.log('Updated subtotal:', subtotalElement.textContent);
        } else {
            console.warn('Element summary-subtotal not found');
        }

        // Update service fee
        const feeElement = document.getElementById('summary-fee');
        if (feeElement) {
            feeElement.textContent = `${currencySymbol}${bookingData.serviceFee || 0}`;
            console.log('Updated service fee:', feeElement.textContent);
        } else {
            console.warn('Element summary-fee not found');
        }

        // Update total price
        const totalElement = document.getElementById('summary-total');
        if (totalElement) {
            totalElement.textContent = `${currencySymbol}${bookingData.totalPrice || 0}`;
            console.log('Updated total price:', totalElement.textContent);
        } else {
            console.warn('Element summary-total not found');
        }

        // Update payment options
        updatePaymentAmounts(bookingData.totalPrice || 0);
    } catch (error) {
        console.error('Error updating summary display:', error);
    }
}

function updatePaymentAmounts(totalPrice) {
    console.log('Updating payment amounts with total:', totalPrice); // Debug log
    
    // Ensure totalPrice is a number
    if (typeof totalPrice !== 'number' || isNaN(totalPrice)) {
        totalPrice = 0;
        console.warn('Invalid totalPrice provided to updatePaymentAmounts, using 0');
    }
    
    const payNowAmount = document.getElementById('pay-now-amount');
    const payLaterFirst = document.getElementById('pay-later-first');
    const payLaterSecond = document.getElementById('pay-later-second');
    
    if (payNowAmount) payNowAmount.textContent = `₱${totalPrice.toLocaleString()}`;
    
    const firstPayment = Math.round(totalPrice / 2);
    const secondPayment = totalPrice - firstPayment;
    
    if (payLaterFirst) payLaterFirst.textContent = `₱${firstPayment.toLocaleString()}`;
    if (payLaterSecond) payLaterSecond.textContent = `₱${secondPayment.toLocaleString()}`;
}

// Function to redirect after successful booking confirmation
function redirectAfterBookingConfirmation(bookingId) {
    try {
        console.log('Redirecting to dashboard with booking ID:', bookingId);
        
        if (!bookingId) {
            console.error('ERROR: No bookingId provided to redirectAfterBookingConfirmation');
            window.location.href = '../Dashboard/Dashboard.html';
            return;
        }
        
        // DIAGNOSTIC: Log all data we're about to store
        console.log('================ BOOKING DATA DIAGNOSTIC ================');
        console.log('Preparing to store booking ID:', bookingId);
        console.log('localStorage before:', {
            currentBookingId: localStorage.getItem('currentBookingId'),
            lastConfirmedBookingId: localStorage.getItem('lastConfirmedBookingId'),
            dashboard_pendingBookingId: localStorage.getItem('dashboard_pendingBookingId'),
            currentBooking: localStorage.getItem('currentBooking')
        });
        console.log('sessionStorage before:', {
            bookingConfirmation: sessionStorage.getItem('bookingConfirmation'),
            backupBookingData: sessionStorage.getItem('backupBookingData')
        });
        
        // Store booking ID in multiple places to ensure it gets passed
        // 1. In localStorage (multiple keys for redundancy)
        localStorage.setItem('currentBookingId', bookingId);
        localStorage.setItem('lastConfirmedBookingId', bookingId);
        localStorage.setItem('dashboard_pendingBookingId', bookingId);
        
        // 2. In sessionStorage
        sessionStorage.setItem('bookingConfirmation', JSON.stringify({
            bookingId: bookingId,
            collection: 'everlodgebookings',
            status: 'pending', // Explicitly set status to pending
            timestamp: new Date().toISOString()
        }));
        
        // 3. Ensure the URL includes the bookingId parameter
        // Create a base URL with query params
        let redirectUrl = `../Dashboard/Dashboard.html?bookingId=${bookingId}&collection=everlodgebookings&status=pending`;
        
        // Add the same parameters as a hash (more reliable across some redirects)
        redirectUrl += `#bookingId=${bookingId}&collection=everlodgebookings&status=pending`;
        
        // DIAGNOSTIC: Log after storage
        console.log('localStorage after setting data:', {
            currentBookingId: localStorage.getItem('currentBookingId'),
            lastConfirmedBookingId: localStorage.getItem('lastConfirmedBookingId'),
            dashboard_pendingBookingId: localStorage.getItem('dashboard_pendingBookingId'),
            currentBooking: localStorage.getItem('currentBooking')
        });
        console.log('sessionStorage after setting data:', {
            bookingConfirmation: sessionStorage.getItem('bookingConfirmation'),
            backupBookingData: sessionStorage.getItem('backupBookingData')
        });
        console.log('Redirect URL:', redirectUrl);
        
        // 4. Fetch and store the complete booking data before redirecting
        try {
            // Initialize db if not already available
            const db = firebase.firestore ? firebase.firestore() : null;
            if (!db) {
                console.error('Firestore not initialized');
                window.location.href = redirectUrl;
                return;
            }
            
            console.log('Fetching booking data before redirect...');
            const bookingRef = db.collection('everlodgebookings').doc(bookingId);
            
            bookingRef.get().then(bookingDoc => {
                if (bookingDoc.exists) {
                    const bookingData = {
                        id: bookingDoc.id,
                        ...bookingDoc.data()
                    };
                    
                    console.log('Successfully retrieved booking data:', bookingData);
                    
                    // Ensure the status is set to pending
                    bookingData.status = 'pending';
                    
                    // Format dates for consistent display
                    if (bookingData.checkIn) {
                        if (typeof bookingData.checkIn === 'string') {
                            // Already a string, no conversion needed
                        } else if (bookingData.checkIn.seconds) {
                            // Firebase timestamp format
                            bookingData.checkIn = new Date(bookingData.checkIn.seconds * 1000).toISOString();
                        } else if (bookingData.checkIn.toDate && typeof bookingData.checkIn.toDate === 'function') {
                            // Firestore Timestamp object
                            bookingData.checkIn = bookingData.checkIn.toDate().toISOString();
                        } else if (bookingData.checkIn instanceof Date) {
                            // Date object
                            bookingData.checkIn = bookingData.checkIn.toISOString();
                        }
                    }

                    if (bookingData.checkOut) {
                        if (typeof bookingData.checkOut === 'string') {
                            // Already a string, no conversion needed
                        } else if (bookingData.checkOut.seconds) {
                            // Firebase timestamp format
                            bookingData.checkOut = new Date(bookingData.checkOut.seconds * 1000).toISOString();
                        } else if (bookingData.checkOut.toDate && typeof bookingData.checkOut.toDate === 'function') {
                            // Firestore Timestamp object
                            bookingData.checkOut = bookingData.checkOut.toDate().toISOString();
                        } else if (bookingData.checkOut instanceof Date) {
                            // Date object
                            bookingData.checkOut = bookingData.checkOut.toISOString();
                        }
                    }
                    
                    // Store the complete booking data in localStorage
                    localStorage.setItem('currentBooking', JSON.stringify(bookingData));
                    
                    // Also store in sessionStorage for redundancy
                    sessionStorage.setItem('backupBookingData', JSON.stringify(bookingData));
                    
                    console.log('Successfully stored complete booking data before redirect');
                    console.log('Final localStorage:', {
                        currentBookingId: localStorage.getItem('currentBookingId'),
                        lastConfirmedBookingId: localStorage.getItem('lastConfirmedBookingId'),
                        dashboard_pendingBookingId: localStorage.getItem('dashboard_pendingBookingId'),
                        currentBooking: localStorage.getItem('currentBooking')
                    });
                    console.log('Final sessionStorage:', {
                        bookingConfirmation: sessionStorage.getItem('bookingConfirmation'),
                        backupBookingData: sessionStorage.getItem('backupBookingData')
                    });
                    
                    // Now redirect with all the data stored
                    console.log('REDIRECTING NOW to:', redirectUrl);
                    window.location.href = redirectUrl;
                } else {
                    console.warn('Booking document not found, redirecting without complete data');
                    window.location.href = redirectUrl;
                }
            }).catch(error => {
                console.error('Error fetching booking before redirect:', error);
                window.location.href = redirectUrl;
            });
        } catch (fetchError) {
            console.error('Error setting up fetch for booking data:', fetchError);
            window.location.href = redirectUrl;
        }
    } catch (error) {
        console.error('Error redirecting after booking confirmation:', error);
        // Fallback redirect without parameters
        window.location.href = '../Dashboard/Dashboard.html';
    }
}

// Add missing setBookingStatus function before processPaymentAndBooking
function setBookingStatus(status) {
    try {
        console.log(`Setting booking status to: ${status}`);
        
        // Store the status in localStorage for reference
        localStorage.setItem('bookingStatus', status);
        
        // Get the booking ID
        const bookingId = localStorage.getItem('currentBookingId') || 
                         localStorage.getItem('tempBookingId');
        
        // If we have a bookingId, update the status in Firestore if needed
        if (bookingId) {
            // This is just a local state change, actual database update is done in processPaymentAndBooking
            console.log(`Booking ${bookingId} status set to ${status} locally`);
        }
    } catch (error) {
        console.error('Error setting booking status:', error);
    }
}

// Add missing showSuccessMessage function
function showSuccessMessage(message) {
    try {
        console.log('Showing success message:', message);
        
        // Display the success modal
        const successModal = document.getElementById('payment-success-modal');
        if (successModal) {
            // Update message text if there's a message element
            const messageElement = successModal.querySelector('p');
            if (messageElement) {
                messageElement.textContent = message;
            }
            
            // Show the modal
            successModal.classList.remove('hidden');
        } else {
            // Fallback to alert if modal not found
            alert(message);
        }
    } catch (error) {
        console.error('Error showing success message:', error);
        // Fallback
        alert(message);
    }
}

// Add the missing enableButton function
function enableButton(buttonId, isEnabled) {
    try {
        console.log(`Setting button ${buttonId} enabled state to: ${isEnabled}`);
        const button = document.getElementById(buttonId);
        
        if (button) {
            button.disabled = !isEnabled;
            
            // Optional: add visual indication of disabled state
            if (isEnabled) {
                button.classList.remove('opacity-50', 'cursor-not-allowed');
            } else {
                button.classList.add('opacity-50', 'cursor-not-allowed');
            }
        } else {
            console.warn(`Button with ID ${buttonId} not found`);
        }
    } catch (error) {
        console.error('Error enabling/disabling button:', error);
    }
}

// Add helper function to update button text
function updateButtonText(text) {
    try {
        const buttonTextElement = document.getElementById("button-text");
        if (buttonTextElement) {
            buttonTextElement.textContent = text;
        } else {
            console.warn("Button text element with ID 'button-text' not found");
        }
    } catch (error) {
        console.error('Error updating button text:', error);
    }
}

async function processPaymentAndBooking() {
    // Enhanced locking mechanism with immediate checks
    const lockKey = 'paymentProcessingLock';
    const processingFlagKey = 'paymentInProgress';
    const currentTime = Date.now();
    
    // Check multiple lock conditions immediately
    if (window.paymentInProgress) {
        console.log('Payment already in progress (window flag), ignoring duplicate call');
        return;
    }
    
    if (localStorage.getItem(processingFlagKey) === 'true') {
        console.log('Payment already in progress (localStorage flag), ignoring duplicate call');
        return;
    }
    
    const existingLock = localStorage.getItem(lockKey);
    if (existingLock) {
        const lockTime = parseInt(existingLock);
        if (currentTime - lockTime < 30000) { // 30 seconds
            console.log('Payment processing is locked by another process, ignoring request');
            return;
        }
    }
    
    // Set multiple locks immediately
    window.paymentInProgress = true;
    localStorage.setItem(lockKey, currentTime.toString());
    localStorage.setItem(processingFlagKey, 'true');
    
    try {
        console.log('Processing payment and booking...');
        
        // Disable the confirm button immediately to prevent additional clicks
        const confirmButton = document.getElementById('confirm-button');
        if (confirmButton) {
            confirmButton.disabled = true;
        }
        
        // Get the user and booking data
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('User not authenticated');
        }

        const bookingData = getBookingData();
        
        // Validate booking data
        if (!bookingData) {
            throw new Error('No booking data found');
        }

        // Validate payment form
        if (!validatePaymentForm()) {
            throw new Error('Payment form validation failed');
        }

        // Get payment method and data
        const paymentMethod = document.querySelector('input[name="payment_method"]:checked').value;
        const paymentData = {
            method: paymentMethod,
            status: 'pending',
            submittedAt: new Date().toISOString(),
            details: {}
        };

        // Add method-specific details
        if (paymentMethod === 'gcash') {
            const referenceNumber = document.getElementById('gcash-reference').value.trim();
            if (!referenceNumber) {
                throw new Error('GCash reference number is required');
            }
            paymentData.details.referenceNumber = referenceNumber;
        } else if (paymentMethod === 'maya') {
            const referenceNumber = document.getElementById('maya-reference').value.trim();
            if (!referenceNumber) {
                throw new Error('Maya reference number is required');
            }
            paymentData.details.referenceNumber = referenceNumber;
        }

        console.log('Payment data:', paymentData);
        
        // Set button state
        enableButton("confirm-button", false);
        updateButtonText("Processing...");
        
        // Show loading spinner
        const loadingSpinner = document.getElementById('loading-spinner');
        if (loadingSpinner) {
            loadingSpinner.classList.remove('hidden');
        }
        
        let confirmedBookingId = null;
        
        // Check if this is a draft booking from Firebase
        const bookingId = getUrlParameter('bookingId');
        
        if (bookingId) {
            // Handle draft booking from Firebase
            console.log('Processing draft booking from Firebase:', bookingId);
            
            // Check if this booking was already processed
            const processedBookings = JSON.parse(localStorage.getItem('processedBookings') || '[]');
            if (processedBookings.includes(bookingId)) {
                throw new Error('This booking has already been processed. Please check your booking history.');
            }
            
            try {
                // Get the draft booking
                const draftBookingRef = doc(db, 'draftBookings', bookingId);
                const draftBookingDoc = await getDoc(draftBookingRef);
                
                if (draftBookingDoc.exists()) {
                    console.log('Draft booking found, confirming...');
                    
                    // Update the draft booking with payment details
                    await updateDoc(draftBookingRef, {
                        paymentDetails: paymentData,
                        paymentStatus: 'pending',
                        status: 'pending',
                        updatedAt: Timestamp.now()
                    });
                    
                    // Use confirmDraftBooking to move to everlodgebookings (this creates only ONE booking)
                    confirmedBookingId = await confirmDraftBooking(bookingId);
                    console.log('Booking confirmed with ID:', confirmedBookingId);
                    
                    // Mark this booking as processed immediately
                    processedBookings.push(bookingId);
                    localStorage.setItem('processedBookings', JSON.stringify(processedBookings));
                } else {
                    // Check if it was already confirmed
                    const bookingsRef = collection(db, 'everlodgebookings');
                    const q = query(bookingsRef, where("originalDraftId", "==", bookingId));
                    const existingBookings = await getDocs(q);
                    
                    if (!existingBookings.empty) {
                        console.log('Booking was already confirmed, using existing booking');
                        confirmedBookingId = existingBookings.docs[0].id;
                        
                        // Mark as processed to prevent future duplicates
                        processedBookings.push(bookingId);
                        localStorage.setItem('processedBookings', JSON.stringify(processedBookings));
                    } else {
                        console.warn('Draft booking document does not exist, creating new booking directly');
                        
                        // Create a new booking document directly in everlodgebookings (ONLY ONE)
                        const bookingsRef = collection(db, 'everlodgebookings');
                        const docRef = await addDoc(bookingsRef, {
                            ...bookingData,
                            paymentDetails: paymentData,
                            paymentStatus: 'pending',
                            status: 'pending',
                            originalDraftId: bookingId, // Track the original draft ID
                            createdAt: Timestamp.now()
                        });
                        
                        confirmedBookingId = docRef.id;
                        console.log('New booking created with ID:', confirmedBookingId);
                        
                        // Mark as processed
                        processedBookings.push(bookingId);
                        localStorage.setItem('processedBookings', JSON.stringify(processedBookings));
                    }
                }
            } catch (error) {
                console.error('Error processing draft booking:', error);
                // If ALL attempts fail, throw the error instead of creating duplicates
                throw new Error('Failed to process booking: ' + error.message);
            }
        } else {
            // Regular localStorage-based booking (ONLY ONE booking creation)
            console.log('Creating new booking from localStorage data');
            
            // Generate a unique booking identifier to prevent duplicates
            const bookingIdentifier = `${currentUser.uid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Check if we've already created a booking for this session
            const sessionBookingId = sessionStorage.getItem('currentSessionBookingId');
            if (sessionBookingId) {
                console.log('Booking already created in this session:', sessionBookingId);
                confirmedBookingId = sessionBookingId;
            } else {
                // Ensure the appropriate date format for Firestore
                const formattedBooking = {
                    ...bookingData,
                    bookingIdentifier, // Add unique identifier
                    checkIn: bookingData.checkIn instanceof Date ? 
                            Timestamp.fromDate(bookingData.checkIn) : 
                            Timestamp.fromDate(new Date(bookingData.checkIn)),
                    checkOut: bookingData.checkOut instanceof Date ? 
                             Timestamp.fromDate(bookingData.checkOut) : 
                             Timestamp.fromDate(new Date(bookingData.checkOut)),
                    createdAt: Timestamp.now(),
                    paymentDetails: paymentData,
                    paymentStatus: 'pending',
                    status: 'pending'
                };
                
                // Add booking document to Firebase (ONLY ONE)
                const bookingsRef = collection(db, 'everlodgebookings');
                const docRef = await addDoc(bookingsRef, formattedBooking);
                confirmedBookingId = docRef.id;
                console.log('New booking created with ID:', confirmedBookingId);
                
                // Store in session to prevent duplicates in the same session
                sessionStorage.setItem('currentSessionBookingId', confirmedBookingId);
            }
        }
        
        // Store the confirmed booking ID
        localStorage.setItem('currentBookingId', confirmedBookingId);
        
        // Send booking confirmation email and create booking request
        try {
            // Get reference number if it exists in the payment data
            const referenceNumber = paymentMethod === 'gcash' ? 
                                  paymentData.details.referenceNumber : 
                                  '';
            
            // Create verification request with all necessary booking information
            await createPaymentVerificationRequest(confirmedBookingId, {
                userId: bookingData.userId,
                email: bookingData.email || currentUser.email,
                bookingRef: confirmedBookingId,
                paymentStatus: 'pending',
                referenceNumber: referenceNumber,
                paymentMethod: paymentMethod,
                method: paymentMethod, // Add explicit method property for redundancy
                amount: bookingData.totalPrice,
                // Include additional booking information
                bookingDetails: bookingData
            });
        } catch (error) {
            console.error('Error creating verification request:', error);
            // Continue even if this fails
        }
        
        // After successful booking creation
        if (confirmedBookingId) {
            // Store the confirmed booking ID immediately for later retrieval
            localStorage.setItem('currentBookingId', confirmedBookingId);
            console.log('Stored currentBookingId in localStorage:', confirmedBookingId);
            
            // Create notification for admin
            try {
                await createBookingNotification(confirmedBookingId, bookingData);
            } catch (error) {
                console.error('Error creating notification:', error);
                // Don't fail the booking process if notification creation fails
            }
            
            // Store booking data in session storage as a backup for the dashboard
            try {
                // Get the current booking data
                const bookingDataForStorage = {
                    ...bookingData,
                    id: confirmedBookingId,
                    status: 'pending',
                    paymentDetails: paymentData
                };
                
                // Format dates for storage - handle all possible formats
                if (bookingDataForStorage.checkIn) {
                    if (typeof bookingDataForStorage.checkIn === 'string') {
                        // Already a string, no conversion needed
                    } else if (bookingDataForStorage.checkIn.seconds) {
                        // Firebase timestamp format
                        bookingDataForStorage.checkIn = new Date(bookingDataForStorage.checkIn.seconds * 1000).toISOString();
                    } else if (bookingDataForStorage.checkIn.toDate && typeof bookingDataForStorage.checkIn.toDate === 'function') {
                        // Firestore Timestamp object
                        bookingDataForStorage.checkIn = bookingDataForStorage.checkIn.toDate().toISOString();
                    } else if (bookingDataForStorage.checkIn instanceof Date) {
                        // Date object
                        bookingDataForStorage.checkIn = bookingDataForStorage.checkIn.toISOString();
                    }
                }

                if (bookingDataForStorage.checkOut) {
                    if (typeof bookingDataForStorage.checkOut === 'string') {
                        // Already a string, no conversion needed
                    } else if (bookingDataForStorage.checkOut.seconds) {
                        // Firebase timestamp format
                        bookingDataForStorage.checkOut = new Date(bookingDataForStorage.checkOut.seconds * 1000).toISOString();
                    } else if (bookingDataForStorage.checkOut.toDate && typeof bookingDataForStorage.checkOut.toDate === 'function') {
                        // Firestore Timestamp object
                        bookingDataForStorage.checkOut = bookingDataForStorage.checkOut.toDate().toISOString();
                    } else if (bookingDataForStorage.checkOut instanceof Date) {
                        // Date object
                        bookingDataForStorage.checkOut = bookingDataForStorage.checkOut.toISOString();
                    }
                }
                
                // Store in both localStorage and sessionStorage for redundancy
                localStorage.setItem('currentBooking', JSON.stringify(bookingDataForStorage));
                sessionStorage.setItem('backupBookingData', JSON.stringify(bookingDataForStorage));
                console.log('Booking data stored for dashboard:', bookingDataForStorage);
            } catch (storageError) {
                console.error('Error storing booking data:', storageError);
            }
            
            setBookingStatus('pending');
            showSuccessMessage(`Payment submitted! Your booking is pending approval. Booking reference: ${confirmedBookingId}`);
            enableButton("confirm-button", false);
            
            // Hide loading spinner on success
            const loadingSpinner = document.getElementById('loading-spinner');
            if (loadingSpinner) {
                loadingSpinner.classList.add('hidden');
            }
            
            // Clear booking data after successful processing
            localStorage.removeItem('tempBookingData');
            localStorage.removeItem('tempBookingId');
            localStorage.removeItem('currentSessionDraftId');
            
            // Clear all payment processing flags
            window.paymentInProgress = false;
            localStorage.removeItem(lockKey);
            localStorage.removeItem('paymentInProgress');
            
            // Redirect to success page
            setTimeout(() => {
                if (bookingData.isHourlyRate) {
                    redirectAfterBookingConfirmation('hourly');
                } else {
                    redirectAfterBookingConfirmation(confirmedBookingId);
                }
            }, 2000);
            
            return confirmedBookingId;
        }
        
        return confirmedBookingId;
    } catch (error) {
        console.error('Error in processPaymentAndBooking:', error);
        
        // Clear all payment processing flags on error
        window.paymentInProgress = false;
        localStorage.removeItem(lockKey);
        localStorage.removeItem('paymentInProgress');
        
        // Reset button state on error
        enableButton("confirm-button", true);
        updateButtonText("Confirm and Pay");
        document.getElementById('loading-spinner').classList.add('hidden');
        throw error;
    }
}

// New function to create payment verification request
async function createPaymentVerificationRequest(bookingId, paymentData) {
    try {
        // Get the booking details first
        const bookingRef = doc(db, 'everlodgebookings', bookingId);
        const bookingDoc = await getDoc(bookingRef);
        
        if (!bookingDoc.exists()) {
            console.error('Booking not found:', bookingId);
            throw new Error('Booking not found');
        }

        const bookingDetails = bookingDoc.data();
        
        // Format the check-in and check-out dates properly
        if (bookingDetails.checkIn && !(bookingDetails.checkIn instanceof Timestamp)) {
            bookingDetails.checkIn = Timestamp.fromDate(new Date(bookingDetails.checkIn));
        }
        
        if (bookingDetails.checkOut && !(bookingDetails.checkOut instanceof Timestamp)) {
            bookingDetails.checkOut = Timestamp.fromDate(new Date(bookingDetails.checkOut));
        }
        
        // Get the reference number from payment details if available
        const referenceNumber = bookingDetails?.paymentDetails?.details?.referenceNumber || 
                              bookingDetails?.paymentDetails?.referenceNumber || 
                              paymentData.referenceNumber ||
                              '';
        
        // Get the payment method from all possible locations
        let paymentMethod = '';
        
        // First check from direct paymentData
        if (paymentData.paymentMethod) {
            paymentMethod = paymentData.paymentMethod;
        } else if (paymentData.method) {
            paymentMethod = paymentData.method;
        } else if (bookingDetails?.paymentDetails?.method) {
            paymentMethod = bookingDetails.paymentDetails.method;
        } else {
            // Default to gcash if not available
            paymentMethod = 'gcash';
        }
        
        console.log('Reference number for verification request:', referenceNumber);
        console.log('Payment method for verification request:', paymentMethod);
        
        // Create payment verification request with booking details
        const paymentVerificationRef = collection(db, 'paymentVerificationRequests');
        const verificationData = {
            bookingId: bookingId, // Add bookingId at the top level for easier querying
            bookingDetails: {
                id: bookingId,
                checkIn: bookingDetails.checkIn || null,
                checkOut: bookingDetails.checkOut || null,
                propertyDetails: bookingDetails.propertyDetails || {},
                roomType: bookingDetails.roomType || bookingDetails.propertyDetails?.room || 'Standard Room'
            },
            userDetails: {
                name: auth.currentUser.displayName || 'Guest',
                email: auth.currentUser.email
            },
            referenceNumber: referenceNumber || 'Not Provided', // Add reference number at the top level
            paymentMethod: paymentMethod, // Add payment method at the top level
            amount: parseFloat(bookingDetails.totalPrice || paymentData.amount || 0),
            createdAt: Timestamp.now(),
            status: 'pending'
        };

        // Add a debugging log to see the full data being sent
        console.log('Creating payment verification request with data:', JSON.stringify(verificationData));

        const docRef = await addDoc(paymentVerificationRef, verificationData);
        console.log('Payment verification request created with ID:', docRef.id);
        
        // Double-check the document was created
        const verificationDoc = await getDoc(doc(paymentVerificationRef, docRef.id));
        if (verificationDoc.exists()) {
            console.log('Verification request document exists in Firestore');
        } else {
            console.error('Failed to retrieve the created verification request document');
        }
        
        return docRef.id;
    } catch (error) {
        console.error('Error creating payment verification request:', error);
        throw error; // We should throw here to handle the error in the calling function
    }
}

async function getUserData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            return userDoc.data();
        }
        return {};
    } catch (error) {
        console.error('Error fetching user data:', error);
        return {};
    }
}

function setupPaymentOptions(bookingData) {
    const paymentTypeRadios = document.querySelectorAll('input[name="payment_type"]');
    
    // Function to update selected class
    const updateSelectedClass = (selectedValue) => {
        // Remove selected class from all options
        document.querySelectorAll('input[name="payment_type"]').forEach(radio => {
            const parentOption = radio.closest('.payment-method-option');
            if (parentOption) {
                parentOption.classList.remove('selected');
            }
        });
        
        // Add selected class to the parent of the selected radio
        const selectedRadio = document.querySelector(`input[name="payment_type"][value="${selectedValue}"]`);
        if (selectedRadio) {
            const parentOption = selectedRadio.closest('.payment-method-option');
            if (parentOption) {
                parentOption.classList.add('selected');
            }
        }
    };
    
    if (paymentTypeRadios.length > 0) {
        const defaultRadio = paymentTypeRadios[0];
        defaultRadio.checked = true; // Default to first option (pay now)
        updateSelectedClass(defaultRadio.value); // Update selected styling
        
        console.log(`[Debug] Default payment TYPE set to: ${defaultRadio.value}`);

        paymentTypeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                console.log(`[Debug] Payment type changed to: ${radio.value}`);
                updateSelectedClass(radio.value); // Update selected styling
                validatePaymentForm();
            });
        });
    } else {
        console.warn('[Debug] No payment type radios found.');
    }
}

function setupPaymentMethodListeners() {
    // Prevent multiple executions
    if (paymentMethodListenersAttached) {
        console.log('Payment method listeners already attached, skipping');
        return;
    }
    
    console.log('Setting up payment method listeners');
    paymentMethodListenersAttached = true;
    
    const paymentMethodRadios = document.querySelectorAll('input[name="payment_method"]');
    const cardForm = document.getElementById('card-form');
    const gcashForm = document.getElementById('gcash-form');
    
    // Function to update selected class
    const updateSelectedClass = (selectedValue) => {
        // Remove selected class from all options
        document.querySelectorAll('.payment-method-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Add selected class to the parent of the selected radio
        const selectedRadio = document.querySelector(`input[name="payment_method"][value="${selectedValue}"]`);
        if (selectedRadio) {
            const parentOption = selectedRadio.closest('.payment-method-option');
            if (parentOption) {
                parentOption.classList.add('selected');
            }
        }
    };
    
    // Default to the first payment method (e.g., 'card')
    if (paymentMethodRadios.length > 0) {
        const defaultRadio = paymentMethodRadios[0]; // Get the first radio
        defaultRadio.checked = true; // Explicitly check it
        updateSelectedClass(defaultRadio.value); // Update selected styling
        console.log(`[Debug] Default payment METHOD set to: ${defaultRadio.value}`); // Log default

        // Trigger visibility of the corresponding form
        if (defaultRadio.value === 'card' && cardForm) {
            cardForm.classList.remove('hidden');
            console.log('[Debug] Card form shown by default');
        } else if (defaultRadio.value === 'gcash' && gcashForm) {
            gcashForm.classList.remove('hidden');
            console.log('[Debug] GCash form shown by default');
        }
        // ... handle other potential default methods if needed ...
        else {
             if (cardForm) cardForm.classList.add('hidden');
             if (gcashForm) gcashForm.classList.add('hidden');
             console.log('[Debug] Default payment method form not found or handled, hiding all.');
        }
    } else {
         console.warn('[Debug] No payment method radios found to set a default.');
    }
    
    paymentMethodRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            // Hide all payment method specific forms first
            if (cardForm) cardForm.classList.add('hidden');
            if (gcashForm) gcashForm.classList.add('hidden');

            // Show the selected payment method form
            console.log(`[Debug] Payment method changed to: ${radio.value}`);
            if (radio.value === 'card' && cardForm) {
                cardForm.classList.remove('hidden');
            } else if (radio.value === 'gcash' && gcashForm) {
                gcashForm.classList.remove('hidden');
            }
            
            // Update styling for selected option
            updateSelectedClass(radio.value);
            
            validatePaymentForm(); // Validate whenever method changes
        });
    });
}

// Add this function near the top of the file to handle URL parameters
function getUrlParameter(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Add this function to clear any default values from the summary display
function clearDefaultSummaryValues() {
    console.log('Clearing any default values from summary display');
    // Elements to clear
    const elementsToReset = [
        'summary-checkin',
        'summary-checkout',
        'summary-guests',
        'summary-contact',
        'summary-nights',
        'summary-rate',
        'summary-subtotal',
        'summary-fee',
        'summary-total',
        'pay-now-amount',
        'pay-later-first',
        'pay-later-second'
    ];
    
    // Reset each element
    elementsToReset.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = '';
        }
    });
}

// Add this debugging function at the top of the file after imports
function debugLocalStorage(label) {
  console.log(`========== DEBUG localStorage (${label}) ==========`);
  console.log('tempBookingData:', localStorage.getItem('tempBookingData'));
  console.log('bookingData:', localStorage.getItem('bookingData'));
  console.log('tempBookingId:', localStorage.getItem('tempBookingId'));
  console.log('currentBookingId:', localStorage.getItem('currentBookingId'));
  console.log('================================================');
}

// At the start of DOMContentLoaded event handler, add debugging
document.addEventListener('DOMContentLoaded', () => {
    console.log('Document loaded, initializing payment page');
    
    // Clear payment processing flag on page load to prevent issues from previous sessions
    window.paymentInProgress = false;
    
    // Handle initial login button state
    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
        // Initially hide the login button, it will be shown by auth state listener if user is not authenticated
        loginButton.style.display = 'none';
    }
    
    // Debug localStorage at page load
    debugLocalStorage('page load');
    
    // Clear any default values immediately
    clearDefaultSummaryValues();
    
    // Check for URL parameters
    const tempBookingId = getUrlParameter('tempBookingId');
    const bookingId = getUrlParameter('bookingId');
    
    console.log('URL parameters - tempBookingId:', tempBookingId, 'bookingId:', bookingId);
    
    // Store IDs in localStorage if they exist in URL
    if (tempBookingId) {
        console.log('Storing tempBookingId in localStorage:', tempBookingId);
        localStorage.setItem('tempBookingId', tempBookingId);
    }
    
    if (bookingId) {
        console.log('Storing bookingId in localStorage:', bookingId);
        localStorage.setItem('currentBookingId', bookingId);
    }
    
    // Get any saved booking data from sessionStorage (in case localStorage failed)
    const sessionBookingData = sessionStorage.getItem('backupBookingData');
    if (sessionBookingData) {
        console.log('Found booking data in sessionStorage, restoring to localStorage');
        localStorage.setItem('tempBookingData', sessionBookingData);
        localStorage.setItem('bookingData', sessionBookingData);
    }
    
    // Debug localStorage after restoring from sessionStorage
    debugLocalStorage('after session restore');
    
    // Initialize the page (only once due to pageInitialized flag)
    initializePage();
    
    // Remove the setTimeout retry mechanism to prevent duplicate initialization
    // The pageInitialized flag in initializePage() will prevent duplicates
    
    // Set up screenshot upload
    const screenshotInput = document.getElementById('payment-screenshot');
    const screenshotPreview = document.getElementById('screenshot-preview');
    
    if (screenshotInput && screenshotPreview) {
        screenshotInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                screenshotPreview.classList.remove('hidden');
            } else {
                screenshotPreview.classList.add('hidden');
            }
        });
    }
    
    // Set up payment type container click handlers
    const payNowOption = document.getElementById('pay-now-option');
    const payLaterOption = document.getElementById('pay-later-option');
    
    if (payNowOption && payLaterOption) {
        payNowOption.addEventListener('click', () => {
            payNowOption.classList.add('selected');
            payLaterOption.classList.remove('selected');
            const radioInput = payNowOption.querySelector('input[type="radio"]');
            if (radioInput) {
                radioInput.checked = true;
                validatePaymentForm();
            }
        });
        
        payLaterOption.addEventListener('click', () => {
            payLaterOption.classList.add('selected');
            payNowOption.classList.remove('selected');
            const radioInput = payLaterOption.querySelector('input[type="radio"]');
            if (radioInput) {
                radioInput.checked = true;
                validatePaymentForm();
            }
        });
    }
    
    // Set up payment method container click handlers
    const cardOption = document.getElementById('card-option');
    const gcashOption = document.getElementById('gcash-option');
    const paypalOption = document.getElementById('paypal-option');
    const cardForm = document.getElementById('card-form');
    const gcashForm = document.getElementById('gcash-form');
    
    if (cardOption) {
        cardOption.addEventListener('click', () => {
            cardOption.classList.add('selected');
            if (gcashOption) gcashOption.classList.remove('selected');
            if (paypalOption) paypalOption.classList.remove('selected');
            
            const radioInput = cardOption.querySelector('input[type="radio"]');
            if (radioInput) {
                radioInput.checked = true;
                if (cardForm) cardForm.classList.add('active');
                if (gcashForm) gcashForm.classList.remove('active');
                validatePaymentForm();
            }
        });
    }
    
    if (gcashOption) {
        gcashOption.addEventListener('click', () => {
            gcashOption.classList.add('selected');
            if (cardOption) cardOption.classList.remove('selected');
            if (paypalOption) paypalOption.classList.remove('selected');
            
            const radioInput = gcashOption.querySelector('input[type="radio"]');
            if (radioInput) {
                radioInput.checked = true;
                if (gcashForm) gcashForm.classList.add('active');
                if (cardForm) cardForm.classList.remove('active');
                validatePaymentForm();
            }
        });
    }
    
    if (paypalOption) {
        paypalOption.addEventListener('click', () => {
            paypalOption.classList.add('selected');
            if (cardOption) cardOption.classList.remove('selected');
            if (gcashOption) gcashOption.classList.remove('selected');
            
            const radioInput = paypalOption.querySelector('input[type="radio"]');
            if (radioInput) {
                radioInput.checked = true;
                if (cardForm) cardForm.classList.remove('active');
                if (gcashForm) gcashForm.classList.remove('active');
                validatePaymentForm();
            }
        });
    }
    
    // Check authentication state immediately
    import('../firebase.js').then(module => {
        const { auth } = module;
        auth.onAuthStateChanged(user => {
            if (user) {
                console.log('User is authenticated:', user.email);
            } else {
                console.log('No user is authenticated');
            }
        });
    });
});

// Helper function to calculate nights between two dates
function calculateNights(checkIn, checkOut) {
    console.log('Calculating nights between:', checkIn, 'and', checkOut);
    try {
        // Convert to Date objects if they're strings or timestamps
        let checkInDate = checkIn;
        let checkOutDate = checkOut;
        
        if (typeof checkIn === 'string') {
            checkInDate = new Date(checkIn);
            console.log('Converted checkIn string to Date:', checkInDate);
        } else if (checkIn && typeof checkIn === 'object' && 'seconds' in checkIn) {
            // Handle Firebase Timestamp
            checkInDate = new Date(checkIn.seconds * 1000);
            console.log('Converted checkIn Timestamp to Date:', checkInDate);
        }
        
        if (typeof checkOut === 'string') {
            checkOutDate = new Date(checkOut);
            console.log('Converted checkOut string to Date:', checkOutDate);
        } else if (checkOut && typeof checkOut === 'object' && 'seconds' in checkOut) {
            // Handle Firebase Timestamp
            checkOutDate = new Date(checkOut.seconds * 1000);
            console.log('Converted checkOut Timestamp to Date:', checkOutDate);
        }
        
        // Check if dates are valid
        if (!checkInDate || !checkOutDate || isNaN(checkInDate) || isNaN(checkOutDate)) {
            console.warn('Invalid dates for calculating nights', { checkInDate, checkOutDate });
            return 0;
        }
        
        // Calculate difference in days
        const diffTime = checkOutDate.getTime() - checkInDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        console.log('Calculated nights:', diffDays);
        return diffDays > 0 ? diffDays : 1; // Minimum 1 night
    } catch (error) {
        console.error('Error calculating nights:', error);
        return 1; // Default to 1 night on error
    }
}

// Add this new function to fetch booking data from Firebase
async function fetchDraftBookingFromFirebase(bookingId) {
  try {
    console.log('Fetching draft booking from Firebase with ID:', bookingId);
    
    // Reference to the draft booking document
    const draftBookingRef = doc(db, 'draftBookings', bookingId);
    const draftBookingDoc = await getDoc(draftBookingRef);
    
    if (draftBookingDoc.exists()) {
      const bookingData = draftBookingDoc.data();
      console.log('Found draft booking in Firebase:', bookingData);
      
      // Convert Firestore timestamps to Date objects
      if (bookingData.checkIn && typeof bookingData.checkIn.toDate === 'function') {
        bookingData.checkIn = bookingData.checkIn.toDate().toISOString();
      }
      if (bookingData.checkOut && typeof bookingData.checkOut.toDate === 'function') {
        bookingData.checkOut = bookingData.checkOut.toDate().toISOString();
      }
      if (bookingData.createdAt && typeof bookingData.createdAt.toDate === 'function') {
        bookingData.createdAt = bookingData.createdAt.toDate().toISOString();
      }
      
      // Store in localStorage as backup
      localStorage.setItem('tempBookingData', JSON.stringify(bookingData));
      
      return bookingData;
    } else {
      console.warn('No draft booking found with ID:', bookingId);
      return null;
    }
  } catch (error) {
    console.error('Error fetching draft booking:', error);
    throw error;
  }
}

// Function to create notification for admin when new booking is made
async function createBookingNotification(bookingId, bookingData) {
    try {
        console.log('Creating notification for booking:', bookingId);
        
        // Get the current user for notification context
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.warn('No authenticated user for notification');
            return;
        }
        
        // Format dates for display
        const formatDate = (date) => {
            if (!date) return 'N/A';
            try {
                if (typeof date === 'string') {
                    return new Date(date).toLocaleDateString();
                } else if (date.toDate && typeof date.toDate === 'function') {
                    return date.toDate().toLocaleDateString();
                } else if (date instanceof Date) {
                    return date.toLocaleDateString();
                }
                return 'N/A';
            } catch (error) {
                console.error('Error formatting date:', error);
                return 'N/A';
            }
        };
        
        // Create notification data
        const notificationData = {
            type: 'booking',
            title: 'New Booking Received',
            message: `New booking from ${bookingData.guestName || currentUser.email} for ${formatDate(bookingData.checkIn)} - ${formatDate(bookingData.checkOut)}`,
            bookingId: bookingId,
            userId: currentUser.uid,
            userEmail: currentUser.email,
            guestName: bookingData.guestName || currentUser.displayName || currentUser.email,
            checkIn: bookingData.checkIn,
            checkOut: bookingData.checkOut,
            totalPrice: bookingData.totalPrice || 0,
            roomNumber: bookingData.propertyDetails?.roomNumber || 'N/A',
            read: false,
            createdAt: Timestamp.now(),
            priority: 'high'
        };
        
        // Add to notifications collection
        const notificationsRef = collection(db, 'notifications');
        const docRef = await addDoc(notificationsRef, notificationData);
        
        console.log('Notification created successfully with ID:', docRef.id);
        
        // Optional: Send browser notification if permission is granted
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New Booking Received', {
                body: notificationData.message,
                icon: '/favicon.ico'
            });
        }
        
        return docRef.id;
        
    } catch (error) {
        console.error('Error creating booking notification:', error);
        throw error;
    }
}
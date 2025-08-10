import { db, auth, addBooking } from '../../AdminSide/firebase.js';
import { doc, getDoc, collection, addDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Constants for pricing
const NIGHTLY_RATE = 5200; // ₱5,200 per night
const SERVICE_FEE_PERCENTAGE = 0.14; // 14% service fee

// Calendar Functionality
const calendarModal = document.getElementById('calendar-modal');
const calendarGrid = document.getElementById('calendar-grid');
const calendarMonth = document.getElementById('calendar-month');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const clearDatesBtn = document.getElementById('clear-dates');
const closeCalendarBtn = document.getElementById('close-calendar');
const checkInInput = document.getElementById('check-in-date');
const checkOutInput = document.getElementById('check-out-date');
const nightsSelected = document.getElementById('nights-selected');
const pricingDetails = document.getElementById('pricing-details');
const nightsCalculation = document.getElementById('nights-calculation');
const totalNightsPrice = document.getElementById('total-nights-price');
const totalPrice = document.getElementById('total-price');
let serviceFee = document.getElementById('service-fee');

let currentDate = new Date(); // Current date
let selectedCheckIn = null;
let selectedCheckOut = null;

function renderCalendar(date) {
    // Implementation similar to lodge1.js
    // ...existing code...
}

function handleDateSelection(selectedDate) {
    // Implementation similar to lodge1.js
    // ...existing code...
}

function updatePriceCalculation() {
    if (!selectedCheckIn || !selectedCheckOut) return;
    
    const nights = Math.round((selectedCheckOut - selectedCheckIn) / (1000 * 60 * 60 * 24));
    nightsSelected.textContent = `${nights} nights selected`;
    
    const totalNights = NIGHTLY_RATE * nights;
    const serviceFeeAmount = Math.round(totalNights * SERVICE_FEE_PERCENTAGE);
    const totalAmount = totalNights + serviceFeeAmount;
    
    nightsCalculation.textContent = `₱${NIGHTLY_RATE.toLocaleString()} x ${nights} nights`;
    totalNightsPrice.textContent = `₱${totalNights.toLocaleString()}`;
    serviceFee.textContent = `₱${serviceFeeAmount.toLocaleString()}`;
    totalPrice.textContent = `₱${totalAmount.toLocaleString()}`;
    
    pricingDetails.classList.remove('hidden');
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });
}

export async function handleReserveClick(event) {
    try {
        event.preventDefault();

        // Check if user is logged in
        const user = auth.currentUser;
        
        // Validate contact number
        const contactNumber = document.getElementById('guest-contact').value.trim();
        if (!contactNumber) {
            alert('Please enter your contact number');
            return;
        }
        if (!/^[0-9]{11}$/.test(contactNumber)) {
            alert('Please enter a valid 11-digit contact number');
            return;
        }

        // Validate guests
        const guests = document.getElementById('guests').value;
        if (!guests || guests < 1) {
            alert('Please select a valid number of guests');
            return;
        }

        // Validate dates
        if (!selectedCheckIn || !selectedCheckOut) {
            alert('Please select both check-in and check-out dates');
            return;
        }

        const nights = Math.round((selectedCheckOut - selectedCheckIn) / (1000 * 60 * 60 * 24));
        if (nights <= 0) {
            alert('Check-out date must be after check-in date');
            return;
        }

        // If not logged in, save details and redirect
        if (!user) {
            const bookingDetails = {
                checkIn: selectedCheckIn,
                checkOut: selectedCheckOut,
                guests: guests,
                contactNumber: contactNumber
            };
            localStorage.setItem('pendingBooking', JSON.stringify(bookingDetails));
            
            const returnUrl = encodeURIComponent(window.location.href);
            window.location.href = `../Login/index.html?redirect=${returnUrl}`;
            return;
        }

        // Calculate costs
        const totalNights = NIGHTLY_RATE * nights;
        const serviceFeeAmount = Math.round(totalNights * SERVICE_FEE_PERCENTAGE);
        const totalAmount = totalNights + serviceFeeAmount;

        // Create booking data object
        const bookingData = {
            checkIn: selectedCheckIn.toISOString(),
            checkOut: selectedCheckOut.toISOString(),
            guests: Number(guests),
            contactNumber: contactNumber,
            numberOfNights: nights,
            nightlyRate: NIGHTLY_RATE,
            subtotal: totalNights,
            serviceFee: serviceFeeAmount,
            totalPrice: totalAmount,
            propertyDetails: {
                name: "Wright Park Manor",
                location: "Wright Park, Baguio City",
                roomType: "Deluxe Suite",
                roomNumber: "303",
                floorLevel: "3"
            }
        };

        // Save to localStorage
        localStorage.setItem('bookingData', JSON.stringify(bookingData));

        // Redirect to payment page
        window.location.href = '../paymentProcess/pay.html';

    } catch (error) {
        console.error('Error in handleReserveClick:', error);
        alert('An error occurred while processing your reservation. Please try again.');
    }
}

// Add event listener for page load to check for pending bookings
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded');
  // Initialize all event listeners
  initializeEventListeners();

  // Auth state observer
  auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = '../Login/index.html';
    }
  });

  // Add auth state observer to handle login button visibility
  auth.onAuthStateChanged((user) => {
    const loginButton = document.getElementById('loginButton');
    if (loginButton) {
      if (user) {
        loginButton.classList.add('hidden'); // Hide login button if user is logged in
      } else {
        loginButton.classList.remove('hidden'); // Show login button if user is logged out
      }
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
    initializeLodgeDetails();
    initializeBooking();
    initializeGallery();
    initializeReviews();
});
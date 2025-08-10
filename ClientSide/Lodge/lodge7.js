import { db, auth, addBooking } from '../../AdminSide/firebase.js';
import { doc, getDoc, collection, addDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Constants for pricing
const NIGHTLY_RATE = 4100; // ₱4,100 per night
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
    const month = date.getMonth();
    const year = date.getFullYear();
    
    calendarMonth.textContent = `${date.toLocaleString('default', { month: 'long' })} ${year}`;
    calendarGrid.innerHTML = '';
  
    // Weekday headers
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    weekdays.forEach(day => {
      const dayEl = document.createElement('div');
      dayEl.textContent = day;
      dayEl.className = 'text-xs font-medium text-gray-500';
      calendarGrid.appendChild(dayEl);
    });
  
    // Calculate first day of the month and previous month's last days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
  
    // Add previous month's days
    for (let i = 0; i < startingDay; i++) {
      const dayEl = document.createElement('div');
      dayEl.textContent = new Date(year, month, -startingDay + i + 1).getDate();
      dayEl.className = 'text-gray-300';
      calendarGrid.appendChild(dayEl);
    }
  
    // Add current month's days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dayEl = document.createElement('div');
      dayEl.textContent = day;
      dayEl.className = 'hover-date text-gray-500 hover:bg-blue-50 rounded py-2';
      
      const currentDay = new Date(year, month, day);
  
      // Check if day is in range
      if (selectedCheckIn && selectedCheckOut && 
          currentDay > selectedCheckIn && 
          currentDay < selectedCheckOut) {
        dayEl.classList.add('in-range');
      }
  
      // Highlight selected dates
      if ((selectedCheckIn && currentDay.toDateString() === selectedCheckIn.toDateString()) ||
          (selectedCheckOut && currentDay.toDateString() === selectedCheckOut.toDateString())) {
        dayEl.classList.add('selected-date');
      }
  
      dayEl.addEventListener('click', () => handleDateSelection(currentDay));
      calendarGrid.appendChild(dayEl);
    }
}

function handleDateSelection(selectedDate) {
    if (!selectedCheckIn || (selectedCheckIn && selectedCheckOut)) {
      // First selection or reset
      selectedCheckIn = selectedDate;
      selectedCheckOut = null;
      checkInInput.value = formatDate(selectedDate);
      checkOutInput.value = '';
    } else {
      // Second selection
      if (selectedDate > selectedCheckIn) {
        selectedCheckOut = selectedDate;
        checkOutInput.value = formatDate(selectedDate);
  
        // Calculate nights and update pricing
        updatePriceCalculation();
      } else {
        // If selected date is before check-in, reset and start over
        selectedCheckIn = selectedDate;
        selectedCheckOut = null;
        checkInInput.value = formatDate(selectedDate);
        checkOutInput.value = '';
      }
    }
  
    renderCalendar(currentDate);
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

// Event Listeners
checkInInput?.addEventListener('click', () => {
    calendarModal.classList.remove('hidden');
    calendarModal.classList.add('flex');
});
  
checkOutInput?.addEventListener('click', () => {
    if (selectedCheckIn) {
        calendarModal.classList.remove('hidden');
        calendarModal.classList.add('flex');
    }
});
  
closeCalendarBtn?.addEventListener('click', () => {
    calendarModal.classList.add('hidden');
    calendarModal.classList.remove('flex');
});
  
clearDatesBtn?.addEventListener('click', () => {
    selectedCheckIn = null;
    selectedCheckOut = null;
    checkInInput.value = '';
    checkOutInput.value = '';
    nightsSelected.textContent = '';
    pricingDetails.classList.add('hidden');
    renderCalendar(currentDate);
});
  
prevMonthBtn?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar(currentDate);
});
  
nextMonthBtn?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar(currentDate);
});

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
                name: "Mountain Pearl Lodge",
                location: "Outlook Drive, Baguio City",
                roomType: "Premium Suite",
                roomNumber: "405",
                floorLevel: "4"
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

function initializeLodgeDetails() {
    console.log('Initializing lodge details');
    // You can add specific lodge details initialization here
}

function initializeBooking() {
    console.log('Initializing booking functionality');
    // Initialize calendar on page load
    if (calendarGrid) {
        renderCalendar(currentDate);
    }
    
    // Setup reserve button
    const reserveBtn = document.getElementById('reserve-btn');
    if (reserveBtn) {
        reserveBtn.addEventListener('click', handleReserveClick);
    }
}

function initializeGallery() {
    console.log('Initializing gallery');
    // Gallery functionality is handled in the HTML via inline scripts
}

function initializeReviews() {
    console.log('Initializing reviews');
    // Reviews functionality is handled in the HTML via inline scripts
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
    // Initialize lodge-specific functionality
    initializeLodgeDetails();
    initializeBooking();
    initializeGallery();
    initializeReviews();
});
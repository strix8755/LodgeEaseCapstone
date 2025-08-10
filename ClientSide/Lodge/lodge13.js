import { 
  auth, 
  db, 
  addBooking,
  doc, 
  getDoc, 
  collection, 
  addDoc, 
  Timestamp, 
  query, 
  where, 
  orderBy, 
  getDocs 
} from '../firebase.js';
import { ReviewSystem } from '../components/reviewSystem.js';

// Define the rate constants and functions first with default values
let STANDARD_RATE = 1300;
let NIGHT_PROMO_RATE = 580;
// Force service fee to be 0 to completely remove it from calculations
let SERVICE_FEE_PERCENTAGE = 0;
let WEEKLY_DISCOUNT = 0.10;
let TWO_HOUR_RATE = 320;
let THREE_HOUR_RATE = 380;
let FOUR_HOUR_RATE = 440;
let FIVE_HOUR_RATE = 500;
let SIX_HOUR_RATE = 560;
let SEVEN_HOUR_RATE = 620;
let EIGHT_HOUR_RATE = 680;
let NINE_HOUR_RATE = 740;
let TEN_HOUR_RATE = 800;
let ELEVEN_HOUR_RATE = 820;
let TWELVE_HOUR_RATE = 820;
let THIRTEEN_HOUR_RATE = 880;
let FOURTEEN_TO_24_HOUR_RATE = 940;
let TV_REMOTE_FEE = 100;

// Fallback functions
function calculateNights(checkIn, checkOut) {
  if (!checkOut) return 0;
  
  const checkInDate = checkIn instanceof Date ? checkIn : new Date(checkIn);
  const checkOutDate = checkOut instanceof Date ? checkOut : new Date(checkOut);
  
  if (checkInDate.getFullYear() === checkOutDate.getFullYear() && 
      checkInDate.getMonth() === checkOutDate.getMonth() && 
      checkInDate.getDate() === checkOutDate.getDate()) {
    return 0;
  }
  
  const diffTime = Math.abs(checkOutDate - checkInDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function calculateHours(checkIn, checkOut) {
  if (!checkOut) return 0;
  
  const checkInDate = checkIn instanceof Date ? checkIn : new Date(checkIn);
  const checkOutDate = checkOut instanceof Date ? checkOut : new Date(checkOut);
  const diffTime = Math.abs(checkOutDate - checkInDate);
  return Math.ceil(diffTime / (1000 * 60 * 60));
}

function isNightPromoEligible(nights) {
  console.log('Checking night promo eligibility...');
  
  // First check if it's a one-night stay
  if (nights !== 1) {
    console.log('Not eligible: Not a one-night stay');
    return false;
  }
  
  // Get check-in and check-out times from UI
  const checkInTimeSelect = document.getElementById('check-in-time');
  const checkOutTimeSelect = document.getElementById('check-out-time');
  
  if (!checkInTimeSelect || !checkOutTimeSelect) {
    console.log('Not eligible: Time selectors not found');
    return false;
  }
  
  const checkInTime = checkInTimeSelect.value;
  const checkOutTime = checkOutTimeSelect.value;
  
  console.log('Checking eligibility with times:', { checkInTime, checkOutTime });
  
  // Check if check-in time is 10 PM
  const isNightCheckIn = checkInTime === '22:00';
  
  // Check if check-out time is between 4 AM and 8 AM
  const validCheckOutTimes = ['04:00', '05:00', '06:00', '07:00', '08:00'];
  const isEarlyCheckOut = validCheckOutTimes.includes(checkOutTime);
  
  const isEligible = isNightCheckIn && isEarlyCheckOut;
  
  console.log('Night promo eligibility result:', { 
    isNightCheckIn, 
    isEarlyCheckOut, 
    isEligible 
  });
  
  // Return true only if all conditions are met
  return isEligible;
}

function getHourlyRate(hours) {
  if (hours <= 2) return TWO_HOUR_RATE;
  if (hours <= 3) return THREE_HOUR_RATE;
  if (hours <= 4) return FOUR_HOUR_RATE;
  if (hours <= 5) return FIVE_HOUR_RATE;
  if (hours <= 6) return SIX_HOUR_RATE;
  if (hours <= 7) return SEVEN_HOUR_RATE;
  if (hours <= 8) return EIGHT_HOUR_RATE;
  if (hours <= 9) return NINE_HOUR_RATE;
  if (hours <= 10) return TEN_HOUR_RATE;
  if (hours <= 11) return ELEVEN_HOUR_RATE;
  if (hours <= 12) return TWELVE_HOUR_RATE;
  if (hours <= 13) return THIRTEEN_HOUR_RATE;
  return FOURTEEN_TO_24_HOUR_RATE;
}

// Save a reference to our original calculateBookingCosts function
const originalCalculateBookingCosts = function(nights, checkInTimeSlot = 'standard', hasCheckOut = true, hasTvRemote = false, hours = 0) {
  console.log('Calculating booking costs with params:', {
    nights, 
    checkInTimeSlot, 
    hasCheckOut, 
    hasTvRemote, 
    hours,
    STANDARD_RATE, 
    NIGHT_PROMO_RATE
  });
  
  let subtotal = 0;
  let nightlyRate = 0;
  let discountAmount = 0;
  
  if (!hasCheckOut) {
    nightlyRate = THREE_HOUR_RATE;
    subtotal = nightlyRate;
    console.log('Using base rate (no checkout):', { nightlyRate, subtotal });
  } else if (nights === 0 && hours > 0) {
    nightlyRate = getHourlyRate(hours);
    subtotal = nightlyRate;
    console.log('Using hourly rate:', { hours, nightlyRate, subtotal });
  } else if (checkInTimeSlot === 'night-promo') {
    nightlyRate = NIGHT_PROMO_RATE;
    subtotal = nightlyRate * (nights || 1);
    console.log('Using night promo rate:', { nightlyRate, nights: (nights || 1), subtotal });
  } else if (nights > 0) {
    nightlyRate = STANDARD_RATE;
    subtotal = nightlyRate * nights;
    console.log('Using standard rate:', { nightlyRate, nights, subtotal });
    
    if (nights >= 7) {
      discountAmount = subtotal * WEEKLY_DISCOUNT;
      subtotal -= discountAmount;
      console.log('Applied weekly discount:', { discountAmount, subtotalAfterDiscount: subtotal });
    }
  }
  
  // Add TV remote fee if applicable
  if (hasTvRemote) {
    subtotal += TV_REMOTE_FEE;
    console.log('Added TV remote fee:', { TV_REMOTE_FEE, subtotalWithFee: subtotal });
  }
  
  // Force service fee to be 0 regardless of SERVICE_FEE_PERCENTAGE
  const serviceFeeAmount = 0;
  // Set total directly equal to subtotal
  const totalAmount = subtotal;
  
  const result = {
    nightlyRate,
    subtotal,
    discountAmount,
    serviceFeeAmount, // Will be 0
    totalAmount
  };
  
  console.log('Final booking cost calculation:', result);
  
  return result;
};

// Use our originalCalculateBookingCosts by default
let calculateBookingCosts = originalCalculateBookingCosts;

// Try to load the real module - wrapped in an IIFE to allow use of async/await
(async function loadRateCalculation() {
  try {
    // Try to import from the ClientSide/AdminSide path
    const rateModule = await import('../AdminSide/js/rateCalculation.js').catch(e => null);
    
    if (rateModule) {
      // Assign all imported values if successful
      STANDARD_RATE = rateModule.STANDARD_RATE;
      NIGHT_PROMO_RATE = rateModule.NIGHT_PROMO_RATE;
      // Always force SERVICE_FEE_PERCENTAGE to be 0 regardless of what's imported
      SERVICE_FEE_PERCENTAGE = 0; 
      WEEKLY_DISCOUNT = rateModule.WEEKLY_DISCOUNT;
      TWO_HOUR_RATE = rateModule.TWO_HOUR_RATE;
      THREE_HOUR_RATE = rateModule.THREE_HOUR_RATE;
      FOUR_HOUR_RATE = rateModule.FOUR_HOUR_RATE;
      FIVE_HOUR_RATE = rateModule.FIVE_HOUR_RATE;
      SIX_HOUR_RATE = rateModule.SIX_HOUR_RATE;
      SEVEN_HOUR_RATE = rateModule.SEVEN_HOUR_RATE;
      EIGHT_HOUR_RATE = rateModule.EIGHT_HOUR_RATE;
      NINE_HOUR_RATE = rateModule.NINE_HOUR_RATE;
      TEN_HOUR_RATE = rateModule.TEN_HOUR_RATE;
      ELEVEN_HOUR_RATE = rateModule.ELEVEN_HOUR_RATE;
      TWELVE_HOUR_RATE = rateModule.TWELVE_HOUR_RATE;
      THIRTEEN_HOUR_RATE = rateModule.THIRTEEN_HOUR_RATE;
      FOURTEEN_TO_24_HOUR_RATE = rateModule.FOURTEEN_TO_24_HOUR_RATE;
      TV_REMOTE_FEE = rateModule.TV_REMOTE_FEE;
      
      // Replace these functions with the ones from the module
      calculateNights = rateModule.calculateNights;
      calculateHours = rateModule.calculateHours;
      isNightPromoEligible = rateModule.isNightPromoEligible;
      getHourlyRate = rateModule.getHourlyRate;
      
      // Use our original calculateBookingCosts to ensure no service fee is added
      // Do NOT replace with the imported module's function
      console.log('Successfully imported rateCalculation.js from ClientSide/AdminSide/js - but using custom calculateBookingCosts');
      return; // Exit the function if successful
    }
    
    // If the first import fails, try the second path
    const rateModule2 = await import('../../AdminSide/js/rateCalculation.js').catch(e => null);
    
    if (rateModule2) {
      // Assign all imported values if successful
      STANDARD_RATE = rateModule2.STANDARD_RATE;
      NIGHT_PROMO_RATE = rateModule2.NIGHT_PROMO_RATE;
      // Always force SERVICE_FEE_PERCENTAGE to be 0 regardless of what's imported
      SERVICE_FEE_PERCENTAGE = 0;
      WEEKLY_DISCOUNT = rateModule2.WEEKLY_DISCOUNT;
      TWO_HOUR_RATE = rateModule2.TWO_HOUR_RATE;
      THREE_HOUR_RATE = rateModule2.THREE_HOUR_RATE;
      FOUR_HOUR_RATE = rateModule2.FOUR_HOUR_RATE;
      FIVE_HOUR_RATE = rateModule2.FIVE_HOUR_RATE;
      SIX_HOUR_RATE = rateModule2.SIX_HOUR_RATE;
      SEVEN_HOUR_RATE = rateModule2.SEVEN_HOUR_RATE;
      EIGHT_HOUR_RATE = rateModule2.EIGHT_HOUR_RATE;
      NINE_HOUR_RATE = rateModule2.NINE_HOUR_RATE;
      TEN_HOUR_RATE = rateModule2.TEN_HOUR_RATE;
      ELEVEN_HOUR_RATE = rateModule2.ELEVEN_HOUR_RATE;
      TWELVE_HOUR_RATE = rateModule2.TWELVE_HOUR_RATE;
      THIRTEEN_HOUR_RATE = rateModule2.THIRTEEN_HOUR_RATE;
      FOURTEEN_TO_24_HOUR_RATE = rateModule2.FOURTEEN_TO_24_HOUR_RATE;
      TV_REMOTE_FEE = rateModule2.TV_REMOTE_FEE;
      
      // Replace these functions with the ones from the module
      calculateNights = rateModule2.calculateNights;
      calculateHours = rateModule2.calculateHours;
      isNightPromoEligible = rateModule2.isNightPromoEligible;
      getHourlyRate = rateModule2.getHourlyRate;
      
      // Use our original calculateBookingCosts to ensure no service fee is added
      // Do NOT replace with the imported module's function
      console.log('Successfully imported rateCalculation.js from root AdminSide/js - but using custom calculateBookingCosts');
      return; // Exit the function if successful
    }
    
    // If both imports fail, we'll use the fallback values already defined
    console.log('Using fallback rate calculation functions - both imports failed');
    
  } catch (error) {
    console.error('Error loading rate calculation module:', error);
    console.log('Using fallback rate calculation functions due to error');
  } finally {
    // Always restore our original calculateBookingCosts function to ensure service fee is 0
    calculateBookingCosts = originalCalculateBookingCosts;
    // Always force SERVICE_FEE_PERCENTAGE to be 0
    SERVICE_FEE_PERCENTAGE = 0;
  }
})();

// Initialization validation - keeps essential checks while removing excessive logging
(function() {
  // Verify Firebase is properly loaded - critical for functionality
  if (!auth || !db) {
    console.error('Firebase initialization issue - auth or db not available. Will retry after timeout.');
    // Try to re-initialize after a short delay
    setTimeout(() => {
      if (!auth || !db) {
        console.error('Firebase still unavailable after timeout. Reserve functionality may be impaired.');
      } else {
        console.log('Firebase initialization successful after retry.');
      }
    }, 1000);
  }
  
  // Listen for DOM readiness to verify components are available
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (!document.getElementById('reserve-btn')) {
        console.error('Reserve button not found in DOM');
      }
    });
  } else if (!document.getElementById('reserve-btn')) {
    console.error('Reserve button not found in DOM');
  }
})();

// Global synchronization function for jQuery datepicker integration
// IMPORTANT: Define this function early to ensure it's available when datepicker initializes
window.syncDateVariables = function(checkInDate, checkOutDate) {
  console.log('Module syncDateVariables called with:', { 
    checkIn: checkInDate ? new Date(checkInDate).toISOString() : null,
    checkOut: checkOutDate ? new Date(checkOutDate).toISOString() : null 
  });
  
  // Update the module-level variables with values from jQuery datepicker
  if (checkInDate) {
    selectedCheckIn = checkInDate instanceof Date ? checkInDate : new Date(checkInDate);
    // Ensure we update the input field
    const checkInInput = document.getElementById('check-in-date');
    if (checkInInput && checkInInput.value === '') {
      checkInInput.value = formatDate(selectedCheckIn);
    }
  }
  
  if (checkOutDate) {
    selectedCheckOut = checkOutDate instanceof Date ? checkOutDate : new Date(checkOutDate);
    // Ensure we update the input field
    const checkOutInput = document.getElementById('check-out-date');
    if (checkOutInput && checkOutInput.value === '') {
      checkOutInput.value = formatDate(selectedCheckOut);
    }
  }
  
  // Call updatePromoEligibility to check if night promo applies
  if (selectedCheckIn && selectedCheckOut) {
    try {
      if (typeof updatePromoEligibility === 'function') {
        updatePromoEligibility();
      }
    } catch (err) {
      console.warn("Error in updatePromoEligibility during sync:", err);
    }
  }
  
  // Update price calculation based on selected dates
  try {
    if (typeof updatePriceCalculation === 'function') {
      updatePriceCalculation();
      console.log('Price calculation updated during sync');
    } else {
      console.warn("updatePriceCalculation not available during sync");
    }
  } catch (err) {
    console.warn("Error in updatePriceCalculation during sync:", err);
  }
  
  // Process any pending sync from the placeholder
  if (window._pendingSync) {
    console.log('Found pending sync data, clearing');
    window._pendingSync = null;
  }
};

// Helper function for hourly rate calculation - early definition to avoid reference errors
function getHourlyRateValue(hours) {
  if (hours <= 2) return TWO_HOUR_RATE; 
  if (hours <= 3) return THREE_HOUR_RATE;
  if (hours <= 4) return FOUR_HOUR_RATE;
  if (hours <= 5) return FIVE_HOUR_RATE;
  if (hours <= 6) return SIX_HOUR_RATE;
  if (hours <= 7) return SEVEN_HOUR_RATE;
  if (hours <= 8) return EIGHT_HOUR_RATE;
  if (hours <= 9) return NINE_HOUR_RATE;
  if (hours <= 10) return TEN_HOUR_RATE;
  if (hours <= 11) return ELEVEN_HOUR_RATE; 
  if (hours <= 12) return TWELVE_HOUR_RATE;
  if (hours <= 13) return THIRTEEN_HOUR_RATE;
  if (hours <= 24) return FOURTEEN_TO_24_HOUR_RATE;
  
  // For stays longer than 24 hours
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  
  if (remainingHours === 0) {
    return days * FOURTEEN_TO_24_HOUR_RATE;
  } else if (remainingHours <= 13) {
    const remainingRate = getHourlyRateValue(remainingHours);
    return (days * FOURTEEN_TO_24_HOUR_RATE) + remainingRate;
  } else {
    return (days + 1) * FOURTEEN_TO_24_HOUR_RATE;
  }
}

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
const promoDiscountRow = document.getElementById('promo-discount-row');
const promoDiscount = document.getElementById('promo-discount');
let serviceFee = document.getElementById('service-fee');
let checkInTime = document.getElementById('check-in-time');
let bookingType = 'standard'; // Default booking type

let currentDate = new Date(); // Current date
// IMPORTANT: These variables are used by multiple functions
// and need to be initialized at module level
let selectedCheckIn = null;
let selectedCheckOut = null;

// Initialize timeslot selection to determine rate
function initializeTimeSlotSelector() {
  // Get references to new UI elements
  const hourlyToggle = document.getElementById('hourly-toggle');
  const hourlyOptions = document.getElementById('hourly-options');
  const hourlyDuration = document.getElementById('hourly-duration');
  const rateTypeDisplay = document.getElementById('rate-type-display');
  const rateInfo = document.getElementById('rate-info');
  const hiddenInput = document.getElementById('rate-type-value'); // hidden input that stores the value
  const checkInTimeSelect = document.getElementById('check-in-time');
  const checkOutTimeSelect = document.getElementById('check-out-time');
  
  // Set default booking type to standard
  bookingType = 'standard';
  if (hiddenInput) hiddenInput.value = 'standard';
  
  // Update rate display
  if (rateTypeDisplay) {
    rateTypeDisplay.textContent = 'Standard (₱1,300/night)';
    rateTypeDisplay.classList.remove('text-orange-600', 'text-green-600');
    rateTypeDisplay.classList.add('text-blue-700');
  }
  
  if (rateInfo) {
    rateInfo.textContent = 'Night promo rate (₱580) applied for one-night stays with check-in at 10PM and check-out between 4AM-8AM.';
  }
  
  // Set default times if not set
  if (checkInTimeSelect && !checkInTimeSelect.value) {
    checkInTimeSelect.value = '14:00'; // Default check-in at 2:00 PM
  }
  
  if (checkOutTimeSelect && !checkOutTimeSelect.value) {
    checkOutTimeSelect.value = '12:00'; // Default check-out at 12:00 PM
  }
  
  // Function to calculate hours between check-in and check-out times
  function calculateHoursBetweenTimes() {
    if (!checkInTimeSelect || !checkOutTimeSelect || !checkInTimeSelect.value || !checkOutTimeSelect.value) {
      return 2; // Default to 2 hours if times not selected
    }
    
    const [checkInHour] = checkInTimeSelect.value.split(':').map(Number);
    const [checkOutHour] = checkOutTimeSelect.value.split(':').map(Number);
    
    // Calculate duration (handle overnight case)
    let duration = checkOutHour >= checkInHour ? 
        checkOutHour - checkInHour : 
        (24 - checkInHour) + checkOutHour;
    
    // Ensure minimum of 2 hours
    return Math.max(2, duration);
  }
  
  // Function to update hourly duration dropdown based on calculated hours
  function updateHourlyDuration() {
    if (!hourlyDuration || !hourlyToggle || !hourlyToggle.checked) return;
    
    const calculatedHours = calculateHoursBetweenTimes();
    
    // Set the dropdown to the calculated hours, capping at the maximum option value
    const maxOptionValue = 14; // Maximum option value in the dropdown
    const hoursToSelect = Math.min(calculatedHours, maxOptionValue);
    
    hourlyDuration.value = hoursToSelect.toString();
    
    // Update the rate display
    const rate = getHourlyRate(hoursToSelect);
    if (rateTypeDisplay) {
      rateTypeDisplay.textContent = `Hourly (₱${rate})`;
    }
    
    // Update pricing with the new duration
    updatePriceCalculation();
  }
  
  // Handle hourly toggle
  if (hourlyToggle) {
    console.log('Attaching event listener to hourly toggle');
    hourlyToggle.addEventListener('change', function() {
      console.log('Hourly toggle changed, checked:', this.checked);
      if (this.checked) {
        // Switch to hourly rate
        bookingType = 'hourly';
        if (hiddenInput) hiddenInput.value = 'hourly';
        
        // Show hourly options
        if (hourlyOptions) hourlyOptions.classList.remove('hidden');
        
        // Calculate hours based on selected check-in and check-out times
        updateHourlyDuration();
        
        if (rateInfo) {
          rateInfo.textContent = 'Base rate: ₱320 for 2 hours, with hourly rates based on duration';
        }
      } else {
        // Switch back to standard rate
        bookingType = 'standard';
        if (hiddenInput) hiddenInput.value = 'standard';
        
        // Hide hourly options
        if (hourlyOptions) hourlyOptions.classList.add('hidden');
        
        // Update the display
        if (rateTypeDisplay) {
          rateTypeDisplay.textContent = 'Standard (₱1,300/night)';
          rateTypeDisplay.classList.remove('text-orange-600', 'text-green-600');
          rateTypeDisplay.classList.add('text-blue-700');
        }
        
        if (rateInfo) {
          rateInfo.textContent = 'Night promo rate (₱580) applied for one-night stays with check-in at 10PM and check-out between 4AM-8AM.';
        }
        
        // Re-check night promo eligibility
        updatePromoEligibility();
      }
    });
  } else {
    console.warn('Hourly toggle element not found');
  }
  
  // Handle hourly duration change
  if (hourlyDuration) {
    hourlyDuration.addEventListener('change', function() {
      if (bookingType === 'hourly') {
        const hours = parseInt(this.value);
        const rate = getHourlyRate(hours);
        
        // Update the display
        if (rateTypeDisplay) {
          rateTypeDisplay.textContent = `Hourly (₱${rate})`;
        }
        
        // Update pricing with the new duration
        updatePriceCalculation();
      }
    });
  }
  
  // Add event listeners to time selectors to update hourly duration when times change
  if (checkInTimeSelect) {
    checkInTimeSelect.addEventListener('change', function() {
      if (hourlyToggle && hourlyToggle.checked) {
        updateHourlyDuration();
      }
    });
  }
  
  if (checkOutTimeSelect) {
    checkOutTimeSelect.addEventListener('change', function() {
      if (hourlyToggle && hourlyToggle.checked) {
        updateHourlyDuration();
      }
    });
  }
}

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
  
  // Check if night promo is eligible after date selection
  if (selectedCheckIn && selectedCheckOut) {
    updatePromoEligibility();
  }
}

// Update the function to calculate pricing based only on check-in and check-out dates
function updatePriceCalculation() {
  if (!selectedCheckIn) return;
  
  // Get hourly duration if in hourly mode
  const hourlyToggle = document.getElementById('hourly-toggle');
  const hourlyDuration = document.getElementById('hourly-duration');
  const isHourlyMode = hourlyToggle && hourlyToggle.checked;
  
  // If no check-out date is selected in standard mode, use the base rate (380 pesos)
  if (!selectedCheckOut && !isHourlyMode) {
    // Use the shared rate calculation for base rate (no checkout)
    const { nightlyRate, subtotal, totalAmount } = calculateBookingCosts(
      0, // nights
      'standard', // doesn't matter, will use base rate
      false, // hasCheckOut is false
      false, // hasTvRemote
      0 // hours are automatically set to 3 in the calculation
    );
    
    // Update display text
    nightsSelected.textContent = `Base rate`;
    nightsCalculation.textContent = `₱${nightlyRate.toLocaleString()} base rate`;
    totalNightsPrice.textContent = `₱${subtotal.toLocaleString()}`;
    
    // Hide service fee row since we've removed it
    const serviceFeeRow = document.querySelector('#pricing-details p:nth-child(2)');
    if (serviceFeeRow) {
      serviceFeeRow.classList.add('hidden');
    }
    
    pricingDetails.classList.remove('hidden');
    totalPrice.textContent = `₱${totalAmount.toLocaleString()}`;
    
    // Hide promo discount row 
    if (promoDiscountRow) {
      promoDiscountRow.classList.add('hidden');
    }
    
    return;
  }
  
  if (isHourlyMode) {
    // Get check-in and check-out times
    const checkInTimeSelect = document.getElementById('check-in-time');
    const checkOutTimeSelect = document.getElementById('check-out-time');
    
    let hours;
    
    // If both check-in and check-out times are selected, calculate hours between them
    if (checkInTimeSelect && checkOutTimeSelect && 
        checkInTimeSelect.value && checkOutTimeSelect.value) {
      
      const [checkInHour] = checkInTimeSelect.value.split(':').map(Number);
      const [checkOutHour] = checkOutTimeSelect.value.split(':').map(Number);
      
      // Calculate duration (handle overnight case)
      hours = checkOutHour >= checkInHour ? 
          checkOutHour - checkInHour : 
          (24 - checkInHour) + checkOutHour;
      
      // Ensure minimum of 2 hours
      hours = Math.max(2, hours);
      
      // If we have a hourly duration dropdown, update it to match calculated hours
      if (hourlyDuration) {
        // Cap at the maximum value in the dropdown (14)
        hourlyDuration.value = Math.min(hours, 14).toString();
      }
    } else {
      // If times not selected, use the dropdown value
      hours = hourlyDuration ? parseInt(hourlyDuration.value) : 2;
    }
    
    // Calculate hourly rate
    const hourlyRate = getHourlyRate(hours);
    
    // Total amount is now just the hourly rate (no service fee)
    const totalAmount = hourlyRate;
    
    // Update UI
    nightsSelected.textContent = `${hours} hours selected`;
    nightsCalculation.textContent = `₱${hourlyRate.toLocaleString()} for ${hours} hours`;
    totalNightsPrice.textContent = `₱${hourlyRate.toLocaleString()}`;
    
    // Hide service fee row
    const serviceFeeRow = document.querySelector('#pricing-details p:nth-child(2)');
    if (serviceFeeRow) {
      serviceFeeRow.classList.add('hidden');
    }
    
    // Hide discount row for hourly rates
    if (promoDiscountRow) {
      promoDiscountRow.classList.add('hidden');
    }
    
    // Update rate display
    const rateTypeDisplay = document.getElementById('rate-type-display');
    if (rateTypeDisplay) {
      rateTypeDisplay.textContent = `Hourly (₱${hourlyRate})`;
      rateTypeDisplay.classList.remove('text-blue-700', 'text-green-600');
      rateTypeDisplay.classList.add('text-orange-600');
    }
    
    // Update total
    pricingDetails.classList.remove('hidden');
    totalPrice.textContent = `₱${totalAmount.toLocaleString()}`;
    
    return;
  }
  
  // Special handling for same-day bookings - treat as hourly if on the same calendar date
  const isSameDay = selectedCheckIn.getFullYear() === selectedCheckOut.getFullYear() && 
                   selectedCheckIn.getMonth() === selectedCheckOut.getMonth() && 
                   selectedCheckIn.getDate() === selectedCheckOut.getDate();
                   
  if (isSameDay) {
    // Get check-in and check-out times
    const checkInTimeSelect = document.getElementById('check-in-time');
    const checkOutTimeSelect = document.getElementById('check-out-time');
    const checkInTimeValue = checkInTimeSelect ? checkInTimeSelect.value : '14:00';
    const checkOutTimeValue = checkOutTimeSelect ? checkOutTimeSelect.value : '12:00';
    
    // Parse the hours to calculate the duration
    let checkInHours = 14, checkOutHours = 12;
    
    try {
      if (checkInTimeValue) {
        const [hours] = checkInTimeValue.split(':').map(Number);
        checkInHours = hours;
      }
      
      if (checkOutTimeValue) {
        const [hours] = checkOutTimeValue.split(':').map(Number);
        checkOutHours = hours;
      }
    } catch (err) {
      console.warn('Error parsing time values:', err);
    }
    
    // Calculate duration (handle overnight case)
    let duration = checkOutHours >= checkInHours ? 
        checkOutHours - checkInHours : 
        (24 - checkInHours) + checkOutHours;
    
    // Minimum stay of 2 hours
    duration = Math.max(2, duration);
    
    // Calculate hourly rate - total is now just the hourly rate (no service fee)
    const hourlyRate = getHourlyRateValue(duration);
    const totalAmount = hourlyRate;
    
    // Update UI
    nightsSelected.textContent = `${duration} hours selected`;
    nightsCalculation.textContent = `₱${hourlyRate.toLocaleString()} for ${duration} hours`;
    totalNightsPrice.textContent = `₱${hourlyRate.toLocaleString()}`;
    
    // Hide service fee row
    const serviceFeeRow = document.querySelector('#pricing-details p:nth-child(2)');
    if (serviceFeeRow) {
      serviceFeeRow.classList.add('hidden');
    }
    
    // Hide discount row for hourly rates
    if (promoDiscountRow) {
      promoDiscountRow.classList.add('hidden');
    }
    
    // Update total
    pricingDetails.classList.remove('hidden');
    totalPrice.textContent = `₱${totalAmount.toLocaleString()}`;
    
    return;
  }
  
  // When both check-in and check-out dates are available on different days, calculate nights
  const nights = calculateNights(selectedCheckIn, selectedCheckOut);
  nightsSelected.textContent = `${nights} nights selected`;

  // Check promo eligibility directly
  const checkInTimeSelect = document.getElementById('check-in-time');
  const checkOutTimeSelect = document.getElementById('check-out-time');
  const checkInTime = checkInTimeSelect ? checkInTimeSelect.value : '';
  const checkOutTime = checkOutTimeSelect ? checkOutTimeSelect.value : '';

  // Debug values
  console.log('Debug - Night promo check:', { 
    nights, 
    checkInTime, 
    checkOutTime,
    isNightCheckIn: checkInTime === '22:00',
    isValidCheckOut: ['04:00', '05:00', '06:00', '07:00', '08:00'].includes(checkOutTime)
  });

  // Direct check for night promo eligibility
  const isNightPromo = (nights === 1 && 
                       checkInTime === '22:00' && 
                       ['04:00', '05:00', '06:00', '07:00', '08:00'].includes(checkOutTime));

  // Force night promo if eligible
  let rateType = 'standard';
  if (isNightPromo) {
    rateType = 'night-promo';
    bookingType = 'night-promo';
    
    // Update UI elements to show night promo is applied
    const hiddenInput = document.getElementById('rate-type-value');
    if (hiddenInput) hiddenInput.value = 'night-promo';
    
    const promoBanner = document.getElementById('promo-banner');
    if (promoBanner) promoBanner.classList.remove('hidden');
    
    const nightPromoPopup = document.getElementById('night-promo-popup');
    if (nightPromoPopup) nightPromoPopup.classList.remove('hidden');
    
    const rateTypeDisplay = document.getElementById('rate-type-display');
    if (rateTypeDisplay) {
      rateTypeDisplay.textContent = 'Night Promo (₱580/night)';
      rateTypeDisplay.classList.remove('text-blue-700', 'text-orange-600');
      rateTypeDisplay.classList.add('text-green-600');
    }
    
    console.log('Debug - Night Promo Eligible! Setting rate type to night-promo');
  } else {
    console.log('Debug - Not eligible for night promo. Using standard rate.');
    
    // Update the hidden input to ensure correct rate is used
    const hiddenInput = document.getElementById('rate-type-value');
    if (hiddenInput) hiddenInput.value = 'standard';
    
    // Hide night promo UI
    const promoBanner = document.getElementById('promo-banner');
    if (promoBanner) promoBanner.classList.add('hidden');
    
    const nightPromoPopup = document.getElementById('night-promo-popup');
    if (nightPromoPopup) nightPromoPopup.classList.add('hidden');
  }

  console.log('Debug - Rate selection:', { isNightPromo, rateType, bookingType });

  // Use the correct rate type for calculation
  const { nightlyRate, subtotal, discountAmount, totalAmount } = calculateBookingCosts(
    nights,
    rateType, // Use our directly determined rate type
    true, // hasCheckOut
    false, // hasTvRemote
    0 // hours not needed, duration calculated from dates
  );

  console.log('Debug - Price calculation results:', {
    rateType,
    nightlyRate,
    subtotal,
    totalAmount
  });

  // Update UI elements
  nightsCalculation.textContent = `₱${nightlyRate.toLocaleString()} x ${nights} nights`;
  totalNightsPrice.textContent = `₱${(nightlyRate * nights).toLocaleString()}`;
  
  // Show/hide discount row based on whether discount applies
  if (promoDiscountRow && promoDiscount) {
    if (discountAmount > 0) {
      promoDiscountRow.classList.remove('hidden');
      const description = nights >= 7 ? 'Weekly Discount' : 'Night Promo Discount';
      promoDiscountRow.querySelector('span:first-child').textContent = description;
      promoDiscount.textContent = `-₱${discountAmount.toLocaleString()}`;
    } else {
      promoDiscountRow.classList.add('hidden');
    }
  }
  
  // Hide service fee row since we've removed it
  const serviceFeeRow = document.querySelector('#pricing-details p:nth-child(2)');
  if (serviceFeeRow) {
    serviceFeeRow.classList.add('hidden');
  }
  
  pricingDetails.classList.remove('hidden');
  totalPrice.textContent = `₱${totalAmount.toLocaleString()}`;
}

// Make updatePriceCalculation available as a global function for jQuery code
window.updatePriceCalculation = updatePriceCalculation;

function formatDate(date) {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

// Event Listeners
function setupCalendarListeners() {
  // Check if jQuery UI datepicker is already initialized
  if ($ && $.fn.datepicker && $('#check-in-date').data('datepicker')) {
    console.log('jQuery UI datepicker is active, skipping custom calendar setup');
    return; // Skip setup if jQuery UI datepicker is active
  }
  
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

  // Close calendar when clicking outside
  calendarModal?.addEventListener('click', (e) => {
    if (e.target === calendarModal) {
      calendarModal.classList.add('hidden');
      calendarModal.classList.remove('flex');
    }
  });
}

// Add check for promo eligibility when the page loads or dates change
function updatePromoEligibility() {
  console.log('Updating promo eligibility...');
  
  const promoBanner = document.getElementById('promo-banner');
  const nightPromoPopup = document.getElementById('night-promo-popup');
  const rateTypeDisplay = document.getElementById('rate-type-display');
  const rateInfo = document.getElementById('rate-info');
  const hiddenInput = document.getElementById('rate-type-value');
  const checkInTimeSelect = document.getElementById('check-in-time');
  const checkOutTimeSelect = document.getElementById('check-out-time');
  const hourlyToggle = document.getElementById('hourly-toggle');
  
  // If hourly is toggled on, don't change anything
  if (hourlyToggle && hourlyToggle.checked) {
    console.log('Hourly mode is active, skipping promo eligibility check');
    return;
  }
  
  if (promoBanner) {
    // By default, hide the promo banner until valid dates are selected
    promoBanner.classList.add('hidden');
  }
  
  if (nightPromoPopup) {
    // By default, hide the night promo popup
    nightPromoPopup.classList.add('hidden');
  }
  
  // Get time values for night promo check
  const checkInTime = checkInTimeSelect ? checkInTimeSelect.value : '';
  const checkOutTime = checkOutTimeSelect ? checkOutTimeSelect.value : '';
  
  // Direct check for night promo eligibility - check if times match regardless of dates
  const checkInAt10PM = checkInTime === '22:00';
  const checkOutBetween4AMand8AM = ['04:00', '05:00', '06:00', '07:00', '08:00'].includes(checkOutTime);
  
  console.log('Night promo time check:', { 
    checkInAt10PM, 
    checkOutBetween4AMand8AM,
    checkInTime,
    checkOutTime
  });
  
  // Check eligibility based on times first
  if (checkInAt10PM && checkOutBetween4AMand8AM) {
    console.log('Times match for night promo!');
    
    // Now check for proper date selection
    if (selectedCheckIn && selectedCheckOut) {
      const nights = calculateNights(selectedCheckIn, selectedCheckOut);
      console.log('Nights calculated:', nights);
      
      // Only apply if it's a 1-night stay
      if (nights === 1) {
        console.log('Night promo eligible - applying discount!');
        
        // Apply night promo rate
        if (promoBanner) {
          promoBanner.classList.remove('hidden');
        }
        
        if (nightPromoPopup) {
          nightPromoPopup.classList.remove('hidden');
        }
        
        // Automatically switch to night promo rate
        bookingType = 'night-promo';
        if (hiddenInput) hiddenInput.value = 'night-promo';
        
        // Update the display
        if (rateTypeDisplay) {
          rateTypeDisplay.textContent = 'Night Promo (₱580/night)';
          rateTypeDisplay.classList.remove('text-blue-700', 'text-orange-600');
          rateTypeDisplay.classList.add('text-green-600');
        }
        
        if (rateInfo) {
          rateInfo.textContent = 'Night promo rate applied! Check-in at 10:00 PM with check-out between 4:00 AM and 8:00 AM';
        }
        
        // Calculate prices with night promo rate
        updatePriceCalculation();
        return;
      }
    }
  } 
  
  // If we get here, night promo is not eligible
  console.log('Night promo not eligible');
  
  // Update the hidden input to ensure correct rate is used
  if (hiddenInput) hiddenInput.value = 'standard';
  bookingType = 'standard';
  
  // Hide night promo UI
  if (promoBanner) {
    promoBanner.classList.add('hidden');
  }
  
  if (nightPromoPopup) {
    nightPromoPopup.classList.add('hidden');
  }
  
  // Update the display
  if (rateTypeDisplay) {
    rateTypeDisplay.textContent = 'Standard (₱1,300/night)';
    rateTypeDisplay.classList.remove('text-green-600', 'text-orange-600');
    rateTypeDisplay.classList.add('text-blue-700');
  }
  
  if (rateInfo) {
    if (selectedCheckIn && selectedCheckOut) {
      const nights = calculateNights(selectedCheckIn, selectedCheckOut);
      
      if (nights === 1) {
        rateInfo.textContent = 'Select check-in at 10:00 PM with check-out between 4:00 AM - 8:00 AM for night promo rate';
      } else if (nights > 1) {
        rateInfo.textContent = 'Night promo rate only available for one-night stays';
      } else {
        rateInfo.textContent = 'Select check-in and check-out dates';
      }
    } else {
      rateInfo.textContent = 'Select check-in and check-out dates';
    }
  }
  
  // Update prices with standard rate
  updatePriceCalculation();
}

function updateDateInputs() {
  if (checkInInput && selectedCheckIn) {
    checkInInput.value = formatDate(selectedCheckIn);
    
    // If using jQuery datepicker, update it properly
    if ($ && $.fn.datepicker && checkInInput.datepicker) {
      try {
        $(checkInInput).datepicker('setDate', selectedCheckIn);
      } catch (err) {
        console.warn('Error updating jQuery datepicker for check-in:', err);
      }
    }
  }
  
  if (checkOutInput && selectedCheckOut) {
    checkOutInput.value = formatDate(selectedCheckOut);
    
    // If using jQuery datepicker, update it properly
    if ($ && $.fn.datepicker && checkOutInput.datepicker) {
      try {
        $(checkOutInput).datepicker('setDate', selectedCheckOut);
      } catch (err) {
        console.warn('Error updating jQuery datepicker for check-out:', err);
      }
    }
  }
  
  // After updating the input values, check for promo eligibility
  if (selectedCheckIn && selectedCheckOut) {
    try {
      updatePromoEligibility();
    } catch (err) {
      console.warn('Error in updatePromoEligibility during updateDateInputs:', err);
    }
  }
}

// Get current user data
async function getCurrentUserData() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.log('No user is signed in');
            return null;
        }

        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            return userDoc.data();
        } else {
            console.log('No user data found');
            return null;
        }
    } catch (error) {
        console.error('Error getting user data:', error);
        throw error;
    }
}

// Check if room is available for the selected dates
async function checkRoomAvailability(roomNumber, checkInDate, checkOutDate) {
    try {
        console.log(`Checking availability for room ${roomNumber} from ${checkInDate} to ${checkOutDate}`);
        
        // Get bookings from Firebase that might overlap with the selected dates
        const bookingsRef = collection(db, 'everlodgebookings');
        const bookingsQuery = query(
            bookingsRef,
            where('propertyDetails.roomNumber', '==', roomNumber),
            where('status', 'in', ['Confirmed', 'Checked In', 'pending'])
        );
        
        const bookingsSnapshot = await getDocs(bookingsQuery);
        
        // Check if any existing booking overlaps with the selected dates
        for (const doc of bookingsSnapshot.docs) {
            const booking = doc.data();
            
            // Convert Firebase timestamps to JavaScript dates, handling different formats
            let existingCheckIn, existingCheckOut;
            
            // Handle different date formats that might be stored in Firestore
            try {
                if (booking.checkIn) {
                    if (typeof booking.checkIn.toDate === 'function') {
                        existingCheckIn = booking.checkIn.toDate();
                    } else if (booking.checkIn instanceof Date) {
                        existingCheckIn = booking.checkIn;
                    } else if (typeof booking.checkIn === 'string') {
                        existingCheckIn = new Date(booking.checkIn);
                    } else {
                        console.warn('Unknown checkIn date format:', booking.checkIn);
                        continue; // Skip this booking record
                    }
                } else {
                    console.warn('Missing checkIn date in booking record');
                    continue; // Skip this booking record
                }
                
                if (booking.checkOut) {
                    if (typeof booking.checkOut.toDate === 'function') {
                        existingCheckOut = booking.checkOut.toDate();
                    } else if (booking.checkOut instanceof Date) {
                        existingCheckOut = booking.checkOut;
                    } else if (typeof booking.checkOut === 'string') {
                        existingCheckOut = new Date(booking.checkOut);
                    } else {
                        console.warn('Unknown checkOut date format:', booking.checkOut);
                        continue; // Skip this booking record
                    }
                } else {
                    console.warn('Missing checkOut date in booking record');
                    continue; // Skip this booking record
                }
                
                // Verify dates are valid
                if (isNaN(existingCheckIn.getTime()) || isNaN(existingCheckOut.getTime())) {
                    console.warn('Invalid date values in booking record:', { existingCheckIn, existingCheckOut });
                    continue; // Skip this booking record
                }
            } catch (dateError) {
                console.error('Error processing dates in booking record:', dateError);
                continue; // Skip problematic booking records
            }
            
            // Check for overlap
            // New booking starts during an existing booking
            // or new booking ends during an existing booking
            // or new booking completely spans an existing booking
            if ((checkInDate < existingCheckOut && checkInDate >= existingCheckIn) ||
                (checkOutDate > existingCheckIn && checkOutDate <= existingCheckOut) ||
                (checkInDate <= existingCheckIn && checkOutDate >= existingCheckOut)) {
                
                console.log('Room not available - Found conflicting booking:', booking);
                return {
                    available: false,
                    conflictWith: {
                        id: doc.id,
                        checkIn: existingCheckIn,
                        checkOut: existingCheckOut,
                        guestName: booking.guestName || 'Another guest'
                    }
                };
            }
        }
        
        // No overlapping bookings found
        return { available: true };
        
    } catch (error) {
        console.error('Error checking room availability:', error);
        // Return a generic availability error instead of throwing
        return { 
            available: false, 
            error: error.message || 'Unknown error checking availability',
            isSystemError: true
        };
    }
}

// Find first available room from rooms 1-36
async function findAvailableRoom(checkInDate, checkOutDate) {
    try {
        console.log(`Finding available room from rooms 1-36 for dates: ${checkInDate} to ${checkOutDate}`);
        
        // Get all bookings for Ever Lodge rooms that might conflict
        const bookingsRef = collection(db, 'everlodgebookings');
        const bookingsQuery = query(
            bookingsRef,
            where('propertyDetails.name', '==', 'Ever Lodge'),
            where('status', 'in', ['Confirmed', 'Checked In', 'pending'])
        );
        
        const bookingsSnapshot = await getDocs(bookingsQuery);
        
        // Create a set of unavailable rooms (with conflicts)
        const unavailableRooms = new Set();
        
        // Identify all rooms that have overlapping bookings
        for (const doc of bookingsSnapshot.docs) {
            const booking = doc.data();
            if (!booking.propertyDetails?.roomNumber) continue;
            
            // Convert Firebase timestamps to JavaScript dates
            let existingCheckIn, existingCheckOut;
            
            try {
                // Parse check-in date
                if (booking.checkIn) {
                    if (typeof booking.checkIn.toDate === 'function') {
                        existingCheckIn = booking.checkIn.toDate();
                    } else if (booking.checkIn instanceof Date) {
                        existingCheckIn = booking.checkIn;
                    } else if (typeof booking.checkIn === 'string') {
                        existingCheckIn = new Date(booking.checkIn);
                    } else {
                        continue; // Skip invalid date format
                    }
                } else {
                    continue; // Skip if no check-in date
                }
                
                // Parse check-out date
                if (booking.checkOut) {
                    if (typeof booking.checkOut.toDate === 'function') {
                        existingCheckOut = booking.checkOut.toDate();
                    } else if (booking.checkOut instanceof Date) {
                        existingCheckOut = booking.checkOut;
                    } else if (typeof booking.checkOut === 'string') {
                        existingCheckOut = new Date(booking.checkOut);
                    } else {
                        continue; // Skip invalid date format
                    }
                } else {
                    continue; // Skip if no check-out date
                }
                
                // Verify dates are valid
                if (isNaN(existingCheckIn.getTime()) || isNaN(existingCheckOut.getTime())) {
                    continue; // Skip invalid dates
                }
                
                // Check if booking overlaps with requested dates
                if ((checkInDate < existingCheckOut && checkInDate >= existingCheckIn) ||
                    (checkOutDate > existingCheckIn && checkOutDate <= existingCheckOut) ||
                    (checkInDate <= existingCheckIn && checkOutDate >= existingCheckOut)) {
                    
                    // Add to unavailable rooms
                    unavailableRooms.add(booking.propertyDetails.roomNumber);
                }
            } catch (error) {
                console.error('Error processing booking dates:', error);
                continue;
            }
        }
        
        // Look for the first available room from 1-36
        for (let roomNum = 1; roomNum <= 36; roomNum++) {
            const roomNumber = roomNum.toString().padStart(2, '0'); // Format as "01", "02", etc.
            
            if (!unavailableRooms.has(roomNumber)) {
                console.log(`Found available room: ${roomNumber}`);
                return {
                    available: true,
                    roomNumber: roomNumber,
                    floorLevel: Math.ceil(roomNum / 12).toString() // Assign floor based on room number
                };
            }
        }
        
        // If no rooms are available
        return {
            available: false,
            error: 'All rooms are currently booked for these dates.'
        };
        
    } catch (error) {
        console.error('Error finding available room:', error);
        return {
            available: false,
            error: error.message || 'Failed to check room availability.',
            isSystemError: true
        };
    }
}

// Fix the checkForExistingBooking function to avoid index issues
async function checkForExistingBooking(userId, checkIn, checkOut, roomNumber) {
    try {
        // Check if a booking with the same dates and room already exists
        const bookingsRef = collection(db, 'everlodgebookings');
        
        // Modified query to avoid index issues by not using multiple inequality operators
        // First, get all bookings for this room number with relevant statuses
        let q = query(
            bookingsRef,
            where('propertyDetails.roomNumber', '==', roomNumber),
            where('status', 'in', ['Confirmed', 'Checked In', 'pending'])
        );
        
        let querySnapshot = await getDocs(q);
        
        // Then manually filter the results in JavaScript
        for (const doc of querySnapshot.docs) {
            const booking = doc.data();
            
            // Get booking check-in and check-out dates
            const bookingCheckIn = booking.checkIn instanceof Timestamp ? 
                booking.checkIn.toDate() : new Date(booking.checkIn);
                
            const bookingCheckOut = booking.checkOut instanceof Timestamp ? 
                booking.checkOut.toDate() : new Date(booking.checkOut);
            
            // Check if dates overlap
            if ((checkIn < bookingCheckOut && checkOut > bookingCheckIn)) {
                // If user ID matches or contact number matches
                if (booking.userId === userId) {
                    console.log('Found existing booking with same user ID');
                    return true;
                }
                
                // Also check for bookings with same contact number
                const contactNumber = document.getElementById('guest-contact').value;
                if (contactNumber && booking.contactNumber === contactNumber) {
                    console.log('Found existing booking with same contact number');
                    return true;
                }
            }
        }
        
        return false; // No duplicate found
    } catch (error) {
        console.error('Error checking for existing booking:', error);
        // Don't throw the error - just return false to allow the booking to proceed
        return false;
    }
}

// Update the validation function to handle hourly bookings properly
function validateBookingData(data) {
    try {
        // Required fields for a basic booking
        const requiredFields = [
            'userId',
            'checkIn',
            'checkOut',
            'createdAt',
            'propertyDetails',
            'guests',
            'subtotal',
            'serviceFee',
            'totalPrice',
            'paymentStatus',
            'status'
        ];
        
        // Check required fields
        for (const field of requiredFields) {
            if (!data[field]) {
                return {
                    isValid: false,
                    error: `Missing required field: ${field}`
                };
            }
        }

        // Validate property details
        const requiredPropertyFields = ['name', 'location', 'roomNumber', 'roomType', 'floorLevel'];
        for (const field of requiredPropertyFields) {
            if (!data.propertyDetails[field]) {
                return {
                    isValid: false,
                    error: `Missing required property field: ${field}`
                };
            }
        }

        // Validate dates
        if (!(data.checkIn instanceof Timestamp)) {
            return {
                isValid: false,
                error: 'Invalid checkIn date format'
            };
        }
        if (!(data.checkOut instanceof Timestamp)) {
            return {
                isValid: false,
                error: 'Invalid checkOut date format'
            };
        }
        if (!(data.createdAt instanceof Timestamp)) {
            return {
                isValid: false,
                error: 'Invalid createdAt date format'
            };
        }

        // Validate numeric fields - handle both hourly and nightly bookings
        if (data.isHourlyRate) {
            // For hourly bookings, duration is required
            if (typeof data.duration !== 'number' || data.duration <= 0) {
                return {
                    isValid: false,
                    error: 'Invalid duration for hourly booking'
                };
            }
            // Set numberOfNights to 0 for hourly bookings if not already set
            if (typeof data.numberOfNights !== 'number') {
                data.numberOfNights = 0;
            }
        } else {
            // For nightly bookings, numberOfNights is required
            if (typeof data.numberOfNights !== 'number' || data.numberOfNights <= 0) {
                return {
                    isValid: false,
                    error: 'Invalid number of nights'
                };
            }
        }
        
        if (typeof data.nightlyRate !== 'number' || data.nightlyRate <= 0) {
            return {
                isValid: false,
                error: 'Invalid nightly rate'
            };
        }
        if (typeof data.subtotal !== 'number' || data.subtotal <= 0) {
            return {
                isValid: false,
                error: 'Invalid subtotal'
            };
        }
        if (typeof data.serviceFee !== 'number' || data.serviceFee < 0) {
            return {
                isValid: false,
                error: 'Invalid service fee'
            };
        }
        if (typeof data.totalPrice !== 'number' || data.totalPrice <= 0) {
            return {
                isValid: false,
                error: 'Invalid total price'
            };
        }
        
        // Ensure total price equals subtotal (no service fee added)
        if (data.totalPrice !== data.subtotal) {
            // Fix it automatically
            data.totalPrice = data.subtotal;
        }

        // All validations passed
        return {
            isValid: true,
            error: null
        };
    } catch (error) {
        console.error('Error in validateBookingData:', error);
        return {
            isValid: false,
            error: 'Validation error: ' + error.message
        };
    }
}

// Function to initialize all event listeners
function initializeEventListeners() {
    // Add all event initialization code here
    console.log('Initializing event listeners');
    
    // Event listener for time inputs to check for night promo eligibility
    const checkInTimeSelect = document.getElementById('check-in-time');
    const checkOutTimeSelect = document.getElementById('check-out-time');
    
    if (checkInTimeSelect) {
        checkInTimeSelect.addEventListener('change', function() {
            console.log('Check-in time changed to:', this.value);
            // Check if it's 10 PM (22:00) - important for night promo
            if (this.value === '22:00') {
                console.log('Check-in time set to 10 PM - checking for night promo eligibility');
            }
            updatePromoEligibility();
        });
    }
    
    if (checkOutTimeSelect) {
        checkOutTimeSelect.addEventListener('change', function() {
            console.log('Check-out time changed to:', this.value);
            // Check if it's between 4 AM and 8 AM - important for night promo
            if (['04:00', '05:00', '06:00', '07:00', '08:00'].includes(this.value)) {
                console.log('Check-out time set to early morning - checking for night promo eligibility');
            }
            updatePromoEligibility();
        });
    }
    
    // Add event listener for hourly-toggle
    const hourlyToggle = document.getElementById('hourly-toggle');
    if (hourlyToggle) {
        hourlyToggle.addEventListener('change', function() {
            console.log('Hourly toggle changed to:', this.checked);
            updatePromoEligibility();
        });
    }
}

// Review System Instance
const reviewSystem = new ReviewSystem('ever-lodge');

// Wrap review system initialization in a function with proper error handling
function initializeReviewSystem() {
  try {
    console.log('Initializing review system for Ever Lodge');
    
    // Check if the reviews section exists
    const reviewsSection = document.getElementById('reviews-section');
    if (!reviewsSection) {
      console.warn('Reviews section not found in DOM');
      return;
    }
    
    // Skip Firebase initialization completely - use static reviews only
    console.log('Using static reviews - Firebase review system disabled');
    
    // Hide loading indicator immediately
    const loadingIndicator = document.getElementById('reviews-loading');
    if (loadingIndicator) {
      loadingIndicator.classList.add('hidden');
    }
    
    // The static reviews are already in the HTML, so no need to load anything
    console.log('Static reviews are ready');
    
    // Initialize time slot selector
    initializeTimeSlotSelector();
  } catch (error) {
    console.error('Error in initializeReviewSystem:', error);
  }
}

// Helper function to show dummy reviews when Firebase fails
function showDummyReviews(container) {
  if (!container) return;
  
  container.innerHTML = `
    <div class="border-b pb-6 mb-6">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center">
          <div class="w-12 h-12 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center mr-4">
            <i class="fas fa-user text-lg"></i>
          </div>
          <div>
            <h4 class="font-semibold text-gray-900">Michael Rodriguez</h4>
            <p class="text-sm text-gray-500">January 8, 2024</p>
          </div>
        </div>
        <div class="text-yellow-500 text-lg">
          <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
        </div>
      </div>
      <p class="text-gray-700 leading-relaxed">Absolutely fantastic experience! Ever Lodge exceeded all my expectations. The room was spotlessly clean, the location is perfect - just minutes from Session Road, and the staff was incredibly accommodating. The view from the window was breathtaking. Highly recommend for anyone visiting Baguio!</p>
    </div>
    
    <div class="border-b pb-6 mb-6">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center">
          <div class="w-12 h-12 rounded-full bg-green-100 text-green-500 flex items-center justify-center mr-4">
            <i class="fas fa-user text-lg"></i>
          </div>
          <div>
            <h4 class="font-semibold text-gray-900">Sarah Chen</h4>
            <p class="text-sm text-gray-500">December 22, 2023</p>
          </div>
        </div>
        <div class="text-yellow-500 text-lg">
          <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
        </div>
      </div>
      <p class="text-gray-700 leading-relaxed">Perfect location in the heart of Baguio! The lodge is modern, well-equipped, and very comfortable. Loved the heating system during the cold nights. The WiFi was excellent for remote work. Great value for money and would definitely stay here again.</p>
    </div>
    
    <div class="border-b pb-6 mb-6">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center">
          <div class="w-12 h-12 rounded-full bg-purple-100 text-purple-500 flex items-center justify-center mr-4">
            <i class="fas fa-user text-lg"></i>
          </div>
          <div>
            <h4 class="font-semibold text-gray-900">James Wilson</h4>
            <p class="text-sm text-gray-500">November 15, 2023</p>
          </div>
        </div>
        <div class="text-yellow-500 text-lg">
          <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="far fa-star"></i>
        </div>
      </div>
      <p class="text-gray-700 leading-relaxed">Great stay overall! The room was clean and comfortable with a nice mountain view. Easy access to local attractions and restaurants. Only minor issue was some noise from the street early in the morning, but the thick curtains helped with that. Recommended!</p>
    </div>
    
    <div class="border-b pb-6 mb-6">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center">
          <div class="w-12 h-12 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center mr-4">
            <i class="fas fa-user text-lg"></i>
          </div>
          <div>
            <h4 class="font-semibold text-gray-900">Maria Santos</h4>
            <p class="text-sm text-gray-500">October 28, 2023</p>
          </div>
        </div>
        <div class="text-yellow-500 text-lg">
          <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
        </div>
      </div>
      <p class="text-gray-700 leading-relaxed">Wonderful experience! The lodge has all the amenities you need for a comfortable stay. The kitchen was fully equipped, parking was secure, and the smart TV was great for entertainment. The location is unbeatable - walking distance to everything in Baguio.</p>
    </div>
    
    <div class="pb-6">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center">
          <div class="w-12 h-12 rounded-full bg-red-100 text-red-500 flex items-center justify-center mr-4">
            <i class="fas fa-user text-lg"></i>
          </div>
          <div>
            <h4 class="font-semibold text-gray-900">David Kim</h4>
            <p class="text-sm text-gray-500">September 12, 2023</p>
          </div>
        </div>
        <div class="text-yellow-500 text-lg">
          <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
        </div>
      </div>
      <p class="text-gray-700 leading-relaxed">Outstanding service and accommodation! The hosts were very responsive and helpful. The room was beautifully furnished with a cozy atmosphere. Perfect for couples or solo travelers. The fitness center and coffee shop were excellent additional perks. Will definitely return!</p>
    </div>
  `;
  
  // Hide the "no reviews" message
  const noReviewsMessage = document.getElementById('no-reviews');
  if (noReviewsMessage) {
    noReviewsMessage.classList.add('hidden');
  }
  
  // Hide loading indicator if it exists
  const loadingIndicator = document.getElementById('reviews-loading');
  if (loadingIndicator) {
    loadingIndicator.classList.add('hidden');
  }
}

export function getMonthlyOccupancyByRoomType() {
    // Temporarily simulating this month's occupancy data:
    const occupancyData = [
        { roomType: 'Standard', occupancy: 45 },
        { roomType: 'Deluxe', occupancy: 32 },
        { roomType: 'Suite', occupancy: 59 },
        { roomType: 'Family', occupancy: 27 }
    ];
    return occupancyData;
}

// Function to show bookings modal
export function showBookingsModal() {
    const bookingsPopup = document.getElementById('bookingsPopup');
    if (bookingsPopup) {
        bookingsPopup.classList.remove('hidden');
    } else {
        console.error('Bookings popup not found');
    }
}

// Improved initializeBookingsModal function with bookingHistory support
export function initializeBookingsModal() {
    // Create bookings popup if it doesn't exist
    if (!document.getElementById('bookingsPopup')) {
        const bookingsPopup = document.createElement('div');
        bookingsPopup.id = 'bookingsPopup';
        bookingsPopup.className = 'fixed inset-0 bg-black bg-opacity-50 hidden z-[70]';
        
        // Create the bookings modal structure
        bookingsPopup.innerHTML = `
            <div class="fixed right-0 top-0 w-96 h-full bg-white shadow-xl overflow-y-auto">
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

        // Add the modal to the body
        document.body.appendChild(bookingsPopup);
        
        // Add event listeners for close button and outside clicks
        const closeBtn = bookingsPopup.querySelector('#closeBookingsPopup');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                bookingsPopup.classList.add('hidden');
            });
        }
        
        // Close when clicking on the backdrop
        bookingsPopup.addEventListener('click', (e) => {
            if (e.target === bookingsPopup) {
                bookingsPopup.classList.add('hidden');
            }
        });
        
        // Set up event listeners for the tabs
        const tabButtons = bookingsPopup.querySelectorAll('[data-tab]');
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
                document.getElementById('currentBookings').classList.toggle('hidden', tabName !== 'current');
                document.getElementById('previousBookings').classList.toggle('hidden', tabName !== 'previous');
                document.getElementById('bookingHistoryContainer').classList.toggle('hidden', tabName !== 'history');
            });
        });
        
        // Fetch user bookings if user is authenticated
        if (auth.currentUser) {
            fetchUserBookings(auth.currentUser.uid);

            // Load booking history using our external module
            import('../Homepage/bookingHistory.js')
                .then(({ loadBookingHistory }) => {
                    loadBookingHistory(auth.currentUser.uid, db);
                })
                .catch(error => {
                    console.error('Error loading booking history module:', error);
                    document.getElementById('bookingHistoryContainer').innerHTML = `
                        <div class="text-center text-red-500 py-8">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>Error loading booking history. Please try again later.</p>
                        </div>
                    `;
                });
        }
    }
}

// Update fetchUserBookings function to match the implementation in rooms.js
async function fetchUserBookings(userId) {
    try {
        console.log('Fetching bookings for user:', userId);
        
        // Create a custom BookingService implementation that directly uses Firestore
        const createCustomBookingService = () => {
            console.log('Creating custom booking service implementation');
            
            // Collections to use
            const bookingsCollection = 'bookings';
            const everLodgeBookingsCollection = 'everlodgebookings';
            
            return {
                getUserBookings: async (userId) => {
                    try {
                        console.log('Using custom getUserBookings implementation');
                        
                        // Arrays to store current and past bookings
                        let currentBookings = [];
                        let pastBookings = [];
                        const now = new Date();
                        
                        // Collections to check
                        const collections = [
                            { name: bookingsCollection, source: 'standard' },
                            { name: everLodgeBookingsCollection, source: 'everlodge' }
                        ];
                        
                        // Fetch bookings from both collections
                        for (const { name, source } of collections) {
                            try {
                                // Use simple where query
                                const q = query(
                                    collection(db, name),
                                    where('userId', '==', userId)
                                );
                                
                                // Get the documents
                                const querySnapshot = await getDocs(q);
                                
                                // Process the documents
                                querySnapshot.forEach(doc => {
                                    try {
                                        const bookingData = doc.data();
                                        
                                        // Convert dates
                                        let checkIn, checkOut;
                                        
                                        // Handle checkIn
                                        if (bookingData.checkIn) {
                                            if (typeof bookingData.checkIn.toDate === 'function') {
                                                checkIn = bookingData.checkIn.toDate();
                                            } else if (bookingData.checkIn instanceof Date) {
                                                checkIn = bookingData.checkIn;
                                            } else {
                                                checkIn = new Date(bookingData.checkIn);
                                            }
                                        } else {
                                            checkIn = new Date(); // Fallback to current date
                                        }
                                        
                                        // Handle checkOut
                                        if (bookingData.checkOut) {
                                            if (typeof bookingData.checkOut.toDate === 'function') {
                                                checkOut = bookingData.checkOut.toDate();
                                            } else if (bookingData.checkOut instanceof Date) {
                                                checkOut = bookingData.checkOut;
                                            } else {
                                                checkOut = new Date(bookingData.checkOut);
                                            }
                                        } else {
                                            // Default to checkIn + 1 day if not available
                                            checkOut = new Date(checkIn);
                                            checkOut.setDate(checkOut.getDate() + 1);
                                        }
                                        
                                        // Create booking object with all necessary fields
                                        const booking = {
                                            id: doc.id,
                                            ...bookingData,
                                            collectionSource: source,
                                            checkIn,
                                            checkOut
                                        };
                                        
                                        // Classify as current or past
                                        if (checkOut >= now) {
                                            currentBookings.push(booking);
                                        } else {
                                            pastBookings.push(booking);
                                        }
                                    } catch (docError) {
                                        console.error('Error processing booking document:', docError);
                                    }
                                });
                            } catch (collectionError) {
                                console.error(`Error fetching from ${name}:`, collectionError);
                            }
                        }
                        
                        // Sort the bookings by date
                        const sortByDate = (a, b) => {
                            const dateA = a.checkIn instanceof Date ? a.checkIn : new Date(a.checkIn);
                            const dateB = b.checkIn instanceof Date ? b.checkIn : new Date(b.checkIn);
                            return dateB - dateA; // Most recent first
                        };
                        
                        currentBookings.sort(sortByDate);
                        pastBookings.sort(sortByDate);
                        
                        console.log('Custom booking service results:', { 
                            currentCount: currentBookings.length, 
                            pastCount: pastBookings.length 
                        });
                        
                        return { currentBookings, pastBookings };
                    } catch (error) {
                        console.error('Error in custom getUserBookings:', error);
                        return { currentBookings: [], pastBookings: [] };
                    }
                }
            };
        };
        
        // Use our custom implementation directly
        const bookingService = createCustomBookingService();
        
        try {
            // Fetch bookings using the custom service
            const { currentBookings, pastBookings } = await bookingService.getUserBookings(userId);
            
            console.log('Retrieved bookings:', { 
                currentCount: currentBookings.length, 
                pastCount: pastBookings.length 
            });
            
            // Display the bookings
            displayBookings('currentBookings', currentBookings);
            displayBookings('previousBookings', pastBookings);
        } catch (serviceError) {
            console.error('Error from booking service:', serviceError);
            
            // Display friendly error message
            const errorMessage = serviceError.message?.includes('index') 
                ? 'Database query requires an index. Please contact support.' 
                : 'Unable to load your bookings at this time';
            
            document.getElementById('currentBookings').innerHTML = `
                <div class="text-center text-red-500 py-8">
                    <p>${errorMessage}</p>
                </div>
            `;
            document.getElementById('previousBookings').innerHTML = `
                <div class="text-center text-red-500 py-8">
                    <p>${errorMessage}</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error fetching bookings:', error);
        // Show error message in the bookings containers
        const errorMessage = error.message || 'Error loading bookings';
        
        document.getElementById('currentBookings').innerHTML = `
            <div class="text-center text-red-500 py-8">
                <p>${errorMessage}</p>
            </div>
        `;
        document.getElementById('previousBookings').innerHTML = `
            <div class="text-center text-red-500 py-8">
                <p>${errorMessage}</p>
            </div>
        `;
    }
}

// Add the displayBookings function from rooms.js
function displayBookings(containerId, bookings) {
    console.log(`Displaying ${bookings.length} bookings in ${containerId}`);
    const container = document.getElementById(containerId);
    
    if (!bookings || !bookings.length) {
        container.innerHTML = `
            <p class="text-gray-500 text-center py-16">No bookings found</p>
        `;
        return;
    }
    
    // Generate HTML for each booking
    const bookingsHTML = bookings.map(booking => {
        // Format dates - properly handle Firestore Timestamp objects
        const checkInDate = booking.checkIn ? 
            (booking.checkIn.toDate ? formatDate(booking.checkIn.toDate()) : formatDate(new Date(booking.checkIn))) : 
            'N/A';
        
        const checkOutDate = booking.checkOut ? 
            (booking.checkOut.toDate ? formatDate(booking.checkOut.toDate()) : formatDate(new Date(booking.checkOut))) : 
            'N/A';
        
        // Get property details
        const propertyName = booking.propertyDetails?.name || 'Unknown Property';
        const roomType = booking.propertyDetails?.roomType || 'Standard Room';
        const roomNumber = booking.propertyDetails?.roomNumber || '';
        
        // Get status
        const status = booking.status || 'pending';
        const statusClass = getStatusClass(status);
        
        return `
            <div class="bg-white border rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-semibold">${propertyName}</h4>
                    <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">
                        ${status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                </div>
                <p class="text-sm text-gray-600 mb-2">${roomType} ${roomNumber ? `#${roomNumber}` : ''}</p>
                <div class="flex items-center text-sm text-gray-500 space-x-2 mb-2">
                    <i class="ri-calendar-line"></i>
                    <span>${checkInDate} → ${checkOutDate}</span>
                </div>
                <div class="flex justify-between items-center mt-2">
                    <span class="font-medium">₱${booking.totalPrice?.toLocaleString() || 'N/A'}</span>
                    <button class="text-blue-600 hover:text-blue-800 text-sm font-medium" 
                            data-booking-id="${booking.id}" 
                            data-collection="${booking.collectionSource}">
                        View Details
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = bookingsHTML;
    
    // Add event listeners to view details buttons
    container.querySelectorAll('[data-booking-id]').forEach(button => {
        button.addEventListener('click', () => {
            const bookingId = button.dataset.bookingId;
            const collection = button.dataset.collection;
            // Navigate to booking details page or show modal with details
            viewBookingDetails(bookingId, collection);
        });
    });
}

// Helper function for status styling
function getStatusClass(status) {
    switch (status.toLowerCase()) {
        case 'confirmed':
        case 'approved':
            return 'bg-green-100 text-green-800';
        case 'pending':
            return 'bg-yellow-100 text-yellow-800';
        case 'cancelled':
            return 'bg-red-100 text-red-800';
        case 'completed':
            return 'bg-blue-100 text-blue-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

// Function to view booking details
function viewBookingDetails(bookingId, collection) {
    console.log(`Viewing booking ${bookingId} from ${collection} collection`);
    // Navigate to the dashboard with bookingId parameter
    window.location.href = `../Dashboard/Dashboard.html?bookingId=${bookingId}&collection=${collection}`;
}

// Add integration helper for userDrawer
function drawerIntegration() {
    console.log('Setting up drawer integration for bookings');
    
    // Ensure the showBookingsModal function is available on the window object
    if (typeof window.showBookingsModal !== 'function') {
        window.showBookingsModal = showBookingsModal;
        console.log('Exposed showBookingsModal to window');
    }
    
    // Ensure the initializeBookingsModal function is available on the window object
    if (typeof window.initializeBookingsModal !== 'function') {
        window.initializeBookingsModal = initializeBookingsModal;
        console.log('Exposed initializeBookingsModal to window');
    }
    
    // Check for and handle drawer bookings button
    const drawerBookingsBtn = document.getElementById('drawerBookingsBtn');
    if (drawerBookingsBtn) {
        console.log('Found drawerBookingsBtn, adding click handler');
        drawerBookingsBtn.addEventListener('click', () => {
            showBookingsModal();
            
            // Close the drawer
            const userDrawer = document.getElementById('userDrawer');
            if (userDrawer) {
                userDrawer.classList.add('translate-x-full');
            }
        });
    }
}

// Initialize event listeners for drawer
document.addEventListener('DOMContentLoaded', () => {
    // Initialize bookings modal
    initializeBookingsModal();
    
    // Setup drawer integration
    drawerIntegration();
    
    // Check if jQuery UI datepicker is active
    const jqueryDatepickerActive = window.$ && window.$.fn && window.$.fn.datepicker && 
                                   $('#check-in-date').length > 0 && 
                                   typeof $('#check-in-date').datepicker === 'function';
    
    if (!jqueryDatepickerActive) {
        console.log('jQuery UI datepicker not detected, initializing custom calendar');
        // Initialize calendar functionality
        setupCalendarListeners();
        
        // Render the initial calendar if needed
        if (calendarGrid && calendarMonth) {
            renderCalendar(currentDate);
        }
    } else {
        console.log('jQuery UI datepicker is active, skipping custom calendar initialization');
        // Hide the custom calendar modal to prevent conflicts
        const calendarModal = document.getElementById('calendar-modal');
        if (calendarModal) {
            calendarModal.style.display = 'none';
            calendarModal.classList.add('hidden');
        }
    }
    
    // Initialize time slot selector
    initializeTimeSlotSelector();
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Check for night promo eligibility on page load
    // This is important for when the page loads with times already set to the night promo range
    setTimeout(() => {
        console.log('Running initial night promo eligibility check');
        
        // Pre-set times if they match URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const checkInTime = urlParams.get('checkin_time');
        const checkOutTime = urlParams.get('checkout_time');
        
        if (checkInTime === '22:00' && ['04:00', '05:00', '06:00', '07:00', '08:00'].includes(checkOutTime)) {
            console.log('URL parameters match night promo - setting times');
            const checkInTimeSelect = document.getElementById('check-in-time');
            const checkOutTimeSelect = document.getElementById('check-out-time');
            
            if (checkInTimeSelect) checkInTimeSelect.value = '22:00';
            if (checkOutTimeSelect) checkOutTimeSelect.value = checkOutTime || '04:00';
        }
        
        updatePromoEligibility();
    }, 500);

    // Set up auth state listener to load bookings when user is authenticated
    auth.onAuthStateChanged(user => {
        if (user) {
            console.log('User authenticated, fetching bookings');
            // If the popup exists, fetch bookings
            const bookingsPopup = document.getElementById('bookingsPopup');
            if (bookingsPopup) {
                fetchUserBookings(user.uid);
                
                // Also load booking history if tab exists
                const historyTab = bookingsPopup.querySelector('[data-tab="history"]');
                if (historyTab) {
                    try {
                        // Create a wrapper function to handle the booking history
                        const loadBookingHistoryWrapper = async (userId, database) => {
                            try {
                                // Create an adapter for the Firestore database
                                const createFirestoreAdapter = (firestoreDb) => {
                                    // Check if firestoreDb is already valid
                                    if (firestoreDb && typeof firestoreDb.collection === 'function') {
                                        console.log('DB already has collection method');
                                        return firestoreDb;
                                    }
                                    
                                    console.log('Creating Firestore adapter to add collection method');
                                    
                                    // Create adapter with collection() method
                                    return {
                                        collection: (collectionPath) => {
                                            // Return an object that mimics a Firestore collection reference
                                            return {
                                                where: (field, operator, value) => {
                                                    // Return an object that mimics a Firestore query
                                                    return {
                                                        get: async () => {
                                                            try {
                                                                // Use the query function from the Firestore module
                                                                const q = query(
                                                                    collection(database, collectionPath),
                                                                    where(field, operator, value)
                                                                );
                                                                const querySnapshot = await getDocs(q);
                                                                return querySnapshot;
                                                            } catch (error) {
                                                                console.error('Error in adapted collection().where().get():', error);
                                                                // Return empty snapshot
                                                                return { 
                                                                    empty: true, 
                                                                    docs: [],
                                                                    forEach: (callback) => {}
                                                                };
                                                            }
                                                        }
                                                    };
                                                }
                                            };
                                        }
                                    };
                                };
                                
                                // Create the adapted database object
                                const adaptedDb = createFirestoreAdapter(database);
                                
                                // Import the bookingHistory.js script
                                const bookingHistoryModule = await import('../Homepage/bookingHistory.js');
                                
                                // Check if the function is available globally after import
                                if (typeof loadBookingHistory === 'function') {
                                    console.log('Using global loadBookingHistory function');
                                    loadBookingHistory(userId, adaptedDb);
                                } else if (typeof window.loadBookingHistory === 'function') {
                                    console.log('Using window.loadBookingHistory function');
                                    window.loadBookingHistory(userId, adaptedDb);
                                } else {
                                    console.error('loadBookingHistory function not found after import');
                                    document.getElementById('bookingHistoryContainer').innerHTML = `
                                        <div class="text-center text-red-500 py-8">
                                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                                            <p>Error loading booking history. Please try again later.</p>
                                        </div>
                                    `;
                                }
                            } catch (error) {
                                console.error('Error in booking history wrapper:', error);
                                document.getElementById('bookingHistoryContainer').innerHTML = `
                                    <div class="text-center text-red-500 py-8">
                                        <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                                        <p>Error loading booking history. Please try again later.</p>
                                    </div>
                                `;
                            }
                        };
                        
                        // Call the wrapper function
                        loadBookingHistoryWrapper(user.uid, db);
                    } catch (error) {
                        console.error('Error setting up booking history:', error);
                        document.getElementById('bookingHistoryContainer').innerHTML = `
                            <div class="text-center text-red-500 py-8">
                                <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                                <p>Error loading booking history. Please try again later.</p>
                            </div>
                        `;
                    }
                }
            }
        } else {
            console.log('No user logged in, booking data not loaded');
        }
    });
    
    // Add click handler for the showBookingsBtn
    document.addEventListener('click', (e) => {
        if (e.target.closest('#showBookingsBtn')) {
            console.log('Show bookings button clicked');
            showBookingsModal();
            
            // Close the user drawer
            const userDrawer = document.getElementById('userDrawer');
            if (userDrawer) {
                userDrawer.classList.add('translate-x-full');
            }
            
            // Hide overlay
            const drawerOverlay = document.getElementById('drawerOverlay');
            if (drawerOverlay) {
                drawerOverlay.classList.add('hidden');
            }
        }
    });
});

// Update the handleReserveClick function to always set numberOfNights properly for hourly bookings
export async function handleReserveClick(event) {
  try {
    // Prevent event from bubbling up
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation(); // Prevent other handlers from running
    }
    
    console.log('HandleReserveClick called');
    
    // Enhanced global booking prevention with timestamp
    const now = Date.now();
    const lastBookingAttempt = window.lastBookingAttempt || 0;
    const MIN_BOOKING_INTERVAL = 5000; // 5 seconds minimum between attempts
    
    if (now - lastBookingAttempt < MIN_BOOKING_INTERVAL) {
      console.log('Booking attempt too soon after previous attempt, ignoring');
      return;
    }
    
    // Set timestamp for this attempt
    window.lastBookingAttempt = now;
    
    // Get the reserve button and check if it's already being processed
    const reserveBtn = document.getElementById('reserve-btn');
    if (reserveBtn) {
      // Check if already processing
      if (reserveBtn.getAttribute('data-clicked') === 'true' || reserveBtn.disabled) {
        console.log('Booking already in progress, ignoring duplicate click');
        return; // Exit early if already processing
      }
      
      // Mark as clicked to prevent duplicates
      reserveBtn.setAttribute('data-clicked', 'true');
      reserveBtn.disabled = true;
      reserveBtn.textContent = 'Processing...';
    }
    
    // Enhanced global flag to prevent multiple simultaneous bookings
    if (window.bookingInProgress) {
      console.log('Another booking is already in progress');
      if (reserveBtn) {
        reserveBtn.disabled = false;
        reserveBtn.textContent = 'Reserve';
        reserveBtn.setAttribute('data-clicked', 'false');
      }
      return;
    }
    
    // Set global flag with additional identifier
    window.bookingInProgress = true;
    window.currentBookingSessionId = 'booking_' + now + '_' + Math.random().toString(36).substr(2, 9);
    
    console.log('Starting booking session:', window.currentBookingSessionId);
    
    // Validate contact number
    const contactNumberInput = document.getElementById('guest-contact');
    if (!contactNumberInput || !contactNumberInput.value) {
      throw new Error('Please enter a contact number');
    }
    
    const contactNumber = contactNumberInput.value.trim();
    if (contactNumber.length !== 11 || !/^\d+$/.test(contactNumber)) {
      throw new Error('Please enter a valid 11-digit contact number');
    }
    
    // Get check-in and check-out dates and times
    const checkInDate = document.getElementById('check-in-date').value;
    const checkOutDate = document.getElementById('check-out-date').value;
    
    if (!checkInDate) {
      throw new Error('Please select a check-in date');
    }
    
    const checkInTime = document.getElementById('check-in-time').value;
    const checkOutTime = document.getElementById('check-out-time').value;
    
    if (!checkInTime) {
      throw new Error('Please select a check-in time');
    }
    
    // For same-day bookings, check out time is required
    if (checkInDate === checkOutDate && !checkOutTime) {
      throw new Error('Please select a check-out time for same-day booking');
    }
    
    // Get the number of guests
    const guests = parseInt(document.getElementById('guests').value) || 1;
    
    // Check for user authentication
    if (!auth) {
      console.error('Firebase auth is not initialized');
      throw new Error('Authentication service is not available. Please try again later.');
    }
    
    if (!auth.currentUser) {
      console.log('User not logged in, redirecting to login page');
      // Prompt user to login
      alert('Please log in to make a reservation');
      
      // Save the booking data to localStorage for later
      const bookingData = {
        checkInDate,
        checkOutDate,
        checkInTime,
        checkOutTime,
        guests,
        contactNumber
      };
      
      localStorage.setItem('pendingBooking', JSON.stringify(bookingData));
      
      // Reset the button
      if (reserveBtn) {
        reserveBtn.disabled = false;
        reserveBtn.textContent = 'Reserve';
        reserveBtn.setAttribute('data-clicked', 'false');
        reserveBtn.classList.remove('bg-gray-500');
      }
      
      // Redirect to login page
      window.location.href = '../Login/index.html?redirect=' + encodeURIComponent(window.location.href);
      return;
    }
    
    console.log('User authenticated:', auth.currentUser.uid);
    
    // Get user data - with added error handling
    let userData;
    try {
      userData = await getCurrentUserData();
      
      if (!userData) {
        console.error('No user data retrieved despite being logged in');
        
        // Fallback to current user info from auth
        userData = {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email || '',
          fullname: auth.currentUser.displayName || 'Guest',
          username: auth.currentUser.email ? auth.currentUser.email.split('@')[0] : 'guest'
        };
        
        console.log('Created fallback user data:', userData);
      }
      
      // Double check that we have a user ID
      if (!userData.uid) {
        if (auth.currentUser.uid) {
          userData.uid = auth.currentUser.uid;
        } else {
          throw new Error('User ID missing from authentication data');
        }
      }
    } catch (userDataError) {
      console.error('Error retrieving user data:', userDataError);
      throw new Error('Could not retrieve your user information. Please try logging in again.');
    }
    
    // Create the dates in the proper format
    const checkInDateObj = new Date(checkInDate);
    let checkOutDateObj;
    
    if (checkOutDate) {
      checkOutDateObj = new Date(checkOutDate);
    } else {
      // For hourly bookings or same-day bookings, set check-out to same day
      checkOutDateObj = new Date(checkInDate);
    }
    
    // Set the time components
    if (checkInTime) {
      const [hours, minutes] = checkInTime.split(':').map(Number);
      checkInDateObj.setHours(hours, minutes, 0, 0);
    }
    
    if (checkOutTime) {
      const [hours, minutes] = checkOutTime.split(':').map(Number);
      checkOutDateObj.setHours(hours, minutes, 0, 0);
    }
    
    // Check date validity
    if (checkOutDateObj <= checkInDateObj) {
      throw new Error('Check-out date/time must be after check-in date/time');
    }
    
    // Log the user ID we're using
    console.log('Using user ID for booking:', userData.uid);
    
    // Check for an available room
    const availableRoom = await findAvailableRoom(checkInDateObj, checkOutDateObj);
    if (!availableRoom.available) {
      throw new Error(availableRoom.error || 'No rooms available for the selected dates');
    }
    
    // Calculate staying details
    const nights = calculateNights(checkInDateObj, checkOutDateObj);
    const hours = calculateHours(checkInDateObj, checkOutDateObj);
    
    // Determine if it's an hourly booking - same day or duration less than 24 hours
    let isHourlyRate;
    if (checkInDate === checkOutDate) {
      isHourlyRate = true;
    } else {
      // If different days but duration is short, still treat as hourly
      isHourlyRate = hours <= 12;
    }
    
    console.log('Booking details:', {
      nights,
      hours,
      isHourlyRate,
      checkInDate,
      checkOutDate
    });
    
    // Determine booking type and rate
    const rateTypeValue = document.getElementById('rate-type-value')?.value || 'standard';
    
    // Check for night promo eligibility (check-in at 10PM, check-out between 4AM-8AM)
    const isNightPromo = (checkInTime === '22:00' && 
                        ['04:00', '05:00', '06:00', '07:00', '08:00'].includes(checkOutTime) &&
                        nights === 1);
    
    // Use night-promo if it's eligible, otherwise use the value from hidden input
    const bookingRateType = isNightPromo ? 'night-promo' : rateTypeValue;
    
    // Calculate costs
    const { nightlyRate, subtotal, totalAmount } = calculateBookingCosts(
      nights,
      bookingRateType, // Use night-promo if eligible
      true, // hasCheckOut
      false, // hasTvRemote
      hours
    );
    
    // Check for duplicate booking
    const hasDuplicate = await checkForExistingBooking(
      userData.uid, 
      checkInDateObj, 
      checkOutDateObj, 
      availableRoom.roomNumber
    );
    
    if (hasDuplicate) {
      throw new Error('You already have a booking for these dates');
    }
    
    // Create the booking data - ensuring userId is present and handling hourly bookings correctly
    const bookingData = {
      userId: userData.uid,
      guestName: userData.fullname || userData.username || 'Guest',
      email: userData.email || '',
      contactNumber: contactNumber,
      propertyDetails: {
        name: 'Ever Lodge',
        location: 'Baguio City, Philippines',
        roomNumber: availableRoom.roomNumber,
        roomType: 'Deluxe Suite',
        floorLevel: availableRoom.floorLevel || '2'
      },
      checkIn: checkInDateObj.toISOString(), // Store as ISO string for localStorage
      checkOut: checkOutDateObj.toISOString(), // Store as ISO string for localStorage
      createdAt: new Date().toISOString(), // Store as ISO string for localStorage
      guests: guests,
      // Always set both numberOfNights and duration
      numberOfNights: isHourlyRate ? 0 : nights,
      duration: hours,
      nightlyRate: nightlyRate,
      subtotal: subtotal,
      serviceFee: 0, // Service fee is now explicitly 0
      totalPrice: totalAmount, // This should equal subtotal since service fee is 0
      bookingType: isHourlyRate ? 'hourly' : (isNightPromo ? 'night-promo' : 'standard'),
      isHourlyRate: isHourlyRate,
      paymentStatus: 'pending',
      status: 'pending'
    };
    
    // Make sure totalPrice is equal to subtotal to avoid any service fee
    bookingData.totalPrice = bookingData.subtotal;
    
    // Log the booking data before validation
    console.log('Booking data to be validated:', {
      userId: bookingData.userId,
      propertyDetails: bookingData.propertyDetails,
      isHourlyRate: bookingData.isHourlyRate,
      numberOfNights: bookingData.numberOfNights,
      duration: bookingData.duration,
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      nightlyRate: bookingData.nightlyRate,
      bookingType: bookingData.bookingType
    });
    
    // Additional safety check for userId
    if (!bookingData.userId) {
      console.error('User ID is missing from booking data after creation');
      if (auth.currentUser && auth.currentUser.uid) {
        console.log('Retrieved user ID from auth.currentUser:', auth.currentUser.uid);
        bookingData.userId = auth.currentUser.uid;
      } else {
        throw new Error('Could not determine your user ID. Please log in again.');
      }
    }
    
    // Clear old booking data to prevent issues with stale data
    localStorage.removeItem('tempBookingData');
    localStorage.removeItem('bookingData');
    localStorage.removeItem('tempBookingId');
    localStorage.removeItem('currentBookingId');
    localStorage.removeItem('currentBooking');
    localStorage.removeItem('currentSessionDraftId');
    localStorage.removeItem('recentlyConfirmedBooking');
    
    // Also clear any backup storage
    sessionStorage.removeItem('backupBookingData');
    sessionStorage.removeItem('tempBookingData');
    
    // Store booking data in localStorage as a fallback
    const bookingDataJson = JSON.stringify(bookingData);
    localStorage.setItem('tempBookingData', bookingDataJson);
    
    // Also save to Firebase draft collection
    let draftBookingId;
    try {
      draftBookingId = await saveDraftBookingToFirebase(bookingData);
      console.log('Successfully saved draft booking to Firebase:', draftBookingId);
      // Store the Firebase document ID
      localStorage.setItem('tempBookingId', draftBookingId);
    } catch (firebaseError) {
      console.error('Failed to save to Firebase, using local ID instead:', firebaseError);
      // Fallback to local ID if Firebase save fails
      const tempBookingId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('tempBookingId', tempBookingId);
      draftBookingId = tempBookingId;
    }
    
    // Reset the button
    if (reserveBtn) {
      reserveBtn.disabled = false;
      reserveBtn.textContent = 'Reserve';
      reserveBtn.setAttribute('data-clicked', 'false');
      reserveBtn.classList.remove('bg-gray-500');
    }
    
    // Clear global flags and session
    window.bookingInProgress = false;
    window.currentBookingSessionId = null;
    
    console.log('Booking session completed successfully:', window.currentBookingSessionId);
    
    // Create and attach a custom event to force data persistence before page unload
    const storageEvent = new Event('storage_complete');
    document.dispatchEvent(storageEvent);
    
    // Small delay to ensure data is written before navigation
    setTimeout(() => {
      console.log('Redirecting to payment page');
      // Redirect to payment page with Firebase document ID
      window.location.href = `../paymentProcess/pay.html?bookingId=${draftBookingId}&source=draft`;
    }, 100);
    
    return draftBookingId;
  } catch (error) {
    console.error('Error in handleReserveClick:', error);
    
    // Clear global flags on error
    window.bookingInProgress = false;
    window.currentBookingSessionId = null;
    
    // Show error message
    const errorModal = document.getElementById('reservation-error-modal');
    const errorMessage = document.getElementById('reservation-error-message');
    
    if (errorModal && errorMessage) {
      errorMessage.textContent = error.message || 'An error occurred while processing your reservation';
      errorModal.classList.remove('hidden');
      
      // Add event listener to close the modal
      const closeButtons = errorModal.querySelectorAll('.close-modal');
      closeButtons.forEach(button => {
        button.addEventListener('click', () => {
          errorModal.classList.add('hidden');
        });
      });
    } else {
      alert(error.message || 'An error occurred while processing your reservation');
    }
    
    // Reset the button
    const reserveBtn = document.getElementById('reserve-btn');
    if (reserveBtn) {
      reserveBtn.disabled = false;
      reserveBtn.textContent = 'Reserve';
      reserveBtn.setAttribute('data-clicked', 'false');
      reserveBtn.classList.remove('bg-gray-500');
    }
    
    throw error;
  }
}

// Add this new function after the validateBookingData function

// Function to save draft booking to Firebase
async function saveDraftBookingToFirebase(bookingData) {
  try {
    console.log('Saving draft booking to Firebase');
    
    // Check for duplicate booking attempts
    const sessionId = window.currentBookingSessionId;
    if (!sessionId) {
      throw new Error('No valid booking session found');
    }
    
    // Check if we've already created a draft booking for this session
    const existingDraftId = localStorage.getItem('currentSessionDraftId');
    if (existingDraftId && existingDraftId.startsWith(sessionId)) {
      console.log('Draft booking already created for this session:', existingDraftId);
      return existingDraftId.split('_')[3]; // Extract the actual Firebase ID
    }
    
    // Convert date strings back to Timestamp objects for Firebase
    const firebaseBookingData = {
      ...bookingData,
      checkIn: Timestamp.fromDate(new Date(bookingData.checkIn)),
      checkOut: Timestamp.fromDate(new Date(bookingData.checkOut)),
      createdAt: Timestamp.fromDate(new Date(bookingData.createdAt)),
      sessionId: sessionId // Include session ID for tracking
    };
    
    // Save to a draftBookings collection
    const draftBookingsRef = collection(db, 'draftBookings');
    const docRef = await addDoc(draftBookingsRef, firebaseBookingData);
    
    // Store the draft ID with session info to prevent duplicates
    localStorage.setItem('currentSessionDraftId', `${sessionId}_${docRef.id}`);
    
    console.log('Draft booking saved to Firebase with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving draft booking to Firebase:', error);
    throw error;
  }
}

// Make sure to integrate with userDrawer when loaded, even if DOMContentLoaded already fired
try {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('Document already loaded, running drawer integration immediately');
    setTimeout(drawerIntegration, 100);
  }
} catch (e) {
  console.error('Error running drawer integration:', e);
}

// Force override of booking calculations right after DOM loaded
document.addEventListener('DOMContentLoaded', function() {
  // Force SERVICE_FEE_PERCENTAGE to be zero
  SERVICE_FEE_PERCENTAGE = 0;
  
  console.log('DOM loaded - ensuring service fee is completely removed');
  
  // Override the calculateBookingCosts function if it was replaced
  const safeCalculateBookingCosts = calculateBookingCosts;
  calculateBookingCosts = function(...args) {
    const result = safeCalculateBookingCosts(...args);
    
    // Force service fee to be 0 and total amount to equal subtotal
    result.serviceFeeAmount = 0;
    result.totalAmount = result.subtotal;
    
    return result;
  };
  
  // Check if any service fee elements still exist and hide them
  const serviceFeeElements = document.querySelectorAll('[id*="service-fee"], [id*="serviceFee"]');
  serviceFeeElements.forEach(element => {
    element.style.display = 'none';
  });
  
  // Check for any pricing rows that might be for service fees
  const pricingDetails = document.getElementById('pricing-details');
  if (pricingDetails) {
    const rows = pricingDetails.querySelectorAll('p');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      if (text.includes('service') || text.includes('fee')) {
        row.style.display = 'none';
      }
    });
  }
  
  // Properly attach event listener to reserve button
  const reserveBtn = document.getElementById('reserve-btn');
  if (reserveBtn) {
    // Check if event listener was already attached
    if (reserveBtn.dataset.listenerAttached === 'true') {
      console.log('Reserve button event listener already attached');
      return;
    }
    
    // Remove any existing event listeners by cloning the button
    const newReserveBtn = reserveBtn.cloneNode(true);
    reserveBtn.parentNode.replaceChild(newReserveBtn, reserveBtn);
    
    // Mark as having listener attached
    newReserveBtn.dataset.listenerAttached = 'true';
    
    // Attach single event listener with enhanced protection
    newReserveBtn.addEventListener('click', function(event) {
      // Prevent any other handlers from running
      event.stopImmediatePropagation();
      event.preventDefault();
      
      // Call the main handler
      handleReserveClick(event);
    }, { once: false, passive: false });
    
    // Disable any fallback mechanisms to prevent double triggering
    window.reserveClickFallback = null;
    window.emergencyReserveClickFallback = function() {
      console.log('Fallback disabled to prevent duplicate bookings');
    };
    
    console.log('Reserve button event listener attached with enhanced protection');
  } else {
    console.error('Reserve button not found!');
  }
  
  // Initialize the review system
  console.log('Initializing review system...');
  try {
    setTimeout(() => {
      initializeReviewSystem();
    }, 500); // Small delay to ensure all elements are ready
  } catch (error) {
    console.error('Error initializing review system:', error);
    // If review system fails, show dummy reviews immediately
    setTimeout(() => {
      const reviewsList = document.getElementById('user-reviews-list');
      const loadingIndicator = document.getElementById('reviews-loading');
      if (loadingIndicator) {
        loadingIndicator.classList.add('hidden');
      }
      if (reviewsList) {
        showDummyReviews(reviewsList);
      }
    }, 1000);
  }
});

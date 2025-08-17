import { 
    auth, 
    db, 
    collection, 
    addDoc,
    doc,
    deleteDoc,
    updateDoc,
    Timestamp,
    getDocs,
    query,
    orderBy,
    where,
    getDoc,
    checkAdminAuth,
    signOut
} from '../firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { PageLogger } from '../js/pageLogger.js';
// Import updated rate calculation module
import { 
    calculateNights, 
    calculateHours,
    isNightPromoEligible, 
    getHourlyRate,
    calculateBookingCosts 
} from '../js/rateCalculation.js';

// Add activity logging function
async function logBillingActivity(actionType, details) {
    try {
        const user = auth().currentUser;
        if (!user) return;

        await addDoc(collection(db(), 'activityLogs'), {
            userId: user.uid,
            userName: user.email,
            actionType,
            details,
            timestamp: Timestamp.now(),
            userRole: 'admin',
            module: 'Billing'
        });
    } catch (error) {
        console.error('Error logging billing activity:', error);
    }
}

// Function to fetch booking data by ID
async function fetchBookingById(bookingId) {
    try {
        const bookingDocRef = doc(db(), 'everlodgebookings', bookingId);
        const bookingDoc = await getDoc(bookingDocRef);
        
        if (bookingDoc.exists()) {
            return {
                id: bookingDoc.id,
                ...bookingDoc.data()
            };
        } else {
            console.log(`No booking found with ID: ${bookingId}`);
            return null;
        }
    } catch (error) {
        console.error('Error fetching booking:', error);
        throw error;
    }
}

// Function to update booking in Room Management
async function updateBookingInRoomManagement(bookingId, updateData) {
    try {
        if (!bookingId) throw new Error('No booking ID provided');
        
        // Get the current booking data
        const bookingRef = doc(db(), 'everlodgebookings', bookingId);
        const bookingDoc = await getDoc(bookingRef);
        
        if (!bookingDoc.exists()) {
            throw new Error(`Booking with ID ${bookingId} not found`);
        }
        
        // Update the booking with new data
        await updateDoc(bookingRef, updateData);
        
        return true;
    } catch (error) {
        console.error('Error updating booking in Room Management:', error);
        throw error;
    }
}

new Vue({
    el: '#app',
    data() {
        return {
            isAuthenticated: false,
            loading: true,
            isUpdating: false,
            searchQuery: '',
            bills: [],
            filteredBills: [], 
            showViewModal: false,
            editingBill: null,
            currentBillId: null,
            startDate: '',
            endDate: '',
            originalBills: [], 
            currentPage: 1,
            itemsPerPage: 10,
            currentDate: new Date(),
            view: 'all',
            isEditMode: false,
            isExpenseOnlyEdit: false, // Add flag for expense-only editing
            
            // Constants for billing calculations
            REMOTE_BOOKING_FEE: 50, // PHP
            TV_REMOTE_FEE: 50, // PHP
        }
    },
    computed: {
        calculateEditTotal() {
            if (!this.editingBill) return '0.00';
            
            let total = 0;
            
            // Add base cost
            total += parseFloat(this.editingBill.baseCost) || 0;
            
            // Add expenses
            if (this.editingBill.expenses) {
                total += this.editingBill.expenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);
            }
            
            return total.toFixed(2);
        },
        searchedBills() {
            if (!this.searchQuery.trim()) {
                return this.bills;
            }
            
            const query = this.searchQuery.toLowerCase().trim();
            return this.bills.filter(bill => {
                return (
                    (bill.customerName && bill.customerName.toLowerCase().includes(query)) ||
                    (bill.roomNumber && bill.roomNumber.toLowerCase().includes(query)) ||
                    (bill.roomType && bill.roomType.toLowerCase().includes(query)) ||
                    (bill.status && bill.status.toLowerCase().includes(query)) ||
                    (bill.totalAmount && bill.totalAmount.toString().includes(query))
                );
            });
        },
        finalFilteredBills() {
            let bills = this.searchedBills;
            
            // Apply date range filter if both startDate and endDate are set
            if (this.startDate && this.endDate) {
                bills = this.filteredBills.length > 0 ? this.filteredBills : bills;
            } else {
                // If no date range filter is active, use the single-day filter
                bills = this.filteredBillsByDate.filter(bill => {
                    // Apply search filter to the day-filtered bills
                    if (!this.searchQuery.trim()) {
                        return true;
                    }
                    
                    const query = this.searchQuery.toLowerCase().trim();
                    return (
                        (bill.customerName && bill.customerName.toLowerCase().includes(query)) ||
                        (bill.roomNumber && bill.roomNumber.toLowerCase().includes(query)) ||
                        (bill.roomType && bill.roomType.toLowerCase().includes(query)) ||
                        (bill.status && bill.status.toLowerCase().includes(query)) ||
                        (bill.totalAmount && bill.totalAmount.toString().includes(query))
                    );
                });
            }
            
            return bills;
        },
        paginatedBills() {
            const start = (this.currentPage - 1) * this.itemsPerPage;
            const end = start + this.itemsPerPage;
            return this.finalFilteredBills.slice(start, end);
        },
        totalPages() {
            return Math.ceil(this.finalFilteredBills.length / this.itemsPerPage);
        },
        showNoDataMessage() {
            return this.finalFilteredBills.length === 0 && ((this.startDate && this.endDate) || this.searchQuery.trim());
        },
        formattedCurrentDate() {
            return this.formatDisplayDate(this.currentDate);
        },
        filteredBillsByDate() {
            // Get current date for filtering with time set to start of day
            const today = new Date(this.currentDate);
            today.setHours(0, 0, 0, 0);
            
            // Get end of day for the current date
            const endOfDay = new Date(this.currentDate);
            endOfDay.setHours(23, 59, 59, 999);
            
            console.log(`Filtering bills by current date: ${this.currentDate.toLocaleDateString()}`);
            
            return this.bills.filter(bill => {
                // Skip bills without date info
                if (!bill.date) return false;
                
                // Convert bill date to Date object if it's not already
                const billDate = bill.date instanceof Date ? bill.date : new Date(bill.date);
                
                // Check if bill date is within the current day or check-out date is within current day
                // Or if the stay spans over the current day (checked in before and checking out after)
                if (bill.checkOut) {
                    const checkOutDate = bill.checkOut instanceof Date ? bill.checkOut : new Date(bill.checkOut);
                    
                    return (
                        // Check-in is on the selected day
                        (billDate >= today && billDate <= endOfDay) ||
                        // Check-out is on the selected day
                        (checkOutDate >= today && checkOutDate <= endOfDay) ||
                        // Stay spans over the selected day
                        (billDate < today && checkOutDate > today)
                    );
                } else {
                    // If no check-out date, just check if bill date is on the current day
                    return billDate >= today && billDate <= endOfDay;
                }
            });
        }
    },
    watch: {
        // Reset to first page when search query changes
        searchQuery() {
            this.currentPage = 1;
        }
    },
    methods: {
        async handleLogout() {
            try {
                await signOut();
                window.location.href = '../Login/index.html';
            } catch (error) {
                console.error('Error signing out:', error);
                alert('Error signing out. Please try again.');
            }
        },

        checkAuthState() {
            const currentAuth = auth();
            onAuthStateChanged(currentAuth, async (user) => {
                this.isAuthenticated = !!user;
                if (!user) {
                    window.location.href = '../Login/index.html';
                }
                this.loading = false;
            });
        },

        async processPayment() {
            try {
                // ...existing payment processing logic...
                await logBillingActivity('billing_payment', `Processed payment for ${this.customerName}`);
            } catch (error) {
                console.error('Error processing payment:', error);
                await logBillingActivity('billing_error', `Payment processing failed: ${error.message}`);
            }
        },

        async addCharge() {
            try {
                // ...existing charge addition logic...
                await logBillingActivity('billing_charge', `Added charge of ${amount} for ${description}`);
            } catch (error) {
                console.error('Error adding charge:', error);
                await logBillingActivity('billing_error', `Failed to add charge: ${error.message}`);
            }
        },

        async applyDiscount() {
            try {
                // ...existing discount logic...
                await logBillingActivity('billing_discount', `Applied ${discount}% discount`);
            } catch (error) {
                console.error('Error applying discount:', error);
                await logBillingActivity('billing_error', `Failed to apply discount: ${error.message}`);
            }
        },

        // Check if a bill can be edited (only bills from today or future dates can be edited and not checked out or cancelled)
        canEditBill(bill) {
            console.log('Checking if bill can be edited:', bill);
            
            // First check the status - bills that are checked out or cancelled cannot be edited
            if (bill.status) {
                const status = bill.status.toLowerCase();
                if (status === 'canceled' || status === 'cancelled' || 
                    status === 'checked out' || status === 'checked-out' || 
                    status === 'completed' || status === 'complete' ||
                    status === 'finished' || status === 'ended') {
                    console.log('Bill cannot be edited due to status:', bill.status);
                    return false;
                }
            }
            
            // Use check-in date for comparison
            if (!bill.date) {
                console.log('No check-in date found - allowing edit');
                return true;
            }
            
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of today
            
            // Convert bill check-in date to Date object and normalize time
            let billDate;
            if (bill.date.toDate) {
                // Firestore timestamp
                billDate = bill.date.toDate();
            } else if (bill.date instanceof Date) {
                billDate = new Date(bill.date);
            } else {
                // String date
                billDate = new Date(bill.date);
            }
            billDate.setHours(0, 0, 0, 0); // Start of bill date
            
            console.log('Today:', today);
            console.log('Bill check-in date:', billDate);
            
            // Check if bill date is older than today
            const isOlderThanToday = billDate.getTime() < today.getTime();
            
            console.log('Is bill older than today?', isOlderThanToday);
            
            const canEdit = !isOlderThanToday; // Can edit only if NOT older than today
            console.log('Can edit this bill?', canEdit);
            
            // Return false if bill is from any date before today (cannot edit)
            return canEdit;
        },

        async loadBills() {
            try {
                this.loading = true;
                console.log("Loading bills from everlodgebookings collection...");
                
                // Reset cached data to force a fresh load
                this.bills = [];
                this.filteredBills = [];
                
                // Fetch booking data directly from everlodgebookings collection
                const bookingsQuery = query(collection(db(), 'everlodgebookings'), orderBy('createdAt', 'desc'));
                const bookingsSnapshot = await getDocs(bookingsQuery);
                
                const bookings = bookingsSnapshot.docs
                    .filter(doc => {
                        // Filter out bookings that are marked as hidden in billing
                        const data = doc.data();
                        return !data.hiddenInBilling;
                    })
                    .map(doc => {
                        const data = doc.data();
                        console.log('Raw booking data for billing:', data);
                        
                        // Extract room details with enhanced fallback options
                        const roomNumber = data.roomNumber || 
                            (data.propertyDetails && data.propertyDetails.roomNumber) || 
                            (data.room && data.room.number) || '';
                        
                        const roomType = data.roomType || 
                            (data.propertyDetails && data.propertyDetails.roomType) || 
                            (data.room && data.room.type) || '';

                        // Create billing record from booking
                        return {
                            id: doc.id,
                            bookingId: doc.id,
                            customerName: data.guestName || (data.guest && data.guest.name) || (data.propertyDetails && data.propertyDetails.guestName) || 'Guest',
                            date: data.checkIn,
                            checkOut: data.checkOut,
                            roomNumber: roomNumber,
                            roomType: roomType,
                            baseCost: data.subtotal || data.basePrice || data.price || 0,
                            serviceFee: data.serviceFee || 0,
                            totalAmount: data.total || data.totalPrice || data.amount || 0,
                            expenses: data.expenses || [],
                            status: data.status || 'pending',
                            paymentStatus: data.paymentStatus || 'pending',
                            bookingType: data.bookingType || 'daily',
                            duration: data.duration || '',
                            source: 'everlodgebookings'
                        };
                    });
                
                console.log("Bills data received:", bookings.length, "records");
                
                // Process each bill to ensure proper format for display
                this.bills = bookings.map(bill => {
                    // Ensure expenses array exists
                    if (!bill.expenses) {
                        bill.expenses = [];
                    }
                    
                    // Convert dates for proper display
                    if (bill.date) {
                        if (typeof bill.date === 'object' && bill.date.seconds) {
                            // Firestore Timestamp object
                            bill.date = new Date(bill.date.seconds * 1000);
                        } else if (!(bill.date instanceof Date)) {
                            // Date string
                            bill.date = new Date(bill.date);
                        }
                    }
                    
                    if (bill.checkOut) {
                        if (typeof bill.checkOut === 'object' && bill.checkOut.seconds) {
                            // Firestore Timestamp object
                            bill.checkOut = new Date(bill.checkOut.seconds * 1000);
                        } else if (!(bill.checkOut instanceof Date)) {
                            // Date string
                            bill.checkOut = new Date(bill.checkOut);
                        }
                    }
                    
                    // Calculate stay duration for display
                    if (bill.date && bill.checkOut) {
                        const checkIn = new Date(bill.date);
                        const checkOut = new Date(bill.checkOut);
                        
                        // Calculate total hours first
                        const totalHours = Math.ceil(Math.abs(checkOut - checkIn) / (1000 * 60 * 60));
                        
                        // Calculate nights (whole days)
                        const nights = Math.floor(totalHours / 24);
                        
                        // Calculate remaining hours after subtracting full nights
                        const remainingHours = totalHours % 24;
                        
                        console.log(`Duration calculation for ${bill.customerName}: totalHours=${totalHours}, nights=${nights}, remainingHours=${remainingHours}`);
                        
                        if (nights === 0) {
                            // For same-day bookings (hourly), show hours only
                            bill.duration = `${totalHours} hour${totalHours !== 1 ? 's' : ''}`;
                        } else if (remainingHours === 0) {
                            // For exact night stays with no extra hours
                            bill.duration = `${nights} night${nights !== 1 ? 's' : ''}`;
                        } else {
                            // For stays with both nights and extra hours
                            bill.duration = `${nights} night${nights !== 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
                        }
                    } else {
                        bill.duration = 'N/A';
                    }
                    
                    return bill;
                });
                
                console.log("Processed bills:", this.bills);
                
                // Store original copy for filtering
                this.originalBills = [...this.bills];
                
                // Set loading to false
                this.loading = false;
            } catch (error) {
                console.error("Error loading bills:", error);
                alert("Failed to load billing data. Please try again.");
                this.loading = false;
            }
        },
        sortBills() {
            if (!this.sortDate) {
                this.bills = [...this.originalBills]; 
                return;
            }

            const selectedDate = new Date(this.sortDate);
            selectedDate.setHours(0, 0, 0, 0); 
            
            this.bills.sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                
                // Find the difference from the selected date
                const diffA = Math.abs(dateA - selectedDate);
                const diffB = Math.abs(dateB - selectedDate);
                
                return diffA - diffB; 
            });
        },

        filterByDateRange() {
            if (!this.startDate || !this.endDate) {
                alert('Please select both start and end dates.');
                return;
            }

            // Validate that end date is not before start date
            if (new Date(this.endDate) < new Date(this.startDate)) {
                alert('End date cannot be earlier than start date.');
                return;
            }

            // Create date objects with time boundaries
            const startDate = new Date(this.startDate);
            startDate.setHours(0, 0, 0, 0);
            
            const endDate = new Date(this.endDate);
            endDate.setHours(23, 59, 59, 999);

            console.log(`Filtering by date range: ${this.startDate} to ${this.endDate}`);
            console.log(`Bills to filter: ${this.bills.length}`);

            this.filteredBills = this.bills.filter(bill => {
                // Skip bills without date info
                if (!bill.date) return false;
                
                // Convert bill dates to Date objects
                const billDate = bill.date instanceof Date ? bill.date : new Date(bill.date);
                
                // Check if any part of the stay overlaps with the selected date range
                if (bill.checkOut) {
                    const checkOutDate = bill.checkOut instanceof Date ? bill.checkOut : new Date(bill.checkOut);
                    
                    return (
                        // Check-in is within the date range
                        (billDate >= startDate && billDate <= endDate) ||
                        // Check-out is within the date range
                        (checkOutDate >= startDate && checkOutDate <= endDate) ||
                        // Stay spans over the date range (checked in before and checking out after)
                        (billDate < startDate && checkOutDate > endDate) ||
                        // Stay overlaps with the start of the range
                        (billDate < startDate && checkOutDate >= startDate && checkOutDate <= endDate) ||
                        // Stay overlaps with the end of the range
                        (billDate >= startDate && billDate <= endDate && checkOutDate > endDate)
                    );
                } else {
                    // If no check-out date, just check if bill date is within the range
                    return billDate >= startDate && billDate <= endDate;
                }
            });

            console.log(`Filtered bills: ${this.filteredBills.length} results found for date range ${this.startDate} to ${this.endDate}`);

            // Reset to first page when filtering
            this.currentPage = 1;
        },

        resetFilter() {
            // Clear the date range filter
            this.startDate = '';
            this.endDate = '';
            this.filteredBills = [];
            this.currentPage = 1;
            
            // Clear the search query
            this.searchQuery = '';
        },

        formatDate(date) {
            if (!date) return 'N/A';
            
            try {
                // Convert to Date object if not already
                const dateObj = date instanceof Date ? date : new Date(date);
                
                // Check if date is valid
                if (isNaN(dateObj.getTime())) return 'Invalid date';
                
                // Format date with time
                return dateObj.toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (error) {
                console.error('Error formatting date:', error);
                return 'Error';
            }
        },
        viewBill(bill) {
            // Deep copy to avoid modifying the original
            this.editingBill = JSON.parse(JSON.stringify(bill));
            
            // Ensure expenses array exists
            if (!this.editingBill.expenses) {
                this.editingBill.expenses = [];
            }
            
            // Format date and time for proper display in form inputs
            if (bill.date) {
                const checkInDate = bill.date instanceof Date ? bill.date : new Date(bill.date);
                
                // Format date as YYYY-MM-DD for the date input
                this.editingBill.date = checkInDate.toISOString().split('T')[0];
                
                // Format time as HH:MM for the time input
                const hours = checkInDate.getHours().toString().padStart(2, '0');
                const minutes = checkInDate.getMinutes().toString().padStart(2, '0');
                this.editingBill.checkInTime = `${hours}:${minutes}`;
            }
            
            if (bill.checkOut) {
                const checkOutDate = bill.checkOut instanceof Date ? bill.checkOut : new Date(bill.checkOut);
                
                // Format date as YYYY-MM-DD for the date input
                this.editingBill.checkOut = checkOutDate.toISOString().split('T')[0];
                
                // Format time as HH:MM for the time input
                const hours = checkOutDate.getHours().toString().padStart(2, '0');
                const minutes = checkOutDate.getMinutes().toString().padStart(2, '0');
                this.editingBill.checkOutTime = `${hours}:${minutes}`;
            }
            
            // Set current ID
            this.currentBillId = bill.id || (bill.source === 'bookings' ? bill.bookingId : null);
            console.log('View bill - Using ID:', this.currentBillId);
            this.showViewModal = true;
            this.isEditMode = false;
        },
        
        openEditModal(bill) {
            console.log('Opening edit modal for bill:', bill);
            
            // Check if bill can be edited
            if (!this.canEditBill(bill)) {
                const status = bill.status ? bill.status.toLowerCase() : '';
                let message = 'This bill cannot be edited.';
                
                if (status === 'canceled' || status === 'cancelled') {
                    message = 'This bill cannot be edited because it has been cancelled.';
                } else if (status === 'checked out' || status === 'checked-out' || status === 'completed' || status === 'complete' || status === 'finished' || status === 'ended') {
                    message = 'This bill cannot be edited because it has been checked out or completed.';
                } else {
                    message = 'This bill cannot be edited because it is from a date older than today. You can only edit bills from today or future dates.';
                }
                
                alert(message);
                return;
            }
            
            // Create a deep copy of the bill
            this.editingBill = {
                ...bill,
                expenses: bill.expenses ? [...bill.expenses] : [],
                bookingType: bill.bookingType || 'standard',
                duration: bill.duration || 3,
                hasTvRemote: bill.hasTvRemote || false,
                hourlyPrice: bill.hourlyPrice || 0 // <-- Add this line
            };
            
            // Format date and time for proper display in form inputs
            if (bill.date) {
                const checkInDate = bill.date instanceof Date ? bill.date : new Date(bill.date);
                
                // Format date as YYYY-MM-DD for the date input
                this.editingBill.date = checkInDate.toISOString().split('T')[0];
                
                // Format time as HH:MM for the time input
                const hours = checkInDate.getHours().toString().padStart(2, '0');
                const minutes = checkInDate.getMinutes().toString().padStart(2, '0');
                this.editingBill.checkInTime = `${hours}:${minutes}`;
            }
            
            if (bill.checkOut) {
                const checkOutDate = bill.checkOut instanceof Date ? bill.checkOut : new Date(bill.checkOut);
                
                // Format date as YYYY-MM-DD for the date input
                this.editingBill.checkOut = checkOutDate.toISOString().split('T')[0];
                
                // Format time as HH:MM for the time input
                const hours = checkOutDate.getHours().toString().padStart(2, '0');
                const minutes = checkOutDate.getMinutes().toString().padStart(2, '0');
                this.editingBill.checkOutTime = `${hours}:${minutes}`;
            }
            
            // Set bill ID, checking for bookingId if it's from the bookings source
            this.currentBillId = bill.id || (bill.source === 'bookings' ? bill.bookingId : null);
            console.log('Edit modal - Using ID:', this.currentBillId);
            
            this.isEditMode = true;
            this.showViewModal = true;
        },
        
        editBill(bill) {
            console.log('Edit bill function called for expenses only', bill);
            
            // Check if bill can be edited
            if (!this.canEditBill(bill)) {
                const status = bill.status ? bill.status.toLowerCase() : '';
                let message = 'This bill cannot be edited.';
                
                if (status === 'canceled' || status === 'cancelled') {
                    message = 'This bill cannot be edited because it has been cancelled.';
                } else if (status === 'checked out' || status === 'checked-out' || status === 'completed' || status === 'complete' || status === 'finished' || status === 'ended') {
                    message = 'This bill cannot be edited because it has been checked out or completed.';
                } else {
                    message = 'This bill cannot be edited because it is from a date older than today. You can only edit bills from today or future dates.';
                }
                
                alert(message);
                return;
            }
            
            // Create a deep copy of the bill but set restricted edit mode
            this.editingBill = {
                ...bill,
                expenses: bill.expenses ? [...bill.expenses] : [],
                bookingType: bill.bookingType || 'standard',
                duration: bill.duration || 3,
                hasTvRemote: bill.hasTvRemote || false,
                hourlyPrice: bill.hourlyPrice || 0
            };
            
            // Format date and time for proper display in form inputs
            if (bill.date) {
                const checkInDate = bill.date instanceof Date ? bill.date : new Date(bill.date);
                
                // Format date as YYYY-MM-DD for the date input
                this.editingBill.date = checkInDate.toISOString().split('T')[0];
                
                // Format time as HH:MM for the time input
                const hours = checkInDate.getHours().toString().padStart(2, '0');
                const minutes = checkInDate.getMinutes().toString().padStart(2, '0');
                this.editingBill.checkInTime = `${hours}:${minutes}`;
            }
            
            if (bill.checkOut) {
                const checkOutDate = bill.checkOut instanceof Date ? bill.checkOut : new Date(bill.checkOut);
                
                // Format date as YYYY-MM-DD for the date input
                this.editingBill.checkOut = checkOutDate.toISOString().split('T')[0];
                
                // Format time as HH:MM for the time input
                const hours = checkOutDate.getHours().toString().padStart(2, '0');
                const minutes = checkOutDate.getMinutes().toString().padStart(2, '0');
                this.editingBill.checkOutTime = `${hours}:${minutes}`;
            }
            
            // Set current ID and source - check both id and bookingId
            this.currentBillId = bill.id || (bill.source === 'bookings' ? bill.bookingId : null);
            console.log('Edit bill - Using ID:', this.currentBillId);
            
            this.showViewModal = true;
            this.isEditMode = true; // Enable edit mode specifically for expenses
            this.isExpenseOnlyEdit = true; // Add flag for expense-only editing
            console.log('Expense-only edit mode enabled:', this.isEditMode);
        },
        
        closeViewModal() {
            this.showViewModal = false;
            this.editingBill = null;
            this.currentBillId = null;
            this.isEditMode = false;
            this.isExpenseOnlyEdit = false; // Reset expense-only edit flag
        },
        addEditExpense() {
            if (!this.editingBill.expenses) this.editingBill.expenses = [];
            this.editingBill.expenses.push({ description: '', amount: '' });
        },
        removeEditExpense(index) {
            this.editingBill.expenses.splice(index, 1);
        },
        async updateBill() {
            try {
                if (!this.editingBill) return;
                this.isUpdating = true;
                this.loading = true;
                
                // Get bill ID with fallbacks
                let billId = this.currentBillId || this.editingBill.id;
                
                // Check if we have a valid bill ID before attempting to update
                if (!billId) {
                    console.error('Cannot update bill: No valid bill ID found');
                    alert('Cannot update bill: No valid bill ID found');
                    this.loading = false;
                    this.isUpdating = false;
                    return;
                }
                
                // Format check-in date with time
                const checkInDateTime = new Date(this.editingBill.date);
                const [checkInHours, checkInMinutes] = this.editingBill.checkInTime.split(':').map(Number);
                checkInDateTime.setHours(checkInHours, checkInMinutes, 0);
                
                // Format check-out date with time if provided
                let checkOutDateTime = null;
                if (this.editingBill.checkOut) {
                    checkOutDateTime = new Date(this.editingBill.checkOut);
                    const [checkOutHours, checkOutMinutes] = this.editingBill.checkOutTime.split(':').map(Number);
                    checkOutDateTime.setHours(checkOutHours, checkOutMinutes, 0);

                    // Check-out cannot be before check-in
                    if (checkOutDateTime < checkInDateTime) {
                        alert('Check-out date/time cannot be earlier than check-in date/time.');
                        this.loading = false;
                        this.isUpdating = false;
                        return;
                    }
                } else if (this.editingBill.bookingType === 'hourly') {
                    // For hourly bookings without checkout, calculate based on duration
                    checkOutDateTime = new Date(checkInDateTime);
                    checkOutDateTime.setHours(checkOutDateTime.getHours() + parseInt(this.editingBill.duration || 3));
                } else {
                    // Default to 3 hour stay
                    checkOutDateTime = new Date(checkInDateTime);
                    checkOutDateTime.setHours(checkOutDateTime.getHours() + 3);
                }
                
                // Calculate total amount including expenses
                let totalAmount = parseFloat(this.editingBill.baseCost) || 0;
                if (this.editingBill.expenses && this.editingBill.expenses.length > 0) {
                    totalAmount += this.editingBill.expenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);
                }
                
                // Add service fee if exists
                if (this.editingBill.serviceFee) {
                    totalAmount += parseFloat(this.editingBill.serviceFee) || 0;
                }
                
                // Prepare the update data for everlodgebookings collection
                const updateData = {
                    guestName: this.editingBill.customerName,
                    checkIn: Timestamp.fromDate(checkInDateTime),
                    checkOut: checkOutDateTime ? Timestamp.fromDate(checkOutDateTime) : null,
                    roomNumber: this.editingBill.roomNumber,
                    roomType: this.editingBill.roomType || "Standard",
                    subtotal: parseFloat(this.editingBill.baseCost) || 0,
                    serviceFee: parseFloat(this.editingBill.serviceFee) || 0,
                    total: totalAmount,
                    expenses: this.editingBill.expenses || [],
                    status: this.editingBill.status,
                    paymentStatus: this.editingBill.paymentStatus,
                    bookingType: this.editingBill.bookingType,
                    duration: this.editingBill.bookingType === 'hourly' ? parseInt(this.editingBill.duration) : null,
                    updatedAt: Timestamp.now()
                };
                
                console.log('Updating booking data:', updateData);

                // Update the record in everlodgebookings collection
                const bookingRef = doc(db(), 'everlodgebookings', billId);
                await updateDoc(bookingRef, updateData);
                
                console.log('Bill updated successfully');
                
                // Log activity
                await logBillingActivity(
                    'bill_updated',
                    `Updated billing record for ${this.editingBill.customerName}, Room ${this.editingBill.roomNumber}`
                );
                
                // Show success message and close modal
                alert('Bill updated successfully!');
                this.closeViewModal();
                
                // Reload bills to reflect changes
                await this.loadBills();
                
            } catch (error) {
                console.error('Error updating bill:', error);
                alert('Error updating bill: ' + error.message);
            } finally {
                this.loading = false;
                this.isUpdating = false;
            }
        },

        forceRefresh() {
            // Store current filter state before refreshing 
            const currentPage = this.currentPage;
            const currentStartDate = this.startDate;
            const currentEndDate = this.endDate;
            
            // Load fresh data
            this.loadBills().then(() => {
                // Determine if we need to reapply filters
                if (currentStartDate && currentEndDate) {
                    console.log(`Reapplying filters after refresh: startDate=${currentStartDate}, endDate=${currentEndDate}`);
                    
                    // Re-apply the date range filter
                    this.startDate = currentStartDate;
                    this.endDate = currentEndDate;
                    this.filterByDateRange();
                    console.log(`Date range filter reapplied with ${this.filteredBills.length} results`);
                }
                
                // After filtering is complete, restore page or go to a valid page
                Vue.nextTick(() => {
                    if (this.totalPages > 0 && currentPage > this.totalPages) {
                        this.currentPage = this.totalPages;
                    } else if (this.totalPages > 0) {
                        this.currentPage = Math.min(currentPage, this.totalPages);
                    } else {
                        this.currentPage = 1;
                    }
                    
                    // Clear the force refreshing flag
                    this._isForceRefreshing = false;
                });
            });
        },

        async deleteBill(bill) {
            try {
                console.log("Attempting to delete bill:", bill);
                
                // Check if this is a valid bill
                if (!bill) {
                    alert('Invalid bill selected');
                    return;
                }
                
                // Confirm before deleting
                if (!confirm(`Are you sure you want to delete the bill for ${bill.customerName}?`)) {
                    return;
                }
                
                this.loading = true;
                
                // Get bill ID
                const billId = bill.id;
                
                if (!billId) {
                    console.error("Cannot delete bill - no valid ID found");
                    alert("Cannot delete this bill - no valid ID found");
                    this.loading = false;
                    return;
                }
                
                // Ask user if they want to hide or completely delete the record
                const shouldHide = confirm(
                    'Would you like to hide this record from billing view (recommended) or completely delete it?\n\n' +
                    'Click OK to HIDE (recommended)\n' +
                    'Click Cancel to DELETE permanently'
                );
                
                if (shouldHide) {
                    // Hide the record from billing view
                    console.log("Marking booking as hidden from billing view, ID:", billId);
                    const bookingRef = doc(db(), 'everlodgebookings', billId);
                    await updateDoc(bookingRef, {
                        hiddenInBilling: true,
                        updatedAt: Timestamp.now()
                    });
                    
                    console.log("Booking marked as hidden");
                    alert('The booking record was hidden from billing view.');
                } else {
                    // Completely delete the record
                    console.log("Deleting booking record with ID:", billId);
                    const bookingRef = doc(db(), 'everlodgebookings', billId);
                    await deleteDoc(bookingRef);
                    console.log("Booking record deleted successfully");
                    alert('The booking record was permanently deleted.');
                }
                
                // Log activity
                await logBillingActivity(
                    shouldHide ? 'bill_hidden' : 'bill_deleted',
                    `${shouldHide ? 'Hidden' : 'Deleted'} billing record for ${bill.customerName}, Room ${bill.roomNumber}`
                );
                
                console.log("Forcing refresh after deletion");
                // Refresh the bill list
                await this.loadBills();
                
            } catch (error) {
                console.error("Error deleting bill:", error);
                alert("Error deleting bill: " + error.message);
            } finally {
                this.loading = false;
            }
        },

        changePage(page) {
            if (page >= 1 && page <= this.totalPages) {
                this.currentPage = page;
            }
        },

        // Date navigation methods
        formatDisplayDate(date) {
            if (!date) return '';
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            return date.toLocaleDateString(undefined, options);
        },
        
        goToPreviousDay() {
            // Store current page location when navigating
            const prevDay = new Date(this.currentDate);
            prevDay.setDate(prevDay.getDate() - 1);
            this.currentDate = prevDay;
            
            // Reset date range filters and use today's filtering
            this.startDate = '';
            this.endDate = '';
            this.filteredBills = this.filteredBillsByDate;
            
            console.log(`Navigated to previous day: ${this.currentDate.toLocaleDateString()} with ${this.filteredBills.length} records`);
            
            // Always start at page 1 when navigating to a new day
            this.currentPage = 1;
        },
        
        goToNextDay() {
            const nextDay = new Date(this.currentDate);
            nextDay.setDate(nextDay.getDate() + 1);
            this.currentDate = nextDay;
            
            // Reset date range filters and use today's filtering
            this.startDate = '';
            this.endDate = '';
            this.filteredBills = this.filteredBillsByDate;
            
            console.log(`Navigated to next day: ${this.currentDate.toLocaleDateString()} with ${this.filteredBills.length} records`);
            
            // Always start at page 1 when navigating to a new day
            this.currentPage = 1;
        },
        
        goToToday() {
            this.currentDate = new Date();
            
            // Reset date range filters when navigating to today view
            this.startDate = '';
            this.endDate = '';
            this.filteredBills = this.filteredBillsByDate;
            
            console.log(`Navigated to today: ${this.currentDate.toLocaleDateString()} with ${this.filteredBills.length} records`);
            
            // Always start at page 1 when navigating to today
            this.currentPage = 1;
        },
        
        formatStatus(status) {
            if (!status) return 'N/A';
            
            // Capitalize first letter of each word
            return status.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        },
        
        getStatusClass(status) {
            if (!status) return 'status-na';
            
            status = status.toLowerCase();
            
            if (status === 'paid') return 'status-paid';
            if (status === 'unpaid') return 'status-unpaid';
            if (status === 'pending') return 'status-pending';
            if (status === 'confirmed' || status === 'approved') return 'status-confirmed';
            if (status === 'canceled' || status === 'cancelled') return 'status-canceled';
            
            return 'status-na';
        },

        calculateTotalAmount(booking) {
            if (!booking) return 0;
            
            let subtotal = this.calculateSubtotal(booking);
            let tvRemoteFee = booking.hasTvRemote ? this.TV_REMOTE_FEE : 0;
            
            return subtotal + tvRemoteFee;
        },
        
        calculateServiceFee(booking) {
            if (!booking) return 0;
            
            let subtotal = this.calculateSubtotal(booking);
            return subtotal * this.SERVICE_FEE_PERCENTAGE;
        },
        
        generateInvoiceDetail(booking) {
            if (!booking) return null;
            
            let subtotal = this.calculateSubtotal(booking);
            let tvRemoteFee = booking.hasTvRemote ? this.TV_REMOTE_FEE : 0;
            let total = subtotal + tvRemoteFee;
            
            return {
                invoiceId: this.generateInvoiceId(),
                roomNumber: booking.roomNumber,
                guestName: booking.guestName,
                checkIn: booking.checkIn,
                checkOut: booking.checkOut || this.calculateAutoCheckout(booking.checkIn),
                stayDuration: this.calculateStayDuration(booking),
                stayType: this.determineStayType(booking),
                roomRate: this.calculateRoomRate(booking),
                subtotal: subtotal,
                tvRemoteFee: tvRemoteFee,
                total: total,
                paymentStatus: 'Pending',
                dateCreated: new Date().toISOString(),
                dateUpdated: new Date().toISOString()
            };
        },
        
        displayInvoice(invoice) {
            if (!invoice) return;
            
            this.currentInvoice = invoice;
            this.showInvoiceModal = true;
            
            // Prepare data for printing
            this.prepareInvoicePrintData(invoice);
        },
        
        prepareInvoicePrintData(invoice) {
            this.invoicePrintData = {
                invoiceId: invoice.invoiceId,
                invoiceDate: this.formatDateTime(invoice.dateCreated),
                guestName: invoice.guestName,
                roomNumber: invoice.roomNumber,
                checkIn: this.formatDateTime(invoice.checkIn),
                checkOut: this.formatDateTime(invoice.checkOut),
                stayDuration: invoice.stayDuration + ' ' + (invoice.stayType === 'hourly' ? 'hour(s)' : 'night(s)'),
                stayType: this.capitalizeFirstLetter(invoice.stayType),
                roomRate: this.formatCurrency(invoice.roomRate),
                subtotal: this.formatCurrency(invoice.subtotal),
                tvRemoteFee: invoice.tvRemoteFee > 0 ? this.formatCurrency(invoice.tvRemoteFee) : '₱0.00',
                total: this.formatCurrency(invoice.total),
                paymentStatus: invoice.paymentStatus
            };
        },
        updateBookingTypeAndPricing() {
            // This function is used for editing existing bills, not creating new ones
            // Update base cost calculation if needed for editing
            if (this.editingBill && this.editingBill.bookingType === 'hourly') {
                // For hourly bookings being edited, update the base cost
                this.editingBill.baseCost = parseFloat(this.editingBill.hourlyPrice) || 0;
            }
        },
        forceReload() {
            // Clear any cached data in the UI
            this.bills = [];
            this.filteredBills = [];
            this.originalBills = [];
            
            // Force browser to refresh cached JavaScript
            console.log('Forcing page reload to refresh data...');
            window.location.reload(true);
        },
    },
    async mounted() {
        try {
            console.log('Billing component mounted');
            
            // Check authentication
            this.checkAuthState();
            
            // Load bills data
            await this.loadBills();

            // Hide the initial loading overlay
            const overlay = document.getElementById('initial-loading-overlay');
            if (overlay) {
                overlay.classList.add('hide');
                // Remove the overlay from the DOM after the transition completes
                setTimeout(() => overlay.style.display = 'none', 500); 
            }
            
            // Initialize with today's date filter
            this.filteredBills = this.filteredBillsByDate;
            
            console.log('Bills initialized with today\'s date filter');
            
            // Set up refresh listeners for booking confirmations
            this.setupRefreshListeners();
            
            // Check if we need to force a reload for the duration fix
            // Use localStorage to prevent infinite reload loop
            if (!localStorage.getItem('durationFixApplied')) {
                localStorage.setItem('durationFixApplied', 'true');
                // Give a slight delay before reload to ensure the page loads first
                setTimeout(() => this.forceReload(), 500);
            }
        } catch (error) {
            console.error('Error during component initialization:', error);
        }
    },
    
    setupRefreshListeners() {
        try {
            // Set up localStorage change listener for cross-tab notifications
            window.addEventListener('storage', (event) => {
                if (event.key === 'dashboard:refresh') {
                    try {
                        const refreshData = JSON.parse(event.newValue);
                        if (refreshData && refreshData.timestamp) {
                            // Check if refresh notification is recent (within last 10 seconds)
                            const now = new Date().getTime();
                            const isFresh = (now - refreshData.timestamp) < 10000;
                            
                            if (isFresh && (refreshData.action === 'booking_approved' || refreshData.action === 'booking_rejected')) {
                                console.log('Billing page refreshing from localStorage notification:', refreshData.action);
                                this.forceRefresh();
                            }
                        }
                    } catch (error) {
                        console.error('Error processing billing refresh notification:', error);
                    }
                }
            });
            
            // Set up custom event listener for same-tab notifications
            window.addEventListener('dashboardRefresh', (event) => {
                try {
                    const refreshData = event.detail;
                    if (refreshData && refreshData.timestamp) {
                        // Check if refresh notification is recent (within last 10 seconds)
                        const now = new Date().getTime();
                        const isFresh = (now - refreshData.timestamp) < 10000;
                        
                        if (isFresh && (refreshData.action === 'booking_approved' || refreshData.action === 'booking_rejected')) {
                            console.log('Billing page refreshing from custom event notification:', refreshData.action);
                            this.forceRefresh();
                        }
                    }
                } catch (error) {
                    console.error('Error processing billing refresh custom event:', error);
                }
            });
            
            console.log('Billing refresh listeners set up successfully');
        } catch (error) {
            console.error('Error setting up billing refresh listeners:', error);
        }
    }
});

// Initialize page logging through PageLogger
onAuthStateChanged(auth(), (user) => {
    if (user) {
        PageLogger.logNavigation('Billing');
    }
});

// Common billing operations
function addChargeRow() {
    // ...existing addChargeRow code...
    logBillingActivity('billing_add_item', 'Added new charge row');
}

function calculateTotal() {
    // ...existing calculateTotal code...
    logBillingActivity('billing_calculate', 'Recalculated bill total');
}

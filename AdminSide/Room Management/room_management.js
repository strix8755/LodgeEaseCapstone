import { db, auth, app } from '../firebase.js';
import { 
    collection, 
    getDocs, 
    query, 
    orderBy, 
    doc, 
    updateDoc, 
    deleteDoc, 
    Timestamp,
    where,
    getDoc,
    addDoc,
    deleteField,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { PageLogger } from '../js/pageLogger.js';
import { ActivityLogger } from '../ActivityLog/activityLogger.js';
// Import rate calculation module with updated rates
import { 
    calculateNights, 
    calculateHours,
    isNightPromoEligible, 
    getHourlyRate,
    calculateBookingCosts 
} from '../js/rateCalculation.js';

const activityLogger = new ActivityLogger();

// Add activity logging function
async function logRoomActivity(actionType, details) {
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
            module: 'Room Management'
        });
    } catch (error) {
        console.error('Error logging room activity:', error);
    }
}

// Update the deleteRoom function
async function deleteRoom(roomId) {
    try {
        const user = auth().currentUser;
        if (!user) {
            alert('Please log in to delete rooms');
            return;
        }

        // Get room details before deletion
        const roomDoc = await getDoc(doc(db(), 'rooms', roomId));
        if (!roomDoc.exists()) {
            throw new Error('Room not found');
        }

        const roomData = roomDoc.data();
        const roomDetails = `${roomData.propertyDetails.name} - Room ${roomData.propertyDetails.roomNumber} (${roomData.propertyDetails.roomType})`;

        // Confirm deletion
        if (!confirm(`Are you sure you want to delete ${roomDetails}?`)) {
            return;
        }

        // Delete the room
        await deleteDoc(doc(db(), 'rooms', roomId));

        // Log the deletion activity
        await activityLogger.logActivity(
            'room_deletion',
            `Room deleted: ${roomDetails}`,
            'Room Management'
        );

        // Show success message
        alert('Room deleted successfully');

    } catch (error) {
        console.error('Error deleting room:', error);
        alert('Error deleting room: ' + error.message);
    }
}

new Vue({
    el: '#app',
    data: {
        bookings: [],
        rooms: [],
        searchQuery: '',
        loading: true,
        selectedBooking: null,
        isAuthenticated: false,
        showManualBookingModal: false,
        currentDate: new Date(), // Added for date navigation
        establishments: {
            lodge1: {
                name: 'Pine Haven Lodge',
                location: 'Baguio City'
            },
            lodge2: {
                name: 'Mountain View Lodge',
                location: 'La Trinidad'
            }
        },
        availableRooms: [],
        manualBooking: {
            guestName: '',
            roomNumber: '',
            status: 'Confirmed',
            checkInDate: '',
            checkInTime: '12:00',
            checkOutDate: '',
            checkOutTime: '11:00',
            guests: 1,
            hasTvRemote: false,
            bookingType: 'standard',
            duration: 3,
        },
        startDate: '',
        endDate: '',
        editMode: false,
        // Add these missing properties to fix Vue warnings
        showAddRoomModal: false,
        showAddRoomToLodgeModal: false,
        showClientRoomsModal: false,
        originalCheckIn: null,
        originalCheckOut: null,
        bypassAdminCheck: true, // Set to true to bypass admin check
    },
    computed: {
        filteredBookings() {
            // Start with a copy of the bookings array
            let filtered = [...this.bookings];

            // Apply search query filter
            const query = this.searchQuery.toLowerCase();
            if (query) {
                filtered = filtered.filter(booking => {
                    const roomNumber = (booking.propertyDetails?.roomNumber || '').toString().toLowerCase();
                    const roomType = (booking.propertyDetails?.roomType || '').toString().toLowerCase();
                    const guestName = (booking.guestName || '').toLowerCase();
                    const status = (booking.status || '').toLowerCase();
                    
                    return roomNumber.includes(query) || 
                           roomType.includes(query) ||
                           guestName.includes(query) ||
                           status.includes(query);
                });
            }

            // If explicit date range is set, use that filter
            if (this.startDate && this.endDate) {
                const start = new Date(this.startDate);
                const end = new Date(this.endDate);
                end.setHours(23, 59, 59); // Include the entire end date

                filtered = filtered.filter(booking => {
                    if (!booking.checkIn) return false;
                    
                    const checkIn = booking.checkIn instanceof Date ? booking.checkIn : new Date(booking.checkIn);
                    
                    // For bookings without check-out, only show if check-in is within range
                    if (!booking.checkOut) {
                        return checkIn >= start && checkIn <= end;
                    }
                    
                    const checkOut = booking.checkOut instanceof Date ? booking.checkOut : new Date(booking.checkOut);
                    // Check if the booking period overlaps with the selected date range
                    return checkIn <= end && checkOut >= start;
                });
            } else {
                // Otherwise, filter by the current date in the date navigation
                // Set start and end of the selected date
                const selectedDate = new Date(this.currentDate);
                selectedDate.setHours(0, 0, 0, 0); // Start of the selected date
                
                const endOfSelectedDate = new Date(this.currentDate);
                endOfSelectedDate.setHours(23, 59, 59, 999); // End of the selected date
                
                filtered = filtered.filter(booking => {
                    // Skip if no check-in date
                    if (!booking.checkIn) return false;
                    
                    const checkIn = booking.checkIn instanceof Date ? booking.checkIn : new Date(booking.checkIn);
                    
                    // For bookings without check-out, show if check-in is on the selected date
                    if (!booking.checkOut) {
                        return checkIn >= selectedDate && checkIn <= endOfSelectedDate;
                    }
                    
                    const checkOut = booking.checkOut instanceof Date ? booking.checkOut : new Date(booking.checkOut);
                    
                    // Show bookings where:
                    // 1. Check-in is on the selected date, or
                    // 2. Check-out is on the selected date, or
                    // 3. The booking spans the selected date (check-in before and check-out after)
                    return (
                        (checkIn >= selectedDate && checkIn <= endOfSelectedDate) || // Checks in on the selected date
                        (checkOut >= selectedDate && checkOut <= endOfSelectedDate) || // Checks out on the selected date
                        (checkIn < selectedDate && checkOut > endOfSelectedDate) // Spans over the selected date
                    );
                });
            }

            return filtered;
        },

        minCheckInDate() {
            const now = new Date();
            return now.toISOString().slice(0, 16); // Format: YYYY-MM-DDThh:mm
        },

        calculateNights() {
            if (!this.manualBooking.checkInDate) return 0;
            if (!this.manualBooking.checkOutDate) return 0; // Short stay (no nights)
            return calculateNights(this.manualBooking.checkInDate, this.manualBooking.checkOutDate);
        },

        calculateHours() {
            if (!this.manualBooking.checkInDate) return 0;
            
            // For short stays (no check-out date), use standard duration
            if (!this.manualBooking.checkOutDate || !this.manualBooking.checkOutTime) {
                return this.manualBooking.duration;
            }
            
            if (this.manualBooking.checkOutDate) {
                // Calculate hours between check-in and check-out if both are provided
                const checkIn = new Date(`${this.manualBooking.checkInDate}T${this.manualBooking.checkInTime}`);
                const checkOut = new Date(`${this.manualBooking.checkOutDate}T${this.manualBooking.checkOutTime}`);
                return calculateHours(checkIn, checkOut);
            }
            
            return 0;
        },

        // Edit form specific computed properties for rate calculation
        editCalculateNights() {
            if (!this.selectedBooking || !this.selectedBooking.checkInDate) return 0;
            if (!this.selectedBooking.checkOutDate || !this.selectedBooking.checkOutTime) return 0;
            
            // Debug log values used in calculation
            console.log('editCalculateNights input:', {
                checkInDate: this.selectedBooking.checkInDate,
                checkInTime: this.selectedBooking.checkInTime,
                checkOutDate: this.selectedBooking.checkOutDate,
                checkOutTime: this.selectedBooking.checkOutTime
            });
            
            try {
                // Use the calculateNights function from the rate calculation module
                const checkInDate = new Date(`${this.selectedBooking.checkInDate}T${this.selectedBooking.checkInTime}`);
                const checkOutDate = new Date(`${this.selectedBooking.checkOutDate}T${this.selectedBooking.checkOutTime}`);
                
                // Verify dates are valid
                if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
                    console.error('Invalid date format detected:', { checkInDate, checkOutDate });
                    return 0;
                }
                
                // Check if check-out is after check-in
                if (checkOutDate <= checkInDate) {
                    console.warn('Check-out date is not after check-in date');
                    return 0;
                }
                
                const nights = calculateNights(checkInDate, checkOutDate);
                console.log('editCalculateNights result:', nights);
                return nights;
            } catch (error) {
                console.error('Error calculating nights:', error);
                return 0;
            }
        },

        editCalculateHours() {
            if (!this.selectedBooking || !this.selectedBooking.checkInDate) return 0;
            
            // Debug log values used in calculation
            console.log('editCalculateHours input:', {
                checkInDate: this.selectedBooking.checkInDate,
                checkInTime: this.selectedBooking.checkInTime,
                checkOutDate: this.selectedBooking.checkOutDate,
                checkOutTime: this.selectedBooking.checkOutTime
            });
            
            // For short stays (no check-out date)
            if (!this.selectedBooking.checkOutDate || !this.selectedBooking.checkOutTime) {
                // Default to 3 hours for short stays or use the stored value
                const hours = this.selectedBooking.hours || 3;
                console.log('editCalculateHours short stay result:', hours);
                return hours;
            }
            
            try {
                // Calculate hours between check-in and check-out
                const checkInDate = new Date(`${this.selectedBooking.checkInDate}T${this.selectedBooking.checkInTime}`);
                const checkOutDate = new Date(`${this.selectedBooking.checkOutDate}T${this.selectedBooking.checkOutTime}`);
                
                // Verify dates are valid
                if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
                    console.error('Invalid date format detected:', { checkInDate, checkOutDate });
                    return this.selectedBooking.hours || 3;
                }
                
                // Check if check-out is after check-in
                if (checkOutDate <= checkInDate) {
                    console.warn('Check-out date is not after check-in date');
                    return this.selectedBooking.hours || 3;
                }
                
                const hours = calculateHours(checkInDate, checkOutDate);
                console.log('editCalculateHours result:', hours);
                return hours;
            } catch (error) {
                console.error('Error calculating hours:', error);
                return this.selectedBooking.hours || 3;
            }
        },

        editHasCheckOut() {
            if (!this.selectedBooking) return false;
            
            // Check-out is considered provided only if both date and time are filled in by the user
            const hasCheckOutDate = this.selectedBooking.checkOutDate && this.selectedBooking.checkOutDate.trim() !== '';
            const hasCheckOutTime = this.selectedBooking.checkOutTime && this.selectedBooking.checkOutTime.trim() !== '';
            
            const result = hasCheckOutDate && hasCheckOutTime;
            console.log('editHasCheckOut calculation:', {
                selectedBooking: this.selectedBooking.id || 'new booking',
                hasCheckOutDate,
                hasCheckOutTime,
                checkOutDate: this.selectedBooking.checkOutDate,
                checkOutTime: this.selectedBooking.checkOutTime,
                result
            });
            
            return result;
        },

        editRoomRate() {
            if (!this.selectedBooking || !this.selectedBooking.checkInDate) return 0;
            
            const bookingType = this.selectedBooking.bookingType || 'standard';
            const hasTvRemote = this.selectedBooking.hasTvRemote || false;
            
            // Use the imported rate calculation with updated parameters
            const { nightlyRate } = calculateBookingCosts(
                this.editCalculateNights, 
                bookingType,
                this.editHasCheckOut,
                hasTvRemote,
                this.editCalculateHours
            );
            return nightlyRate;
        },

        editStayTypeLabel() {
            if (!this.selectedBooking) return '';
            
            if (!this.editHasCheckOut) {
                return '3-Hour Short Stay';
            } else if (this.editCalculateNights === 1) {
                return '1 Night Stay';
            } else {
                return `${this.editCalculateNights} Nights Stay`;
            }
        },

        editSubtotal() {
            if (!this.selectedBooking || !this.selectedBooking.checkInDate) return 0;
            
            const bookingType = this.selectedBooking.bookingType || 'standard';
            const hasTvRemote = this.selectedBooking.hasTvRemote || false;
            
            console.log('Calculating editSubtotal with:', {
                nights: this.editCalculateNights,
                bookingType,
                hasCheckOut: this.editHasCheckOut,
                hasTvRemote,
                hours: this.editCalculateHours
            });
            
            const { subtotal } = calculateBookingCosts(
                this.editCalculateNights, 
                bookingType,
                this.editHasCheckOut,
                hasTvRemote,
                this.editCalculateHours
            );
            
            console.log('Calculated editSubtotal:', subtotal);
            return subtotal;
        },

        editServiceFee() {
            if (!this.selectedBooking || !this.selectedBooking.checkInDate) return 0;
            
            const bookingType = this.selectedBooking.bookingType || 'standard';
            const hasTvRemote = this.selectedBooking.hasTvRemote || false;
            
            const { serviceFeeAmount } = calculateBookingCosts(
                this.editCalculateNights, 
                bookingType,
                this.editHasCheckOut,
                hasTvRemote,
                this.editCalculateHours
            );
            return serviceFeeAmount;
        },

        editTotalAmount() {
            if (!this.selectedBooking || !this.selectedBooking.checkInDate) return 0;
            
            const bookingType = this.selectedBooking.bookingType || 'standard';
            const hasTvRemote = this.selectedBooking.hasTvRemote || false;
            
            console.log('Calculating editTotalAmount with:', {
                nights: this.editCalculateNights,
                bookingType,
                hasCheckOut: this.editHasCheckOut,
                hasTvRemote,
                hours: this.editCalculateHours
            });
            
            // Use direct calculation instead of potentially cached values
            const { totalAmount } = calculateBookingCosts(
                this.editCalculateNights, 
                bookingType,
                this.editHasCheckOut,
                hasTvRemote,
                this.editCalculateHours
            );
            
            console.log('Calculated editTotalAmount:', totalAmount);
            
            // Make sure the value is updated in the selectedBooking object too
            if (this.selectedBooking) {
                this.selectedBooking.totalPrice = totalAmount;
            }
            
            return totalAmount;
        },

        isNightPromoEligible() {
            // Always false since night-promo option is removed
            return false;
        },

        hasCheckOut() {
            // Check-out is considered provided only if both date and time are filled in by the user
            return this.manualBooking.checkOutDate && this.manualBooking.checkOutDate.trim() !== '' &&
                   this.manualBooking.checkOutTime && this.manualBooking.checkOutTime.trim() !== '';
        },

        calculateRoomRate() {
            if (!this.manualBooking.checkInDate) return 0;
            
            // Use the imported rate calculation with updated parameters
            const { nightlyRate } = calculateBookingCosts(
                this.calculateNights, 
                this.manualBooking.bookingType,
                this.hasCheckOut,
                this.manualBooking.hasTvRemote,
                this.calculateHours // Add calculated hours
            );
            return nightlyRate;
        },

        stayTypeLabel() {
            if (!this.hasCheckOut) {
                return '3-Hour Short Stay';
            } else if (this.calculateNights === 1) {
                return '1 Night Stay';
            } else {
                return `${this.calculateNights} Nights Stay`;
            }
        },

        calculateSubtotal() {
            if (!this.manualBooking.checkInDate) return 0;
            
            const { subtotal } = calculateBookingCosts(
                this.calculateNights, 
                this.manualBooking.bookingType,
                this.hasCheckOut,
                this.manualBooking.hasTvRemote,
                this.calculateHours // Add calculated hours
            );
            return subtotal;
        },

        calculateServiceFee() {
            if (!this.manualBooking.checkInDate) return 0;
            
            const { serviceFeeAmount } = calculateBookingCosts(
                this.calculateNights, 
                this.manualBooking.bookingType,
                this.hasCheckOut,
                this.manualBooking.hasTvRemote,
                this.calculateHours // Add calculated hours
            );
            return serviceFeeAmount;
        },

        calculateTotal() {
            if (!this.manualBooking.checkInDate) return 0;
            
            const { totalAmount } = calculateBookingCosts(
                this.calculateNights, 
                this.manualBooking.bookingType,
                this.hasCheckOut,
                this.manualBooking.hasTvRemote,
                this.calculateHours // Add calculated hours
            );
            return totalAmount;
        },

        tvRemoteFee() {
            if (!this.manualBooking.checkInDate) return 0;
            
            const { tvRemoteFee } = calculateBookingCosts(
                this.calculateNights, 
                this.manualBooking.bookingType,
                this.hasCheckOut,
                this.manualBooking.hasTvRemote,
                this.calculateHours // Add calculated hours
            );
            return tvRemoteFee;
        },

        previewImage() {
            if (this.selectedImages.length > 0) {
                return this.selectedImages[0].url;
            }
            return this.defaultImage; // Use the instance property
        },
        
        isPreviewBestValue() {
            // Logic to determine if this lodge should be marked as "best value"
            // For example, if it has a promo price and the discount is substantial
            if (!this.newLodge.price || !this.newLodge.promoPrice) return false;
            
            const regularPrice = parseFloat(this.newLodge.price);
            const promoPrice = parseFloat(this.newLodge.promoPrice);
            
            // If discount is more than 50%
            return promoPrice < (regularPrice * 0.5);
        },
        
        isFormValid() {
            return this.newLodge.name && 
                   this.newLodge.location && 
                   this.newLodge.barangay && 
                   this.newLodge.price && 
                   this.newLodge.propertyType && 
                   this.newLodge.description &&
                   this.newLodge.amenities.length >= 2 &&
                   this.selectedImages.length > 0;
        },
        isRoomFormValid() {
            return this.newRoom.lodgeId && 
                   this.newRoom.roomNumber && 
                   this.newRoom.roomType && 
                   this.newRoom.floorLevel && 
                   this.newRoom.price && 
                   this.newRoom.description &&
                   this.roomImages.length > 0;
        },
        
        isManualBookingFormValid() {
            return this.manualBooking.guestName.trim() !== '' &&
                this.manualBooking.guestName.trim().length >= 6 &&
                this.manualBooking.guestName.trim().length <= 11 &&
                this.manualBooking.checkInDate !== '' &&
                this.manualBooking.roomNumber !== '';
            // Note: checkOutDate is not required
        },
    },
    methods: {
        async fetchBookings() {
            try {
                console.log('Starting to fetch bookings...');
                this.loading = true;

                // First, automatically check for and remove duplicate bookings before fetching
                await this.removeDuplicatesBeforeDisplay();

                // Fetch all bookings from everlodgebookings collection
                const bookingsRef = collection(db(), 'everlodgebookings');
                const bookingsQuery = query(bookingsRef, orderBy('createdAt', 'desc')); // Sort by creation date
                const bookingsSnapshot = await getDocs(bookingsQuery);

                // Map the bookings data
                this.bookings = bookingsSnapshot.docs.map(doc => {
                    const data = doc.data();
                    console.log('Raw booking data:', data);

                    // Handle case where checkOut might be undefined/null
                    let checkOut = null;
                    if (data.checkOut) {
                        try {
                            checkOut = data.checkOut?.toDate?.() || new Date(data.checkOut);
                        } catch (e) {
                            console.warn('Invalid checkOut date format:', e);
                        }
                    }
                    
                    // Handle case where checkIn might be undefined/null or invalid
                    let checkIn = null;
                    if (data.checkIn) {
                        try {
                            checkIn = data.checkIn?.toDate?.() || new Date(data.checkIn);
                        } catch (e) {
                            console.warn('Invalid checkIn date format:', e);
                            checkIn = new Date(); // Default to current date if invalid
                        }
                    } else {
                        checkIn = new Date(); // Default to current date if missing
                    }

                    // Get room number from different possible locations in the data
                    const roomNumber = data.roomNumber || 
                                     data.propertyDetails?.roomNumber || 
                                     (typeof data.room === 'object' ? data.room.number : data.room) || 
                                     'N/A';

                    return {
                        id: doc.id,
                        ...data,
                        propertyDetails: {
                            roomNumber: roomNumber,
                            roomType: data.roomType || data.propertyDetails?.roomType || 'Standard',
                            floorLevel: data.floorLevel || data.propertyDetails?.floorLevel || '1',
                            name: data.propertyName || data.propertyDetails?.name || 'Ever Lodge',
                            location: data.location || data.propertyDetails?.location || 'Baguio City'
                        },
                        guestName: data.guestName || data.guest?.name || 'N/A',
                        email: data.email || data.guest?.email || 'N/A',
                        contactNumber: data.contactNumber || data.guest?.contact || 'N/A',
                        checkIn: checkIn,
                        checkOut: checkOut,
                        status: this.determineStatus(data) || data.status || 'Pending',
                        totalPrice: data.totalPrice || 0,
                        serviceFee: data.serviceFee || 0,
                        nightlyRate: data.nightlyRate || 0,
                        numberOfNights: data.numberOfNights || 0,
                        hours: data.hours || 0,
                        hasTvRemote: !!data.hasTvRemote,
                    };
                });

                console.log(`Fetched ${this.bookings.length} bookings after duplicate removal`);
                this.loading = false;
            } catch (error) {
                console.error('Error fetching bookings:', error);
                this.loading = false;
                alert('Failed to fetch bookings: ' + error.message);
            }
        },

        // New method to remove duplicates before displaying bookings
        async removeDuplicatesBeforeDisplay() {
            try {
                console.log('Checking for duplicates before displaying bookings...');
                
                // Get all bookings from everlodgebookings
                const bookingsRef = collection(db(), 'everlodgebookings');
                const snapshot = await getDocs(bookingsRef);
                
                const bookings = [];
                snapshot.forEach((doc) => {
                    bookings.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                if (bookings.length === 0) {
                    console.log('No bookings found to check for duplicates');
                    return;
                }
                
                // Group bookings by potential duplicate criteria with improved logic
                const duplicateGroups = {};
                
                bookings.forEach(booking => {
                    // Create a more comprehensive key for duplicate detection
                    const checkInTime = booking.checkIn?.seconds || booking.checkInDate?.seconds || 0;
                    const checkOutTime = booking.checkOut?.seconds || booking.checkOutDate?.seconds || 0;
                    const userId = booking.userId || 'unknown';
                    const roomNumber = booking.roomNumber || booking.propertyDetails?.roomNumber || 'unknown';
                    const totalPrice = booking.totalPrice || 0;
                    const guestName = booking.guestName || booking.guest?.name || 'unknown';
                    
                    // Create a unique key based on multiple criteria
                    const key = `${userId}_${checkInTime}_${checkOutTime}_${roomNumber}_${totalPrice}_${guestName}`;
                    
                    if (!duplicateGroups[key]) {
                        duplicateGroups[key] = [];
                    }
                    duplicateGroups[key].push(booking);
                });
                
                // Find groups with more than one booking (duplicates)
                const duplicates = Object.values(duplicateGroups).filter(group => group.length > 1);
                
                if (duplicates.length > 0) {
                    console.log(`Found ${duplicates.length} sets of duplicate bookings - removing duplicates before display...`);
                    
                    let removedCount = 0;
                    for (const group of duplicates) {
                        console.log(`Processing duplicate group with ${group.length} bookings:`, group.map(b => ({ 
                            id: b.id, 
                            guestName: b.guestName, 
                            createdAt: b.createdAt?.seconds 
                        })));
                        
                        // Sort by creation time, keep the most recent
                        group.sort((a, b) => {
                            const aTime = a.createdAt?.seconds || a.confirmedAt?.seconds || a.timestamp?.seconds || 0;
                            const bTime = b.createdAt?.seconds || b.confirmedAt?.seconds || b.timestamp?.seconds || 0;
                            return bTime - aTime; // Most recent first
                        });
                        
                        // Remove all except the first (most recent)
                        const toKeep = group[0];
                        const toRemove = group.slice(1);
                        
                        console.log(`Keeping booking ${toKeep.id}, removing ${toRemove.length} duplicates`);
                        
                        for (const booking of toRemove) {
                            try {
                                await deleteDoc(doc(db(), 'everlodgebookings', booking.id));
                                console.log(`Removed duplicate booking: ${booking.id} for guest: ${booking.guestName}`);
                                removedCount++;
                            } catch (error) {
                                console.error(`Error removing duplicate booking ${booking.id}:`, error);
                            }
                        }
                    }
                    
                    if (removedCount > 0) {
                        console.log(`Successfully removed ${removedCount} duplicate bookings before display.`);
                        
                        // Log the cleanup activity
                        try {
                            await logRoomActivity('duplicate_cleanup', `Automatically removed ${removedCount} duplicate bookings during fetch`);
                        } catch (logError) {
                            console.warn('Could not log duplicate cleanup activity:', logError);
                        }
                    }
                } else {
                    console.log('No duplicate bookings found during pre-display check.');
                }
                
            } catch (error) {
                console.error('Error during pre-display duplicate removal:', error);
            }
        },

        determineStatus(booking) {
            if (!booking.checkIn) return 'Available';
            
            const now = new Date();
            const checkIn = booking.checkIn?.toDate?.() || new Date(booking.checkIn);
            
            // If checkOut is not defined, the booking is considered "Checked In" 
            // once the checkIn time has passed
            if (!booking.checkOut) {
                return now >= checkIn ? 'Checked In' : 'Confirmed';
            }
            
            const checkOut = booking.checkOut?.toDate?.() || new Date(booking.checkOut);

            if (now < checkIn) return 'Confirmed';
            if (now >= checkIn && now <= checkOut) return 'Checked In';
            if (now > checkOut) return 'Checked Out';
            
            return booking.status || 'Pending';
        },

        formatDate(date) {
            if (!date) return '-';
            try {
                if (typeof date === 'string') date = new Date(date);
                if (date.toDate) date = date.toDate();
                return date.toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch (error) {
                console.error('Date formatting error:', error);
                return '-';
            }
        },

        async checkAdminStatus(user) {
            try {
                console.log('Checking admin status for user:', user.uid, user.email);
                
                // 1. First check in users collection
                const userDoc = await getDoc(doc(db(), 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    console.log('User data found:', userData);
                    
                    // Check for admin status in various possible fields
                    if (userData.isAdmin === true || 
                        userData.role === 'admin' || 
                        userData.role === 'superadmin' ||
                        userData.admin === true ||
                        userData.adminRole === 'administrator' ||
                        (userData.permissions && userData.permissions.includes('admin'))) {
                        console.log('Admin privileges found in user document');
                        return true;
                    }
                }
                
                // 2. Check in admins collection
                try {
                    const adminDoc = await getDoc(doc(db(), 'admins', user.uid));
                    if (adminDoc.exists()) {
                        console.log('User found in admins collection');
                        return true;
                    }
                } catch (adminError) {
                    console.warn('Error checking admins collection:', adminError);
                }
                
                // 3. If email contains admin or administrator, grant access
                if (user.email && (
                    user.email.includes('admin') || 
                    user.email.includes('administrator') ||
                    user.email === 'administrator@gmail.com'
                )) {
                    console.log('Admin access granted based on email:', user.email);
                    // Create admin privileges for this user
                    await this.ensureAdminPrivileges(user);
                    return true;
                }
                
                // 4. Grant access to any authenticated user (new permissive check)
                console.log('Granting admin access to authenticated user:', user.email);
                await this.ensureAdminPrivileges(user);
                return true;
            } catch (error) {
                console.error('Error checking admin status:', error);
                return false;
            }
        },

        async updateBookingStatus(booking) {
            try {
                this.loading = true;
                console.log('Updating booking status...');

                // Update booking in everlodgebookings collection
                const bookingRef = doc(db(), 'everlodgebookings', booking.id);
                await updateDoc(bookingRef, {
                    status: booking.status,
                    updatedAt: Timestamp.now()
                });

                // Log the activity
                await activityLogger.logActivity(
                    'booking_status_update',
                    `Booking status updated to ${booking.status} for guest/plate: ${booking.guestName}`,
                    'Room Management'
                );

                // Refresh bookings list
                await this.fetchBookings();

                alert('Booking status updated successfully!');
            } catch (error) {
                console.error('Error updating booking status:', error);
                alert('Failed to update booking status: ' + error.message);
            } finally {
                this.loading = false;
            }
        },

        editBooking(booking) {
            // Make a deep copy of the booking to avoid modifying the original directly
            this.selectedBooking = JSON.parse(JSON.stringify(booking));
            this.editMode = true;
            
            // Store original dates to track changes
            this.originalCheckIn = booking.checkIn;
            this.originalCheckOut = booking.checkOut;
            
            // Convert Firebase timestamps to JavaScript Date objects
            if (this.selectedBooking.checkIn) {
                try {
                    // First, check if it's a Firebase Timestamp
                    if (typeof this.selectedBooking.checkIn.toDate === 'function') {
                        this.selectedBooking.checkIn = this.selectedBooking.checkIn.toDate();
                    } 
                    // If it's already a Date or string, use it as is
                    else if (!(this.selectedBooking.checkIn instanceof Date)) {
                        this.selectedBooking.checkIn = new Date(this.selectedBooking.checkIn);
                    }
                    
                    // Format and set the date and time for the form inputs
                    this.selectedBooking.checkInDate = this.selectedBooking.checkIn.toISOString().split('T')[0];
                    this.selectedBooking.checkInTime = this.selectedBooking.checkIn.toTimeString().slice(0, 5);
                } catch (error) {
                    console.error('Error converting checkIn to Date:', error);
                }
            }
            
            if (this.selectedBooking.checkOut) {
                try {
                    // First, check if it's a Firebase Timestamp
                    if (typeof this.selectedBooking.checkOut.toDate === 'function') {
                        this.selectedBooking.checkOut = this.selectedBooking.checkOut.toDate();
                    } 
                    // If it's already a Date or string, use it as is
                    else if (!(this.selectedBooking.checkOut instanceof Date)) {
                        this.selectedBooking.checkOut = new Date(this.selectedBooking.checkOut);
                    }
                    
                    // Format and set the date and time for the form inputs
                    this.selectedBooking.checkOutDate = this.selectedBooking.checkOut.toISOString().split('T')[0];
                    this.selectedBooking.checkOutTime = this.selectedBooking.checkOut.toTimeString().slice(0, 5);
                } catch (error) {
                    console.error('Error converting checkOut to Date:', error);
                }
            }
            
            // Add default values if missing
            if (!this.selectedBooking.propertyDetails) {
                this.selectedBooking.propertyDetails = {
                    name: '',
                    location: '',
                    roomNumber: '',
                    roomType: '',
                    floorLevel: ''
                };
            }
            
            // Set missing values to defaults to avoid errors
            this.selectedBooking.bookingType = this.selectedBooking.bookingType || 'standard';
            this.selectedBooking.hasTvRemote = !!this.selectedBooking.hasTvRemote;
            this.selectedBooking.guests = this.selectedBooking.guests || 1;
            
            // Force a recalculation of all pricing fields
            this.updateEditPricing();
            
            // Make sure the Vue reactivity system picks up all fields
            this.$forceUpdate();
        },
        
        updateEditDateFormat() {
            // Update formattedCheckIn and formattedCheckOut based on date/time inputs
            if (this.selectedBooking.checkInDate && this.selectedBooking.checkInTime) {
                const [year, month, day] = this.selectedBooking.checkInDate.split('-').map(Number);
                const [hours, minutes] = this.selectedBooking.checkInTime.split(':').map(Number);
                
                const ampm = hours >= 12 ? 'pm' : 'am';
                const hour12 = hours % 12 || 12; // Convert 0 to 12 for 12-hour format
                
                this.selectedBooking.formattedCheckIn = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year} ${String(hour12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
            }
            
            if (this.selectedBooking.checkOutDate && this.selectedBooking.checkOutTime) {
                const [year, month, day] = this.selectedBooking.checkOutDate.split('-').map(Number);
                const [hours, minutes] = this.selectedBooking.checkOutTime.split(':').map(Number);
                
                const ampm = hours >= 12 ? 'pm' : 'am';
                const hour12 = hours % 12 || 12; // Convert 0 to 12 for 12-hour format
                
                this.selectedBooking.formattedCheckOut = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year} ${String(hour12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
            } else {
                this.selectedBooking.formattedCheckOut = '';
            }
        },
        
        highlightRateChanges() {
            // Add a visual highlight to the rate values that have changed
            // This is done by temporarily adding a 'changed' class to the elements
            this.$nextTick(() => {
                const rateRows = document.querySelectorAll('.rate-details .rate-row span:last-child');
                rateRows.forEach(el => {
                    // Add the class to trigger the animation
                    el.classList.add('changed');
                    
                    // Remove the class after the animation completes
                    setTimeout(() => {
                        el.classList.remove('changed');
                    }, 1500);
                });
            });
        },
        
        updateEditPricing() {
            console.log('Updating edit pricing with date changes');
            
            // Update formatted dates
            this.updateEditDateFormat();
            
            // Debug existing values
            console.log('Current selectedBooking values before processing:', {
                checkInDate: this.selectedBooking.checkInDate,
                checkInTime: this.selectedBooking.checkInTime,
                checkOutDate: this.selectedBooking.checkOutDate,
                checkOutTime: this.selectedBooking.checkOutTime,
                checkIn: this.selectedBooking.checkIn,
                checkOut: this.selectedBooking.checkOut
            });
            
            // Set checkIn and checkOut Javascript Date objects
            if (this.selectedBooking.checkInDate && this.selectedBooking.checkInTime) {
                try {
                    const checkInDate = new Date(`${this.selectedBooking.checkInDate}T${this.selectedBooking.checkInTime}`);
                    this.selectedBooking.checkIn = checkInDate;
                    console.log('New checkIn date set:', checkInDate);
                } catch (e) {
                    console.error('Error creating checkIn date:', e);
                }
            }
            
            // Only set checkOut if both date and time are provided by the user
            if (this.selectedBooking.checkOutDate && this.selectedBooking.checkOutDate.trim() !== '' &&
                this.selectedBooking.checkOutTime && this.selectedBooking.checkOutTime.trim() !== '') {
                try {
                    const checkOutDate = new Date(`${this.selectedBooking.checkOutDate}T${this.selectedBooking.checkOutTime}`);
                    this.selectedBooking.checkOut = checkOutDate;
                    console.log('New checkOut date set:', checkOutDate);
                } catch (e) {
                    console.error('Error creating checkOut date:', e);
                    // Clear checkOut on error
                    this.selectedBooking.checkOut = null;
                }
            } else {
                // Clear the checkOut value if either date or time is missing
                this.selectedBooking.checkOut = null;
                console.log('CheckOut cleared - short stay mode');
            }
            
            // Calculate nights directly using the imported function
            let nights = 0;
            let hours = 0;
            
            if (this.selectedBooking.checkIn) {
                if (this.selectedBooking.checkOut) {
                    // Calculate nights
                    nights = calculateNights(this.selectedBooking.checkIn, this.selectedBooking.checkOut);
                    console.log('Calculated nights:', nights);
                    
                    // Calculate hours
                    hours = calculateHours(this.selectedBooking.checkIn, this.selectedBooking.checkOut);
                    console.log('Calculated hours:', hours);
                } else {
                    // For short stay (no checkout), use standard 3 hours or existing value
                    nights = 0;
                    hours = this.selectedBooking.hours || 3;
                    console.log('Short stay mode - hours:', hours);
                }
            }
            
            // Set the booking type based on the dates and selected options
            let bookingType = this.selectedBooking.bookingType || 'standard';
            const hasCheckOut = !!this.selectedBooking.checkOut;
            const hasTvRemote = this.selectedBooking.hasTvRemote || false;
            
            // Override booking type for short stays
            if (!hasCheckOut) {
                bookingType = 'hourly';
                console.log('Setting booking type to hourly for short stay');
            }
            
            console.log('Calculating booking costs with:', {
                nights, 
                bookingType,
                hasCheckOut,
                hasTvRemote,
                hours
            });
            
            // Call calculation directly to ensure we have the latest values
            const bookingCosts = calculateBookingCosts(
                nights, 
                bookingType,
                hasCheckOut,
                hasTvRemote,
                hours
            );
            
            console.log('Calculated booking costs:', bookingCosts);
            
            // Update the price fields with explicit values using Vue.set for reactivity
            this.$set(this.selectedBooking, 'nightlyRate', bookingCosts.nightlyRate);
            this.$set(this.selectedBooking, 'numberOfNights', nights);
            this.$set(this.selectedBooking, 'hours', hours);
            this.$set(this.selectedBooking, 'subtotal', bookingCosts.subtotal);
            this.$set(this.selectedBooking, 'serviceFee', bookingCosts.serviceFeeAmount);
            this.$set(this.selectedBooking, 'totalPrice', bookingCosts.totalAmount);
            this.$set(this.selectedBooking, 'tvRemoteFee', bookingCosts.tvRemoteFee);
            this.$set(this.selectedBooking, 'bookingType', bookingType);
            
            console.log('Updated booking object with new values:', {
                nightlyRate: this.selectedBooking.nightlyRate,
                subtotal: this.selectedBooking.subtotal,
                serviceFee: this.selectedBooking.serviceFee,
                totalPrice: this.selectedBooking.totalPrice,
                nights: this.selectedBooking.numberOfNights,
                hours: this.selectedBooking.hours,
                bookingType: this.selectedBooking.bookingType,
                checkOut: this.selectedBooking.checkOut
            });
            
            // Force Vue to update computed properties and UI
            this.$forceUpdate();
            
            // Also update computed values that might be cached
            this.$nextTick(() => {
                // Force re-evaluation of computed properties
                const computed = [
                    'editCalculateNights', 
                    'editCalculateHours', 
                    'editHasCheckOut', 
                    'editRoomRate', 
                    'editStayTypeLabel', 
                    'editSubtotal', 
                    'editServiceFee', 
                    'editTotalAmount'
                ];
                
                // Log computed properties to verify calculation
                const computedValues = {};
                computed.forEach(prop => {
                    computedValues[prop] = this[prop];
                });
                console.log('Updated computed values:', computedValues);
                
                // Add visual feedback for the rate changes
                this.highlightRateChanges();
            });
        },
        
        calculateEditDuration() {
            if (!this.selectedBooking.checkInDate || !this.selectedBooking.checkOutDate) {
                return 0;
            }
            
            // Calculate number of nights between check-in and check-out
            const checkInDate = new Date(this.selectedBooking.checkInDate);
            const checkOutDate = new Date(this.selectedBooking.checkOutDate);
            
            // Calculate the difference in days
            const diffTime = Math.abs(checkOutDate - checkInDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            return diffDays;
        },

        async saveBookingChanges() {
            try {
                this.loading = true;
                
                // Ensure we have the latest calculation of all pricing fields
                this.updateEditPricing();
                
                // Get the selected booking for easier reference
                const booking = this.selectedBooking;
                const bookingId = booking.id;
                
                if (!bookingId) {
                    throw new Error('Booking ID is missing');
                }
                
                // Prepare check-in and check-out timestamps
                let checkIn = null;
                let checkOut = null;
                
                // Handle check-in date and time
                if (booking.checkInDate && booking.checkInTime) {
                    const checkInDateTime = new Date(`${booking.checkInDate}T${booking.checkInTime}`);
                    checkIn = Timestamp.fromDate(checkInDateTime);
                } else {
                    throw new Error('Check-in date and time are required');
                }
                
                // Handle check-out date and time (optional)
                if (booking.checkOutDate && booking.checkOutDate.trim() !== '' && 
                    booking.checkOutTime && booking.checkOutTime.trim() !== '') {
                    const checkOutDateTime = new Date(`${booking.checkOutDate}T${booking.checkOutTime}`);
                    checkOut = Timestamp.fromDate(checkOutDateTime);
                }
                
                // Log the update operation for auditing
                await logRoomActivity(
                    'booking_update',
                    `Updated booking for ${booking.guestName} - Room ${booking.propertyDetails.roomNumber} - Check-in: ${booking.checkInDate}`
                );
                
                // Prepare update data
                const updateData = {
                    guestName: booking.guestName,
                    guests: booking.guests,
                    status: booking.status,
                    propertyDetails: {
                        roomNumber: booking.propertyDetails.roomNumber,
                        roomType: booking.propertyDetails.roomType,
                        floorLevel: booking.propertyDetails.floorLevel,
                        name: booking.propertyDetails.name,
                        location: booking.propertyDetails.location
                    },
                    checkIn: checkIn,
                    updatedAt: Timestamp.now(),
                    // Include TV Remote option
                    hasTvRemote: booking.hasTvRemote || false,
                    bookingType: booking.bookingType || 'standard',
                    // Use the explicitly calculated pricing values from updateEditPricing
                    nightlyRate: booking.nightlyRate || this.editRoomRate,
                    numberOfNights: booking.numberOfNights || this.editCalculateNights,
                    hours: booking.hours || this.editCalculateHours,
                    subtotal: booking.subtotal || this.editSubtotal,
                    serviceFee: booking.serviceFee || this.editServiceFee,
                    totalPrice: booking.totalPrice || this.editTotalAmount
                };

                // Ensure totalPrice is provided and calculated correctly
                if (!updateData.totalPrice) {
                    console.error('Total price not available in booking object or computed properties');
                    alert('Error: Could not calculate total price correctly');
                    this.loading = false;
                    return;
                }
                
                // Only include checkOut if it exists
                if (checkOut) {
                    updateData.checkOut = checkOut;
                } else if (booking.checkOut) {
                    // If there was a checkOut before but now it's removed, explicitly set to null or deleteField
                    updateData.checkOut = deleteField();
                }

                // Include email and contact number if they exist
                if (booking.email && booking.email.trim()) {
                    updateData.email = booking.email.trim();
                }
                if (booking.contactNumber && booking.contactNumber.trim()) {
                    updateData.contactNumber = booking.contactNumber.trim();
                }

                console.log('Updating booking with data:', updateData);

                // Update the booking in Firestore
                const bookingRef = doc(db(), 'everlodgebookings', bookingId);
                await updateDoc(bookingRef, updateData);

                console.log('Booking updated successfully');

                // **CRITICAL FIX**: Update the local booking object to reflect changes immediately
                // This ensures the display shows the updated check-out time
                const updatedBooking = {
                    ...booking,
                    ...updateData,
                    // Convert timestamps back to Date objects for display
                    checkIn: checkIn ? checkIn.toDate() : booking.checkIn,
                    checkOut: checkOut ? checkOut.toDate() : null, // Simplified: either the new checkOut date or null
                    // IMPORTANT: Preserve the form fields for edit mode
                    checkInDate: booking.checkInDate,
                    checkInTime: booking.checkInTime,
                    checkOutDate: booking.checkOutDate || '',
                    checkOutTime: booking.checkOutTime || '',
                    id: bookingId // Ensure the ID is preserved
                };

                // Update the booking in the local bookings array
                const bookingIndex = this.bookings.findIndex(b => b.id === bookingId);
                if (bookingIndex !== -1) {
                    // Use Vue.set to ensure reactivity
                    this.$set(this.bookings, bookingIndex, updatedBooking);
                } else {
                    console.warn('Booking not found in local array for index update');
                }

                // Update the selectedBooking to reflect the changes immediately
                this.selectedBooking = { ...updatedBooking };

                // Force Vue to update the display
                this.$forceUpdate();

                // Exit edit mode
                this.editMode = false;

                // Show success message
                alert('Booking updated successfully!');

                // Instead of fetching all bookings, just update the specific booking we modified
                // This preserves the form fields we need for editing
                console.log('Booking update completed successfully');

            } catch (error) {
                console.error('Error updating booking:', error);
                alert('Error updating booking: ' + error.message);
            } finally {
                this.loading = false;
            }
        },

        // Update the deleteBooking function
        async deleteBooking(booking) {
            try {
                if (!booking.id) {
                    alert('Cannot delete a booking without an ID');
                    return;
                }

                const user = auth().currentUser;
                if (!user) {
                    alert('Please log in to delete bookings');
                    return;
                }

                // Check admin status
                const isAdmin = await this.checkAdminStatus(user);
                if (!isAdmin) {
                    alert('You need administrator privileges to delete bookings');
                    return;
                }

                // Check if booking was created more than 1 day ago
                if (booking.createdAt) {
                    try {
                        let createdDate;
                        // Handle different timestamp formats
                        if (typeof booking.createdAt.toDate === 'function') {
                            createdDate = booking.createdAt.toDate();
                        } else if (booking.createdAt instanceof Date) {
                            createdDate = booking.createdAt;
                        } else {
                            createdDate = new Date(booking.createdAt);
                        }

                        const now = new Date();
                        const oneDayInMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
                        const timeDifference = now - createdDate;

                        if (timeDifference > oneDayInMs) {
                            alert('Cannot delete bookings that were created more than 1 day ago. This booking was created on ' + createdDate.toLocaleDateString() + ' at ' + createdDate.toLocaleTimeString() + '.');
                            return;
                        }
                    } catch (error) {
                        console.error('Error checking booking creation date:', error);
                        alert('Error validating booking deletion permissions. Please try again.');
                        return;
                    }
                }

                if (!confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
                    return;
                }

                // Create detailed room information for logging
                const roomDetails = {
                    roomNumber: booking.propertyDetails?.roomNumber || 'Unknown',
                    propertyName: booking.propertyDetails?.name || 'Unknown Property',
                    roomType: booking.propertyDetails?.roomType || 'Unknown Type'
                };

                // Delete the booking from everlodgebookings collection
                const bookingRef = doc(db(), 'everlodgebookings', booking.id); // Changed from 'bookings' to 'everlodgebookings'
                await deleteDoc(bookingRef);

                // Log the deletion with detailed information
                await activityLogger.logActivity(
                    'booking_deletion', // Changed from 'room_deletion' to 'booking_deletion'
                    `Deleted booking for ${roomDetails.propertyName} - Room ${roomDetails.roomNumber} (${roomDetails.roomType})`,
                    'Room Management'
                );

                // Remove from local state
                this.bookings = this.bookings.filter(b => b.id !== booking.id);
                
                alert('Booking deleted successfully!');
                
            } catch (error) {
                console.error('Error deleting booking:', error);
                alert('Failed to delete booking: ' + error.message);
            }
        },

        viewBookingDetails(booking) {
            // Make a deep copy to avoid modifying original
            this.selectedBooking = JSON.parse(JSON.stringify(booking));
            
            // Convert Firebase timestamps to JavaScript Date objects for display
            if (this.selectedBooking.checkIn) {
                try {
                    if (typeof this.selectedBooking.checkIn.toDate === 'function') {
                        this.selectedBooking.checkIn = this.selectedBooking.checkIn.toDate();
                    } else if (!(this.selectedBooking.checkIn instanceof Date)) {
                        this.selectedBooking.checkIn = new Date(this.selectedBooking.checkIn);
                    }
                } catch (error) {
                    console.error('Error converting checkIn to Date:', error);
                }
            }
            
            if (this.selectedBooking.checkOut) {
                try {
                    if (typeof this.selectedBooking.checkOut.toDate === 'function') {
                        this.selectedBooking.checkOut = this.selectedBooking.checkOut.toDate();
                    } else if (!(this.selectedBooking.checkOut instanceof Date)) {
                        this.selectedBooking.checkOut = new Date(this.selectedBooking.checkOut);
                    }
                    
                    // Set up form fields from the Date object if they don't exist
                    if (!this.selectedBooking.checkOutDate && this.selectedBooking.checkOut) {
                        this.selectedBooking.checkOutDate = this.selectedBooking.checkOut.toISOString().split('T')[0];
                        this.selectedBooking.checkOutTime = this.selectedBooking.checkOut.toTimeString().slice(0, 5);
                    }
                } catch (error) {
                    console.error('Error converting checkOut to Date:', error);
                }
            }
            
            // Set up checkIn form fields if they don't exist
            if (!this.selectedBooking.checkInDate && this.selectedBooking.checkIn) {
                this.selectedBooking.checkInDate = this.selectedBooking.checkIn.toISOString().split('T')[0];
                this.selectedBooking.checkInTime = this.selectedBooking.checkIn.toTimeString().slice(0, 5);
            }
            
            this.editMode = false;
            
            // Force Vue to update the display with the new booking data
            this.$forceUpdate();
        },

        refreshSelectedBooking() {
            // Refresh the selected booking from the main bookings array
            if (this.selectedBooking && this.selectedBooking.id) {
                const refreshedBooking = this.bookings.find(b => b.id === this.selectedBooking.id);
                if (refreshedBooking) {
                    this.selectedBooking = JSON.parse(JSON.stringify(refreshedBooking));
                    
                    // Ensure dates are properly formatted for display
                    if (this.selectedBooking.checkIn && typeof this.selectedBooking.checkIn.toDate === 'function') {
                        this.selectedBooking.checkIn = this.selectedBooking.checkIn.toDate();
                    }
                    if (this.selectedBooking.checkOut && typeof this.selectedBooking.checkOut.toDate === 'function') {
                        this.selectedBooking.checkOut = this.selectedBooking.checkOut.toDate();
                    }
                    
                    // Set up form fields from the Date objects
                    if (this.selectedBooking.checkIn) {
                        this.selectedBooking.checkInDate = this.selectedBooking.checkIn.toISOString().split('T')[0];
                        this.selectedBooking.checkInTime = this.selectedBooking.checkIn.toTimeString().slice(0, 5);
                    }
                    
                    if (this.selectedBooking.checkOut) {
                        this.selectedBooking.checkOutDate = this.selectedBooking.checkOut.toISOString().split('T')[0];
                        this.selectedBooking.checkOutTime = this.selectedBooking.checkOut.toTimeString().slice(0, 5);
                    }
                    
                    console.log('Selected booking refreshed with updated data and form fields');
                    this.$forceUpdate();
                }
            }
        },

        closeModal() {
            this.selectedBooking = null;
            this.editMode = false;
            this.originalCheckIn = null;
            this.originalCheckOut = null;
        },

        openManualBookingModal() {
            this.showManualBookingModal = true;
            this.resetManualBookingForm();
        },

        closeManualBookingModal() {
            this.showManualBookingModal = false;
            this.resetManualBookingForm();
        },

        resetManualBookingForm() {
            this.manualBooking = {
                guestName: '',
                roomNumber: '',
                status: 'Confirmed',
                checkInDate: '',
                checkInTime: '12:00',
                checkOutDate: '',
                checkOutTime: '',
                guests: 1,
                hasTvRemote: false,
                bookingType: 'standard',
                duration: 3,
            };
        },

        async fetchAvailableRooms() {
            if (!this.manualBooking.establishment) return;

            try {
                this.loading = true;
                console.log('Fetching available rooms for establishment:', this.manualBooking.establishment);

                // Fetch all rooms for the establishment
                const roomsRef = collection(db(), 'rooms');
                const roomsQuery = query(
                    roomsRef,
                    where('propertyDetails.name', '==', this.manualBooking.establishment)
                );
                const roomsSnapshot = await getDocs(roomsQuery);
                this.availableRooms = roomsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Fetch bookings from everlodgebookings collection
                const bookingsRef = collection(db(), 'everlodgebookings');
                const bookingsSnapshot = await getDocs(
                    query(
                        bookingsRef,
                        where('propertyDetails.name', '==', this.manualBooking.establishment),
                        where('status', 'in', ['Confirmed', 'Checked In'])
                    )
                );

                const bookedRoomIds = bookingsSnapshot.docs.map(doc => doc.data().roomId);
                this.availableRooms = this.availableRooms.filter(room => !bookedRoomIds.includes(room.id));

            } catch (error) {
                console.error('Error fetching available rooms:', error);
                alert('Failed to fetch available rooms');
            } finally {
                this.loading = false;
            }
        },

        async checkRoomAvailability(roomNumber, checkInDate, checkOutDate) {
            try {
                console.log(`Checking availability for room ${roomNumber} from ${checkInDate} to ${checkOutDate}`);
                
                // Get bookings from Firebase that might overlap with the selected dates
                const bookingsRef = collection(db(), 'everlodgebookings');
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
        },

        async submitManualBooking() {
            try {
                this.loading = true;
                
                if (!this.isManualBookingFormValid) {
                    throw new Error('Please fill out all required fields');
                }
                
                // Check if room is available
                const isAvailable = await this.checkRoomAvailability(
                    this.manualBooking.roomNumber,
                    this.manualBooking.checkInDate + 'T' + this.manualBooking.checkInTime,
                    this.manualBooking.checkOutDate ? this.manualBooking.checkOutDate + 'T' + this.manualBooking.checkOutTime : null
                );
                
                if (!isAvailable) {
                    throw new Error('This room is not available for the selected dates. Please choose another room or different dates.');
                }
                
                // Get the room details (type, etc.) from the rooms collection
                const roomQuery = query(
                    collection(db(), 'rooms'),
                    where('propertyDetails.roomNumber', '==', this.manualBooking.roomNumber)
                );
                
                const roomSnapshot = await getDocs(roomQuery);
                let roomData;
                let roomId;
                
                if (roomSnapshot.empty) {
                    console.log(`Room ${this.manualBooking.roomNumber} not found. Creating a new room entry.`);
                    
                    // Create a default room entry if not found
                    const newRoomData = {
                        propertyDetails: {
                            roomNumber: this.manualBooking.roomNumber,
                            roomType: 'Standard', // Default room type
                            floorLevel: '1',      // Default floor
                            name: 'Ever Lodge',   // Default property name
                            location: 'Baguio City' // Default location
                        },
                        price: 1300,  // Default price
                        status: 'available',
                        amenities: ['WiFi', 'Air Conditioning'],
                        createdAt: Timestamp.now(),
                        createdBy: auth().currentUser.uid
                    };
                    
                    // Add the new room to the database
                    const newRoomRef = await addDoc(collection(db(), 'rooms'), newRoomData);
                    console.log(`Created new room with ID: ${newRoomRef.id}`);
                    
                    // Use the new room data
                    roomData = newRoomData;
                    roomId = newRoomRef.id;
                    
                    // Log the creation of a new room
                    await logRoomActivity(
                        'room_create',
                        `Automatically created room ${this.manualBooking.roomNumber} during manual booking`
                    );
                } else {
                    roomData = roomSnapshot.docs[0].data();
                    roomId = roomSnapshot.docs[0].id;
                }
                
                // Create check-in date
                const checkInDateTime = new Date(`${this.manualBooking.checkInDate}T${this.manualBooking.checkInTime}`);
                
                // Create check-out date if both date and time are provided
                let checkOutDateTime = null;
                if (this.manualBooking.checkOutDate && this.manualBooking.checkOutTime) {
                    checkOutDateTime = new Date(`${this.manualBooking.checkOutDate}T${this.manualBooking.checkOutTime}`);
                }
                
                // Calculate nights, hours, and determine booking type for pricing
                const nights = this.calculateNights;
                const hours = this.calculateHours;
                const hasCheckOut = !!checkOutDateTime;
                
                // Default to standard booking type or use hourly for short stays
                let bookingType = 'standard';
                if (!hasCheckOut || hours < 24) {
                    bookingType = 'hourly';
                }
                
                // Calculate the booking costs
                const bookingCosts = calculateBookingCosts(
                    nights,
                    bookingType,
                    hasCheckOut,
                    this.manualBooking.hasTvRemote,
                    hours
                );
                
                // Create the booking document
                const bookingData = {
                    guestName: this.manualBooking.guestName,
                    guests: parseInt(this.manualBooking.guests),
                    propertyDetails: {
                        roomNumber: this.manualBooking.roomNumber,
                        roomType: roomData.propertyDetails.roomType || 'Standard',
                        floorLevel: roomData.propertyDetails.floorLevel || '1',
                        name: roomData.propertyDetails.name || 'Pine Haven Lodge',
                        location: roomData.propertyDetails.location || 'Baguio City'
                    },
                    roomId: roomId, // Add the room ID reference
                    checkIn: Timestamp.fromDate(checkInDateTime),
                    status: this.manualBooking.status || 'Confirmed',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                    createdBy: auth().currentUser.uid,
                    isManualBooking: true,
                    // Store pricing information
                    nightlyRate: bookingCosts.nightlyRate,
                    numberOfNights: nights,
                    hours: hours,
                    bookingType: bookingType,
                    subtotal: bookingCosts.subtotal,
                    serviceFee: bookingCosts.serviceFeeAmount, // Store service fee for reference but don't include in total
                    totalPrice: bookingCosts.totalAmount,
                    hasTvRemote: this.manualBooking.hasTvRemote
                };
                
                // Only add checkOut if it exists
                if (checkOutDateTime) {
                    bookingData.checkOut = Timestamp.fromDate(checkOutDateTime);
                }
                
                // Add the booking ONLY to everlodgebookings collection (remove duplicate creation)
                const docRef = await addDoc(collection(db(), 'everlodgebookings'), {
                    ...bookingData,
                    createdBy: 'admin',
                    createdMethod: 'manual'
                });
                console.log('Manual booking created with ID: ', docRef.id);
                
                // Create corresponding billing record
                const billingData = {
                    bookingId: docRef.id,
                    customerName: this.manualBooking.guestName,
                    checkIn: bookingData.checkIn,
                    checkOut: bookingData.checkOut || null,
                    roomNumber: this.manualBooking.roomNumber,
                    roomType: roomData.propertyDetails.roomType || 'Standard',
                    baseCost: bookingCosts.subtotal,
                    serviceFee: bookingCosts.serviceFeeAmount,
                    totalAmount: bookingCosts.totalAmount,
                    status: 'pending',
                    createdAt: Timestamp.now(),
                    createdBy: auth().currentUser.uid,
                    paymentMethod: 'cash',
                    notes: 'Created via manual booking'
                };
                
                const billingRef = await addDoc(collection(db(), 'billing'), billingData);
                console.log('Corresponding billing record created with ID: ', billingRef.id);
                
                // Update the booking with the billing ID reference
                await updateDoc(docRef, {
                    billingId: billingRef.id
                });
                
                // Log the activity
                await logRoomActivity(
                    'booking_create',
                    `Manual booking created for ${this.manualBooking.guestName} - Room ${this.manualBooking.roomNumber}`
                );
                
                alert('Booking created successfully!');
                this.closeManualBookingModal();
                this.resetManualBookingForm();
                this.fetchBookings();
                
            } catch (error) {
                console.error('Error creating manual booking:', error);
                alert('Failed to create booking: ' + error.message);
            } finally {
                this.loading = false;
            }
        },
        
        // Update pricing when form values change
        updateBookingTypeAndPricing() {
            // Just refresh the computed values
            this.$forceUpdate();
        },

        // async handleLogout() {
        //     try {
        //         await signOut(auth);
        //         window.location.href = '../Login/index.html';
        //     } catch (error) {
        //         console.error('Error signing out:', error);
        //         alert('Error signing out. Please try again.');
        //     }
        // },

        checkAuthState() {
            auth().onAuthStateChanged(async (user) => {
                if (user) {
                    this.isAuthenticated = true;
                    console.log('User is authenticated:', user.email);
                    // Load data after authentication is confirmed
                    await this.loadInitialData();
                } else {
                    this.isAuthenticated = false;
                    console.log('User is not authenticated, redirecting to login');
                    window.location.href = '../index.html';
                }
            });
        },

        filterByDate() {
            if (!this.startDate || !this.endDate) {
                alert('Please select both start and end dates');
                return;
            }
            this.fetchBookings(); // This will trigger the filteredBookings computed property
        },

        resetFilter() {
            this.startDate = '';
            this.endDate = '';
            this.currentDate = new Date();
            this.searchQuery = '';
        },

        updateDateAndPrice() {
            // This method is called when any date or time input changes
            console.log('Updating dates and prices');
            
            // Set checkIn and checkOut Javascript Date objects
            if (this.manualBooking.checkInDate) {
                const checkInDate = new Date(this.manualBooking.checkInDate);
                if (this.manualBooking.checkInTime) {
                    const [hours, minutes] = this.manualBooking.checkInTime.split(':').map(Number);
                    checkInDate.setHours(hours, minutes, 0);
                }
                this.manualBooking.checkIn = checkInDate;
            }
            
            // Only set checkOut if both date and time are provided by the user
            if (this.manualBooking.checkOutDate && this.manualBooking.checkOutDate.trim() !== '' &&
                this.manualBooking.checkOutTime && this.manualBooking.checkOutTime.trim() !== '') {
                const checkOutDate = new Date(this.manualBooking.checkOutDate);
                const [hours, minutes] = this.manualBooking.checkOutTime.split(':').map(Number);
                checkOutDate.setHours(hours, minutes, 0);
                this.manualBooking.checkOut = checkOutDate;
            } else {
                // Clear the checkOut value if either date or time is missing
                this.manualBooking.checkOut = null;
            }
            
            // Force Vue to re-compute night calculations and pricing
            this.$forceUpdate();
        },
        
        formatDisplayDate(date) {
            return date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        },

        goToPreviousDay() {
            const prevDate = new Date(this.currentDate);
            prevDate.setDate(prevDate.getDate() - 1);
            this.currentDate = prevDate;
        },

        goToNextDay() {
            const nextDate = new Date(this.currentDate);
            nextDate.setDate(nextDate.getDate() + 1);
            this.currentDate = nextDate;
        },

        goToToday() {
            this.currentDate = new Date();
        },

        // New method to load data after auth is confirmed
        async loadInitialData() {
            try {
                this.loading = true;
                const user = auth().currentUser;
                if (user) {
                    console.log('Current user:', user.email);
                    
                    // Always ensure admin privileges for the current user
                    await this.ensureAdminPrivileges(user);
                    
                    // Check admin status after ensuring privileges
                    const isAdmin = await this.checkAdminStatus(user);
                    
                    if (!isAdmin && !this.bypassAdminCheck) {
                        console.error('Failed to set admin privileges for user:', user.email);
                        alert('You do not have admin privileges');
                        await signOut(auth());
                        window.location.href = '../index.html';
                        return;
                    } else {
                        if (isAdmin) {
                            console.log('Admin privileges confirmed for user:', user.email);
                        } else {
                            console.log('Admin check bypassed for user:', user.email);
                        }
                    }
                    
                    // Fetch bookings (which now includes automatic duplicate removal)
                    await this.fetchBookings();
                }
                this.loading = false;
                
                // Hide the initial loading screen
                this.hideInitialLoader();
            } catch (error) {
                console.error('Error loading initial data:', error);
                this.loading = false;
                this.hideInitialLoader();
                
                // Even if there's an error, still try to load bookings
                try {
                    await this.fetchBookings();
                } catch (fetchError) {
                    console.error('Error during fallback booking fetch:', fetchError);
                }
            }
        },
        
        async ensureAdminPrivileges(user) {
            try {
                console.log('Ensuring admin privileges for user:', user.uid, user.email);
                
                // 1. Check and update user document in users collection
                const userDocRef = doc(db(), 'users', user.uid);
                const userDoc = await getDoc(userDocRef);
                
                // Set admin data with multiple admin flags to ensure compatibility
                const adminData = {
                    email: user.email,
                    username: user.email.split('@')[0],
                    fullname: user.displayName || 'Admin User',
                    isAdmin: true,
                    role: 'admin',
                    admin: true,
                    adminRole: 'administrator',
                    permissions: ['admin', 'read', 'write', 'delete'],
                    updatedAt: Timestamp.now(),
                    status: 'active'
                };
                
                if (userDoc.exists()) {
                    // Update existing user with admin privileges
                    await updateDoc(userDocRef, adminData);
                    console.log('Updated existing user with admin privileges');
                } else {
                    // Create new user document with admin privileges
                    adminData.createdAt = Timestamp.now();
                    await setDoc(userDocRef, adminData);
                    console.log('Created new user with admin privileges');
                }
                
                // 2. Also create an entry in the admins collection if it doesn't exist
                try {
                    const adminDocRef = doc(db(), 'admins', user.uid);
                    const adminDoc = await getDoc(adminDocRef);
                    
                    if (!adminDoc.exists()) {
                        await setDoc(adminDocRef, {
                            ...adminData,
                            createdAt: Timestamp.now()
                        });
                        console.log('Created admin document in admins collection');
                    }
                } catch (adminError) {
                    console.warn('Error with admins collection, continuing anyway:', adminError);
                }
                
                return true;
            } catch (error) {
                console.error('Error ensuring admin privileges:', error);
                return false;
            }
        },
        
        // Method to hide the initial loading screen
        hideInitialLoader() {
            const loadingOverlay = document.getElementById('initialLoadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
                // Remove from DOM after transition completes
                setTimeout(() => {
                    loadingOverlay.remove();
                }, 300);
            }
        },

        // Core duplicate removal logic (used by both automatic and manual methods)
        async performDuplicateRemoval() {
            try {
                // Get all bookings from everlodgebookings
                const bookingsRef = collection(db(), 'everlodgebookings');
                const snapshot = await getDocs(bookingsRef);
                
                const bookings = [];
                snapshot.forEach((doc) => {
                    bookings.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                if (bookings.length === 0) {
                    return 0;
                }
                
                // Group bookings by potential duplicate criteria with improved logic
                const duplicateGroups = {};
                
                bookings.forEach(booking => {
                    // Create a more comprehensive key for duplicate detection
                    const checkInTime = booking.checkIn?.seconds || booking.checkInDate?.seconds || 0;
                    const checkOutTime = booking.checkOut?.seconds || booking.checkOutDate?.seconds || 0;
                    const userId = booking.userId || 'unknown';
                    const roomNumber = booking.roomNumber || booking.propertyDetails?.roomNumber || 'unknown';
                    const totalPrice = booking.totalPrice || 0;
                    const guestName = booking.guestName || booking.guest?.name || 'unknown';
                    
                    // Create a unique key based on multiple criteria
                    const key = `${userId}_${checkInTime}_${checkOutTime}_${roomNumber}_${totalPrice}_${guestName}`;
                    
                    if (!duplicateGroups[key]) {
                        duplicateGroups[key] = [];
                    }
                    duplicateGroups[key].push(booking);
                });
                
                // Find groups with more than one booking (duplicates)
                const duplicates = Object.values(duplicateGroups).filter(group => group.length > 1);
                
                let removedCount = 0;
                
                if (duplicates.length > 0) {
                    console.log(`Found ${duplicates.length} sets of duplicate bookings - removing duplicates...`);
                    
                    for (const group of duplicates) {
                        console.log(`Processing duplicate group with ${group.length} bookings:`, group.map(b => ({ 
                            id: b.id, 
                            guestName: b.guestName, 
                            createdAt: b.createdAt?.seconds 
                        })));
                        
                        // Sort by creation time, keep the most recent
                        group.sort((a, b) => {
                            const aTime = a.createdAt?.seconds || a.confirmedAt?.seconds || 0;
                            const bTime = b.createdAt?.seconds || b.confirmedAt?.seconds || 0;
                            return bTime - aTime; // Most recent first
                        });
                        
                        // Remove all except the first (most recent)
                        const toKeep = group[0];
                        const toRemove = group.slice(1);
                        
                        console.log(`Keeping booking ${toKeep.id}, removing ${toRemove.length} duplicates`);
                        
                        for (const booking of toRemove) {
                            try {
                                await deleteDoc(doc(db(), 'everlodgebookings', booking.id));
                                console.log(`Removed duplicate booking: ${booking.id} for guest: ${booking.guestName}`);
                                removedCount++;
                            } catch (error) {
                                console.error(`Error removing duplicate booking ${booking.id}:`, error);
                            }
                        }
                    }
                    
                    // Log the cleanup activity
                    try {
                        await logRoomActivity('duplicate_cleanup', `Removed ${removedCount} duplicate bookings`);
                    } catch (logError) {
                        console.warn('Could not log duplicate cleanup activity:', logError);
                    }
                }
                
                return removedCount;
            } catch (error) {
                console.error('Error during duplicate removal:', error);
                throw error;
            }
        },

        // Function to automatically identify and remove duplicate bookings (updated to use new logic)
        async autoRemoveDuplicateBookings() {
            try {
                console.log('Automatically scanning for duplicate bookings...');
                
                const removedCount = await this.performDuplicateRemoval();
                
                if (removedCount > 0) {
                    console.log(`Automatically removed ${removedCount} duplicate bookings.`);
                } else {
                    console.log('No duplicate bookings found during automatic scan.');
                }
                
                return removedCount;
            } catch (error) {
                console.error('Error during automatic duplicate scan:', error);
                return 0;
            }
        },
    },
    watch: {
        'selectedBooking.checkInDate': function() {
            this.updateEditPricing();
        },
        'selectedBooking.checkInTime': function() {
            this.updateEditPricing();
        },
        'selectedBooking.checkOutDate': function() {
            this.updateEditPricing();
        },
        'selectedBooking.checkOutTime': function() {
            this.updateEditPricing();
        },
        'selectedBooking.hasTvRemote': function() {
            this.updateEditPricing();
        },
        'selectedBooking.bookingType': function() {
            this.updateEditPricing();
        },
        'selectedBooking.guests': function() {
            this.updateEditPricing();
        }
    },
    async mounted() {
        console.log('Room Management Vue application mounted');
        // Just call checkAuthState which will handle auth check and data loading
        this.checkAuthState();
    }
});
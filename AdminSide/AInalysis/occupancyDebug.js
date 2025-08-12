import { db, collection, getDocs } from '../firebase.js';
import { occupancyService } from '../shared/occupancyCalculationService.js';

export async function debugOccupancyCalculations() {
    try {
        console.log('\n=== Unified Occupancy Debug Analysis ===');
        
        // Fetch all rooms
        const roomsRef = collection(db, 'rooms');
        const roomsSnapshot = await getDocs(roomsRef);
        const rooms = roomsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Fetch all bookings from everlodgebookings collection (same as Dashboard and Business Analytics)
        const bookingsRef = collection(db, 'everlodgebookings');
        const bookingsSnapshot = await getDocs(bookingsRef);
        const bookings = bookingsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`Loaded ${rooms.length} rooms and ${bookings.length} bookings from everlodgebookings`);

        // Debug room status
        console.log('\n=== Room Status Analysis ===');
        const roomStatusCount = rooms.reduce((acc, room) => {
            const status = (room.status || 'available').toLowerCase();
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        console.log('Room Status Distribution:', roomStatusCount);

        // Use unified occupancy calculation service
        console.log('\n=== Unified Occupancy Calculation ===');
        const occupancyData = occupancyService.calculateCurrentOccupancy(bookings);
        
        console.log('Unified Service Results:');
        console.log(`  Occupancy Rate: ${occupancyData.occupancyRateFormatted}`);
        console.log(`  Occupied Rooms: ${occupancyData.occupiedRooms}`);
        console.log(`  Available Rooms: ${occupancyData.availableRooms}`);
        console.log(`  Total Rooms: ${occupancyData.totalRooms}`);
        console.log(`  Active Bookings Today: ${occupancyData.activeBookingsToday}`);
        console.log(`  Occupied Room Numbers: [${occupancyData.occupiedRoomNumbers.join(', ')}]`);
        
        // Validate data consistency
        const isValid = occupancyService.validateOccupancyData(occupancyData);
        console.log(`  Data Validation: ${isValid ? '✅ PASSED' : '❌ FAILED'}`);

        // Debug room types
        const roomTypes = rooms.reduce((acc, room) => {
            const type = room.propertyDetails?.roomType || room.type || 'Standard';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        console.log('\n=== Room Types Distribution ===');
        console.log('Room Types:', roomTypes);

        // Legacy calculation for comparison
        console.log('\n=== Legacy vs Unified Comparison ===');
        const now = new Date();
        const activeBookingsLegacy = bookings.filter(booking => {
            const checkIn = new Date(booking.checkIn?.toDate?.() || booking.checkIn);
            const checkOut = new Date(booking.checkOut?.toDate?.() || booking.checkOut);
            return booking.status === 'Confirmed' && checkIn <= now && checkOut >= now;
        });
        
        const legacyOccupiedRooms = roomStatusCount.occupied || 0;
        const legacyOccupancyRate = (legacyOccupiedRooms / rooms.length) * 100;
        
        console.log(`Legacy Method:`);
        console.log(`  Active Bookings (Confirmed only): ${activeBookingsLegacy.length}`);
        console.log(`  Occupied Rooms (by status): ${legacyOccupiedRooms}`);
        console.log(`  Occupancy Rate: ${legacyOccupancyRate.toFixed(1)}%`);
        
        console.log(`Unified Method:`);
        console.log(`  Active Bookings (all active statuses): ${occupancyData.activeBookingsToday}`);
        console.log(`  Occupied Rooms (unique by booking): ${occupancyData.occupiedRooms}`);
        console.log(`  Occupancy Rate: ${occupancyData.occupancyRateFormatted}`);

        // Calculate stay durations for active bookings
        const stayDurations = [];
        bookings.forEach(booking => {
            try {
                const checkIn = new Date(booking.checkIn?.toDate?.() || booking.checkIn);
                const checkOut = new Date(booking.checkOut?.toDate?.() || booking.checkOut);
                if (checkIn && checkOut && !isNaN(checkIn) && !isNaN(checkOut)) {
                    const duration = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
                    if (duration > 0) {
                        stayDurations.push({
                            bookingId: booking.id,
                            duration: duration,
                            status: booking.status,
                            room: booking.propertyDetails?.roomNumber
                        });
                    }
                }
            } catch (error) {
                console.warn(`Error calculating duration for booking ${booking.id}:`, error);
            }
        });

        console.log('\n=== Stay Duration Analysis ===');
        console.log(`Valid Stay Durations: ${stayDurations.length}`);
        if (stayDurations.length > 0) {
            const avgStayDuration = stayDurations.reduce((sum, { duration }) => sum + duration, 0) / stayDurations.length;
            console.log(`Average Stay Duration: ${avgStayDuration.toFixed(1)} days`);
            
            // Show some examples
            const activeDurations = stayDurations.filter(s => 
                ['occupied', 'checked-in', 'confirmed', 'active', 'pending'].includes(s.status?.toLowerCase())
            );
            console.log(`Active Stay Durations (${activeDurations.length}):`, activeDurations.slice(0, 5));
        }

        console.log('\n=== Final Summary ===');
        return {
            unifiedOccupancyData: occupancyData,
            roomStatusCount,
            roomTypes,
            stayDurations,
            totalRooms: rooms.length,
            totalBookings: bookings.length,
            validationPassed: isValid,
            calculations: {
                unifiedOccupancyRate: occupancyData.occupancyRate,
                unifiedOccupiedRooms: occupancyData.occupiedRooms,
                unifiedAvailableRooms: occupancyData.availableRooms,
                legacyOccupancyRate: legacyOccupancyRate,
                legacyOccupiedRooms: legacyOccupiedRooms
            }
        };
        
    } catch (error) {
        console.error('Error in unified occupancy debug:', error);
        throw error;
    }
}

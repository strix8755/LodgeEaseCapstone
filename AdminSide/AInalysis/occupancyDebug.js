import { db, collection, getDocs } from '../firebase.js';

export async function debugOccupancyCalculations() {
    try {
        // Fetch all rooms
        const roomsRef = collection(db, 'rooms');
        const roomsSnapshot = await getDocs(roomsRef);
        const rooms = roomsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Fetch all bookings
        const bookingsRef = collection(db, 'bookings');
        const bookingsSnapshot = await getDocs(bookingsRef);
        const bookings = bookingsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Debug room status
        console.log('\n=== Room Status Analysis ===');
        const roomStatusCount = rooms.reduce((acc, room) => {
            const status = (room.status || 'available').toLowerCase();
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        console.log('Room Status Distribution:', roomStatusCount);

        // Debug active bookings
        const now = new Date();
        const activeBookings = bookings.filter(booking => {
            const checkIn = new Date(booking.checkIn?.toDate?.() || booking.checkIn);
            const checkOut = new Date(booking.checkOut?.toDate?.() || booking.checkOut);
            return booking.status === 'Confirmed' && checkIn <= now && checkOut >= now;
        });
        console.log('\n=== Active Bookings Analysis ===');
        console.log('Total Active Bookings:', activeBookings.length);

        // Debug room types
        const roomTypes = rooms.reduce((acc, room) => {
            const type = room.propertyDetails?.roomType || room.type || 'Standard';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        console.log('\n=== Room Types Distribution ===');
        console.log('Room Types:', roomTypes);

        // Debug stay duration
        const stayDurations = activeBookings.map(booking => {
            const checkIn = new Date(booking.checkIn?.toDate?.() || booking.checkIn);
            const checkOut = new Date(booking.checkOut?.toDate?.() || booking.checkOut);
            return {
                bookingId: booking.id,
                duration: Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))
            };
        });
        console.log('\n=== Stay Duration Analysis ===');
        console.log('Stay Durations:', stayDurations);

        // Calculate averages
        const totalRooms = rooms.length;
        const occupiedRooms = roomStatusCount.occupied || 0;
        const occupancyRate = (occupiedRooms / totalRooms) * 100;
        const avgStayDuration = stayDurations.reduce((sum, { duration }) => sum + duration, 0) / 
                               (stayDurations.length || 1);

        console.log('\n=== Final Calculations ===');
        console.log({
            totalRooms,
            occupiedRooms,
            occupancyRate: occupancyRate.toFixed(1) + '%',
            avgStayDuration: avgStayDuration.toFixed(1) + ' days'
        });

        return {
            roomStatusCount,
            activeBookings,
            roomTypes,
            stayDurations,
            calculations: {
                totalRooms,
                occupiedRooms,
                occupancyRate,
                avgStayDuration
            }
        };
    } catch (error) {
        console.error('Error in occupancy debug:', error);
        throw error;
    }
}

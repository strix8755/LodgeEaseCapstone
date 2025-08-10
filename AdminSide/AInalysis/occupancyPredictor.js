import { db, collection, getDocs, query, where, Timestamp } from '../firebase.js';

export async function predictNextMonthOccupancy() {
    try {
        // Get next month's date range
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);

        // Modified query to use single field index
        const bookingsRef = collection(db(), 'bookings');
        let confirmedBookings = [];

        try {
            // First get bookings by date range
            const dateQuery = query(bookingsRef, 
                where('checkIn', '>=', nextMonth),
                where('checkIn', '<=', nextMonthEnd)
            );
            const dateSnapshot = await getDocs(dateQuery);
            
            // Then filter for confirmed status in memory
            confirmedBookings = dateSnapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(booking => booking.status?.toLowerCase() === 'confirmed');
        } catch (error) {
            // If composite index fails, try fallback approach
            console.warn('Using fallback query method:', error);
            const allBookingsQuery = query(bookingsRef);
            const allSnapshot = await getDocs(allBookingsQuery);
            
            confirmedBookings = allSnapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(booking => {
                    const checkIn = new Date(booking.checkIn?.toDate?.() || booking.checkIn);
                    return booking.status?.toLowerCase() === 'confirmed' &&
                           checkIn >= nextMonth &&
                           checkIn <= nextMonthEnd;
                });
        }

        // Rest of the prediction logic
        const roomsRef = collection(db(), 'rooms');
        const roomsSnapshot = await getDocs(roomsRef);
        const totalRooms = roomsSnapshot.docs.length;

        // Calculate base prediction from confirmed bookings
        const daysInMonth = nextMonthEnd.getDate();
        const dailyOccupancy = new Array(daysInMonth).fill(0);

        // Count daily occupancy from confirmed bookings
        confirmedBookings.forEach(booking => {
            const checkIn = new Date(booking.checkIn?.toDate?.() || booking.checkIn);
            const checkOut = new Date(booking.checkOut?.toDate?.() || booking.checkOut);
            
            for (let d = new Date(checkIn); d <= checkOut; d.setDate(d.getDate() + 1)) {
                if (d.getMonth() === nextMonth.getMonth()) {
                    dailyOccupancy[d.getDate() - 1]++;
                }
            }
        });

        // Calculate average occupancy
        const averageOccupancy = dailyOccupancy.reduce((sum, count) => sum + count, 0) / daysInMonth;
        const predictedRate = (averageOccupancy / totalRooms) * 100;

        // Calculate current booking pace
        const currentPace = calculateBookingPace(confirmedBookings);
        const historicalOccupancy = await getHistoricalOccupancy(bookingsRef, totalRooms);

        return {
            month: nextMonth.toLocaleString('default', { month: 'long' }),
            predictedRate: Math.min(100, predictedRate),
            confidence: calculateConfidenceScore(confirmedBookings.length, totalRooms),
            details: {
                confirmedBookings: confirmedBookings.length,
                totalRooms,
                currentPace,
                historicalOccupancy,
                expectedAdditional: Math.round(currentPace * 30),
                dailyOccupancy
            }
        };
    } catch (error) {
        console.error('Error predicting occupancy:', error);
        throw error;
    }
}

// Add helper functions after the main prediction function
function calculateBookingPace(bookings) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    const recentBookings = bookings.filter(booking => {
        const bookingDate = new Date(booking.createdAt?.toDate?.() || booking.createdAt);
        return bookingDate >= thirtyDaysAgo && bookingDate <= now;
    });

    return recentBookings.length / 30; // Average bookings per day
}

async function getHistoricalOccupancy(bookingsRef, totalRooms) {
    try {
        // Get last year's same month
        const lastYear = new Date();
        lastYear.setFullYear(lastYear.getFullYear() - 1);
        const startOfMonth = new Date(lastYear.getFullYear(), lastYear.getMonth(), 1);
        const endOfMonth = new Date(lastYear.getFullYear(), lastYear.getMonth() + 1, 0);

        const historicalQuery = query(bookingsRef,
            where('checkIn', '>=', startOfMonth),
            where('checkIn', '<=', endOfMonth)
        );

        const snapshot = await getDocs(historicalQuery);
        const historicalBookings = snapshot.docs.map(doc => doc.data())
            .filter(booking => booking.status?.toLowerCase() === 'confirmed');

        const daysInMonth = endOfMonth.getDate();
        const dailyOccupancy = new Array(daysInMonth).fill(0);

        historicalBookings.forEach(booking => {
            const checkIn = new Date(booking.checkIn?.toDate?.() || booking.checkIn);
            const checkOut = new Date(booking.checkOut?.toDate?.() || booking.checkOut);
            
            for (let d = new Date(checkIn); d <= checkOut; d.setDate(d.getDate() + 1)) {
                if (d.getMonth() === startOfMonth.getMonth()) {
                    dailyOccupancy[d.getDate() - 1]++;
                }
            }
        });

        const averageOccupancy = dailyOccupancy.reduce((sum, count) => sum + count, 0) / daysInMonth;
        return (averageOccupancy / totalRooms) * 100;
    } catch (error) {
        console.warn('Error getting historical occupancy:', error);
        return 0;
    }
}

function calculateConfidenceScore(confirmedBookings, totalRooms) {
    // Base confidence on how many rooms are already booked
    const baseConfidence = (confirmedBookings / totalRooms) * 50; // Max 50% from bookings

    // Add time-based confidence
    const daysUntilNextMonth = getDaysUntilNextMonth();
    const timeConfidence = Math.min(50, (30 - daysUntilNextMonth) * 1.67); // Max 50% from time

    return Math.min(100, baseConfidence + timeConfidence);
}

function getDaysUntilNextMonth() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return Math.ceil((nextMonth - now) / (1000 * 60 * 60 * 24));
}

// Export helper functions for testing
export {
    calculateBookingPace,
    getHistoricalOccupancy,
    calculateConfidenceScore,
    getDaysUntilNextMonth
};

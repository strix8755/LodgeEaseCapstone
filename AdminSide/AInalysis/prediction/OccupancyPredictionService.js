import { db, collection, getDocs, query, where, Timestamp } from '../../firebase.js';

export class OccupancyPredictionService {
    async predictNextMonthOccupancy() {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        
        const nextMonthEnd = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);
        
        try {
            // Get all rooms
            const roomsRef = collection(db, 'rooms');
            const roomsSnapshot = await getDocs(roomsRef);
            const totalRooms = roomsSnapshot.docs.length;

            // Get confirmed bookings for next month
            const bookingsRef = collection(db, 'bookings');
            const nextMonthBookings = await this.getConfirmedBookingsForPeriod(nextMonth, nextMonthEnd);
            
            // Get historical data for the same month from last year
            const lastYear = new Date(nextMonth);
            lastYear.setFullYear(lastYear.getFullYear() - 1);
            const lastYearEnd = new Date(lastYear);
            lastYearEnd.setMonth(lastYear.getMonth() + 1);
            lastYearEnd.setDate(0);
            
            const historicalBookings = await this.getConfirmedBookingsForPeriod(lastYear, lastYearEnd);

            // Calculate daily occupancy for next month
            const daysInMonth = nextMonthEnd.getDate();
            const dailyOccupancy = this.calculateDailyOccupancy(nextMonthBookings, nextMonth, nextMonthEnd);
            
            // Calculate historical occupancy rate
            const historicalOccupancy = this.calculateHistoricalOccupancy(historicalBookings, lastYear, lastYearEnd, totalRooms);
            
            // Calculate current booking pace
            const currentPace = await this.calculateBookingPace(nextMonthBookings);
            const historicalPace = await this.calculateBookingPace(historicalBookings);
            
            // Calculate predicted occupancy
            const confirmedOccupancy = dailyOccupancy.reduce((sum, count) => sum + count, 0) / daysInMonth;
            const expectedAdditionalBookings = this.predictAdditionalBookings(
                currentPace,
                historicalPace,
                historicalOccupancy,
                totalRooms
            );
            
            // Calculate final prediction
            const predictedOccupancy = Math.min(100, (
                (confirmedOccupancy + expectedAdditionalBookings) / totalRooms
            ) * 100);

            // Calculate confidence score
            const confidence = this.calculateConfidence(
                nextMonthBookings.length,
                historicalBookings.length,
                totalRooms
            );

            return {
                month: nextMonth.toLocaleString('default', { month: 'long', year: 'numeric' }),
                predictedRate: predictedOccupancy.toFixed(1),
                confidence: confidence.toFixed(1),
                details: {
                    confirmedBookings: nextMonthBookings.length,
                    totalRooms,
                    historicalOccupancy: historicalOccupancy.toFixed(1),
                    currentPace: currentPace.toFixed(2),
                    expectedAdditional: expectedAdditionalBookings.toFixed(1)
                }
            };
        } catch (error) {
            console.error('Error predicting occupancy:', error);
            throw error;
        }
    }

    async getConfirmedBookingsForPeriod(startDate, endDate) {
        const bookingsRef = collection(db, 'bookings');
        const q = query(
            bookingsRef,
            where('checkIn', '>=', startDate),
            where('checkIn', '<=', endDate),
            where('status', 'in', ['Confirmed', 'confirmed'])
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    calculateDailyOccupancy(bookings, startDate, endDate) {
        const days = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dayOccupancy = bookings.filter(booking => {
                const checkIn = new Date(booking.checkIn?.toDate?.() || booking.checkIn);
                const checkOut = new Date(booking.checkOut?.toDate?.() || booking.checkOut);
                return checkIn <= d && checkOut >= d;
            }).length;
            days.push(dayOccupancy);
        }
        return days;
    }

    calculateHistoricalOccupancy(bookings, startDate, endDate, totalRooms) {
        const days = this.calculateDailyOccupancy(bookings, startDate, endDate);
        return (days.reduce((sum, count) => sum + count, 0) / days.length / totalRooms) * 100;
    }

    async calculateBookingPace(bookings) {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
        
        const recentBookings = bookings.filter(booking => {
            const createdAt = new Date(booking.createdAt?.toDate?.() || booking.createdAt);
            return createdAt >= thirtyDaysAgo;
        });

        return recentBookings.length / 30;
    }

    predictAdditionalBookings(currentPace, historicalPace, historicalOccupancy, totalRooms) {
        const paceRatio = currentPace / (historicalPace || 1);
        const daysUntilNextMonth = Math.floor((new Date().getMonth() + 1) - new Date().getDate());
        
        return Math.min(
            totalRooms * (historicalOccupancy / 100) * paceRatio,
            totalRooms - (currentPace * daysUntilNextMonth)
        );
    }

    calculateConfidence(confirmedCount, historicalCount, totalRooms) {
        const dataAvailability = Math.min(confirmedCount / (historicalCount || 1), 1);
        const coverage = confirmedCount / totalRooms;
        return (dataAvailability * 0.6 + coverage * 0.4) * 100;
    }
}

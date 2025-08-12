// Unified Occupancy Calculation Service
// This service provides consistent occupancy rate calculations across Dashboard and Business Analytics

import { db, collection, getDocs } from '../firebase.js';
import { parseDate } from '../shared/dateUtils.js';

export class OccupancyCalculationService {
    constructor() {
        this.TOTAL_ROOMS = 36;
        this.COLLECTION_NAME = 'everlodgebookings';
        this.ACTIVE_STATUSES = ['occupied', 'checked-in', 'confirmed', 'active', 'pending'];
    }

    /**
     * Calculate current day occupancy rate using unified logic
     * @param {Array} bookings - Array of booking objects
     * @returns {Object} - Occupancy data with rate, occupied rooms, and available rooms
     */
    calculateCurrentOccupancy(bookings) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of today
            
            if (!bookings || !Array.isArray(bookings)) {
                console.warn('OccupancyCalculationService: Invalid bookings data');
                return this.getEmptyOccupancyData();
            }
            
            // Use Set to track unique occupied rooms
            const occupiedRoomsSet = new Set();
            const activeBookingsToday = [];
            
            bookings.forEach(booking => {
                try {
                    // Parse check-in and check-out dates using unified date parsing
                    const checkIn = this.parseBookingDate(booking.checkIn);
                    const checkOut = this.parseBookingDate(booking.checkOut);
                    
                    if (!checkIn || !checkOut) {
                        console.warn(`OccupancyCalculationService: Invalid dates for booking ${booking.id}`);
                        return;
                    }
                    
                    // Check if booking has active status
                    const hasActiveStatus = this.ACTIVE_STATUSES.includes(booking.status?.toLowerCase());
                    
                    // Check if today falls between check-in and check-out
                    const isCurrentlyActive = checkIn <= today && checkOut >= today;
                    
                    if (hasActiveStatus && isCurrentlyActive) {
                        activeBookingsToday.push(booking);
                        
                        // Count unique rooms only
                        const roomNumber = booking.propertyDetails?.roomNumber || booking.roomNumber;
                        if (roomNumber) {
                            occupiedRoomsSet.add(roomNumber);
                        } else {
                            console.warn(`OccupancyCalculationService: No room number for active booking ${booking.id}`);
                        }
                    }
                } catch (error) {
                    console.warn(`OccupancyCalculationService: Error processing booking ${booking.id}:`, error);
                }
            });
            
            const occupiedRoomsCount = occupiedRoomsSet.size;
            const occupancyRate = (occupiedRoomsCount / this.TOTAL_ROOMS) * 100;
            const availableRooms = this.TOTAL_ROOMS - occupiedRoomsCount;
            
            // Log detailed information for debugging
            console.log(`OccupancyCalculationService: Current occupancy calculation:`);
            console.log(`  - Total rooms: ${this.TOTAL_ROOMS}`);
            console.log(`  - Occupied rooms: ${occupiedRoomsCount}`);
            console.log(`  - Occupancy rate: ${occupancyRate.toFixed(1)}%`);
            console.log(`  - Available rooms: ${availableRooms}`);
            console.log(`  - Active bookings today: ${activeBookingsToday.length}`);
            console.log(`  - Occupied room numbers: [${Array.from(occupiedRoomsSet).sort().join(', ')}]`);
            
            return {
                occupancyRate: parseFloat(occupancyRate.toFixed(1)),
                occupancyRateFormatted: occupancyRate.toFixed(1) + '%',
                occupiedRooms: occupiedRoomsCount,
                availableRooms: availableRooms,
                totalRooms: this.TOTAL_ROOMS,
                activeBookingsToday: activeBookingsToday.length,
                occupiedRoomNumbers: Array.from(occupiedRoomsSet).sort(),
                calculatedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('OccupancyCalculationService: Error calculating current occupancy:', error);
            return this.getEmptyOccupancyData();
        }
    }

    /**
     * Calculate monthly occupancy rates for historical analysis
     * @param {Array} bookings - Array of booking objects
     * @param {number} monthsBack - Number of months to analyze (default 12)
     * @returns {Array} - Array of monthly occupancy data
     */
    calculateMonthlyOccupancy(bookings, monthsBack = 12) {
        try {
            if (!bookings || !Array.isArray(bookings)) {
                return [];
            }

            const monthlyData = new Map();
            const today = new Date();
            
            // Initialize months
            for (let i = 0; i < monthsBack; i++) {
                const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const monthKey = date.toISOString().substring(0, 7); // YYYY-MM format
                monthlyData.set(monthKey, {
                    month: monthKey,
                    monthName: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
                    occupiedRooms: new Set(),
                    totalRoomDays: 0,
                    occupiedRoomDays: 0,
                    occupancyRate: 0
                });
            }

            // Process bookings
            bookings.forEach(booking => {
                try {
                    const checkIn = this.parseBookingDate(booking.checkIn);
                    const checkOut = this.parseBookingDate(booking.checkOut);
                    
                    if (!checkIn || !checkOut) return;
                    if (!this.ACTIVE_STATUSES.includes(booking.status?.toLowerCase())) return;

                    const roomNumber = booking.propertyDetails?.roomNumber || booking.roomNumber;
                    if (!roomNumber) return;

                    // Calculate which months this booking spans
                    const currentDate = new Date(checkIn);
                    while (currentDate < checkOut) {
                        const monthKey = currentDate.toISOString().substring(0, 7);
                        const monthData = monthlyData.get(monthKey);
                        
                        if (monthData) {
                            monthData.occupiedRooms.add(roomNumber);
                            
                            // Calculate days in this month for this booking
                            const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                            const endOfStay = new Date(Math.min(checkOut, monthEnd));
                            const daysInMonth = Math.ceil((endOfStay - currentDate) / (1000 * 60 * 60 * 24));
                            
                            monthData.occupiedRoomDays += daysInMonth;
                        }
                        
                        // Move to next month
                        currentDate.setMonth(currentDate.getMonth() + 1, 1);
                    }
                } catch (error) {
                    console.warn(`OccupancyCalculationService: Error processing booking ${booking.id} for monthly data:`, error);
                }
            });

            // Calculate final rates
            const result = Array.from(monthlyData.values()).map(monthData => {
                const daysInMonth = new Date(
                    parseInt(monthData.month.split('-')[0]),
                    parseInt(monthData.month.split('-')[1]),
                    0
                ).getDate();
                
                monthData.totalRoomDays = this.TOTAL_ROOMS * daysInMonth;
                monthData.occupancyRate = monthData.totalRoomDays > 0 
                    ? (monthData.occupiedRoomDays / monthData.totalRoomDays) * 100 
                    : 0;

                return {
                    ...monthData,
                    occupiedRooms: monthData.occupiedRooms.size,
                    occupancyRate: parseFloat(monthData.occupancyRate.toFixed(1))
                };
            });

            console.log(`OccupancyCalculationService: Calculated monthly occupancy for ${result.length} months`);
            return result.sort((a, b) => a.month.localeCompare(b.month));
            
        } catch (error) {
            console.error('OccupancyCalculationService: Error calculating monthly occupancy:', error);
            return [];
        }
    }

    /**
     * Fetch bookings from Firebase and calculate current occupancy
     * @returns {Promise<Object>} - Current occupancy data
     */
    async fetchAndCalculateCurrentOccupancy() {
        try {
            const dbInstance = db();
            const bookingsRef = collection(dbInstance, this.COLLECTION_NAME);
            const snapshot = await getDocs(bookingsRef);
            
            const bookings = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log(`OccupancyCalculationService: Loaded ${bookings.length} bookings from ${this.COLLECTION_NAME}`);
            
            return this.calculateCurrentOccupancy(bookings);
        } catch (error) {
            console.error('OccupancyCalculationService: Error fetching and calculating occupancy:', error);
            return this.getEmptyOccupancyData();
        }
    }

    /**
     * Parse booking date with multiple format support
     * @private
     */
    parseBookingDate(dateValue) {
        if (!dateValue) return null;
        
        try {
            // Handle Firestore Timestamp
            if (dateValue.toDate && typeof dateValue.toDate === 'function') {
                return dateValue.toDate();
            }
            
            // Handle Date object
            if (dateValue instanceof Date) {
                return dateValue;
            }
            
            // Handle string dates
            if (typeof dateValue === 'string') {
                const parsed = new Date(dateValue);
                return isNaN(parsed.getTime()) ? null : parsed;
            }
            
            return null;
        } catch (error) {
            console.warn('OccupancyCalculationService: Error parsing date:', error);
            return null;
        }
    }

    /**
     * Get empty occupancy data structure
     * @private
     */
    getEmptyOccupancyData() {
        return {
            occupancyRate: 0,
            occupancyRateFormatted: '0.0%',
            occupiedRooms: 0,
            availableRooms: this.TOTAL_ROOMS,
            totalRooms: this.TOTAL_ROOMS,
            activeBookingsToday: 0,
            occupiedRoomNumbers: [],
            calculatedAt: new Date().toISOString()
        };
    }

    /**
     * Validate occupancy data consistency
     * @param {Object} occupancyData - Occupancy data to validate
     * @returns {boolean} - Whether data is valid
     */
    validateOccupancyData(occupancyData) {
        if (!occupancyData) return false;
        
        const expectedTotal = occupancyData.occupiedRooms + occupancyData.availableRooms;
        if (expectedTotal !== this.TOTAL_ROOMS) {
            console.warn(`OccupancyCalculationService: Inconsistent room totals. Expected: ${this.TOTAL_ROOMS}, Got: ${expectedTotal}`);
            return false;
        }
        
        const calculatedRate = (occupancyData.occupiedRooms / this.TOTAL_ROOMS) * 100;
        const rateMargin = Math.abs(calculatedRate - occupancyData.occupancyRate);
        if (rateMargin > 0.1) {
            console.warn(`OccupancyCalculationService: Inconsistent occupancy rate. Expected: ${calculatedRate.toFixed(1)}, Got: ${occupancyData.occupancyRate}`);
            return false;
        }
        
        return true;
    }
}

// Export singleton instance
export const occupancyService = new OccupancyCalculationService();

// Export individual functions for backward compatibility
export const calculateCurrentOccupancy = (bookings) => occupancyService.calculateCurrentOccupancy(bookings);
export const calculateMonthlyOccupancy = (bookings, monthsBack = 12) => occupancyService.calculateMonthlyOccupancy(bookings, monthsBack);

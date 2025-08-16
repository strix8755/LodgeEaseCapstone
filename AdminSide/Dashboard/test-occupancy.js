// Test script to verify occupancy calculation with mock data
import { occupancyService } from '../shared/occupancyCalculationService.js';

console.log('Testing occupancy calculation service...');

// Create mock booking data similar to what would be created by manual booking
const mockBookings = [
    {
        id: 'test1',
        status: 'Confirmed', // Capital C as created by manual booking
        checkIn: { seconds: Math.floor(Date.now() / 1000) }, // Today as timestamp
        checkOut: { seconds: Math.floor((Date.now() + 86400000) / 1000) }, // Tomorrow
        propertyDetails: {
            roomNumber: '101'
        },
        guestName: 'Test Guest 1'
    },
    {
        id: 'test2',
        status: 'confirmed', // Lowercase as might come from other sources
        checkIn: { seconds: Math.floor(Date.now() / 1000) }, // Today
        checkOut: { seconds: Math.floor((Date.now() + 86400000) / 1000) }, // Tomorrow
        propertyDetails: {
            roomNumber: '102'
        },
        guestName: 'Test Guest 2'
    },
    {
        id: 'test3',
        status: 'pending',
        checkIn: { seconds: Math.floor(Date.now() / 1000) }, // Today
        // No check-out date to test our fix
        propertyDetails: {
            roomNumber: '103'
        },
        guestName: 'Test Guest 3'
    },
    {
        id: 'test4',
        status: 'cancelled', // Should not be counted
        checkIn: { seconds: Math.floor(Date.now() / 1000) },
        checkOut: { seconds: Math.floor((Date.now() + 86400000) / 1000) },
        propertyDetails: {
            roomNumber: '104'
        },
        guestName: 'Test Guest 4'
    }
];

console.log('Mock bookings:', mockBookings);

const result = occupancyService.calculateCurrentOccupancy(mockBookings);

console.log('\n=== OCCUPANCY CALCULATION RESULT ===');
console.log(`Occupancy Rate: ${result.occupancyRateFormatted}`);
console.log(`Occupied Rooms: ${result.occupiedRooms}`);
console.log(`Available Rooms: ${result.availableRooms}`);
console.log(`Total Rooms: ${result.totalRooms}`);
console.log(`Occupied Room Numbers: [${result.occupiedRoomNumbers.join(', ')}]`);
console.log(`Active Bookings Today: ${result.activeBookingsToday}`);

// Expected results:
// - Should count rooms 101, 102, 103 (3 rooms occupied)
// - Should not count room 104 (cancelled status)
// - Occupancy rate should be 3/36 = 8.3%
// - Available rooms should be 33

console.log('\n=== EXPECTED RESULTS ===');
console.log('Expected occupied rooms: 3 (rooms 101, 102, 103)');
console.log('Expected occupancy rate: 8.3%');
console.log('Expected available rooms: 33');

console.log('\n=== VALIDATION ===');
const isValid = occupancyService.validateOccupancyData(result);
console.log(`Data validation passed: ${isValid}`);

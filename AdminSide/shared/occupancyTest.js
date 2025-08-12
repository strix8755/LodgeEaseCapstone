// Test file to validate the unified occupancy calculation service
// This file can be run to verify that both Dashboard and Business Analytics 
// will show consistent occupancy rates

import { occupancyService } from './shared/occupancyCalculationService.js';
import { db, collection, getDocs } from './firebase.js';

// Test function to simulate occupancy calculations
async function testOccupancyConsistency() {
    try {
        console.log('=== Testing Unified Occupancy Calculation Service ===');
        
        // Fetch sample booking data
        const dbInstance = db();
        const bookingsRef = collection(dbInstance, 'everlodgebookings');
        const snapshot = await getDocs(bookingsRef);
        
        const sampleBookings = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log(`Loaded ${sampleBookings.length} sample bookings`);
        
        // Test 1: Calculate occupancy using the service
        console.log('\n--- Test 1: Current Occupancy Calculation ---');
        const occupancyData = occupancyService.calculateCurrentOccupancy(sampleBookings);
        
        console.log('Results:');
        console.log(`  Occupancy Rate: ${occupancyData.occupancyRateFormatted}`);
        console.log(`  Occupied Rooms: ${occupancyData.occupiedRooms}`);
        console.log(`  Available Rooms: ${occupancyData.availableRooms}`);
        console.log(`  Total Rooms: ${occupancyData.totalRooms}`);
        console.log(`  Active Bookings Today: ${occupancyData.activeBookingsToday}`);
        console.log(`  Occupied Room Numbers: [${occupancyData.occupiedRoomNumbers.join(', ')}]`);
        
        // Test 2: Validate data consistency
        console.log('\n--- Test 2: Data Validation ---');
        const isValid = occupancyService.validateOccupancyData(occupancyData);
        console.log(`  Validation Result: ${isValid ? '✅ PASSED' : '❌ FAILED'}`);
        
        if (!isValid) {
            console.log('  ⚠️  Data consistency issues detected!');
        } else {
            console.log('  ✅ Data is consistent and accurate');
        }
        
        // Test 3: Fetch and calculate (simulating real usage)
        console.log('\n--- Test 3: Simulated Real Usage ---');
        const realTimeData = await occupancyService.fetchAndCalculateCurrentOccupancy();
        
        console.log('Real-time Results:');
        console.log(`  Occupancy Rate: ${realTimeData.occupancyRateFormatted}`);
        console.log(`  Occupied Rooms: ${realTimeData.occupiedRooms}`);
        console.log(`  Available Rooms: ${realTimeData.availableRooms}`);
        console.log(`  Calculation Time: ${realTimeData.calculatedAt}`);
        
        // Test 4: Compare results
        console.log('\n--- Test 4: Consistency Check ---');
        const rateMatch = Math.abs(occupancyData.occupancyRate - realTimeData.occupancyRate) < 0.1;
        const roomMatch = occupancyData.occupiedRooms === realTimeData.occupiedRooms;
        
        console.log(`  Rate Consistency: ${rateMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
        console.log(`  Room Count Consistency: ${roomMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
        
        if (rateMatch && roomMatch) {
            console.log('  🎉 All tests PASSED - occupancy calculations are consistent!');
        } else {
            console.log('  ⚠️  Some tests FAILED - there may be consistency issues');
        }
        
        // Test 5: Monthly data calculation
        console.log('\n--- Test 5: Monthly Occupancy Calculation ---');
        const monthlyData = occupancyService.calculateMonthlyOccupancy(sampleBookings, 3);
        
        console.log(`  Monthly data points: ${monthlyData.length}`);
        monthlyData.forEach(month => {
            console.log(`  ${month.monthName}: ${month.occupancyRate.toFixed(1)}% (${month.occupiedRooms} unique rooms)`);
        });
        
        return {
            currentOccupancy: occupancyData,
            realTimeOccupancy: realTimeData,
            monthlyOccupancy: monthlyData,
            allTestsPassed: rateMatch && roomMatch && isValid
        };
        
    } catch (error) {
        console.error('Error in occupancy consistency test:', error);
        return {
            error: error.message,
            allTestsPassed: false
        };
    }
}

// Export test function for manual testing
export { testOccupancyConsistency };

// Auto-run test if this file is loaded directly
if (typeof window !== 'undefined') {
    window.testOccupancyConsistency = testOccupancyConsistency;
    console.log('Occupancy test function available as window.testOccupancyConsistency()');
}

// Create a simple validation function for quick checks
export function quickOccupancyCheck(bookings) {
    if (!bookings || !Array.isArray(bookings)) {
        console.warn('QuickCheck: Invalid bookings data');
        return false;
    }
    
    const result = occupancyService.calculateCurrentOccupancy(bookings);
    const isValid = occupancyService.validateOccupancyData(result);
    
    console.log(`QuickCheck: ${result.occupancyRateFormatted} occupancy, ${result.occupiedRooms} rooms occupied, validation: ${isValid ? 'PASS' : 'FAIL'}`);
    
    return {
        occupancyRate: result.occupancyRate,
        isValid: isValid
    };
}

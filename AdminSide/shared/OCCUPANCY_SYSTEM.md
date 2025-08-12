# Unified Occupancy Rate Calculation System

## Overview

This system ensures consistent occupancy rate calculations across the Dashboard and Business Analytics components of the Lodge Ease application. Previously, these components used different logic which could result in conflicting occupancy rates being displayed to users.

## Problem Solved

**Before**: Dashboard and Business Analytics sometimes showed different occupancy rates due to:
- Different booking status filtering logic
- Different date parsing methods
- Different room counting approaches
- Inconsistent total room counts

**After**: Both components now use the same unified service, ensuring:
- ✅ Consistent occupancy rates across all views
- ✅ Standardized active booking status filtering
- ✅ Unified date parsing logic
- ✅ Consistent room counting methodology
- ✅ Data validation and error handling

## Architecture

```
AdminSide/
├── shared/
│   ├── occupancyCalculationService.js  # Main service
│   ├── dateUtils.js                    # Date parsing utilities
│   ├── occupancyTest.js                # Testing utilities
│   └── OCCUPANCY_SYSTEM.md             # This documentation
├── Dashboard/
│   └── app.js                          # Updated to use unified service
├── BusinessAnalytics/
│   └── business_analytics.js           # Updated to use unified service
└── AInalysis/
    └── occupancyDebug.js               # Updated debug utilities
```

## Core Service: OccupancyCalculationService

### Key Features

1. **Singleton Pattern**: Ensures consistent configuration across the app
2. **Standardized Constants**:
   - Total rooms: 36
   - Collection: 'everlodgebookings'
   - Active statuses: ['occupied', 'checked-in', 'confirmed', 'active', 'pending']

3. **Unified Date Parsing**: Handles Firestore Timestamps, Date objects, and strings
4. **Room Counting**: Uses Set to count unique occupied rooms (prevents double counting)
5. **Data Validation**: Built-in validation to catch inconsistencies

### Main Methods

#### `calculateCurrentOccupancy(bookings)`
Calculates current day occupancy rate from an array of bookings.

**Returns**:
```javascript
{
    occupancyRate: 75.5,              // Numeric rate
    occupancyRateFormatted: "75.5%",  // Formatted string
    occupiedRooms: 27,                // Count of occupied rooms
    availableRooms: 9,                // Count of available rooms
    totalRooms: 36,                   // Total room count
    activeBookingsToday: 30,          // Active bookings count
    occupiedRoomNumbers: [1,2,3...],  // Array of room numbers
    calculatedAt: "2025-01-13..."     // Calculation timestamp
}
```

#### `calculateMonthlyOccupancy(bookings, monthsBack)`
Calculates historical monthly occupancy data for analysis and charts.

#### `fetchAndCalculateCurrentOccupancy()`
Fetches bookings from Firebase and calculates current occupancy (used for real-time updates).

#### `validateOccupancyData(occupancyData)`
Validates that occupancy data is mathematically consistent.

## Implementation Details

### Active Booking Logic

A booking is considered "active" for occupancy calculation if:
1. **Status Check**: Status is one of: 'occupied', 'checked-in', 'confirmed', 'active', 'pending'
2. **Date Check**: Today's date falls between check-in and check-out dates
3. **Room Assignment**: Booking has a valid room number

### Date Parsing

The service handles multiple date formats:
- Firestore Timestamp objects (`.toDate()` method)
- JavaScript Date objects
- String date representations
- Numeric timestamps

### Room Counting

Uses JavaScript Set to ensure unique room counting:
```javascript
const occupiedRoomsSet = new Set();
// ... process bookings ...
if (booking.propertyDetails?.roomNumber) {
    occupiedRoomsSet.add(booking.propertyDetails.roomNumber);
}
const occupiedCount = occupiedRoomsSet.size;
```

## Usage Examples

### Dashboard Integration
```javascript
import { occupancyService } from '../shared/occupancyCalculationService.js';

// In calculateDashboardMetrics()
const occupancyData = occupancyService.calculateCurrentOccupancy(this.allBookings);
this.stats.occupancyRate = occupancyData.occupancyRateFormatted;
this.availableRooms = occupancyData.availableRooms;
```

### Business Analytics Integration
```javascript
import { occupancyService } from '../shared/occupancyCalculationService.js';

// In calculateCurrentOccupancy()
function calculateCurrentOccupancy(data) {
    const occupancyData = occupancyService.calculateCurrentOccupancy(data.bookings);
    return occupancyData.occupancyRate;
}
```

### Testing and Debugging
```javascript
import { testOccupancyConsistency } from '../shared/occupancyTest.js';

// Run comprehensive tests
const testResults = await testOccupancyConsistency();
console.log('All tests passed:', testResults.allTestsPassed);
```

## Data Validation

The service includes built-in validation:

1. **Room Count Validation**: `occupiedRooms + availableRooms = totalRooms`
2. **Rate Consistency**: Calculated rate matches `(occupiedRooms / totalRooms) * 100`
3. **Data Type Validation**: Ensures all values are proper numbers/strings

## Error Handling

- **Invalid Data**: Returns default empty state with 0% occupancy
- **Date Parsing Errors**: Skips invalid bookings with warnings
- **Calculation Errors**: Logs errors and returns safe defaults
- **Network Errors**: Handles Firebase connection issues gracefully

## Debugging and Monitoring

### Console Logging
The service provides detailed logging:
- Calculation steps and results
- Data validation results  
- Room assignments and counts
- Error conditions and warnings

### Debug Utilities
- `occupancyDebug.js`: Enhanced debugging with unified service
- `occupancyTest.js`: Comprehensive testing suite
- Manual testing functions available in browser console

### Browser Console Commands
```javascript
// Test occupancy calculation
window.testOccupancyConsistency();

// Quick validation check
window.quickOccupancyCheck(bookings);

// Debug current state
window.debugOccupancyCalculations();
```

## Configuration

### Constants (can be modified in service if needed):
```javascript
TOTAL_ROOMS = 36
COLLECTION_NAME = 'everlodgebookings'
ACTIVE_STATUSES = ['occupied', 'checked-in', 'confirmed', 'active', 'pending']
```

### Customization
To modify behavior, update the `OccupancyCalculationService` class:
- Change room count in constructor
- Modify active statuses array
- Update date parsing logic
- Add new validation rules

## Migration Notes

### Dashboard Changes
- Removed complex occupancy calculation logic from `calculateDashboardMetrics()`
- Added unified service import
- Simplified occupancy rate assignment

### Business Analytics Changes  
- Replaced `calculateCurrentOccupancy()` function with service call
- Added unified service import
- Maintained backward compatibility with existing chart code

### Benefits After Migration
1. **Consistency**: Same occupancy rate everywhere
2. **Maintainability**: Single source of truth for logic
3. **Debugging**: Centralized logging and validation
4. **Testing**: Comprehensive test coverage
5. **Reliability**: Better error handling

## Troubleshooting

### Common Issues

**Issue**: Different occupancy rates in Dashboard vs Business Analytics
- **Solution**: Check that both components import and use the unified service
- **Debug**: Run `testOccupancyConsistency()` to verify

**Issue**: Occupancy rate is 0% when there should be bookings
- **Solution**: Check booking statuses and date ranges
- **Debug**: Use `occupancyDebug.js` to see detailed booking analysis

**Issue**: Room count doesn't match expectations
- **Solution**: Verify room numbers are properly assigned in `propertyDetails.roomNumber`
- **Debug**: Check console logs for missing room number warnings

### Validation Failures
If validation fails, check:
1. Booking data structure is correct
2. Room numbers are consistently formatted
3. Date fields are valid
4. Status values match expected active statuses

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for live occupancy updates
2. **Historical Analysis**: Extended monthly/yearly occupancy trends
3. **Forecasting**: AI-powered occupancy predictions
4. **Room-level Details**: Individual room status tracking
5. **Performance**: Caching for frequently accessed calculations

## Support

For issues or questions regarding the unified occupancy system:
1. Check console logs for detailed error messages
2. Run the test suite to identify specific problems
3. Use debug utilities to analyze booking data
4. Review this documentation for implementation details

The system is designed to be self-documenting through comprehensive logging and validation.

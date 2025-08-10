import { predictNextMonthOccupancy } from './occupancyPredictor.js';

export async function generateOccupancyAnalysis() {
    try {
        const prediction = await predictNextMonthOccupancy();
        const nextMonth = new Date().toLocaleString('default', { month: 'long' });
        
        return {
            summary: `Based on current bookings and historical trends, the predicted occupancy rate for ${nextMonth} is ${prediction.predictedRate.toFixed(1)}%`,
            details: `This prediction has a ${prediction.confidence.toFixed(1)}% confidence level, based on ${prediction.details.confirmedBookings} confirmed bookings out of ${prediction.details.totalRooms} total rooms.`,
            confidence: prediction.confidence,
            predictedRate: prediction.predictedRate
        };
    } catch (error) {
        console.error('Error generating occupancy analysis:', error);
        return {
            summary: 'Unable to generate occupancy prediction at this time',
            details: 'Insufficient data or system error',
            confidence: 0,
            predictedRate: 0
        };
    }
}

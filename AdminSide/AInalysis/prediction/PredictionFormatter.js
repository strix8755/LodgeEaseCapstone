export class PredictionFormatter {
    static formatOccupancyPrediction(prediction) {
        const { month, predictedRate, confidence, details } = prediction;
        
        // Format the trend description
        let trend = '';
        let trendEmoji = '';
        if (details.currentPace > details.historicalOccupancy) {
            trend = 'increasing';
            trendEmoji = '📈';
        } else if (details.currentPace < details.historicalOccupancy) {
            trend = 'decreasing';
            trendEmoji = '📉';
        } else {
            trend = 'stable';
            trendEmoji = '📊';
        }

        // Format confidence level description
        let confidenceDesc = '';
        if (confidence >= 80) confidenceDesc = 'very high';
        else if (confidence >= 60) confidenceDesc = 'high';
        else if (confidence >= 40) confidenceDesc = 'moderate';
        else if (confidence >= 20) confidenceDesc = 'low';
        else confidenceDesc = 'very low';

        // Generate recommendations based on the data
        const recommendations = this.generateRecommendations(prediction);

        return `Occupancy Forecast for ${month} ${trendEmoji}

Primary Metrics:
• Predicted Occupancy Rate: ${predictedRate.toFixed(1)}%
• Confidence Level: ${confidence.toFixed(1)}% (${confidenceDesc})
• Booking Trend: ${trend}

Current Booking Status:
• Confirmed Bookings: ${details.confirmedBookings}
• Total Available Rooms: ${details.totalRooms}
• Current Booking Pace: ${details.currentPace.toFixed(2)} bookings/day
• Expected Additional Bookings: ${details.expectedAdditional}

Historical Comparison:
• Last Year's Occupancy: ${details.historicalOccupancy.toFixed(1)}%
• Year-over-Year Change: ${this.calculateYoYChange(predictedRate, details.historicalOccupancy)}

${recommendations}

Note: This forecast is updated in real-time as new bookings are confirmed.`;
    }

    static generateRecommendations(prediction) {
        const recommendations = [];
        const { predictedRate, details } = prediction;

        if (predictedRate < 40) {
            recommendations.push("• Consider running promotional campaigns to boost bookings");
            recommendations.push("• Review pricing strategy for competitive rates");
        }
        if (details.currentPace < 1) {
            recommendations.push("• Investigate booking channels for potential issues");
            recommendations.push("• Evaluate marketing effectiveness");
        }
        if (details.historicalOccupancy > predictedRate) {
            recommendations.push("• Analyze factors causing lower booking rates");
            recommendations.push("• Review current market conditions");
        }

        return recommendations.length > 0 
            ? `\nRecommendations:\n${recommendations.join('\n')}`
            : '';
    }

    static calculateYoYChange(current, historical) {
        if (historical === 0) return 'No historical data available';
        const change = ((current - historical) / historical * 100).toFixed(1);
        return `${change > 0 ? '+' : ''}${change}%`;
    }
}

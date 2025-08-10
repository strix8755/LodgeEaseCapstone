export class BusinessReportFormatter {
    static formatPerformanceReport(data) {
        const {
            occupancy,
            revenue,
            bookings,
            historicalData,
            marketMetrics
        } = data;

        const metrics = this.calculateBusinessMetrics(data);
        const performanceScore = this.calculatePerformanceScore(metrics);
        const trends = this.analyzeTrends(data);

        return `Business Performance Dashboard ${this.getPerformanceEmoji(performanceScore)}

Performance Score: ${performanceScore}/100 ${this.getScoreIndicator(performanceScore)}

Occupancy Metrics:
• Current Occupancy Rate: ${occupancy.rate.toFixed(1)}% ${this.getTrendIcon(trends.occupancy)}
• Room Distribution:
  - Occupied: ${occupancy.occupied} rooms (${((occupancy.occupied / occupancy.total) * 100).toFixed(1)}%)
  - Available: ${occupancy.available} rooms (${((occupancy.available / occupancy.total) * 100).toFixed(1)}%)
  - Maintenance: ${occupancy.maintenance} rooms (${((occupancy.maintenance / occupancy.total) * 100).toFixed(1)}%)
• Utilization Efficiency: ${metrics.utilizationRate.toFixed(1)}%
• RevPAR: $${metrics.revPAR.toFixed(2)} ${this.getTrendIcon(trends.revPAR)}

Financial Performance:
• Revenue Metrics:
  - Monthly Revenue: $${revenue.currentMonth.toLocaleString()}
  - Daily Average: $${revenue.dailyAverage.toFixed(2)}
  - Per Room Revenue: $${metrics.revenuePerRoom.toFixed(2)}
  - Growth Rate: ${revenue.growthRate > 0 ? '+' : ''}${revenue.growthRate.toFixed(1)}%
• Profitability Indicators:
  - Gross Operating Profit: $${metrics.grossProfit.toLocaleString()}
  - Operating Margin: ${metrics.operatingMargin.toFixed(1)}%
  - Cost per Available Room: $${metrics.costPerRoom.toFixed(2)}

Booking Analytics:
• Current Status:
  - Active Bookings: ${bookings.active}
  - Pending Confirmations: ${bookings.pending}
  - Conversion Rate: ${metrics.conversionRate.toFixed(1)}%
• Today's Operations:
  - Check-ins: ${bookings.todayCheckins}
  - Check-outs: ${bookings.todayCheckouts}
  - Net Room Change: ${bookings.todayCheckins - bookings.todayCheckouts}
• Booking Patterns:
  - Average Lead Time: ${metrics.averageLeadTime.toFixed(1)} days
  - Peak Hours: ${this.formatPeakHours(bookings.peakHours)}
  - Most Popular: ${bookings.popularRoom}

Market Position:
• Competitive Index: ${metrics.competitiveIndex.toFixed(2)} ${this.getCompetitiveIndicator(metrics.competitiveIndex)}
• Market Share: ${metrics.marketShare.toFixed(1)}%
• Rate Positioning: ${this.getRatePosition(metrics.rateIndex)}

${this.generatePerformanceInsights(metrics, trends)}

${this.generateActionItems(metrics, trends)}`;
    }

    static calculateBusinessMetrics(data) {
        return {
            utilizationRate: this.calculateUtilization(data),
            revPAR: this.calculateRevPAR(data),
            revenuePerRoom: data.revenue.currentMonth / data.occupancy.total,
            grossProfit: this.calculateGrossProfit(data),
            operatingMargin: this.calculateOperatingMargin(data),
            costPerRoom: this.calculateCostPerRoom(data),
            conversionRate: (data.bookings.active / (data.bookings.active + data.bookings.pending)) * 100,
            averageLeadTime: this.calculateAverageLeadTime(data),
            competitiveIndex: this.calculateCompetitiveIndex(data),
            marketShare: this.calculateMarketShare(data),
            rateIndex: this.calculateRateIndex(data)
        };
    }

    static calculateUtilization(data) {
        return (data.occupancy.occupied / (data.occupancy.total - data.occupancy.maintenance)) * 100;
    }

    static calculateRevPAR(data) {
        return data.revenue.currentMonth / (data.occupancy.total * 30);
    }

    static calculateGrossProfit(data) {
        // Simplified calculation - replace with actual cost data
        return data.revenue.currentMonth * 0.65;
    }

    static calculateOperatingMargin(data) {
        return (this.calculateGrossProfit(data) / data.revenue.currentMonth) * 100;
    }

    static calculateCostPerRoom(data) {
        // Simplified - replace with actual cost data
        return (data.revenue.currentMonth * 0.35) / data.occupancy.total;
    }

    static calculateAverageLeadTime(data) {
        return data.historicalData?.averageLeadTime || 14; // Default to 14 days if no historical data
    }

    static calculateCompetitiveIndex(data) {
        // Compare to market average - replace with actual market data
        const marketAverageOccupancy = data.marketMetrics?.averageOccupancy || 65;
        return (data.occupancy.rate / marketAverageOccupancy) * 100;
    }

    static calculateMarketShare(data) {
        // Simplified market share calculation
        const totalMarketRooms = data.marketMetrics?.totalRooms || 100;
        return (data.occupancy.total / totalMarketRooms) * 100;
    }

    static calculateRateIndex(data) {
        const marketAverageRate = data.marketMetrics?.averageRate || 100;
        const propertyAverageRate = data.revenue.dailyAverage / data.occupancy.occupied;
        return (propertyAverageRate / marketAverageRate) * 100;
    }

    static getPerformanceEmoji(score) {
        if (score >= 80) return '🌟';
        if (score >= 60) return '⭐';
        return '📊';
    }

    static getScoreIndicator(score) {
        if (score >= 80) return '(Exceptional)';
        if (score >= 60) return '(Good)';
        if (score >= 40) return '(Average)';
        return '(Needs Improvement)';
    }

    static getTrendIcon(trend) {
        if (trend > 5) return '📈';
        if (trend < -5) return '📉';
        return '➡️';
    }

    static getCompetitiveIndicator(index) {
        if (index > 110) return '(Market Leader)';
        if (index > 90) return '(Competitive)';
        return '(Below Market)';
    }

    static getRatePosition(index) {
        if (index > 110) return 'Premium';
        if (index > 90) return 'Market Rate';
        return 'Value Position';
    }

    static formatPeakHours(peakHours) {
        return peakHours
            .map(hour => `${hour}:00`)
            .join(', ');
    }

    static generatePerformanceInsights(metrics, trends) {
        const insights = [];

        if (metrics.utilizationRate < 70) {
            insights.push("• Room utilization below target - review pricing strategy");
        }
        if (metrics.operatingMargin < 30) {
            insights.push("• Operating margin needs attention - analyze cost structure");
        }
        if (metrics.competitiveIndex < 90) {
            insights.push("• Market position trailing - evaluate competitive strategy");
        }
        if (trends.revPAR < 0) {
            insights.push("• Declining RevPAR - consider revenue management optimization");
        }

        return insights.length > 0 
            ? '\nKey Insights:\n' + insights.join('\n')
            : '';
    }

    static generateActionItems(metrics, trends) {
        const actions = [];

        if (metrics.utilizationRate < 70) {
            actions.push("• Implement dynamic pricing strategy");
            actions.push("• Review distribution channels");
        }
        if (metrics.operatingMargin < 30) {
            actions.push("• Conduct cost analysis");
            actions.push("• Optimize operational efficiency");
        }
        if (metrics.conversionRate < 50) {
            actions.push("• Improve booking process");
            actions.push("• Enhance follow-up procedures");
        }

        return actions.length > 0 
            ? '\nRecommended Actions:\n' + actions.join('\n')
            : '';
    }

    static calculatePerformanceScore(metrics) {
        // Calculate component scores (0-100)
        const occupancyScore = this.calculateOccupancyScore(metrics);
        const revenueScore = this.calculateRevenueScore(metrics);
        const operationalScore = this.calculateOperationalScore(metrics);
        const marketScore = this.calculateMarketScore(metrics);

        // Apply weights to each component
        const weights = {
            occupancy: 0.3,
            revenue: 0.3,
            operational: 0.2,
            market: 0.2
        };

        // Calculate weighted average
        const weightedScore = 
            (occupancyScore * weights.occupancy) +
            (revenueScore * weights.revenue) +
            (operationalScore * weights.operational) +
            (marketScore * weights.market);

        // Round to nearest integer
        return Math.round(weightedScore);
    }

    static calculateOccupancyScore(metrics) {
        const utilizationScore = (metrics.utilizationRate / 100) * 100;
        const revparScore = (metrics.revPAR / 200) * 100; // Assuming $200 as benchmark
        return (utilizationScore * 0.6) + (revparScore * 0.4);
    }

    static calculateRevenueScore(metrics) {
        const marginScore = (metrics.operatingMargin / 50) * 100; // Assuming 50% as benchmark
        const revenueScore = Math.min((metrics.revenuePerRoom / 150) * 100, 100); // Cap at 100
        return (marginScore * 0.5) + (revenueScore * 0.5);
    }

    static calculateOperationalScore(metrics) {
        const conversionScore = metrics.conversionRate;
        const costScore = Math.max(0, 100 - (metrics.costPerRoom / 100) * 100);
        return (conversionScore * 0.5) + (costScore * 0.5);
    }

    static calculateMarketScore(metrics) {
        const competitiveScore = (metrics.competitiveIndex / 100) * 100;
        const marketShareScore = (metrics.marketShare / 20) * 100; // Assuming 20% as benchmark
        return (competitiveScore * 0.6) + (marketShareScore * 0.4);
    }

    static analyzeTrends(data) {
        const occupancyTrend = this.calculateOccupancyTrend(data);
        const revenueTrend = this.calculateRevenueTrend(data);
        const bookingTrend = this.calculateBookingTrend(data);
        
        return {
            occupancy: this.calculateTrendPercentage(occupancyTrend),
            revenue: this.calculateTrendPercentage(revenueTrend),
            revPAR: this.calculateRevPARTrend(data),
            booking: this.calculateTrendPercentage(bookingTrend)
        };
    }

    static calculateTrendPercentage(currentValue, previousValue) {
        if (!previousValue) return 0;
        return ((currentValue - previousValue) / previousValue) * 100;
    }

    static calculateOccupancyTrend(data) {
        const currentOccupancy = data.occupancy?.rate || 0;
        const historicalOccupancy = data.historicalData?.averageOccupancy || 0;
        return this.calculateTrendPercentage(currentOccupancy, historicalOccupancy);
    }

    static calculateRevenueTrend(data) {
        const currentRevenue = data.revenue?.currentMonth || 0;
        const historicalRevenue = data.historicalData?.averageRevenue || 0;
        return this.calculateTrendPercentage(currentRevenue, historicalRevenue);
    }

    static calculateBookingTrend(data) {
        const currentBookings = data.bookings?.active || 0;
        const historicalBookings = data.historicalData?.averageBookings || 0;
        return this.calculateTrendPercentage(currentBookings, historicalBookings);
    }

    static calculateRevPARTrend(data) {
        const currentRevPAR = data.revenue.currentMonth / data.occupancy.total;
        const historicalRevPAR = (data.historicalData?.averageRevenue || 0) / data.occupancy.total;
        return ((currentRevPAR - historicalRevPAR) / historicalRevPAR * 100) || 0;
    }
}

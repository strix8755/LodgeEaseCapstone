export class ChatHandler {
    constructor(container, submitCallback) {
        this.container = container;
        this.submitCallback = submitCallback;
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.container.addEventListener('click', (event) => {
            const suggestionChip = event.target.closest('.suggestion-chip');
            if (suggestionChip) {
                const question = suggestionChip.getAttribute('data-question');
                if (question) {
                    this.submitCallback(question);
                }
            }
        });
    }

    addSuggestions(response) {
        const suggestions = this.getSuggestionsFromResponse(response);
        const suggestionDiv = document.createElement('div');
        suggestionDiv.className = 'message-suggestions';
        suggestionDiv.innerHTML = `
            <div class="chat-suggestions">
                ${suggestions.map(text => `
                    <div class="suggestion-chip" data-question="${text}">
                        ${text}
                    </div>
                `).join('')}
            </div>
        `;
        this.container.appendChild(suggestionDiv);
        this.container.scrollTop = this.container.scrollHeight;
    }

    getSuggestionsFromResponse(response) {
        const suggestions = [];
        const lowerResponse = response.toLowerCase();
        
        // Determine the context and subcontext
        if (lowerResponse.includes('occupancy')) {
            if (lowerResponse.includes('peak')) {
                suggestions.push(
                    'Compare with last year\'s peak occupancy',
                    'Show occupancy by room type',
                    'What drives our peak occupancy?'
                );
            } else if (lowerResponse.includes('trend')) {
                suggestions.push(
                    'What factors affect this trend?',
                    'Show seasonal patterns',
                    'Forecast next month\'s occupancy'
                );
            }
        }
        
        if (lowerResponse.includes('revenue')) {
            if (lowerResponse.includes('total') || lowerResponse.includes('overall')) {
                suggestions.push(
                    'Show revenue breakdown by room type',
                    'Compare with last year\'s revenue',
                    'What is our revenue forecast?'
                );
            } else if (lowerResponse.includes('trend')) {
                suggestions.push(
                    'What are our best performing months?',
                    'Show revenue per room category',
                    'Analyze revenue growth rate'
                );
            }
        }

        if (lowerResponse.includes('booking')) {
            if (lowerResponse.includes('pattern')) {
                suggestions.push(
                    'What are our peak booking hours?',
                    'Show booking sources',
                    'What is our average booking value?'
                );
            } else {
                suggestions.push(
                    'Show booking trends by room type',
                    'What is our booking conversion rate?',
                    'Analyze cancellation patterns'
                );
            }
        }

        // If no specific context is found, return general follow-ups
        if (suggestions.length === 0) {
            suggestions.push(
                'Show me overall performance metrics',
                'What are our current challenges?',
                'Compare with industry benchmarks'
            );
        }

        return suggestions;
    }

    async addDetailedResponse(response, analysisData) {
        const mainResponse = document.createElement('div');
        mainResponse.className = 'message bot';
        
        // Determine context and subcontext from the question
        const context = this.determineContext(response);
        const subContext = this.determineSubContext(response);

        // Get specific response based on context
        const responseContent = await this.generateContextSpecificResponse(context, subContext, analysisData);
        
        const content = document.createElement('div');
        content.className = 'message-content detailed';
        
        // Add summary section
        if (responseContent.summary) {
            const summary = document.createElement('div');
            summary.className = 'response-summary';
            summary.textContent = responseContent.summary;
            content.appendChild(summary);
        }

        // Add details section
        if (responseContent.details) {
            const details = document.createElement('div');
            details.className = 'response-details';
            details.innerHTML = this.formatDetails(responseContent.details);
            content.appendChild(details);
        }

        // Add recommendations if available
        if (responseContent.recommendations) {
            const recommendations = document.createElement('div');
            recommendations.className = 'response-recommendations';
            recommendations.innerHTML = `
                <h4>Recommendations:</h4>
                <ul>
                    ${responseContent.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            `;
            content.appendChild(recommendations);
        }

        mainResponse.appendChild(content);
        this.container.appendChild(mainResponse);
        this.container.scrollTop = this.container.scrollHeight;
        
        // Add relevant follow-up suggestions
        this.addContextualSuggestions(context, subContext);
    }

    determineContext(response) {
        const lowerResponse = response.toLowerCase();
        if (lowerResponse.includes('occupancy')) return 'occupancy';
        if (lowerResponse.includes('revenue')) return 'revenue';
        if (lowerResponse.includes('booking')) return 'booking';
        return 'general';
    }

    determineSubContext(response) {
        const lowerResponse = response.toLowerCase();
        if (lowerResponse.includes('peak') || lowerResponse.includes('highest')) return 'peak';
        if (lowerResponse.includes('trend') || lowerResponse.includes('pattern')) return 'trend';
        if (lowerResponse.includes('compare') || lowerResponse.includes('versus')) return 'comparison';
        if (lowerResponse.includes('total') || lowerResponse.includes('overall')) return 'total';
        if (lowerResponse.includes('analysis')) return 'analysis';
        return 'general';
    }

    async generateContextSpecificResponse(context, subContext, data) {
        try {
            const suggestionService = new SuggestionService();
            
            // Handle revenue-specific queries
            if (context === 'revenue') {
                const revenueData = await this.prepareRevenueData(data);
                return {
                    summary: suggestionService.generateResponse('revenue', subContext, revenueData),
                    details: this.generateRevenueDetails(revenueData),
                    recommendations: this.generateRevenueRecommendations(revenueData)
                };
            }

            // Handle performance report queries
            if (context === 'performance') {
                const performanceData = await this.preparePerformanceData(data);
                return {
                    summary: suggestionService.generateResponse('revenue', 'performance', performanceData),
                    details: this.generatePerformanceDetails(performanceData),
                    recommendations: this.generatePerformanceRecommendations(performanceData)
                };
            }

            // Fallback to generic response
            return this.generateGenericResponse(data);
        } catch (error) {
            console.error('Error generating response:', error);
            return {
                summary: 'I apologize, but I encountered an error processing your request.',
                details: 'Please try rephrasing your question or ask something else.'
            };
        }
    }

    async prepareRevenueData(data) {
        // Calculate revenue metrics
        const currentDate = new Date();
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        
        const revenueData = {
            period: `${monthStart.toLocaleString('default', { month: 'long' })} ${currentDate.getFullYear()}`,
            total: this.calculateTotalRevenue(data),
            momGrowth: this.calculateMonthOverMonthGrowth(data),
            yoyGrowth: this.calculateYearOverYearGrowth(data),
            roomTypeRevenue: this.calculateRevenueByRoomType(data),
            adr: this.calculateADR(data),
            revpar: this.calculateRevPAR(data),
            occupancyRevenue: this.calculateOccupancyRevenue(data),
            forecast: this.generateRevenueForecast(data)
        };

        return revenueData;
    }

    async preparePerformanceData(data) {
        return {
            current: this.calculateCurrentRevenue(data),
            target: this.calculateRevenueTarget(data),
            variance: this.calculateVariance(data),
            sources: this.analyzeRevenueSources(data),
            marketPosition: this.analyzeMarketPosition(data),
            competitiveIndex: this.calculateCompetitiveIndex(data),
            recommendations: this.generatePerformanceRecommendations(data)
        };
    }

    // Add helper methods for calculations
    calculateTotalRevenue(data) {
        return data.bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    }

    calculateMonthOverMonthGrowth(data) {
        try {
            const currentMonth = new Date().getMonth();
            const currentMonthRevenue = this.getRevenueForMonth(data, currentMonth);
            const lastMonthRevenue = this.getRevenueForMonth(data, currentMonth - 1);
            
            return lastMonthRevenue > 0 ? 
                ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;
        } catch (error) {
            console.error('Error calculating MoM growth:', error);
            return 0;
        }
    }

    calculateYearOverYearGrowth(data) {
        try {
            const currentYear = new Date().getFullYear();
            const currentYearRevenue = this.getRevenueForYear(data, currentYear);
            const lastYearRevenue = this.getRevenueForYear(data, currentYear - 1);
            
            return lastYearRevenue > 0 ? 
                ((currentYearRevenue - lastYearRevenue) / lastYearRevenue) * 100 : 0;
        } catch (error) {
            console.error('Error calculating YoY growth:', error);
            return 0;
        }
    }

    calculateRevenueByRoomType(data) {
        const revenueByType = {};
        try {
            data.bookings.forEach(booking => {
                const roomType = booking.propertyDetails?.roomType || 'Standard';
                revenueByType[roomType] = (revenueByType[roomType] || 0) + (booking.totalAmount || 0);
            });
            return revenueByType;
        } catch (error) {
            console.error('Error calculating revenue by room type:', error);
            return {};
        }
    }

    calculateADR(data) {
        try {
            const totalRevenue = this.calculateTotalRevenue(data);
            const occupiedRoomNights = data.bookings.reduce((total, booking) => {
                const nights = this.calculateNightsBetweenDates(
                    new Date(booking.checkIn),
                    new Date(booking.checkOut)
                );
                return total + nights;
            }, 0);
            
            return occupiedRoomNights > 0 ? totalRevenue / occupiedRoomNights : 0;
        } catch (error) {
            console.error('Error calculating ADR:', error);
            return 0;
        }
    }

    calculateRevPAR(data) {
        try {
            const totalRevenue = this.calculateTotalRevenue(data);
            const availableRoomNights = data.rooms.length * this.getDaysInPeriod();
            
            return availableRoomNights > 0 ? totalRevenue / availableRoomNights : 0;
        } catch (error) {
            console.error('Error calculating RevPAR:', error);
            return 0;
        }
    }

    // Helper Methods for Revenue Analysis
    getRevenueForMonth(data, month) {
        return data.bookings
            .filter(booking => new Date(booking.checkIn).getMonth() === month)
            .reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    }

    getRevenueForYear(data, year) {
        return data.bookings
            .filter(booking => new Date(booking.checkIn).getFullYear() === year)
            .reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    }

    calculateNightsBetweenDates(checkIn, checkOut) {
        const diffTime = Math.abs(checkOut - checkIn);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    getDaysInPeriod(period = 'month') {
        const today = new Date();
        switch (period) {
            case 'month':
                return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
            case 'year':
                return 365;
            default:
                return 30;
        }
    }

    // Advanced Analytics Methods
    analyzeSeasonalPatterns(data) {
        const monthlyRevenue = new Array(12).fill(0);
        const monthlyBookings = new Array(12).fill(0);
        
        data.bookings.forEach(booking => {
            const month = new Date(booking.checkIn).getMonth();
            monthlyRevenue[month] += booking.totalAmount || 0;
            monthlyBookings[month]++;
        });

        return monthlyRevenue.map((revenue, index) => ({
            month: new Date(2024, index).toLocaleString('default', { month: 'long' }),
            revenue,
            bookings: monthlyBookings[index],
            averageBookingValue: monthlyBookings[index] > 0 ? 
                revenue / monthlyBookings[index] : 0
        }));
    }

    calculateRevenueForecasts(data) {
        const seasonalPatterns = this.analyzeSeasonalPatterns(data);
        const averageGrowth = this.calculateAverageGrowthRate(data);
        
        return {
            nextMonth: this.forecastNextMonth(seasonalPatterns, averageGrowth),
            nextQuarter: this.forecastNextQuarter(seasonalPatterns, averageGrowth),
            nextYear: this.forecastNextYear(seasonalPatterns, averageGrowth)
        };
    }

    calculateAverageGrowthRate(data) {
        const monthlyRevenue = this.getMonthlyRevenueTrend(data);
        const growthRates = [];
        
        for (let i = 1; i < monthlyRevenue.length; i++) {
            if (monthlyRevenue[i - 1] > 0) {
                const growthRate = (monthlyRevenue[i] - monthlyRevenue[i - 1]) / monthlyRevenue[i - 1];
                growthRates.push(growthRate);
            }
        }

        return growthRates.length > 0 ? 
            growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length : 0;
    }

    getMonthlyRevenueTrend(data) {
        const months = new Array(12).fill(0);
        data.bookings.forEach(booking => {
            const month = new Date(booking.checkIn).getMonth();
            months[month] += booking.totalAmount || 0;
        });
        return months;
    }

    // Revenue Optimization Analysis
    analyzeRevenueOptimization(data) {
        return {
            roomTypePerformance: this.analyzeRoomTypePerformance(data),
            pricingOpportunities: this.identifyPricingOpportunities(data),
            demandPatterns: this.analyzeDemandPatterns(data),
            recommendations: this.generateOptimizationRecommendations(data)
        };
    }

    analyzeRoomTypePerformance(data) {
        const performance = {};
        const revenueByType = this.calculateRevenueByRoomType(data);
        
        Object.entries(revenueByType).forEach(([type, revenue]) => {
            const typeBookings = data.bookings.filter(b => b.propertyDetails?.roomType === type);
            const occupancy = this.calculateOccupancyForType(data, type);
            
            performance[type] = {
                revenue,
                occupancy,
                adr: this.calculateADRForType(typeBookings),
                revpar: this.calculateRevPARForType(data, type, revenue),
                demandScore: this.calculateDemandScore(occupancy, revenue)
            };
        });

        return performance;
    }

    calculateDemandScore(occupancy, revenue) {
        // Normalize occupancy (0-1) and revenue (relative to highest revenue)
        const normalizedOccupancy = occupancy / 100;
        const normalizedRevenue = revenue / this.maxRevenue;
        
        // Weighted average (60% occupancy, 40% revenue)
        return (normalizedOccupancy * 0.6 + normalizedRevenue * 0.4) * 100;
    }

    identifyPricingOpportunities(data) {
        const opportunities = [];
        const performance = this.analyzeRoomTypePerformance(data);

        Object.entries(performance).forEach(([type, metrics]) => {
            if (metrics.occupancy > 80 && metrics.adr < this.getAverageADR(data)) {
                opportunities.push({
                    roomType: type,
                    recommendation: 'Increase rates due to high demand',
                    potentialRevenue: this.calculatePotentialRevenue(metrics)
                });
            } else if (metrics.occupancy < 50 && metrics.adr > this.getAverageADR(data)) {
                opportunities.push({
                    roomType: type,
                    recommendation: 'Consider promotional rates to boost occupancy',
                    potentialRevenue: this.calculatePotentialRevenue(metrics)
                });
            }
        });

        return opportunities;
    }

    generateOptimizationRecommendations(data) {
        const recommendations = [];
        const performance = this.analyzeRoomTypePerformance(data);
        const seasonalPatterns = this.analyzeSeasonalPatterns(data);

        // Add revenue-specific recommendations
        this.addRevenueRecommendations(recommendations, performance, seasonalPatterns);
        
        // Add occupancy-based recommendations
        this.addOccupancyRecommendations(recommendations, performance);
        
        // Add pricing recommendations
        this.addPricingRecommendations(recommendations, performance, data);

        return recommendations;
    }

    addRevenueRecommendations(recommendations, performance, seasonalPatterns) {
        Object.entries(performance).forEach(([type, metrics]) => {
            if (metrics.revpar < this.getAverageRevPAR()) {
                recommendations.push({
                    category: 'revenue',
                    priority: 'high',
                    action: `Optimize RevPAR for ${type} rooms through dynamic pricing`,
                    impact: this.calculateRevenueImpact(metrics)
                });
            }
        });
    }

    addOccupancyRecommendations(recommendations, performance) {
        Object.entries(performance).forEach(([type, metrics]) => {
            if (metrics.occupancy < 60) {
                recommendations.push({
                    category: 'occupancy',
                    priority: metrics.occupancy < 40 ? 'high' : 'medium',
                    action: `Implement targeted marketing for ${type} rooms`,
                    impact: this.calculateOccupancyImpact(metrics)
                });
            }
        });
    }

    addPricingRecommendations(recommendations, performance, data) {
        const averageADR = this.getAverageADR(data);
        Object.entries(performance).forEach(([type, metrics]) => {
            if (metrics.occupancy > 80 && metrics.adr < averageADR) {
                recommendations.push({
                    category: 'pricing',
                    priority: 'high',
                    action: `Increase rates for ${type} rooms during high demand`,
                    impact: this.calculatePricingImpact(metrics, averageADR)
                });
            }
        });
    }

    generateRevenueDetails(data) {
        return `
            <div class="detailed-metrics">
                <div class="metric-item">
                    <div class="metric-label">Monthly Revenue</div>
                    <div class="metric-value">$${data.total.toLocaleString()}</div>
                </div>
                <!-- Add more metric items -->
            </div>
        `;
    }

    generateRevenueRecommendations(data) {
        const recommendations = [];
        
        if (data.momGrowth < 0) {
            recommendations.push("Investigate factors contributing to monthly revenue decline");
        }
        if (data.adr < data.targetADR) {
            recommendations.push("Consider optimizing room rates to improve ADR");
        }
        // Add more recommendations based on data analysis

        return recommendations;
    }

    formatDetails(details) {
        return details.replace(/\n/g, '<br>')
                     .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                     .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    addContextualSuggestions(context, subContext) {
        const suggestions = this.getSuggestionsFromResponse(context);
        const suggestionDiv = document.createElement('div');
        suggestionDiv.className = 'message-suggestions';
        suggestionDiv.innerHTML = `
            <div class="chat-suggestions">
                <div class="suggestion-header">Follow-up Questions:</div>
                ${suggestions.map(text => `
                    <div class="suggestion-chip" data-question="${text}">
                        ${text}
                    </div>
                `).join('')}
            </div>
        `;
        this.container.appendChild(suggestionDiv);
    }

    async processRevenueQuery(query, data) {
        const analysisType = this.determineRevenueAnalysisType(query);
        const revenueData = await this.prepareRevenueAnalysisData(data, analysisType);
        
        const suggestionService = new SuggestionService();
        return suggestionService.revenueResponseTemplates[analysisType](revenueData);
    }

    determineRevenueAnalysisType(query) {
        const lowerQuery = query.toLowerCase();
        if (lowerQuery.includes('forecast') || lowerQuery.includes('predict')) return 'forecast';
        if (lowerQuery.includes('room type') || lowerQuery.includes('category')) return 'roomType';
        return 'comprehensive';
    }

    async prepareRevenueAnalysisData(data, type) {
        const baseData = {
            total: this.calculateTotalRevenue(data),
            yoyGrowth: await this.calculateYearOverYearGrowth(data),
            performanceRatio: this.calculatePerformanceVsTarget(data)
        };

        switch (type) {
            case 'forecast':
                return {
                    ...baseData,
                    forecast: await this.generateRevenueForecast(data),
                    seasonalFactors: this.analyzeSeasonalPatterns(data),
                    confidenceInterval: this.calculateConfidenceInterval(data)
                };
            case 'roomType':
                return {
                    ...baseData,
                    roomTypeRevenue: await this.analyzeRevenueByRoomType(data),
                    occupancyByType: this.calculateOccupancyByRoomType(data),
                    profitabilityAnalysis: this.analyzeProfitabilityByRoomType(data)
                };
            default:
                return {
                    ...baseData,
                    monthlyRevenue: await this.calculateMonthlyRevenue(data),
                    sources: this.analyzeRevenueSources(data),
                    adr: this.calculateADR(data),
                    revpar: this.calculateRevPAR(data),
                    occupancyRevenue: this.calculateOccupancyRevenue(data)
                };
        }
    }

    async generateRevenueForecast(data) {
        const historicalData = await this.getHistoricalRevenueData();
        const trends = this.analyzeTrends(historicalData);
        const seasonality = this.calculateSeasonalityFactors(historicalData);

        return {
            nextMonth: this.forecastNextPeriod(trends, seasonality, 1),
            quarterEnd: this.forecastNextPeriod(trends, seasonality, 3),
            yearEnd: this.forecastNextPeriod(trends, seasonality, 12),
            confidence: this.calculateForecastConfidence(historicalData)
        };
    }

    async analyzeRevenueByRoomType(data) {
        const roomTypes = {};
        const bookings = await this.getBookingsByRoomType();

        for (const [type, bookingData] of Object.entries(bookings)) {
            roomTypes[type] = {
                revenue: this.calculateRevenueForRoomType(bookingData),
                share: this.calculateMarketShare(bookingData, bookings),
                adr: this.calculateADRForRoomType(bookingData),
                occupancy: this.calculateOccupancyForRoomType(bookingData),
                trend: this.calculateTrendForRoomType(bookingData)
            };
        }

        return roomTypes;
    }

    // Add other helper methods for revenue analysis...
}

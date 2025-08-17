// Import Firebase modules
import { db, auth, signOut } from '../firebase.js';
import { collection, getDocs, query, orderBy, limit, doc, deleteDoc, updateDoc, Timestamp, where, addDoc, getFirestore, getDoc, writeBatch, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getChartData } from './chartData.js';
import { occupancyService } from '../shared/occupancyCalculationService.js';

// Vue app for the dashboard
const app = new Vue({
    el: '#app',
    data: {
        todayCheckIns: 0,
        availableRooms: 36, // Update initial value to 36 rooms
        searchQuery: '',
        bookings: [],
        allBookings: [], // Store all bookings for metrics calculations
        analysisFeedback: '',
        isAuthenticated: false,
        loading: true,
        revenueChart: null,
        occupancyChart: null,
        lengthOfStayChart: null,
        lastProcessedRefresh: null,
        stats: {
            totalBookings: 0,
            currentMonthRevenue: '₱0.00',
            occupancyRate: '0.0'
        },
        // Add salesData
        salesData: {
            metrics: {
                totalSales: 0,
                monthlyGrowth: 0,
                yearOverYearGrowth: 0,
                currentMonthSales: 0,
                previousMonthSales: 0
            },
            forecast: []
        },
        chartData: {
            revenue: {
                labels: [],
                datasets: []
            },
            occupancy: {
                labels: [],
                datasets: []
            },
            lengthOfStay: {
                labels: [],
                datasets: []
            }
        },
        forecastData: {
            occupancyPrediction: [],
            revenueForecast: [],
            demandTrends: [],
            seasonalityPatterns: []
        },
        aiInsights: [],
        // Length of Stay Year Selection
        selectedLengthOfStayYear: new Date().getFullYear(),
        availableYears: [],
        updateInterval: null,
        forecastInterval: null,
        revenueData: {
            labels: [],
            datasets: {
                monthly: [{
                    label: 'Actual Sales',
                    data: [],
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: true
                }, {
                    label: 'Forecast',
                    data: [],
                    borderColor: 'rgba(255, 159, 64, 1)',
                    backgroundColor: 'rgba(255, 159, 64, 0.2)',
                    borderDash: [5, 5],
                    fill: true
                }]
            },
            metrics: {
                totalRevenue: 0,
                monthlyGrowth: 0,
                yearOverYearGrowth: 0,
                currentMonthRevenue: 0,
                previousMonthRevenue: 0,
                forecast: []
            }
        },
        occupancyData: {
            labels: [],
            datasets: [],
            metrics: {
                averageOccupancy: 0,
                currentOccupancy: 0,
                forecast: []
            }
        },
        showingChartInfo: false,
        chartInfoTitle: '',
        chartInfoText: '',
        chartInfo: {
            revenue: {
                title: 'Revenue Analysis Chart',
                text: 'This chart displays the historical and predicted revenue trends. The blue line shows actual revenue, while the orange dashed line shows predicted future revenue. The chart helps identify seasonal patterns, growth trends, and potential future earnings based on historical data and AI predictions.'
            },
            occupancy: {
                title: 'Occupancy Analysis Chart',
                text: 'The occupancy chart shows room occupancy rates over time. It displays actual occupancy (red line), predicted occupancy (green dashed line), and target occupancy rate (purple dashed line). This helps track capacity utilization and forecast future demand patterns.'
            },
            bookings: {
                title: 'Booking Trends Chart',
                text: 'This chart combines bar and line representations to show booking patterns. The bars represent actual bookings, while the lines show predictions and historical comparisons. It helps identify peak booking periods and seasonal trends in guest reservations.'
            },
            lengthOfStay: {
                title: 'Length-of-Stay Distribution Chart',
                text: 'This histogram shows the distribution of bookings by the number of nights guests stay. The buckets are: 1 night, 2-3 nights, 4-7 nights, and 8+ nights. This helps identify typical guest stay patterns and can inform pricing strategies for different length bookings. Longer stays may warrant different rates or packages.'
            },
            sales: {
                title: 'Sales Analysis Chart',
                text: 'The sales analysis chart provides a comprehensive view of your sales performance. It shows actual sales data (blue line) and predicted future sales (orange dashed line). The chart helps identify sales patterns, growth trends, and potential sales opportunities. The target line (purple dashed) indicates your revenue goals. Use this chart to track performance against targets and make data-driven decisions about pricing and marketing strategies.'
            }
        },
        showingExplanation: false,
        explanationTitle: '',
        explanationText: '',
        chartInitializationAttempted: false, // Add this flag
        chartInstances: {
            revenue: null,
            occupancy: null,
            lengthOfStay: null,
            bookingTrend: null,
            sales: null
        },
        isInitialized: false, // Add this flag
        showingMetricsExplanation: false, // Add this flag
        showingMetricInfo: false,
        metricInfoTitle: '',
        metricInfoText: '',
        // Notification system properties
        notifications: [],
        unreadNotificationsCount: 0,
        showNotificationDropdown: false,
        notificationListener: null,
        // Add booking listener for real-time updates
        bookingListener: null,
    },
    created() {
        // Check for dashboard refresh signals right away
        const hasRefreshSignal = this.checkRefreshSignals();
        
        // Initialize app and load data
        this.checkAuthState().then(user => {
            if (user) {
                // Initialize charts after authentication
                this.$nextTick(() => {
                    this.initializeCharts();
                    
                    // If a refresh signal was detected, force a data refresh
                    if (hasRefreshSignal) {
                        console.log('Refreshing data due to detected refresh signal');
                        this.fetchBookings();
                    }
                });
            }
        }).catch(error => {
            console.error('Error checking auth state:', error);
            this.loading = false;
        });
    },
    computed: {
        filteredBookings() {
            if (!this.searchQuery) {
                return this.bookings;
            }
            
            const query = this.searchQuery.toLowerCase();
            return this.bookings.filter(booking => {
                // Search by guest name
                if (booking.guestName && booking.guestName.toLowerCase && booking.guestName.toLowerCase().includes(query)) {
                    return true;
                }
                
                // Search by room number
                if (booking.propertyDetails && booking.propertyDetails.roomNumber && 
                    booking.propertyDetails.roomNumber.toString().includes(query)) {
                    return true;
                }
                
                // Search by room type
                if (booking.propertyDetails && booking.propertyDetails.roomType && 
                    booking.propertyDetails.roomType.toLowerCase && booking.propertyDetails.roomType.toLowerCase().includes(query)) {
                    return true;
                }
                
                // Search by status
                if (booking.status && booking.status.toLowerCase && booking.status.toLowerCase().includes(query)) {
                    return true;
                }
                
                // Search by payment status
                if (booking.paymentStatus && booking.paymentStatus.toLowerCase && booking.paymentStatus.toLowerCase().includes(query)) {
                    return true;
                }
                
                return false;
            });
        }
    },
    methods: {
        async handleLogout() {
            try {
                await signOut();
                window.location.href = '../Login/index.html';
            } catch (error) {
                console.error('Error signing out:', error);
                alert('Error signing out. Please try again.');
            }
        },

        async checkAuthState() {
            return new Promise((resolve) => {
                // Fix: Get the auth object as a function call
                const authInstance = auth();
                authInstance.onAuthStateChanged(async (user) => {
                    this.loading = false;
                    if (user) {
                        this.isAuthenticated = true;
                        this.user = user;
                        // Only fetch bookings here, remove initializeCharts call
                        await this.fetchBookings();
                    } else {
                        this.isAuthenticated = false;
                        this.user = null;
                    }
                    resolve(user);
                });
            });
        },

        analyzeData() {
            const totalBookings = this.bookings.length;
            const pendingBookings = this.bookings.filter(b => b.status === 'pending').length;
            const occupiedBookings = this.bookings.filter(b => b.status === 'occupied').length;
            const completedBookings = this.bookings.filter(b => b.status === 'completed').length;
            
            this.analysisFeedback = `
                Total Bookings: ${totalBookings}
                Pending Bookings: ${pendingBookings}
                Occupied Rooms: ${occupiedBookings}
                Completed Bookings: ${completedBookings}
                Available Rooms: ${this.availableRooms}
                Occupancy Rate: ${((occupiedBookings / 36) * 100).toFixed(1)}%
            `;
        },

        formatDate(timestamp) {
            try {
                if (!timestamp) return 'N/A';
                
                // Handle different date formats
                let date;
                
                // Handle Firestore Timestamp objects
                if (timestamp && typeof timestamp.toDate === 'function') {
                    date = timestamp.toDate();
                } 
                // Handle Date objects
                else if (timestamp instanceof Date) {
                    date = timestamp;
                } 
                // Handle timestamp objects with seconds
                else if (typeof timestamp === 'object' && timestamp.seconds) {
                    date = new Date(timestamp.seconds * 1000);
                } 
                // Handle string dates
                else if (typeof timestamp === 'string') {
                    date = new Date(timestamp);
                }
                
                // Check if date is valid
                if (!date || isNaN(date.getTime())) {
                    return 'Invalid Date';
                }
                
                // Format date
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
            } catch (error) {
                console.error('Date formatting error:', error, timestamp);
                return 'N/A';
            }
        },

        formatDateForChart(date) {
            try {
                // Handle different date formats
                const dateObj = date instanceof Date ? date : 
                               (date?.toDate ? date.toDate() : 
                               (typeof date === 'string' ? new Date(date) : null));

                if (!dateObj || isNaN(dateObj.getTime())) {
                    throw new Error('Invalid date input');
                }

                return dateObj.toLocaleString('default', { 
                    month: 'short', 
                    year: '2-digit'
                });
            } catch (error) {
                console.error('Date formatting error:', error, 'Input:', date);
                return 'Invalid Date';
            }
        },

        async fetchBookings() {
            try {
                console.log("Setting up real-time listener for bookings from everlodgebookings collection");
                const dbInstance = db();
                const bookingsRef = collection(dbInstance, 'everlodgebookings');
                const q = query(bookingsRef);
                
                // Remove existing listener if it exists
                if (this.bookingListener) {
                    this.bookingListener();
                    console.log("Removed existing booking listener");
                }
                
                // Set up real-time listener
                this.bookingListener = onSnapshot(q, (querySnapshot) => {
                    console.log(`Real-time update: Found ${querySnapshot.size} booking documents`);
                    
                    // Log document changes for debugging
                    querySnapshot.docChanges().forEach((change) => {
                        if (change.type === "added") {
                            console.log("New booking added:", change.doc.id);
                        }
                        if (change.type === "modified") {
                            console.log("Booking modified:", change.doc.id);
                        }
                        if (change.type === "removed") {
                            console.log("Booking removed/deleted:", change.doc.id);
                        }
                    });
                    
                    if (querySnapshot.empty) {
                        console.warn("No bookings found in everlodgebookings collection");
                        // Set default values if no bookings are found
                        this.todayCheckIns = 0;
                        this.availableRooms = 36;
                        this.stats = {
                            totalBookings: 0,
                            currentMonthRevenue: this.formatCurrency(0),
                            occupancyRate: '0.0%'
                        };
                        return;
                    }
                    
                    // Map the bookings with all necessary fields and proper defaults
                    let allBookings = querySnapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            ...data,
                            // Ensure essential fields have defaults
                            checkIn: data.checkIn,
                            checkOut: data.checkOut,
                            contactNumber: data.contactNumber || 'Not provided',
                            nightlyRate: data.nightlyRate || 0,
                            totalPrice: data.totalPrice || data.totalAmount || 0,
                            status: data.status || 'pending',
                            // Use email as fallback if displayName is not available
                            guestName: data.guestName || data.email || 'Guest',
                            email: data.email || 'No email provided',
                            // Ensure we have a timestamp for sorting (created or check-in date)
                            createdAt: data.createdAt || data.checkIn || { seconds: Date.now() / 1000 },
                            roomType: data.roomType || data.propertyDetails?.roomType || 'Standard',
                            propertyDetails: data.propertyDetails || {
                                roomType: data.roomType || 'Standard',
                                name: data.lodgeName || 'Ever Lodge'
                            }
                        };
                    });
                    
                    // Sort all bookings by creation date (newest first)
                    allBookings.sort((a, b) => {
                        const aTime = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
                        const bTime = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
                        return bTime - aTime; // Descending order (newest first)
                    });
                    
                    // Log booking data for debugging
                    console.log("Real-time update - Sorted bookings:", allBookings.slice(0, 3).map(b => ({
                        id: b.id, 
                        createdAt: b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000).toISOString() : 'unknown',
                        guestName: b.guestName,
                        status: b.status,
                        roomNumber: b.propertyDetails?.roomNumber
                    })));
                    
                    // Store all bookings for dashboard metrics calculations
                    this.allBookings = allBookings;
                    
                    // Generate available years for length-of-stay chart
                    this.generateAvailableYears();
                    
                    // DEBUG: Log the status distribution of all bookings
                    const statusCounts = {};
                    allBookings.forEach(booking => {
                        statusCounts[booking.status] = (statusCounts[booking.status] || 0) + 1;
                    });
                    console.log("Real-time update - Booking status distribution:", statusCounts);
                    
                    // Use all bookings for metrics calculations and store a subset for display
                    this.bookings = allBookings.slice(0, 5);
                    
                    console.log(`Real-time update - Displaying ${this.bookings.length} recent bookings out of ${allBookings.length} total`);
                    
                    // Calculate metrics based on actual data (using all bookings)
                    this.calculateDashboardMetrics();
                    this.updateDashboardStats();
                    
                    // Force Vue to refresh the UI
                    this.$forceUpdate();
                    
                    console.log("Real-time booking data processing complete");
                }, (error) => {
                    console.error('Error in booking real-time listener:', error);
                    // Set default values on error
                    this.todayCheckIns = 0;
                    this.availableRooms = 36;
                    this.stats = {
                        totalBookings: 0,
                        currentMonthRevenue: this.formatCurrency(0),
                        occupancyRate: '0.0%'
                    };
                    // Force Vue to refresh the UI even on error
                    this.$forceUpdate();
                });
                
                console.log("Real-time booking listener established");
                
            } catch (error) {
                console.error('Error setting up booking listener:', error);
                // Set default values on error
                this.todayCheckIns = 0;
                this.availableRooms = 36;
                this.stats = {
                    totalBookings: 0,
                    currentMonthRevenue: this.formatCurrency(0),
                    occupancyRate: '0.0%'
                };
                // Force Vue to refresh the UI even on error
                this.$forceUpdate();
            }
        },

        async calculateSalesMetrics() {
            try {
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                const lastMonth = new Date(currentYear, currentMonth - 1);
                const lastYear = new Date(currentYear - 1, currentMonth);

                // Generate labels for the last 12 months
                const labels = [];
                const actualSales = [];
                const predictedSales = [];
                const actualOccupancy = [];
                const predictedOccupancy = [];
                const targetOccupancy = [];

                for (let i = 11; i >= 0; i--) {
                    const date = new Date(currentYear, currentMonth - i, 1);
                    labels.push(date.toLocaleString('default', { month: 'short', year: '2-digit' }));

                    // Filter bookings for this month
                    const monthBookings = this.allBookings.filter(booking => {
                        const bookingDate = new Date(booking.createdAt?.toDate?.() || booking.createdAt);
                        return bookingDate.getMonth() === date.getMonth() && 
                               bookingDate.getFullYear() === date.getFullYear() &&
                               booking.status !== 'cancelled';
                    });

                    // Calculate actual sales for this month
                    const monthSales = monthBookings.reduce((sum, booking) => {
                        // Ensure we're using the same totalPrice approach as BusinessAnalytics
                        const price = parseFloat(booking.totalPrice) || 0;
                        return sum + price;
                    }, 0);
                    actualSales.push(monthSales);

                    // Calculate actual occupancy for this month
                    const occupiedDays = monthBookings.length;
                    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
                    const occupancyRate = (occupiedDays / (10 * daysInMonth)) * 100; // 10 rooms total
                    actualOccupancy.push(occupancyRate);

                    // For future months (next 3 months), generate predictions
                    if (i < 3) {
                        // Predict based on average of last 3 months with some variation
                        const lastThreeMonths = actualSales.slice(-3);
                        const avgSales = lastThreeMonths.reduce((a, b) => a + b, 0) / lastThreeMonths.length;
                        // Apply same parsing logic for consistency
                        const predictedSale = parseFloat(avgSales * (1 + (Math.random() * 0.2 - 0.1))) || 0; // ±10% variation
                        predictedSales.push(predictedSale);

                        const lastThreeOccupancy = actualOccupancy.slice(-3);
                        const avgOccupancy = lastThreeOccupancy.reduce((a, b) => a + b, 0) / lastThreeOccupancy.length;
                        const predictedOcc = Math.min(100, parseFloat(avgOccupancy * (1 + (Math.random() * 0.2 - 0.1))) || 0); // ±10% variation
                        predictedOccupancy.push(predictedOcc);
                    } else {
                        predictedSales.push(null);
                        predictedOccupancy.push(null);
                    }

                    // Set target occupancy at 80%
                    targetOccupancy.push(80);
                }

                // Update chart data
                if (this.chartInstances.revenue) {
                    const revenueData = {
                        labels: labels,
                        datasets: [{
                            label: 'Actual Sales',
                            data: actualSales,
                            borderColor: 'rgba(54, 162, 235, 1)',
                            backgroundColor: 'rgba(54, 162, 235, 0.2)',
                            fill: true,
                            tension: 0.4
                        }, {
                            label: 'Predicted Sales',
                            data: predictedSales,
                            borderColor: 'rgba(255, 159, 64, 1)',
                            backgroundColor: 'rgba(255, 159, 64, 0.2)',
                            borderDash: [5, 5],
                            fill: true,
                            tension: 0.4
                        }]
                    };
                    this.updateChart(this.chartInstances.revenue, revenueData);
                }

                // Update sales chart if available
                if (this.chartInstances.sales) {
                    const salesData = {
                        labels: labels,
                        datasets: [{
                            label: 'Actual Sales',
                            data: actualSales.map(value => parseFloat(value) || 0), // Ensure consistent parsing
                            borderColor: 'rgba(75, 192, 192, 1)',
                            backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            fill: true,
                            tension: 0.4
                        }, {
                            label: 'Predicted Sales',
                            data: predictedSales.map(value => value === null ? null : parseFloat(value) || 0), // Ensure consistent parsing
                            borderColor: 'rgba(255, 99, 132, 1)',
                            backgroundColor: 'rgba(255, 99, 132, 0.2)',
                            borderDash: [5, 5],
                            fill: true,
                            tension: 0.4
                        }, {
                            label: 'Target Sales',
                            data: Array(12).fill(this.allBookings.length > 0 ? Math.max(...actualSales) * 1.2 : 0), // Set target 20% above highest month
                            borderColor: 'rgba(153, 102, 255, 1)',
                            borderDash: [3, 3],
                            fill: false
                        }]
                    };
                    this.updateChart(this.chartInstances.sales, salesData);
                }

                if (this.chartInstances.occupancy) {
                    const occupancyData = {
                        labels: labels,
                        datasets: [{
                            label: 'Actual Occupancy',
                            data: actualOccupancy,
                            borderColor: 'rgba(255, 99, 132, 1)',
                            backgroundColor: 'rgba(255, 99, 132, 0.2)',
                            fill: true,
                            tension: 0.4
                        }, {
                            label: 'Predicted Occupancy',
                            data: predictedOccupancy,
                            borderColor: 'rgba(75, 192, 192, 1)',
                            backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            borderDash: [5, 5],
                            fill: true,
                            tension: 0.4
                        }, {
                            label: 'Target Rate',
                            data: targetOccupancy,
                            borderColor: 'rgba(153, 102, 255, 1)',
                            borderDash: [3, 3],
                            fill: false
                        }]
                    };
                    this.updateChart(this.chartInstances.occupancy, occupancyData);
                }

                // Calculate current month metrics
                const currentMonthBookings = this.allBookings.filter(booking => {
                    const bookingDate = new Date(booking.createdAt?.toDate?.() || booking.createdAt);
                    return bookingDate.getMonth() === currentMonth && 
                           bookingDate.getFullYear() === currentYear;
                });

                const currentMonthSales = currentMonthBookings.reduce((sum, booking) => {
                    const price = parseFloat(booking.totalPrice) || 0;
                    return sum + price;
                }, 0);
                const lastMonthSales = actualSales[actualSales.length - 2] || 0;
                const lastYearSales = actualSales[0] || 0;

                // Calculate growth rates
                const monthlyGrowth = lastMonthSales > 0 ? 
                    ((currentMonthSales - lastMonthSales) / lastMonthSales) * 100 : 0;
                const yearOverYearGrowth = lastYearSales > 0 ? 
                    ((currentMonthSales - lastYearSales) / lastYearSales) * 100 : 0;

                // Update sales data
                this.salesData = {
                    metrics: {
                        totalSales: this.allBookings.reduce((sum, booking) => {
                            // Use consistent totalPrice calculation and filter out cancelled bookings
                            // to match calculation in BusinessAnalytics & AInalysis
                            if (booking.status === 'cancelled') return sum;
                            const price = parseFloat(booking.totalPrice) || 0;
                            return sum + price;
                        }, 0),
                        monthlyGrowth: monthlyGrowth,
                        yearOverYearGrowth: yearOverYearGrowth,
                        currentMonthSales: currentMonthSales,
                        previousMonthSales: lastMonthSales
                    },
                    forecast: predictedSales.filter(val => val !== null)
                };

                console.log('Sales metrics calculated:', this.salesData);
                console.log('Charts updated with new data');

            } catch (error) {
                console.error('Error calculating sales metrics:', error);
            }
        },

        async deleteBooking(bookingId) {
            if (!this.isAuthenticated) {
                alert('Please log in to delete bookings');
                return;
            }

            if (!bookingId) {
                console.error('No booking ID provided');
                return;
            }

            try {
                const dbInstance = db();
                const bookingRef = doc(dbInstance, 'everlodgebookings', bookingId); // Updated collection name
                
                // First, fetch the booking to check its creation date
                const bookingDoc = await getDoc(bookingRef);
                if (!bookingDoc.exists()) {
                    alert('Booking not found');
                    return;
                }

                const bookingData = bookingDoc.data();
                
                // Check if booking was created more than 1 day ago
                if (bookingData.createdAt) {
                    try {
                        let createdDate;
                        // Handle different timestamp formats
                        if (typeof bookingData.createdAt.toDate === 'function') {
                            createdDate = bookingData.createdAt.toDate();
                        } else if (bookingData.createdAt instanceof Date) {
                            createdDate = bookingData.createdAt;
                        } else {
                            createdDate = new Date(bookingData.createdAt);
                        }

                        const now = new Date();
                        const oneDayInMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
                        const timeDifference = now - createdDate;

                        if (timeDifference > oneDayInMs) {
                            alert('Cannot delete bookings that were created more than 1 day ago. This booking was created on ' + createdDate.toLocaleDateString() + ' at ' + createdDate.toLocaleTimeString() + '.');
                            return;
                        }
                    } catch (error) {
                        console.error('Error checking booking creation date:', error);
                        alert('Error validating booking deletion permissions. Please try again.');
                        return;
                    }
                }

                if (!confirm('Are you sure you want to delete this booking?')) {
                    return;
                }

                await deleteDoc(bookingRef);
                
                // Remove from local state
                this.bookings = this.bookings.filter(booking => booking.id !== bookingId);
                this.updateDashboardStats();
                
                alert('Booking deleted successfully!');
            } catch (error) {
                console.error('Error deleting booking:', error);
                if (error.code === 'permission-denied') {
                    alert('You do not have permission to delete this booking');
                } else {
                    alert('Error deleting booking. Please try again.');
                }
            }
        },

        async editBooking(booking) {
            if (!this.isAuthenticated) {
                alert('Please log in to edit bookings');
                return;
            }

            if (!booking || !booking.id) {
                console.error('Invalid booking data');
                return;
            }

            console.log('Editing booking:', booking); // Debug log

            try {
                const modalHTML = `
                    <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                        <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
                            <h2 class="text-xl font-bold mb-4">Edit Booking</h2>
                            <form id="edit-booking-form" class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
                                    <input 
                                        name="roomNumber" 
                                        type="text" 
                                        value="${booking.propertyDetails?.roomNumber || ''}"
                                        class="w-full p-2 border rounded-md"
                                        required
                                    >
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
                                    <input 
                                        name="roomType" 
                                        type="text" 
                                        value="${booking.propertyDetails?.roomType || ''}"
                                        class="w-full p-2 border rounded-md"
                                        required
                                    >
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Floor Level</label>
                                    <input 
                                        name="floorLevel" 
                                        type="text" 
                                        value="${booking.propertyDetails.floorLevel}"
                                        class="w-full p-2 border rounded-md"
                                        required
                                    >
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Guest Name</label>
                                    <input 
                                        name="guestName" 
                                        type="text" 
                                        value="${booking.guestName}"
                                        class="w-full p-2 border rounded-md"
                                        required
                                    >
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <select name="status" class="w-full p-2 border rounded-md" required>
                                        <option value="pending" ${booking.status === 'pending' ? 'selected' : ''}>Pending</option>
                                        <option value="occupied" ${booking.status === 'occupied' ? 'selected' : ''}>Occupied</option>
                                        <option value="completed" ${booking.status === 'completed' ? 'selected' : ''}>Completed</option>
                                    </select>
                                </div>
                                <div class="flex justify-end space-x-3 mt-6">
                                    <button type="button" class="cancel-edit px-4 py-2 bg-gray-200 text-gray-800 rounded">Cancel</button>
                                    <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;

                const modalContainer = document.createElement('div');
                modalContainer.innerHTML = modalHTML;
                document.body.appendChild(modalContainer);

                const form = document.getElementById('edit-booking-form');
                const cancelBtn = modalContainer.querySelector('.cancel-edit');

                cancelBtn.addEventListener('click', () => {
                    modalContainer.remove();
                });

                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const formData = new FormData(form);

                    try {
                        const dbInstance = db();
                        const bookingRef = doc(dbInstance, 'bookings', booking.id);
                        const updateData = {
                            'propertyDetails.roomNumber': formData.get('roomNumber'),
                            'propertyDetails.roomType': formData.get('roomType'),
                            'floorLevel': formData.get('floorLevel'),
                            guestName: formData.get('guestName'),
                            status: formData.get('status'),
                            updatedAt: Timestamp.fromDate(new Date())
                        };

                        console.log('Updating with data:', updateData); // Debug log
                        await updateDoc(bookingRef, updateData);

                        await this.fetchBookings();
                        modalContainer.remove();
                        alert('Booking updated successfully!');
                    } catch (error) {
                        console.error('Error updating booking:', error);
                        alert('Error updating booking. Please try again.');
                    }
                });

            } catch (error) {
                console.error('Error opening edit modal:', error);
                alert('Error opening edit form. Please try again.');
            }
        },

        async updateDashboardStats() {
            try {
                // Get current date
                const now = new Date();
                const today = now.toDateString();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                
                // Filter for check-ins today (exclude cancelled/deleted bookings)
                const checkInsToday = this.allBookings.filter(booking => {
                    // Skip cancelled or deleted bookings
                    if (booking.status === 'cancelled' || booking.status === 'deleted') {
                        return false;
                    }
                    const checkInDate = booking.checkIn?.toDate?.() || new Date(booking.checkIn);
                    return checkInDate.toDateString() === today;
                });
                
                // Calculate current month bookings (exclude cancelled/deleted bookings)
                const currentMonthBookings = this.allBookings.filter(booking => {
                    // Skip cancelled or deleted bookings
                    if (booking.status === 'cancelled' || booking.status === 'deleted') {
                        return false;
                    }
                    const bookingDate = booking.checkIn?.toDate?.() || new Date(booking.checkIn);
                    return bookingDate.getMonth() === currentMonth && 
                           bookingDate.getFullYear() === currentYear;
                });
                
                // Calculate current month revenue
                const currentMonthRevenue = currentMonthBookings.reduce((sum, booking) => {
                    // Use consistent parsing for totalPrice
                    const price = parseFloat(booking.totalPrice) || 0;
                    return sum + price;
                }, 0);
                
                // Calculate available rooms (occupancy rate will be calculated in calculateDashboardMetrics)
                const totalRooms = 36; // Total available rooms
                const occupiedRooms = new Set();
                
                this.allBookings.forEach(booking => {
                    // Skip cancelled or deleted bookings
                    if (booking.status === 'cancelled' || booking.status === 'deleted') {
                        return;
                    }
                    
                    const checkInDate = booking.checkIn?.toDate?.() || new Date(booking.checkIn);
                    const checkOutDate = booking.checkOut?.toDate?.() || new Date(booking.checkOut);
                    
                    // Check if booking is currently active
                    const isCurrentlyActive = checkInDate <= now && checkOutDate >= now;
                    const isNotCancelled = booking.status !== 'cancelled' && booking.status !== 'completed';
                    
                    if (isCurrentlyActive && isNotCancelled) {
                        if (booking.propertyDetails?.roomNumber) {
                            occupiedRooms.add(booking.propertyDetails.roomNumber);
                        }
                    }
                });
                
                // Update stats (totalBookings and occupancyRate will be calculated in calculateDashboardMetrics)
                this.todayCheckIns = checkInsToday.length;
                this.availableRooms = totalRooms - occupiedRooms.size;
                this.stats.currentMonthRevenue = this.formatCurrency(currentMonthRevenue);
                
                // Also calculate total sales for consistency with Business Analytics
                const totalSales = this.allBookings.reduce((sum, booking) => {
                    // Use consistent parsing for totalPrice and filter out cancelled/deleted bookings
                    if (booking.status === 'cancelled' || booking.status === 'deleted') return sum;
                    const price = parseFloat(booking.totalPrice) || 0;
                    return sum + price;
                }, 0);
                
                this.salesData.metrics.totalSales = totalSales;
                
                console.log('Dashboard stats updated successfully');
            } catch (error) {
                console.error('Error updating dashboard stats:', error);
            }
        },

        async calculateDashboardMetrics() {
            try {
                console.log("Calculating dashboard metrics using unified occupancy service...");

                // Create consistent date objects for comparison
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                // Helper function to parse dates consistently
                const parseDate = (dateField) => {
                    if (!dateField) return null;
                    
                    try {
                        // Handle Firebase Timestamp object
                        if (dateField && typeof dateField === 'object' && 'seconds' in dateField) {
                            return new Date(dateField.seconds * 1000);
                        }
                        
                        // Handle Date object
                        if (dateField instanceof Date) {
                            return dateField;
                        }
                        
                        // Handle string date
                        return new Date(dateField);
                    } catch (error) {
                        console.error('Error parsing date:', error);
                        return null;
                    }
                };

                // Debug: Log all bookings to check their structure
                console.log("All bookings:", this.allBookings.length);

                // Calculate bookings made today or confirmed today
                this.todayCheckIns = 0; // Reset counter
                
                // Log all bookings with their creation dates for debugging
                console.log("All bookings with creation and verification dates:");
                this.allBookings.forEach(booking => {
                    // Skip cancelled or deleted bookings
                    if (booking.status === 'cancelled' || booking.status === 'deleted') {
                        return;
                    }
                    
                    const createdAt = parseDate(booking.createdAt);
                    const verifiedAt = parseDate(booking.verifiedAt);
                    let countAsToday = false;
                    let reason = '';
                    
                    if (createdAt) {
                        // Create date-only versions for comparison (ignore time)
                        const createdAtDateOnly = new Date(createdAt);
                        createdAtDateOnly.setHours(0, 0, 0, 0);
                        
                        const createdToday = createdAtDateOnly.getTime() === today.getTime();
                        
                        if (createdToday) {
                            countAsToday = true;
                            reason = 'created today';
                        }
                    }
                    
                    // Also count bookings that were confirmed/verified today
                    if (verifiedAt && booking.status === 'confirmed') {
                        const verifiedAtDateOnly = new Date(verifiedAt);
                        verifiedAtDateOnly.setHours(0, 0, 0, 0);
                        
                        const verifiedToday = verifiedAtDateOnly.getTime() === today.getTime();
                        
                        if (verifiedToday && !countAsToday) {
                            countAsToday = true;
                            reason = 'confirmed today';
                        }
                    }
                    
                    console.log(`Booking ${booking.id}: createdAt=${createdAt ? new Date(createdAt).toISOString() : 'unknown'}, verifiedAt=${verifiedAt ? new Date(verifiedAt).toISOString() : 'none'}, status=${booking.status}, countAsToday=${countAsToday} (${reason})`);
                    
                    // Count booking if it was created today OR confirmed today
                    if (countAsToday) {
                        this.todayCheckIns++;
                        console.log(`✓ Counting booking ${booking.id} as today's booking (${reason})`);
                    }
                });

                console.log(`Today's bookings (created + confirmed): ${this.todayCheckIns}`);

                // Calculate total bookings for current month (based on creation date)
                const currentMonth = today.getMonth();
                const currentYear = today.getFullYear();
                
                this.stats.totalBookings = this.allBookings.filter(booking => {
                    // Use createdAt date instead of checkIn date for "Total Bookings This Month"
                    const bookingCreatedDate = parseDate(booking.createdAt);
                    if (!bookingCreatedDate) return false;
                    
                    const isThisMonth = bookingCreatedDate.getMonth() === currentMonth && 
                           bookingCreatedDate.getFullYear() === currentYear;
                    const isActive = booking.status !== 'cancelled' && booking.status !== 'deleted';
                    return isThisMonth && isActive;
                }).length;

                console.log(`Total bookings created this month: ${this.stats.totalBookings}`);
                console.log(`Total bookings in everlodgebookings collection: ${this.allBookings.length}`);
                console.log(`Non-cancelled bookings this month: ${this.stats.totalBookings}`);

                // Calculate current month revenue
                const currentMonthRevenue = this.allBookings
                    .filter(booking => {
                        const bookingDate = parseDate(booking.checkIn);
                        if (!bookingDate) return false;
                        
                        const isThisMonth = bookingDate.getMonth() === currentMonth && 
                               bookingDate.getFullYear() === currentYear;
                        const isActive = booking.status !== 'cancelled' && booking.status !== 'deleted';
                        return isThisMonth && isActive;
                    })
                    .reduce((total, booking) => {
                        const price = parseFloat(booking.totalPrice) || 0;
                        return total + price;
                    }, 0);

                this.stats.currentMonthRevenue = this.formatCurrency(currentMonthRevenue);
                console.log(`Current month revenue: ${this.stats.currentMonthRevenue}`);

                // Use unified occupancy calculation service
                console.log("Dashboard: Using unified occupancy calculation service");
                const occupancyData = occupancyService.calculateCurrentOccupancy(this.allBookings);
                
                // Update stats with occupancy data from unified service
                this.stats.occupancyRate = occupancyData.occupancyRateFormatted;
                this.availableRooms = occupancyData.availableRooms;
                
                console.log(`Dashboard: Unified occupancy calculation complete`);
                console.log(`Dashboard: Occupancy rate: ${occupancyData.occupancyRateFormatted}`);
                console.log(`Dashboard: Available rooms: ${occupancyData.availableRooms}`);
                console.log(`Dashboard: Occupied rooms: ${occupancyData.occupiedRooms}`);
                console.log(`Dashboard: Occupied room numbers: [${occupancyData.occupiedRoomNumbers.join(', ')}]`);
                
                // Validate the occupancy data consistency
                if (!occupancyService.validateOccupancyData(occupancyData)) {
                    console.warn('Dashboard: Occupancy data validation failed - check for inconsistencies');
                }
                
                // Force a UI update after all metrics have been calculated
                this.$forceUpdate();

            } catch (error) {
                console.error('Error calculating dashboard metrics:', error);
                // Set default values on error
                this.todayCheckIns = 0;
                this.availableRooms = 36;
                this.stats = {
                    totalBookings: 0,
                    currentMonthRevenue: this.formatCurrency(0),
                    occupancyRate: '0.0%'
                };
                // Force UI update even after error
                this.$forceUpdate();
            }
        },

        // Manual refresh method for testing and user-initiated updates
        async manualRefresh() {
            try {
                console.log("Manual refresh triggered by user");
                this.loading = true;
                
                // Re-establish the real-time listener which will trigger data updates
                await this.fetchBookings();
                
                console.log("Manual refresh completed");
            } catch (error) {
                console.error('Error during manual refresh:', error);
                alert('Failed to refresh dashboard data. Please try again.');
            } finally {
                this.loading = false;
            }
        },

        formatCurrency(amount) {
            try {
                return new Intl.NumberFormat('en-PH', {
                    style: 'currency',
                    currency: 'PHP'
                }).format(amount);
            } catch (error) {
                console.error('Error formatting currency:', error);
                return '₱0.00';
            }
        },

        generateBookingTrendData(bookings) {
            try {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const currentDate = new Date();
                const labels = [];
                const actualData = [];
                const predictedData = [];
                const previousPeriodData = [];
                
                // Generate last 6 months of data
                for (let i = 5; i >= 0; i--) {
                    const month = new Date(currentDate);
                    month.setMonth(currentDate.getMonth() - i);
                    const monthLabel = `${months[month.getMonth()]}-${month.getFullYear().toString().substr(2)}`;
                    labels.push(monthLabel);
                    
                    // Count actual bookings for this month
                    const bookingsInMonth = bookings.filter(booking => {
                        if (!booking.checkIn || !booking.checkIn.toDate) return false;
                        const checkIn = booking.checkIn.toDate();
                        return checkIn.getMonth() === month.getMonth() && 
                               checkIn.getFullYear() === month.getFullYear();
                    }).length;
                    
                    actualData.push(bookingsInMonth);
                    
                    // Generate predicted data (slightly different from actual for visualization)
                    const predicted = Math.max(0, bookingsInMonth * (1 + (Math.random() * 0.4 - 0.2)));
                    predictedData.push(Math.round(predicted));
                    
                    // Generate previous period data (from one year ago)
                    const prevYearBookingsCount = bookings.filter(booking => {
                        if (!booking.checkIn || !booking.checkIn.toDate) return false;
                        const checkIn = booking.checkIn.toDate();
                        return checkIn.getMonth() === month.getMonth() && 
                               checkIn.getFullYear() === month.getFullYear() - 1;
                    }).length;
                    
                    previousPeriodData.push(prevYearBookingsCount);
                }
                
                // Add future months for prediction
                for (let i = 1; i <= 3; i++) {
                    const month = new Date(currentDate);
                    month.setMonth(currentDate.getMonth() + i);
                    const monthLabel = `${months[month.getMonth()]}-${month.getFullYear().toString().substr(2)}`;
                    labels.push(monthLabel);
                    
                    // For future months, actual data is null
                    actualData.push(null);
                    
                    // Generate forecast based on previous year trend and recent months
                    const lastValue = actualData[actualData.length - 2] || 0;
                    const prevYearValue = previousPeriodData[previousPeriodData.length - 1] || 0;
                    const seasonalFactor = prevYearValue > 0 ? prevYearValue / 5 : 1;
                    
                    // Predict with some randomness and seasonal factor
                    const predicted = Math.max(1, lastValue * seasonalFactor * (1 + (Math.random() * 0.3 - 0.1)));
                    predictedData.push(Math.round(predicted));
                    
                    // Previous period data continues with random values for future months
                    const randomPrevValue = Math.round(Math.random() * 5);
                    previousPeriodData.push(randomPrevValue);
                }
                
                return {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Actual Bookings',
                            type: 'bar',
                            data: actualData,
                            backgroundColor: 'rgba(75, 192, 192, 0.6)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 1,
                            order: 2
                        },
                        {
                            label: 'Predicted Bookings',
                            type: 'line',
                            data: predictedData,
                            borderColor: 'rgba(255, 159, 64, 1)',
                            backgroundColor: 'rgba(255, 159, 64, 0.2)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            fill: false,
                            tension: 0.4,
                            order: 1
                        },
                        {
                            label: 'Previous Period',
                            type: 'line',
                            data: previousPeriodData,
                            borderColor: 'rgba(153, 102, 255, 1)',
                            borderWidth: 1,
                            borderDash: [3, 3],
                            fill: false,
                            tension: 0.4,
                            order: 0
                        }
                    ]
                };
            } catch (error) {
                console.error('Error generating booking trend data:', error);
                // Return default chart data structure
                return {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [
                        {
                            label: 'Actual Bookings',
                            type: 'bar',
                            data: [3, 5, 4, 6, 5, 7],
                            backgroundColor: 'rgba(75, 192, 192, 0.6)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 1
                        }
                    ]
                };
            }
        },

        updateChart(chart, newData) {
            if (!chart || !newData) {
                console.warn('Cannot update chart: chart instance or data is missing');
                return;
            }
            
            try {
                // For sales/revenue chart, ensure consistent data processing
                if (chart === this.chartInstances.revenue || chart === this.revenueChart) {
                    // Ensure all data points are properly parsed as numbers
                    if (newData.datasets) {
                        newData.datasets.forEach(dataset => {
                            if (dataset.data) {
                                dataset.data = dataset.data.map(value => parseFloat(value) || 0);
                            }
                        });
                    }
                }
                
                // Update labels if they exist
                if (newData.labels) {
                    chart.data.labels = newData.labels;
                }
                
                // Update datasets if they exist
                if (newData.datasets) {
                    chart.data.datasets = newData.datasets;
                }
                
                // Update and render
                chart.update();
            } catch (error) {
                console.error('Error updating chart:', error);
            }
        },

        async initializeCharts() {
            // If charts are already initialized, don't reinitialize
            if (this.isInitialized) {
                console.log('Charts already initialized, skipping initialization');
                return;
            }
            
            // Check if Chart.js is available
            if (typeof Chart === 'undefined') {
                console.error('Chart.js is not loaded, cannot initialize charts');
                return;
            }
            
            try {
                console.log('Initializing dashboard charts');
                
                // First, destroy any existing chart instances to avoid conflicts
                this.destroyExistingCharts();
                
                // Get canvas elements
                const revenueCtx = document.getElementById('revenueChart');
                const occupancyCtx = document.getElementById('occupancyChart');
                const lengthOfStayCtx = document.getElementById('lengthOfStayChart');
                const bookingTrendsCtx = document.getElementById('bookingTrendChart');
                const salesCtx = document.getElementById('salesChart'); // Add sales chart
                
                if (!revenueCtx || !occupancyCtx || !lengthOfStayCtx || !bookingTrendsCtx) {
                    console.error('Chart canvas elements not found, cannot initialize charts');
                    return;
                }
                
                // Import chart data - use selected year for length-of-stay chart
                const chartData = await getChartData(this.selectedLengthOfStayYear);
                console.log('Chart data received:', chartData);
                
                if (!chartData) {
                    console.error('Failed to get chart data');
                    return;
                }
                
                // Create chart instances with default data structure
                this.createChartInstances(revenueCtx, occupancyCtx, lengthOfStayCtx, bookingTrendsCtx, salesCtx, chartData);
                
                // Mark charts as initialized
                this.isInitialized = true;
                console.log('All charts initialized successfully');
            } catch (error) {
                console.error('Error initializing charts:', error);
                // Reset initialization flag on error
                this.isInitialized = false;
            }
        },

        // Generate available years from booking data
        generateAvailableYears() {
            const yearsWithData = new Set();
            
            // Extract years from booking data only if bookings exist
            if (this.allBookings && this.allBookings.length > 0) {
                this.allBookings.forEach(booking => {
                    // Only count non-cancelled bookings with valid nights data
                    if (booking.checkIn && booking.status !== 'cancelled') {
                        const checkInDate = typeof booking.checkIn.toDate === 'function' 
                            ? booking.checkIn.toDate() 
                            : new Date(booking.checkIn);
                        
                        if (!isNaN(checkInDate.getTime())) {
                            // Validate that the booking has usable length-of-stay data
                            let hasValidNights = false;
                            
                            // Check if numberOfNights is directly available and valid
                            if (booking.numberOfNights && typeof booking.numberOfNights === 'number' && booking.numberOfNights > 0) {
                                hasValidNights = true;
                            } else {
                                // Check if we can calculate nights from dates
                                const checkOut = booking.checkOut;
                                if (checkOut) {
                                    const checkOutDate = typeof checkOut.toDate === 'function' 
                                        ? checkOut.toDate() 
                                        : new Date(checkOut);
                                    
                                    if (!isNaN(checkOutDate.getTime()) && checkOutDate > checkInDate) {
                                        const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24));
                                        if (nights > 0) {
                                            hasValidNights = true;
                                        }
                                    }
                                }
                            }
                            
                            // Only add year if booking has valid nights data
                            if (hasValidNights) {
                                yearsWithData.add(checkInDate.getFullYear());
                            }
                        }
                    }
                });
            }
            
            // If no years found from data, add current year as default
            if (yearsWithData.size === 0) {
                yearsWithData.add(new Date().getFullYear());
            }
            
            // Convert to sorted array (newest first)
            this.availableYears = Array.from(yearsWithData).sort((a, b) => b - a);
            
            // Set selected year to the most recent year with data
            if (this.availableYears.length > 0) {
                this.selectedLengthOfStayYear = this.availableYears[0];
            }
            
            console.log('Available years for length-of-stay analysis (with valid data only):', this.availableYears);
        },

        // Update length-of-stay chart when year changes
        async updateLengthOfStayChart() {
            try {
                console.log(`Updating length-of-stay chart for year ${this.selectedLengthOfStayYear}`);
                
                // Import the getChartData function
                const { getChartData } = await import('./chartData.js');
                
                // Get new chart data for the selected year
                const chartData = await getChartData(this.selectedLengthOfStayYear);
                
                if (chartData && chartData.lengthOfStay && this.lengthOfStayChart) {
                    const lengthOfStayData = chartData.lengthOfStay;
                    
                    // Check if there's actually data for this year
                    const totalBookings = lengthOfStayData.totalBookings || 0;
                    
                    if (totalBookings > 0) {
                        // Update the chart data
                        this.lengthOfStayChart.data.labels = lengthOfStayData.labels;
                        this.lengthOfStayChart.data.datasets[0].data = lengthOfStayData.datasets[0].data;
                        
                        // Update the chart title
                        this.lengthOfStayChart.options.plugins.title.text = `Year ${lengthOfStayData.year || this.selectedLengthOfStayYear} (${totalBookings} bookings)`;
                        
                        // Update the chart
                        this.lengthOfStayChart.update();
                        
                        console.log(`Length-of-stay chart updated successfully for year ${this.selectedLengthOfStayYear} with ${totalBookings} bookings`);
                    } else {
                        // No data for this year - this shouldn't happen if generateAvailableYears works correctly
                        console.warn(`No bookings found for year ${this.selectedLengthOfStayYear}`);
                        
                        // Update chart title to show no data
                        this.lengthOfStayChart.options.plugins.title.text = `Year ${this.selectedLengthOfStayYear} (No data)`;
                        this.lengthOfStayChart.update();
                    }
                } else {
                    console.warn('No length-of-stay data available for selected year');
                }
            } catch (error) {
                console.error('Error updating length-of-stay chart:', error);
            }
        },

        destroyExistingCharts() {
            if (this.revenueChart instanceof Chart) {
                this.revenueChart.destroy();
                this.revenueChart = null;
            }
            
            if (this.occupancyChart instanceof Chart) {
                this.occupancyChart.destroy();
                this.occupancyChart = null;
            }
            
            if (this.lengthOfStayChart instanceof Chart) {
                this.lengthOfStayChart.destroy();
                this.lengthOfStayChart = null;
            }
            
            if (this.bookingTrendsChart instanceof Chart) {
                this.bookingTrendsChart.destroy();
                this.bookingTrendsChart = null;
            }
            
            if (this.salesChart instanceof Chart) {
                this.salesChart.destroy();
                this.salesChart = null;
            }
            
            console.log('Existing chart instances destroyed');
        },

        createChartInstances(revenueCtx, occupancyCtx, lengthOfStayCtx, bookingTrendsCtx, salesCtx, chartData) {
            // Create Revenue Chart
            this.revenueChart = new Chart(revenueCtx, {
                type: 'line',
                data: chartData.revenue || {
                    labels: [],
                    datasets: [{
                        label: 'Monthly Sales',
                        data: [],
                        borderColor: 'rgba(54, 162, 235, 1)',
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            top: 30,
                            right: 30,
                            bottom: 30,
                            left: 30
                        }
                    },
                    interaction: {
                        mode: 'index',
                        intersect: false,
                        includeInvisible: true
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '₱' + value.toLocaleString();
                                },
                                padding: 15,
                                font: {
                                    size: 12
                                }
                            },
                            grid: {
                                drawBorder: false
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                padding: 15,
                                font: {
                                    size: 12
                                }
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleFont: {
                                size: 14
                            },
                            bodyFont: {
                                size: 13
                            },
                            padding: 12,
                            displayColors: true,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += '₱' + context.parsed.y.toLocaleString();
                                    }
                                    return label;
                                }
                            }
                        },
                        legend: {
                            position: 'top',
                            align: 'end',
                            labels: {
                                padding: 25,
                                usePointStyle: true,
                                font: {
                                    size: 13
                                }
                            }
                        }
                    },
                    elements: {
                        point: {
                            radius: 4,
                            hoverRadius: 8,
                            borderWidth: 2,
                            hoverBorderWidth: 2,
                            hoverBorderColor: '#ffffff'
                        },
                        line: {
                            tension: 0.3
                        }
                    }
                }
            });
            
            // Create Sales Analysis Chart (similar to revenue but with consistent parsing)
            if (salesCtx) {
                this.salesChart = new Chart(salesCtx, {
                    type: 'line',
                    data: chartData.sales || {
                        labels: [],
                        datasets: [{
                            label: 'Monthly Sales',
                            data: [],
                            borderColor: 'rgba(54, 162, 235, 1)',
                            backgroundColor: 'rgba(54, 162, 235, 0.2)',
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: {
                            padding: {
                                top: 30,
                                right: 30,
                                bottom: 30,
                                left: 30
                            }
                        },
                        interaction: {
                            mode: 'index',
                            intersect: false,
                            includeInvisible: true
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return '₱' + parseFloat(value).toLocaleString();
                                    },
                                    padding: 15,
                                    font: {
                                        size: 12
                                    }
                                },
                                grid: {
                                    drawBorder: false
                                }
                            },
                            x: {
                                grid: {
                                    display: false
                                },
                                ticks: {
                                    padding: 15,
                                    font: {
                                        size: 12
                                    }
                                }
                            }
                        },
                        plugins: {
                            tooltip: {
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                titleFont: {
                                    size: 14
                                },
                                bodyFont: {
                                    size: 13
                                },
                                padding: 12,
                                displayColors: true,
                                callbacks: {
                                    label: function(context) {
                                        let label = context.dataset.label || '';
                                        if (label) {
                                            label += ': ';
                                        }
                                        if (context.parsed.y !== null) {
                                            label += '₱' + parseFloat(context.parsed.y).toLocaleString();
                                        }
                                        return label;
                                    }
                                }
                            },
                            legend: {
                                position: 'top',
                                align: 'end',
                                labels: {
                                    padding: 25,
                                    usePointStyle: true,
                                    font: {
                                        size: 13
                                    }
                                }
                            }
                        },
                        elements: {
                            point: {
                                radius: 4,
                                hoverRadius: 8,
                                borderWidth: 2,
                                hoverBorderWidth: 2,
                                hoverBorderColor: '#ffffff'
                            },
                            line: {
                                tension: 0.3
                            }
                        }
                    }
                });
                
                // Store in chartInstances for consistent reference
                this.chartInstances.sales = this.salesChart;
            }
            
            // Create Occupancy Chart
            this.occupancyChart = new Chart(occupancyCtx, {
                type: 'line',
                data: chartData.occupancy || {
                    labels: [],
                    datasets: [{
                        label: 'Occupancy Rate',
                        data: [],
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                        includeInvisible: true
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleFont: {
                                size: 14
                            },
                            bodyFont: {
                                size: 13
                            },
                            padding: 12,
                            displayColors: true,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += context.parsed.y.toFixed(1) + '%';
                                    }
                                    return label;
                                },
                                afterLabel: function(context) {
                                    // Calculate if rate is good, fair, or needs improvement
                                    const rate = context.parsed.y;
                                    let status = '';
                                    
                                    if (rate >= 80) status = '✓ Excellent';
                                    else if (rate >= 60) status = '✓ Good';
                                    else if (rate >= 40) status = '⚠️ Fair';
                                    else status = '⚠️ Needs Improvement';
                                    
                                    return [
                                        `Status: ${status}`,
                                        `Industry Avg: 65%`
                                    ];
                                }
                            }
                        },
                        hover: {
                            mode: 'nearest',
                            intersect: false
                        }
                    },
                    elements: {
                        point: {
                            radius: 3,
                            hoverRadius: 7,
                            borderWidth: 2,
                            hoverBorderWidth: 2,
                            hoverBorderColor: '#ffffff'
                        },
                        line: {
                            tension: 0.3
                        }
                    }
                }
            });
            
            // Create Length-of-Stay Chart
            const lengthOfStayData = chartData.lengthOfStay || {
                labels: ['1 Night', '2-3 Nights', '4-7 Nights', '8+ Nights'],
                datasets: [{
                    label: 'Bookings Count',
                    data: [25, 45, 35, 15],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.7)',   // 1 Night - Red
                        'rgba(54, 162, 235, 0.7)',   // 2-3 Nights - Blue
                        'rgba(255, 205, 86, 0.7)',   // 4-7 Nights - Yellow
                        'rgba(75, 192, 192, 0.7)'    // 8+ Nights - Green
                    ],
                    hoverBackgroundColor: [
                        'rgba(255, 99, 132, 0.9)',
                        'rgba(54, 162, 235, 0.9)',
                        'rgba(255, 205, 86, 0.9)',
                        'rgba(75, 192, 192, 0.9)'
                    ],
                    borderWidth: 2,
                    hoverBorderWidth: 3,
                    hoverBorderColor: '#ffffff'
                }],
                buckets: {
                    '1 Night': 25,
                    '2-3 Nights': 45,
                    '4-7 Nights': 35,
                    '8+ Nights': 15
                },
                totalBookings: 120
            };

            this.lengthOfStayChart = new Chart(lengthOfStayCtx, {
                type: 'bar',
                data: lengthOfStayData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: `Year ${lengthOfStayData.year || new Date().getFullYear()} (${lengthOfStayData.totalBookings || 0} bookings)`,
                            font: {
                                size: 16,
                                weight: 'bold'
                            },
                            color: '#374151',
                            padding: {
                                top: 10,
                                bottom: 20
                            }
                        },
                        legend: {
                            display: false // Hide legend for bar chart as it's not needed
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.85)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            borderColor: '#ffffff',
                            borderWidth: 1,
                            titleFont: {
                                size: 16,
                                weight: 'bold'
                            },
                            bodyFont: {
                                size: 14
                            },
                            padding: 16,
                            cornerRadius: 8,
                            displayColors: false,
                            callbacks: {
                                title: function(context) {
                                    return `${context[0].label} Stays`;
                                },
                                label: function(context) {
                                    const label = context.label;
                                    const count = context.parsed.y;
                                    const total = chartData.lengthOfStay?.totalBookings || 120;
                                    const percentage = ((count / total) * 100).toFixed(1);
                                    
                                    const insights = [];
                                    insights.push(`📊 ${count} bookings (${percentage}%)`);
                                    
                                    // Add insights based on the length of stay category
                                    if (label === '1 Night') {
                                        insights.push('💼 Business/Transit travelers');
                                        if (percentage > 30) {
                                            insights.push('💡 Consider express services');
                                        }
                                    } else if (label === '2-3 Nights') {
                                        insights.push('🏖️ Weekend/Short leisure stays');
                                        if (percentage > 40) {
                                            insights.push('💡 Most common stay duration');
                                        }
                                    } else if (label === '4-7 Nights') {
                                        insights.push('🌴 Extended vacation stays');
                                        if (percentage > 25) {
                                            insights.push('💡 Consider weekly packages');
                                        }
                                    } else if (label === '8+ Nights') {
                                        insights.push('🏠 Long-term/Extended stays');
                                        if (percentage > 15) {
                                            insights.push('� Ideal for monthly discounts');
                                        }
                                    }
                                    
                                    return insights;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Length of Stay',
                                font: {
                                    size: 14,
                                    weight: 'bold'
                                }
                            },
                            ticks: {
                                font: {
                                    size: 12
                                }
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Number of Bookings',
                                font: {
                                    size: 14,
                                    weight: 'bold'
                                }
                            },
                            beginAtZero: true,
                            ticks: {
                                stepSize: 5,
                                font: {
                                    size: 12
                                }
                            }
                        }
                    },
                    animation: {
                        duration: 1000,
                        easing: 'easeOutQuart'
                    }
                }
            });
            
            // Create Booking Trends Chart
            this.bookingTrendsChart = new Chart(bookingTrendsCtx, {
                type: 'line',
                data: chartData.bookingTrends || {
                    labels: [],
                    datasets: [{
                        label: 'Daily Bookings',
                        data: [],
                        borderColor: 'rgba(153, 102, 255, 1)',
                        backgroundColor: 'rgba(153, 102, 255, 0.2)',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    scales: {
                        x: {
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleFont: {
                                size: 14
                            },
                            bodyFont: {
                                size: 13
                            },
                            padding: 12,
                            displayColors: true,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += context.parsed.y + ' bookings';
                                    }
                                    return label;
                                },
                                afterLabel: function(context) {
                                    // This would be populated with real data in production
                                    const value = context.parsed.y;
                                    let trend = '';
                                    
                                    // Example condition for trends
                                    if (value > 10) trend = '↑ High demand';
                                    else if (value > 5) trend = '→ Average demand';
                                    else trend = '↓ Low demand';
                                    
                                    return [
                                        `Day: ${context.chart.data.labels[context.dataIndex]}`,
                                        `Trend: ${trend}`
                                    ];
                                }
                            }
                        },
                        hover: {
                            mode: 'nearest',
                            intersect: false
                        }
                    },
                    elements: {
                        point: {
                            radius: 3,
                            hoverRadius: 7,
                            borderWidth: 2,
                            hoverBorderWidth: 2,
                            hoverBorderColor: '#ffffff'
                        },
                        line: {
                            tension: 0.3
                        }
                    }
                }
            });
        },

        // Add methods for metric information
        showMetricInfo(metricType) {
            switch(metricType) {
                case 'checkins':
                    this.metricInfoTitle = "Today's Bookings";
                    this.metricInfoText = "Number of bookings created or confirmed today. This includes new bookings made today and previously pending bookings that were approved/confirmed today.";
                    break;
                case 'rooms':
                    this.metricInfoTitle = "Available Rooms";
                    this.metricInfoText = "Current number of rooms that are not occupied and available for booking.";
                    break;
                case 'bookings':
                    this.metricInfoTitle = "Total Bookings";
                    this.metricInfoText = "Total number of bookings for the current month.";
                    break;
                case 'occupancy':
                    this.metricInfoTitle = "Occupancy Rate";
                    this.metricInfoText = "Percentage of rooms currently occupied out of total rooms available.";
                    break;
                default:
                    this.metricInfoTitle = "Metric Information";
                    this.metricInfoText = "This metric provides insights into your property's performance.";
            }
            this.showingMetricInfo = true;
        },

        closeMetricInfo() {
            this.showingMetricInfo = false;
        },

        // Add methods for chart information
        showChartInfo(chartType) {
            if (this.chartInfo[chartType]) {
                this.chartInfoTitle = this.chartInfo[chartType].title;
                this.chartInfoText = this.chartInfo[chartType].text;
                this.showingChartInfo = true;
            }
        },

        closeChartInfo() {
            this.showingChartInfo = false;
        },

        // Add method for explaining chart content
        explainChartContent(chartType) {
            this.explanationTitle = `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Analysis`;
            
            switch(chartType) {
                case 'sales':
                    this.explanationText = `The sales data shows your sales performance over time. Based on the current trends, your property is ${this.salesData.metrics.monthlyGrowth > 0 ? 'growing' : 'experiencing some challenges'} compared to last month.`;
                    break;
                case 'occupancy':
                    const rate = parseFloat(this.stats.occupancyRate);
                    this.explanationText = `Your current occupancy rate is ${rate}%. ${rate > 70 ? 'This is a healthy occupancy level.' : 'There may be opportunity to increase bookings.'}`;
                    break;
                case 'lengthOfStay':
                    const lengthOfStayData = this.lengthOfStayChart?.data;
                    if (lengthOfStayData && lengthOfStayData.datasets && lengthOfStayData.datasets[0]) {
                        const data = lengthOfStayData.datasets[0].data;
                        const labels = lengthOfStayData.labels;
                        const total = data.reduce((sum, val) => sum + val, 0);
                        
                        // Find the most common length of stay
                        let maxIndex = 0;
                        for (let i = 1; i < data.length; i++) {
                            if (data[i] > data[maxIndex]) {
                                maxIndex = i;
                            }
                        }
                        
                        const mostCommon = labels[maxIndex];
                        const percentage = ((data[maxIndex] / total) * 100).toFixed(1);
                        
                        this.explanationText = `Length-of-stay analysis shows guest booking patterns. Most guests (${percentage}%) book ${mostCommon.toLowerCase()}, which indicates ${
                            maxIndex === 0 ? 'many business or transit travelers' :
                            maxIndex === 1 ? 'typical weekend and short leisure stays' :
                            maxIndex === 2 ? 'extended vacation and leisure travel' :
                            'long-term or extended stay guests'
                        }. This distribution helps optimize pricing strategies and service packages for different stay durations.`;
                    } else {
                        this.explanationText = 'The length-of-stay distribution shows how many nights guests typically book, helping you understand guest patterns and optimize pricing strategies.';
                    }
                    break;
                case 'bookings':
                    this.explanationText = 'The booking trends chart shows patterns in reservation activity. Understanding these patterns can help with staffing and resource planning.';
                    break;
                default:
                    this.explanationText = 'This chart provides visualization of your property data.';
            }
            
            this.showingExplanation = true;
        },

        closeExplanation() {
            this.showingExplanation = false;
        },

        // Close metrics explanation modal
        closeMetricsExplanation() {
            this.showingMetricsExplanation = false;
        },

        // Add method to handle chart interactions
        setupChartInteractions() {
            const charts = [
                { instance: this.revenueChart, container: document.querySelector('.sales-chart') },
                { instance: this.occupancyChart, container: document.querySelector('.occupancy-chart') },
                { instance: this.lengthOfStayChart, container: document.querySelector('.length-of-stay-chart') },
                { instance: this.bookingTrendsChart, container: document.querySelector('.booking-trend-chart') }
            ];

            // Remove any active class from all charts
            const removeActiveClass = () => {
                charts.forEach(chart => {
                    if (chart.container) {
                        chart.container.classList.remove('active');
                    }
                });
            };

            // Add click handlers for each chart
            charts.forEach(chart => {
                if (chart.instance && chart.container) {
                    const canvas = chart.container.querySelector('canvas');
                    
                    if (canvas) {
                        // Add click handler for the chart container to add active class
                        chart.container.addEventListener('click', () => {
                            removeActiveClass();
                            chart.container.classList.add('active');
                        });

                        // Add hover enter/leave for container
                        chart.container.addEventListener('mouseenter', () => {
                            canvas.style.opacity = '1';
                        });

                        chart.container.addEventListener('mouseleave', () => {
                            canvas.style.opacity = '0.95';
                            // Optional: remove active class on mouse leave
                            // chart.container.classList.remove('active');
                        });

                        // Optional: Click handler for canvas to show detailed view
                        canvas.addEventListener('click', (event) => {
                            const points = chart.instance.getElementsAtEventForMode(
                                event, 
                                'nearest', 
                                { intersect: true }, 
                                false
                            );
                            
                            if (points.length) {
                                const firstPoint = points[0];
                                const datasetIndex = firstPoint.datasetIndex;
                                const index = firstPoint.index;
                                
                                // Get the clicked data
                                const label = chart.instance.data.labels[index];
                                const value = chart.instance.data.datasets[datasetIndex].data[index];
                                
                                console.log(`Clicked on ${label}: ${value}`);
                                
                                // You could show a modal with detailed info about this data point
                                // or trigger an animation, etc.
                                
                                // Example: highlighting the clicked point by modifying its properties
                                const dataset = chart.instance.data.datasets[datasetIndex];
                                
                                // Reset all points to normal size
                                if (dataset.pointRadius) {
                                    dataset.pointRadius = dataset.pointRadius.map(() => 3);
                                } else {
                                    dataset.pointRadius = Array(dataset.data.length).fill(3);
                                }
                                
                                // Highlight the clicked point
                                dataset.pointRadius[index] = 8;
                                dataset.pointBackgroundColor = Array(dataset.data.length).fill(dataset.borderColor);
                                dataset.pointBackgroundColor[index] = '#ff6384';
                                
                                chart.instance.update();
                            }
                        });
                    }
                }
            });
        },

        // Add this as a new method
        checkRefreshSignals() {
            try {
                const refreshData = JSON.parse(localStorage.getItem('dashboard:refresh') || '{}');
                if (refreshData && refreshData.timestamp) {
                    const now = new Date().getTime();
                    const age = now - refreshData.timestamp;
                    
                    // Accept refresh signals that are less than 5 minutes old
                    if (age < 300000) {
                        console.log(`Found dashboard refresh signal (${age}ms old), action: ${refreshData.action}`);
                        this.lastProcessedRefresh = refreshData.timestamp;
                        
                        // If the signal is very recent (less than 10 seconds), clear it to prevent
                        // other instances from also processing it
                        if (age < 10000) {
                            localStorage.removeItem('dashboard:refresh');
                            console.log('Cleared recent refresh signal');
                        }
                        
                        return true; // Signal was processed
                    } else {
                        // Clear stale signals
                        localStorage.removeItem('dashboard:refresh');
                        console.log('Cleared stale refresh signal');
                    }
                }
            } catch (error) {
                console.warn('Error checking refresh signals:', error);
            }
            return false; // No valid signal found
        },

        // Notification System Methods
        async initializeNotificationSystem() {
            console.log('Initializing notification system...');
            
            // Set up real-time listener for new notifications
            await this.setupNotificationListener();
            
            // Load existing notifications
            await this.loadNotifications();
            
            // Set up UI event handlers
            this.setupNotificationEventHandlers();
            
            console.log('Notification system initialized');
        },

        async setupNotificationListener() {
            try {
                // Create a real-time listener for new notifications
                const notificationsRef = collection(db(), 'notifications');
                const q = query(notificationsRef, orderBy('createdAt', 'desc'));
                
                // Use onSnapshot for real-time updates
                this.notificationListener = onSnapshot(q, (snapshot) => {
                    console.log('Notification snapshot received, size:', snapshot.size);
                    
                    const newNotifications = [];
                    snapshot.forEach((doc) => {
                        const notificationData = {
                            id: doc.id,
                            ...doc.data()
                        };
                        
                        // Convert Firestore timestamps to JavaScript dates
                        if (notificationData.createdAt && notificationData.createdAt.toDate) {
                            notificationData.createdAt = notificationData.createdAt.toDate();
                        }
                        
                        newNotifications.push(notificationData);
                    });
                    
                    // Check for truly new notifications (ones we haven't seen before)
                    const existingIds = this.notifications.map(n => n.id);
                    const brandNewNotifications = newNotifications.filter(n => !existingIds.includes(n.id));
                    
                    if (brandNewNotifications.length > 0) {
                        console.log('Found new notifications:', brandNewNotifications.length);
                        // Show notification badge animation or sound
                        this.animateNotificationBell();
                    }
                    
                    this.notifications = newNotifications;
                    this.updateUnreadCount();
                }, (error) => {
                    console.error('Error in notification listener:', error);
                });
                
            } catch (error) {
                console.error('Error setting up notification listener:', error);
            }
        },

        async loadNotifications() {
            try {
                const notificationsRef = collection(db(), 'notifications');
                const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(50));
                const querySnapshot = await getDocs(q);
                
                this.notifications = [];
                querySnapshot.forEach((doc) => {
                    const notificationData = {
                        id: doc.id,
                        ...doc.data()
                    };
                    
                    // Convert Firestore timestamps to JavaScript dates
                    if (notificationData.createdAt && notificationData.createdAt.toDate) {
                        notificationData.createdAt = notificationData.createdAt.toDate();
                    }
                    
                    this.notifications.push(notificationData);
                });
                
                this.updateUnreadCount();
                console.log('Loaded notifications:', this.notifications.length);
                
            } catch (error) {
                console.error('Error loading notifications:', error);
            }
        },

        setupNotificationEventHandlers() {
            // Notification bell click handler
            const notificationBell = document.getElementById('notificationBell');
            const notificationDropdown = document.getElementById('notificationDropdown');
            
            if (notificationBell && notificationDropdown) {
                notificationBell.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleNotificationDropdown();
                });
                
                // Close dropdown when clicking outside
                document.addEventListener('click', (e) => {
                    if (!notificationDropdown.contains(e.target) && !notificationBell.contains(e.target)) {
                        this.closeNotificationDropdown();
                    }
                });
            }
            
            // Mark all as read button
            const markAllReadBtn = document.getElementById('markAllReadBtn');
            if (markAllReadBtn) {
                markAllReadBtn.addEventListener('click', () => {
                    this.markAllNotificationsAsRead();
                });
            }
            
            // Close modal handlers
            const closeModalBtns = document.querySelectorAll('#closeNotificationModal, #closeNotificationModalBtn');
            closeModalBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.closeNotificationModal();
                });
            });
        },

        toggleNotificationDropdown() {
            this.showNotificationDropdown = !this.showNotificationDropdown;
            const dropdown = document.getElementById('notificationDropdown');
            
            if (dropdown) {
                if (this.showNotificationDropdown) {
                    dropdown.classList.remove('hidden');
                    this.renderNotifications();
                } else {
                    dropdown.classList.add('hidden');
                }
            }
        },

        closeNotificationDropdown() {
            this.showNotificationDropdown = false;
            const dropdown = document.getElementById('notificationDropdown');
            if (dropdown) {
                dropdown.classList.add('hidden');
            }
        },

        renderNotifications() {
            const notificationList = document.querySelector('.notification-list');
            const noNotifications = document.getElementById('noNotifications');
            
            if (!notificationList) return;
            
            if (this.notifications.length === 0) {
                noNotifications.classList.remove('hidden');
                return;
            }
            
            noNotifications.classList.add('hidden');
            
            // Clear existing notifications except the "no notifications" message
            const existingNotifications = notificationList.querySelectorAll('.notification-item');
            existingNotifications.forEach(item => item.remove());
            
            // Render notifications
            this.notifications.slice(0, 10).forEach(notification => {
                const notificationElement = this.createNotificationElement(notification);
                notificationList.insertBefore(notificationElement, noNotifications);
            });
        },

        createNotificationElement(notification) {
            const element = document.createElement('div');
            element.className = `notification-item ${notification.read ? '' : 'unread'}`;
            element.setAttribute('data-notification-id', notification.id);
            
            const timeAgo = this.getTimeAgo(notification.createdAt);
            const iconClass = this.getNotificationIconClass(notification.type);
            
            element.innerHTML = `
                <div class="flex items-start">
                    <div class="notification-icon ${notification.type}">
                        <i class="${iconClass}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="notification-title">${notification.title}</div>
                        <div class="notification-message">${notification.message}</div>
                        <div class="notification-time">${timeAgo}</div>
                    </div>
                </div>
            `;
            
            // Add click handler
            element.addEventListener('click', () => {
                this.handleNotificationClick(notification);
            });
            
            return element;
        },

        getNotificationIconClass(type) {
            switch (type) {
                case 'booking':
                    return 'fas fa-calendar-plus';
                case 'payment':
                    return 'fas fa-credit-card';
                case 'cancellation':
                    return 'fas fa-times-circle';
                default:
                    return 'fas fa-bell';
            }
        },

        getTimeAgo(date) {
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString();
        },

        async handleNotificationClick(notification) {
            // Mark notification as read
            if (!notification.read) {
                await this.markNotificationAsRead(notification.id);
            }
            
            // Close dropdown
            this.closeNotificationDropdown();
            
            // Show detailed modal
            await this.showNotificationModal(notification);
        },

        async showNotificationModal(notification) {
            const modal = document.getElementById('notificationModal');
            const modalContent = document.getElementById('notificationModalContent');
            
            if (!modal || !modalContent) return;
            
            // Get booking details if this is a booking notification
            let bookingDetails = null;
            if (notification.bookingId) {
                bookingDetails = await this.getBookingDetails(notification.bookingId);
            }
            
            // Populate modal content
            modalContent.innerHTML = this.generateModalContent(notification, bookingDetails);
            
            // Show modal
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            
            // Set up view full booking button
            const viewFullBookingBtn = document.getElementById('viewFullBookingBtn');
            if (viewFullBookingBtn && notification.bookingId) {
                viewFullBookingBtn.onclick = () => {
                    this.closeNotificationModal();
                    // Navigate to booking details (you can customize this)
                    window.location.href = `#booking-${notification.bookingId}`;
                };
            }
        },

        generateModalContent(notification, bookingDetails) {
            let content = `
                <div class="booking-detail-item">
                    <span class="booking-detail-label">Notification Type:</span>
                    <span class="booking-detail-value">${notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}</span>
                </div>
                <div class="booking-detail-item">
                    <span class="booking-detail-label">Message:</span>
                    <span class="booking-detail-value">${notification.message}</span>
                </div>
                <div class="booking-detail-item">
                    <span class="booking-detail-label">Time:</span>
                    <span class="booking-detail-value">${notification.createdAt.toLocaleString()}</span>
                </div>
            `;
            
            if (bookingDetails) {
                content += `
                    <hr class="my-4">
                    <h3 class="text-lg font-semibold mb-3">Booking Details</h3>
                    <div class="booking-detail-item">
                        <span class="booking-detail-label">Guest Name:</span>
                        <span class="booking-detail-value">${bookingDetails.guestName || 'N/A'}</span>
                    </div>
                    <div class="booking-detail-item">
                        <span class="booking-detail-label">Contact:</span>
                        <span class="booking-detail-value">${bookingDetails.contactNumber || 'N/A'}</span>
                    </div>
                    <div class="booking-detail-item">
                        <span class="booking-detail-label">Room:</span>
                        <span class="booking-detail-value">${bookingDetails.propertyDetails?.roomNumber || 'N/A'}</span>
                    </div>
                    <div class="booking-detail-item">
                        <span class="booking-detail-label">Check-in:</span>
                        <span class="booking-detail-value">${this.formatDate(bookingDetails.checkIn)}</span>
                    </div>
                    <div class="booking-detail-item">
                        <span class="booking-detail-label">Check-out:</span>
                        <span class="booking-detail-value">${this.formatDate(bookingDetails.checkOut)}</span>
                    </div>
                    <div class="booking-detail-item">
                        <span class="booking-detail-label">Total Price:</span>
                        <span class="booking-detail-value">₱${(bookingDetails.totalPrice || 0).toLocaleString('en-PH')}</span>
                    </div>
                    <div class="booking-detail-item">
                        <span class="booking-detail-label">Status:</span>
                        <span class="booking-detail-value">
                            <span class="booking-status-badge ${(bookingDetails.status || 'pending').toLowerCase()}">
                                ${(bookingDetails.status || 'Pending').charAt(0).toUpperCase() + (bookingDetails.status || 'pending').slice(1)}
                            </span>
                        </span>
                    </div>
                `;
            }
            
            return content;
        },

        async getBookingDetails(bookingId) {
            try {
                const bookingRef = doc(db(), 'everlodgebookings', bookingId);
                const bookingSnap = await getDoc(bookingRef);
                
                if (bookingSnap.exists()) {
                    return bookingSnap.data();
                } else {
                    console.warn('Booking not found:', bookingId);
                    return null;
                }
            } catch (error) {
                console.error('Error fetching booking details:', error);
                return null;
            }
        },

        closeNotificationModal() {
            const modal = document.getElementById('notificationModal');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        },

        async markNotificationAsRead(notificationId) {
            try {
                const notificationRef = doc(db(), 'notifications', notificationId);
                await updateDoc(notificationRef, { read: true });
                
                // Update local state
                const notification = this.notifications.find(n => n.id === notificationId);
                if (notification) {
                    notification.read = true;
                    this.updateUnreadCount();
                }
            } catch (error) {
                console.error('Error marking notification as read:', error);
            }
        },

        async markAllNotificationsAsRead() {
            try {
                const unreadNotifications = this.notifications.filter(n => !n.read);
                
                // Update all unread notifications in Firestore
                const batch = writeBatch(db());
                unreadNotifications.forEach(notification => {
                    const notificationRef = doc(db(), 'notifications', notification.id);
                    batch.update(notificationRef, { read: true });
                });
                
                await batch.commit();
                
                // Update local state
                this.notifications.forEach(notification => {
                    notification.read = true;
                });
                
                this.updateUnreadCount();
                this.renderNotifications();
                
            } catch (error) {
                console.error('Error marking all notifications as read:', error);
            }
        },

        updateUnreadCount() {
            this.unreadNotificationsCount = this.notifications.filter(n => !n.read).length;
            
            // Update badge
            const badge = document.getElementById('notificationBadge');
            if (badge) {
                if (this.unreadNotificationsCount > 0) {
                    badge.textContent = this.unreadNotificationsCount;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }
        },

        animateNotificationBell() {
            const bell = document.getElementById('notificationBell');
            if (bell) {
                bell.classList.add('animate-pulse');
                setTimeout(() => {
                    bell.classList.remove('animate-pulse');
                }, 2000);
            }
        },

        // Clean up notification listener when component is destroyed
        destroyNotificationListener() {
            if (this.notificationListener) {
                this.notificationListener();
                this.notificationListener = null;
            }
        },
    },
    mounted() {
        // Initialize chart interactions after the app is mounted
        this.$nextTick(() => {
            // Expose a global refresh function for other pages to call
            window.dashboardRefresh = () => {
                console.log('Dashboard refresh triggered by external call');
                this.fetchBookings();
            };
            
            // Wait a bit to ensure charts are fully initialized
            setTimeout(() => {
                if (this.isInitialized) {
                    this.setupChartInteractions();
                }
            }, 1000);
            
            // Set up booking update event listener to refresh dashboard when bookings are approved
            document.addEventListener('dashboard:booking:update', (event) => {
                console.log('Dashboard received booking update event:', event.detail);
                if (event.detail && (event.detail.action === 'approve' || event.detail.action === 'update')) {
                    // Refresh the dashboard data when a booking is approved or updated
                    this.fetchBookings();
                }
            });
            
            // Set up localStorage change listener for cross-tab notifications
            window.addEventListener('storage', (event) => {
                if (event.key === 'dashboard:refresh') {
                    try {
                        const refreshData = JSON.parse(event.newValue);
                        if (refreshData && refreshData.timestamp) {
                            // Check if refresh notification is recent (within last 10 seconds)
                            const now = new Date().getTime();
                            const isFresh = (now - refreshData.timestamp) < 10000;
                            
                            if (isFresh && (refreshData.action === 'booking_approved' || refreshData.action === 'booking_rejected')) {
                                console.log('Dashboard refreshing from localStorage notification:', refreshData.action);
                                this.fetchBookings();
                            }
                        }
                    } catch (error) {
                        console.error('Error processing dashboard refresh notification:', error);
                    }
                }
            });
            
            // Set up custom event listener for same-tab notifications
            window.addEventListener('dashboardRefresh', (event) => {
                try {
                    const refreshData = event.detail;
                    if (refreshData && refreshData.timestamp) {
                        // Check if refresh notification is recent (within last 10 seconds)
                        const now = new Date().getTime();
                        const isFresh = (now - refreshData.timestamp) < 10000;
                        
                        if (isFresh && (refreshData.action === 'booking_approved' || refreshData.action === 'booking_rejected')) {
                            console.log('Dashboard refreshing from custom event notification:', refreshData.action);
                            this.fetchBookings();
                        }
                    }
                } catch (error) {
                    console.error('Error processing dashboard refresh custom event:', error);
                }
            });
            
            // Setup periodic check for dashboard refresh signals
            const checkRefreshInterval = setInterval(() => {
                try {
                    const refreshData = JSON.parse(localStorage.getItem('dashboard:refresh') || '{}');
                    if (refreshData && refreshData.timestamp) {
                        // Check if refresh notification is recent (within last 10 seconds)
                        const now = new Date().getTime();
                        const isFresh = (now - refreshData.timestamp) < 10000;
                        
                        if (isFresh && !this.lastProcessedRefresh || this.lastProcessedRefresh !== refreshData.timestamp) {
                            this.lastProcessedRefresh = refreshData.timestamp;
                            console.log('Dashboard refreshing from periodic check');
                            this.fetchBookings();
                        }
                    }
                } catch (error) {
                    // Silently ignore parsing errors
                }
            }, 5000); // Check every 5 seconds
            
            // Clear interval when component is destroyed
            this.$once('hook:beforeDestroy', () => {
                clearInterval(checkRefreshInterval);
                // Clean up booking listener
                if (this.bookingListener) {
                    this.bookingListener();
                    console.log("Cleaned up booking listener");
                }
                // Clean up notification listener
                if (this.notificationListener) {
                    this.notificationListener();
                    console.log("Cleaned up notification listener");
                }
            });
            
            // Add message listener for cross-frame communication
            window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'refresh-dashboard') {
                    console.log('Dashboard refresh requested via window messaging');
                    this.fetchBookings();
                }
            });
        });
    },
    watch: {
        // Watch for isInitialized changes to set up interactions
        isInitialized(newVal) {
            if (newVal === true) {
                // Wait a bit to ensure charts are fully rendered
                setTimeout(() => {
                    this.setupChartInteractions();
                }, 500);
            }
        }
    }
});

// Make Vue app globally accessible for debugging
window.app = app;

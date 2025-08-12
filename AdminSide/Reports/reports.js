import { 
    auth, 
    db,
    signOut
} from '../firebase.js';
import { 
    getFirestore,
    collection, 
    getDocs, 
    addDoc, 
    Timestamp,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { PageLogger } from "../js/pageLogger.js";

new Vue({
    el: '.app',
    data: {
        isAuthenticated: false,
        loading: true,
        bookings: [],
        // View control
        currentView: 'bookings',
        // Owner Reports related data
        showPinModal: false,
        ownerPin: '',
        pinError: '',
        ownerReportsVisible: false,
        activeTab: 'am',
        amReports: [],
        pmReports: [],
        ownerPinHash: 'bWH7eBepBuJvvhkWVjDNRUqMUjuajmm6', // This should be stored securely in a real app
        // Pagination and filtering
        dateFilter: null,
        filteredAmReports: [],
        filteredPmReports: [],
        currentPage: 1,
        rowsPerPage: 10,
        currentReportDate: null, // Store the current selected date for reports
        // Booking search and pagination
        bookingSearchQuery: '',
        filteredBookings: [],
        currentBookingPage: 1,
        bookingRowsPerPage: 10,
        // Owner report search
        ownerReportSearchQuery: '',
    },
    computed: {
        // Calculate total pages based on current filter
        totalPages() {
            const reports = this.activeTab === 'am' ? this.filteredAmReports : this.filteredPmReports;
            return Math.max(1, Math.ceil(reports.length / this.rowsPerPage));
        },
        
        // Get paginated AM reports
        paginatedAmReports() {
            const startIndex = (this.currentPage - 1) * this.rowsPerPage;
            const endIndex = startIndex + this.rowsPerPage;
            return this.filteredAmReports.slice(startIndex, endIndex);
        },
        
        // Get paginated PM reports
        paginatedPmReports() {
            const startIndex = (this.currentPage - 1) * this.rowsPerPage;
            const endIndex = startIndex + this.rowsPerPage;
            return this.filteredPmReports.slice(startIndex, endIndex);
        },
        
        // Calculate total pages for bookings
        totalBookingPages() {
            return Math.max(1, Math.ceil(this.filteredBookings.length / this.bookingRowsPerPage));
        },
        
        // Get paginated filtered bookings
        paginatedFilteredBookings() {
            const startIndex = (this.currentBookingPage - 1) * this.bookingRowsPerPage;
            const endIndex = startIndex + this.bookingRowsPerPage;
            return this.filteredBookings.slice(startIndex, endIndex);
        }
    },
    watch: {
        // Reset to page 1 when changing tabs
        activeTab() {
            this.currentPage = 1;
        }
    },
    async created() {
        try {
            // Listen for auth state changes
            const authInstance = auth(); // Call auth as a function to get the instance
            onAuthStateChanged(authInstance, async (user) => {
                this.loading = true;
                if (user) {
                    this.isAuthenticated = true;
                    await this.fetchBookings();
                    await this.fetchOwnerReports();
                    this.setDefaultDate(); // Set default date if none selected
                    this.organizeStandaloneButtons(); // Organize standalone buttons
                } else {
                    this.isAuthenticated = false;
                }
                this.loading = false;
                // Also hide overlay on auth state change
                this.hideInitialOverlay();
            });
        } catch (error) {
            console.error('Auth error:', error);
            this.loading = false;
            // Also hide overlay on auth error
            this.hideInitialOverlay();
        }
    },
    mounted() {
        // Add tooltip functionality specific to Vue components
        this.$nextTick(() => {
            setTimeout(() => {
                console.log('Vue mounted, initializing tooltips');
                // Ensure tooltips work with Vue components
                this.initTooltips();
            }, 500);
        });
    },
    methods: {
        // Initialize tooltips for Vue components
        initTooltips() {
            const tooltipElements = document.querySelectorAll('.tooltip');
            console.log('Found tooltip elements:', tooltipElements.length);
            
            tooltipElements.forEach(element => {
                // Skip elements that don't have tooltip content
                if (!element.hasAttribute('data-tooltip')) {
                    return;
                }
                
                console.log('Tooltip text for element:', element.getAttribute('data-tooltip'));
                
                // Ensure the element has position relative
                if (window.getComputedStyle(element).position === 'static') {
                    element.style.position = 'relative';
                }
                
                // Ensure visibility and z-index are properly set
                element.addEventListener('mouseenter', function() {
                    const tooltipAfter = window.getComputedStyle(element, '::after');
                    if (tooltipAfter && tooltipAfter.content !== 'none' && tooltipAfter.content !== 'normal') {
                        console.log('Tooltip hover detected');
                    }
                });
            });
        },
        
        // Method to organize standalone buttons that might be outside the Vue app
        organizeStandaloneButtons() {
            setTimeout(() => {
                // Collect all buttons that match our criteria
                const buttonElements = [];
                
                // Get standalone buttons by selector
                const selectorButtons = Array.from(document.querySelectorAll(
                    'body > button, body > .btn, body > a[class*="btn"], ' +
                    'body > div:not(.app):not(.sidebar) > button, ' + 
                    'body > div:not(.app):not(.sidebar) > .btn, ' +
                    'body > div:not(.app):not(.sidebar) > a[class*="btn"]'
                ));
                buttonElements.push(...selectorButtons);
                
                // Find buttons by text content (case insensitive)
                const textMatches = ['export to excel', 'import data', 'download', 'upload'];
                const allButtons = Array.from(document.querySelectorAll('button, .btn, a[class*="btn"]'));
                const textMatchButtons = allButtons.filter(button => {
                    const buttonText = button.textContent.toLowerCase().trim();
                    return textMatches.some(match => buttonText.includes(match)) && 
                           // Exclude buttons already in our Vue app actions section
                           !button.closest('.action-buttons') && 
                           !button.closest('.owner-reports-actions');
                });
                buttonElements.push(...textMatchButtons);
                
                // Remove duplicates
                const uniqueButtons = [...new Set(buttonElements)];
                
                if (uniqueButtons.length > 0) {
                    console.log('Found standalone buttons to organize:', uniqueButtons.length);
                    
                    // Find our dedicated container
                    const container = document.getElementById('standalone-buttons-container');
                    
                    if (!container) {
                        console.error('Button container not found');
                        return;
                    }
                    
                    // Move buttons into the container
                    uniqueButtons.forEach(button => {
                        const parent = button.parentNode;
                        // Only move if not already in our container, Vue app, or specific sections
                        if (parent && 
                            parent.id !== 'standalone-buttons-container' &&
                            !parent.classList.contains('button-group-container') && 
                            !parent.classList.contains('actions') && 
                            !parent.classList.contains('action-buttons') &&
                            !button.closest('.app') && 
                            !button.closest('.sidebar')) {
                            
                            // Clone instead of move if it's deeply nested
                            if (button.closest('body > div > div')) {
                                const clone = button.cloneNode(true);
                                // Preserve click handlers by adding data attribute
                                if (button.onclick) {
                                    clone.setAttribute('data-original-id', button.id || Date.now());
                                    clone.onclick = button.onclick;
                                }
                                container.appendChild(clone);
                                // Hide the original if we successfully cloned it
                                button.style.display = 'none';
                            } else {
                                container.appendChild(button);
                            }
                        }
                    });
                    
                    // If we have buttons, position the container appropriately
                    if (container.children.length > 0) {
                        // Position the container after the header in the main content
                        const mainContent = document.querySelector('.main-content');
                        if (mainContent) {
                            const header = mainContent.querySelector('.page-header');
                            // If we can find the header, move the container after it
                            if (header && container.parentNode !== mainContent) {
                                mainContent.insertBefore(container, header.nextSibling);
                            }
                        }
                    }
                }
                
                // Initialize tooltips after organizing buttons
                this.initTooltips();
            }, 1000); // Give more time for dynamic elements to load
        },

        // Method to hide the initial overlay
        hideInitialOverlay() {
            const overlay = document.getElementById('initial-loading-overlay');
            if (overlay) {
                overlay.classList.add('hide');
                // Remove the overlay from the DOM after the transition completes
                setTimeout(() => {
                    overlay.style.display = 'none';
                    // Optional: remove from DOM completely 
                    // overlay.parentNode.removeChild(overlay);
                }, 500);
            }
        },

        async handleLogout() {
            try {
                await signOut();
                window.location.href = '../Login/index.html';
            } catch (error) {
                console.error('Error signing out:', error);
                alert('Error signing out. Please try again.');
            }
        },

        async fetchBookings() {
            try {
                // Create a reference to the 'everlodgebookings' collection using the imported collection function
                const bookingsCollection = collection(db(), 'everlodgebookings');
                
                let allBookings = [];
                let lastDoc = null;
                const batchSize = 500; // Fetch in batches of 500 documents
                
                do {
                    // Create query with ordering and limit
                    let q = query(
                        bookingsCollection, 
                        orderBy('__name__'), // Order by document ID for consistent pagination
                        limit(batchSize)
                    );
                    
                    // If we have a last document, start after it
                    if (lastDoc) {
                        q = query(
                            bookingsCollection,
                            orderBy('__name__'),
                            startAfter(lastDoc),
                            limit(batchSize)
                        );
                    }
                    
                    const snapshot = await getDocs(q);
                    
                    // Break if no more documents
                    if (snapshot.empty) {
                        break;
                    }
                    
                    // Process documents and add to array
                    const batchBookings = snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            ...data,
                            checkIn: data.checkIn?.toDate?.() || data.checkIn,
                            checkOut: data.checkOut?.toDate?.() || data.checkOut
                        };
                    });
                    
                    allBookings = allBookings.concat(batchBookings);
                    
                    // Get the last document for pagination
                    lastDoc = snapshot.docs[snapshot.docs.length - 1];
                    
                    console.log(`Fetched batch: ${batchBookings.length} bookings, Total so far: ${allBookings.length}`);
                    
                } while (lastDoc);
                
                this.bookings = allBookings;
                
                // Initialize filtered bookings with all bookings
                this.filteredBookings = [...this.bookings];
                
                console.log('Fetched all bookings from everlodgebookings collection:', this.bookings.length);
            } catch (error) {
                console.error('Error fetching bookings:', error);
                alert('Error fetching bookings data');
            }
        },

        formatDate(timestamp) {
            if (!timestamp) return 'N/A';
            if (timestamp.toDate) {
                return timestamp.toDate().toLocaleDateString();
            }
            return new Date(timestamp).toLocaleDateString();
        },

        async exportToExcel() {
            try {
                const exportData = this.bookings.map(booking => ({
                    'Booking ID': booking.id,
                    'Guest Name': booking.guestName || 'N/A',
                    'Check In': this.formatDate(booking.checkIn),
                    'Check Out': this.formatDate(booking.checkOut),
                    'Room Type': booking.propertyDetails?.roomType || 'N/A',
                    'Room Number': booking.propertyDetails?.roomNumber || 'N/A',
                    'Total Price': booking.totalPrice || 0,
                    'Status': booking.status || 'N/A'
                }));

                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Bookings');

                const fileName = `bookings_export_${new Date().toISOString().split('T')[0]}.xlsx`;
                XLSX.writeFile(wb, fileName);

                await this.logReportActivity('report_export', 'Exported booking report to Excel');
            } catch (error) {
                console.error('Error exporting data:', error);
                alert('Error exporting data');
                await this.logReportActivity('report_error', `Failed to export report: ${error.message}`);
            }
        },

        async importData(event) {
            try {
                const file = event.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = async (e) => {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    console.log('Imported data:', jsonData);
                    alert('Data imported successfully. Please refresh to see updates.');
                };
                reader.readAsArrayBuffer(file);

                await this.logReportActivity('report_import', 'Imported data from file');
            } catch (error) {
                console.error('Error importing data:', error);
                alert('Error importing data');
                await this.logReportActivity('report_error', `Failed to import data: ${error.message}`);
            }
        },

        // View toggle method
        toggleView() {
            if (this.currentView === 'bookings') {
                this.currentView = 'owner';
                this.logReportActivity('view_change', 'Switched to Owner Reports view');
            } else {
                this.currentView = 'bookings';
                this.logReportActivity('view_change', 'Switched to Booking Reports view');
            }
            
            // Re-initialize tooltips after view change
            this.$nextTick(() => {
                setTimeout(() => {
                    this.initTooltips();
                }, 300);
            });
        },

        // Owner Reports Methods
        showOwnerPinModal() {
            this.showPinModal = true;
            this.ownerPin = '';
            this.pinError = '';
        },

        verifyOwnerPin() {
            // In a real app, this should use a secure verification method
            // For this example, we're using a simple hash comparison
            if (this.ownerPin === '000000') { // Simple PIN for demonstration
                this.showPinModal = false;
                this.ownerReportsVisible = true;
                this.activeTab = 'am';
                this.logReportActivity('owner_reports_access', 'Accessed owner reports section');
            } else {
                this.pinError = 'Invalid PIN. Please try again.';
                this.logReportActivity('owner_reports_access_failed', 'Failed attempt to access owner reports');
            }
        },

        async fetchOwnerReports() {
            try {
                // Create references to the owner reports collections
                const amReportsCollection = collection(db(), 'ownerReportsAM');
                const pmReportsCollection = collection(db(), 'ownerReportsPM');
                
                // Function to fetch all documents with pagination
                const fetchAllReports = async (collection) => {
                    let allReports = [];
                    let lastDoc = null;
                    const batchSize = 500;
                    
                    do {
                        // Create query with ordering and limit
                        let q = query(
                            collection,
                            orderBy('date', 'desc'),
                            limit(batchSize)
                        );
                        
                        // If we have a last document, start after it
                        if (lastDoc) {
                            q = query(
                                collection,
                                orderBy('date', 'desc'),
                                startAfter(lastDoc),
                                limit(batchSize)
                            );
                        }
                        
                        const snapshot = await getDocs(q);
                        
                        // Break if no more documents
                        if (snapshot.empty) {
                            break;
                        }
                        
                        // Process documents and add to array
                        const batchReports = snapshot.docs.map(doc => {
                            const data = doc.data();
                            return {
                                id: doc.id,
                                date: data.date ? this.formatDateForInput(data.date) : '',
                                day: data.day || '',
                                frontdesk: data.frontdesk || '',
                                customers: data.customers || 0,
                                cash: data.cash || 0,
                                gcash: data.gcash || 0,
                                cashOut: data.cashOut || 0
                            };
                        });
                        
                        allReports = allReports.concat(batchReports);
                        
                        // Get the last document for pagination
                        lastDoc = snapshot.docs[snapshot.docs.length - 1];
                        
                    } while (lastDoc);
                    
                    return allReports;
                };
                
                // Fetch all AM and PM reports
                this.amReports = await fetchAllReports(amReportsCollection);
                this.pmReports = await fetchAllReports(pmReportsCollection);
                
                // If no reports exist, add an empty row to each
                if (this.amReports.length === 0) {
                    this.addOwnerReportRow('am');
                }
                
                if (this.pmReports.length === 0) {
                    this.addOwnerReportRow('pm');
                }
                
                // Initialize filtered reports
                this.filterReports();
                
                console.log('Fetched all owner reports:', { 
                    am: this.amReports.length, 
                    pm: this.pmReports.length 
                });
            } catch (error) {
                console.error('Error fetching owner reports:', error);
            }
        },

        formatDateForInput(timestamp) {
            if (!timestamp) return '';
            
            let date;
            if (timestamp.toDate) {
                date = timestamp.toDate();
            } else if (timestamp instanceof Date) {
                date = timestamp;
            } else {
                date = new Date(timestamp);
            }
            
            if (isNaN(date.getTime())) return '';
            
            // Format as YYYY-MM-DD for input[type="date"]
            return date.toISOString().split('T')[0];
        },

        addOwnerReportRow(type = null) {
            console.log('addOwnerReportRow called with type:', type, 'and activeTab:', this.activeTab);
            
            const newRow = {
                date: this.currentReportDate || this.formatDateForInput(new Date()),
                day: this.currentReportDate ? 
                    new Date(this.currentReportDate).toLocaleDateString('en-US', { weekday: 'long' }) : 
                    new Date().toLocaleDateString('en-US', { weekday: 'long' }),
                frontdesk: '',
                customers: 0,
                cash: 0,
                gcash: 0,
                cashOut: 0
            };
            
            // When called from the UI button without parameters, use activeTab
            if (!type) {
                type = this.activeTab;
            }
            
            if (type === 'am') {
                this.amReports.unshift(newRow);
            } else if (type === 'pm') {
                this.pmReports.unshift(newRow);
            }
            
            // Update filtered reports
            this.filterReports();
            
            console.log(`Added new row to ${type} reports`);
        },

        deleteOwnerReportRow(type, index) {
            if (type === 'am') {
                if (this.amReports.length > 1) {
                    this.amReports.splice(index, 1);
                } else {
                    alert('At least one row must remain in the table.');
                }
            } else {
                if (this.pmReports.length > 1) {
                    this.pmReports.splice(index, 1);
                } else {
                    alert('At least one row must remain in the table.');
                }
            }
        },

        async saveOwnerReports() {
            try {
                this.loading = true;
                let savedReportsCount = 0;
                
                // Save AM reports
                for (const report of this.amReports) {
                    // If we have a date filter active, only save reports for that date
                    if (this.currentReportDate && report.date) {
                        const reportDate = new Date(report.date).toDateString();
                        const filterDate = new Date(this.currentReportDate).toDateString();
                        if (reportDate !== filterDate) continue;
                    }
                    
                    const reportData = {
                        ...report,
                        date: report.date ? new Date(report.date) : new Date(),
                        customers: Number(report.customers),
                        cash: Number(report.cash),
                        gcash: Number(report.gcash),
                        cashOut: Number(report.cashOut),
                        updatedAt: Timestamp.now()
                    };
                    
                    if (report.id) {
                        // Update existing report
                        await updateDoc(doc(db(), 'ownerReportsAM', report.id), reportData);
                    } else {
                        // Add new report
                        const docRef = await addDoc(collection(db(), 'ownerReportsAM'), reportData);
                        report.id = docRef.id;
                    }
                    savedReportsCount++;
                }
                
                // Save PM reports
                for (const report of this.pmReports) {
                    // If we have a date filter active, only save reports for that date
                    if (this.currentReportDate && report.date) {
                        const reportDate = new Date(report.date).toDateString();
                        const filterDate = new Date(this.currentReportDate).toDateString();
                        if (reportDate !== filterDate) continue;
                    }
                    
                    const reportData = {
                        ...report,
                        date: report.date ? new Date(report.date) : new Date(),
                        customers: Number(report.customers),
                        cash: Number(report.cash),
                        gcash: Number(report.gcash),
                        cashOut: Number(report.cashOut),
                        updatedAt: Timestamp.now()
                    };
                    
                    if (report.id) {
                        // Update existing report
                        await updateDoc(doc(db(), 'ownerReportsPM', report.id), reportData);
                    } else {
                        // Add new report
                        const docRef = await addDoc(collection(db(), 'ownerReportsPM'), reportData);
                        report.id = docRef.id;
                    }
                    savedReportsCount++;
                }
                
                const reportDateMessage = this.currentReportDate ? 
                    ` for ${new Date(this.currentReportDate).toLocaleDateString()}` : '';
                
                alert(`Owner reports${reportDateMessage} saved successfully! (${savedReportsCount} records updated)`);
                await this.logReportActivity('owner_reports_save', `Saved owner reports data${reportDateMessage}`);
                
                this.loading = false;
            } catch (error) {
                console.error('Error saving owner reports:', error);
                alert('Error saving reports. Please try again.');
                this.loading = false;
            }
        },

        exportOwnerReportsToExcel() {
            try {
                const reportType = this.activeTab === 'am' ? 'AM' : 'PM';
                const reportData = this.activeTab === 'am' ? this.amReports : this.pmReports;
                
                // Format data for export
                const exportData = reportData.map(report => ({
                    'Date': report.date ? new Date(report.date).toLocaleDateString() : 'N/A',
                    'Day': report.day || 'N/A',
                    'Frontdesk': report.frontdesk || 'N/A',
                    'Number of Customers': report.customers || 0,
                    'Cash': report.cash || 0,
                    'GCash': report.gcash || 0,
                    'Cash Out': report.cashOut || 0
                }));
                
                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, `Owner Reports ${reportType}`);
                
                const fileName = `owner_reports_${reportType.toLowerCase()}_${new Date().toISOString().split('T')[0]}.xlsx`;
                XLSX.writeFile(wb, fileName);
                
                this.logReportActivity('owner_reports_export', `Exported ${reportType} owner reports to Excel`);
            } catch (error) {
                console.error('Error exporting owner reports:', error);
                alert('Error exporting data');
            }
        },
        
        async logReportActivity(actionType, details) {
            try {
                const user = auth().currentUser;
                if (!user) return;

                await addDoc(collection(db(), 'activityLogs'), {
                    userId: user.uid,
                    userName: user.email,
                    actionType,
                    details,
                    timestamp: Timestamp.now(),
                    userRole: 'admin',
                    module: 'Reports'
                });
                console.log(`Logged report activity: ${actionType} - ${details}`);
            } catch (error) {
                console.error('Error logging report activity:', error);
            }
        },

        // Pagination methods
        nextPage() {
            if (this.currentPage < this.totalPages) {
                this.currentPage++;
            }
        },
        
        prevPage() {
            if (this.currentPage > 1) {
                this.currentPage--;
            }
        },
        
        // Get the original index in the full array from the paginated index
        getOriginalIndex(type, paginatedIndex) {
            const startIndex = (this.currentPage - 1) * this.rowsPerPage;
            const originalIndex = startIndex + paginatedIndex;
            
            // Get the filtered item
            const filteredArray = type === 'am' ? this.filteredAmReports : this.filteredPmReports;
            const filteredItem = filteredArray[originalIndex];
            
            // Find this item in the original array
            const originalArray = type === 'am' ? this.amReports : this.pmReports;
            return originalArray.findIndex(item => item === filteredItem);
        },
        
        // Filtering methods
        applyDateFilter() {
            this.currentReportDate = this.dateFilter;
            this.filterReports();
            this.currentPage = 1; // Reset to first page when filter changes
        },
        
        clearDateFilter() {
            this.dateFilter = null;
            this.currentReportDate = null;
            this.filterReports();
            this.currentPage = 1;
        },
        
        setDefaultDate() {
            // If no date is selected, default to today's date
            if (!this.dateFilter) {
                this.dateFilter = this.formatDateForInput(new Date());
                this.currentReportDate = this.dateFilter;
                this.filterReports();
            }
        },
        
        filterReports() {
            if (!this.dateFilter) {
                // If no date filter, show all reports
                this.filteredAmReports = [...this.amReports];
                this.filteredPmReports = [...this.pmReports];
                this.currentReportDate = null;
            } else {
                // Apply date filter
                const filterDate = new Date(this.dateFilter);
                this.currentReportDate = this.dateFilter;
                
                // Check if we have reports for this date
                let amReportsForDate = this.amReports.filter(report => {
                    if (!report.date) return false;
                    const reportDate = new Date(report.date);
                    return reportDate.toDateString() === filterDate.toDateString();
                });
                
                let pmReportsForDate = this.pmReports.filter(report => {
                    if (!report.date) return false;
                    const reportDate = new Date(report.date);
                    return reportDate.toDateString() === filterDate.toDateString();
                });
                
                // If no reports exist for this date, create new report rows
                if (amReportsForDate.length === 0) {
                    const newAmRow = {
                        date: this.dateFilter,
                        day: new Date(this.dateFilter).toLocaleDateString('en-US', { weekday: 'long' }),
                        frontdesk: '',
                        customers: 0,
                        cash: 0,
                        gcash: 0,
                        cashOut: 0
                    };
                    this.amReports.unshift(newAmRow);
                    amReportsForDate = [newAmRow];
                }
                
                if (pmReportsForDate.length === 0) {
                    const newPmRow = {
                        date: this.dateFilter,
                        day: new Date(this.dateFilter).toLocaleDateString('en-US', { weekday: 'long' }),
                        frontdesk: '',
                        customers: 0,
                        cash: 0,
                        gcash: 0,
                        cashOut: 0
                    };
                    this.pmReports.unshift(newPmRow);
                    pmReportsForDate = [newPmRow];
                }
                
                this.filteredAmReports = amReportsForDate;
                this.filteredPmReports = pmReportsForDate;
            }
        },
        
        // Booking search and pagination methods
        filterBookings() {
            if (!this.bookingSearchQuery.trim()) {
                this.filteredBookings = [...this.bookings];
            } else {
                const query = this.bookingSearchQuery.toLowerCase().trim();
                this.filteredBookings = this.bookings.filter(booking => {
                    return (
                        (booking.guestName && booking.guestName.toLowerCase().includes(query)) ||
                        (booking.propertyDetails?.roomType && booking.propertyDetails.roomType.toLowerCase().includes(query)) ||
                        (booking.propertyDetails?.roomNumber && booking.propertyDetails.roomNumber.toString().includes(query)) ||
                        (booking.status && booking.status.toLowerCase().includes(query)) ||
                        (booking.id && booking.id.toLowerCase().includes(query))
                    );
                });
            }
            this.currentBookingPage = 1; // Reset to first page when search changes
        },
        
        clearBookingSearch() {
            this.bookingSearchQuery = '';
            this.filterBookings();
        },
        
        // Booking pagination methods
        nextBookingPage() {
            if (this.currentBookingPage < this.totalBookingPages) {
                this.currentBookingPage++;
            }
        },
        
        prevBookingPage() {
            if (this.currentBookingPage > 1) {
                this.currentBookingPage--;
            }
        },
        
        // Row numbering methods
        getBookingRowNumber(index) {
            return (this.currentBookingPage - 1) * this.bookingRowsPerPage + index + 1;
        },
        
        getOwnerReportRowNumber(type, index) {
            return (this.currentPage - 1) * this.rowsPerPage + index + 1;
        },
        
        // Owner report search methods
        filterOwnerReports() {
            if (!this.ownerReportSearchQuery.trim()) {
                // If no search query, apply existing date filter logic
                this.filterReports();
            } else {
                const query = this.ownerReportSearchQuery.toLowerCase().trim();
                
                // First apply date filter if active
                let amData = this.amReports;
                let pmData = this.pmReports;
                
                if (this.currentReportDate) {
                    const filterDate = new Date(this.currentReportDate);
                    amData = this.amReports.filter(report => {
                        if (!report.date) return false;
                        const reportDate = new Date(report.date);
                        return reportDate.toDateString() === filterDate.toDateString();
                    });
                    pmData = this.pmReports.filter(report => {
                        if (!report.date) return false;
                        const reportDate = new Date(report.date);
                        return reportDate.toDateString() === filterDate.toDateString();
                    });
                }
                
                // Then apply search filter
                this.filteredAmReports = amData.filter(report => {
                    return (
                        (report.frontdesk && report.frontdesk.toLowerCase().includes(query)) ||
                        (report.day && report.day.toLowerCase().includes(query)) ||
                        (report.customers && report.customers.toString().includes(query)) ||
                        (report.cash && report.cash.toString().includes(query)) ||
                        (report.gcash && report.gcash.toString().includes(query)) ||
                        (report.cashOut && report.cashOut.toString().includes(query))
                    );
                });
                
                this.filteredPmReports = pmData.filter(report => {
                    return (
                        (report.frontdesk && report.frontdesk.toLowerCase().includes(query)) ||
                        (report.day && report.day.toLowerCase().includes(query)) ||
                        (report.customers && report.customers.toString().includes(query)) ||
                        (report.cash && report.cash.toString().includes(query)) ||
                        (report.gcash && report.gcash.toString().includes(query)) ||
                        (report.cashOut && report.cashOut.toString().includes(query))
                    );
                });
            }
            this.currentPage = 1; // Reset to first page when search changes
        },
        
        clearOwnerReportSearch() {
            this.ownerReportSearchQuery = '';
            this.filterOwnerReports();
        }
    }
});

// Initialize page logging
const authInstance = auth(); // Call auth as a function to get the instance
onAuthStateChanged(authInstance, (user) => {
    if (user) {
        PageLogger.logNavigation('Reports');
    }
});

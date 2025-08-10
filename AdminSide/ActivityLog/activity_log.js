import { 
    auth, 
    db, 
    collection, 
    query, 
    where, 
    getDocs,
    orderBy,
    Timestamp,
    onSnapshot,
    getDoc,
    doc,
    addDoc,
    signOut 
} from '../firebase.js';
import { ActivityLogger, activityLogger } from './activityLogger.js';
import { checkAuthentication } from '../js/auth-check.js';
import { PageLogger } from '../js/pageLogger.js'; // Update import to use PageLogger instead of logPageView
import { roomActivityLogger } from './roomActivityLogger.js';

// Use the existing Firebase instance
// const auth = getAuth(app); // This line is no longer needed

// Add this helper function at the top
async function verifyAdminAuth() {
    const authInstance = auth();
    const user = authInstance.currentUser;
    if (!user) {
        throw new Error('Not authenticated');
    }
    
    const dbInstance = db();
    const userDoc = await getDoc(doc(dbInstance, "users", user.uid));
    if (!userDoc.exists() || userDoc.data().role !== 'admin') {
        throw new Error('Not authorized as admin');
    }
    return true;
}

// Add createActivityLog function at the top
async function createActivityLog(actionType, details, userId = null, userName = null) {
    try {
        const authInstance = auth();
        const user = authInstance.currentUser;
        const logEntry = {
            actionType,
            details,
            timestamp: Timestamp.now(),
            userId: userId || user?.uid || 'system',
            userName: userName || user?.email || 'Unknown User',
            userRole: 'admin' // Since this is admin side
        };

        const dbInstance = db();
        await addDoc(collection(dbInstance, 'activityLogs'), logEntry);
        console.log('Activity logged:', logEntry);
    } catch (error) {
        console.error('Error logging activity:', error);
        throw error; // Propagate error for handling
    }
}

// Move this function to the top level for better visibility
async function checkActivityLogsCollection() {
    console.log('Checking activity logs collection...');
    try {
        // Verify admin authentication first
        await verifyAdminAuth();
        
        const dbInstance = db();
        const logsRef = collection(dbInstance, 'activityLogs');
        const snapshot = await getDocs(logsRef);
        
        // Detailed logging
        const authInstance = auth();
        console.log('Activity Logs Collection Check:', {
            collectionPath: logsRef.path,
            exists: !snapshot.empty,
            count: snapshot.size,
            currentUser: authInstance.currentUser?.uid
        });

        if (snapshot.empty) {
            console.log('No logs found in collection');
        } else {
            snapshot.forEach(doc => {
                console.log('Log entry:', {
                    id: doc.id,
                    timestamp: doc.data().timestamp?.toDate?.(),
                    actionType: doc.data().actionType,
                    userName: doc.data().userName,
                    details: doc.data().details
                });
            });
        }
    } catch (error) {
        console.error('Error checking activity logs collection:', error);
    }
}

// Update Vue instance to use PageLogger
new Vue({
    el: '#app',
    data: {
        isAuthenticated: false,
        currentUser: null
    },
    async created() {
        // Check authentication status only
        const authInstance = auth();
        authInstance.onAuthStateChanged((user) => {
            this.isAuthenticated = !!user;
            this.currentUser = user;
        });
    },
    methods: {
        // async handleLogout() {
        //     try {
        //         await signOut();
        //         window.location.href = '../Login/index.html';
        //     } catch (error) {
        //         console.error('Logout error:', error);
        //     }
        // }
    }
});

// Update the auth state checking to remove duplicate navigation logging
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Activity log page loaded');
    
    const authInstance = auth();
    authInstance.onAuthStateChanged(async (user) => {
        try {
            if (!user) {
                console.log('No user detected, redirecting to login...');
                if (window.currentUnsubscribe) window.currentUnsubscribe();
                window.location.href = '../Login/index.html';
                return;
            }

            // Verify admin status
            const dbInstance = db();
            const userDoc = await getDoc(doc(dbInstance, "users", user.uid));
            if (!userDoc.exists() || userDoc.data().role !== 'admin') {
                console.log('User is not an admin, redirecting...');
                if (window.currentUnsubscribe) window.currentUnsubscribe();
                window.location.href = '../Login/index.html';
                return;
            }

            // Initialize filters
            await setupFilters();

            // Setup real-time listener and store the unsubscribe function
            window.currentUnsubscribe = setupActivityLogListener();

            // Add Apply button event listener
            document.getElementById('applyFiltersBtn')?.addEventListener('click', applyFilters);
            
            // Add clear filters button event listener (already in HTML)
            document.getElementById('clearFiltersBtn')?.addEventListener('click', clearFilters);
            
            // Add Enter key support for date inputs
            document.getElementById('startDateFilter')?.addEventListener('keyup', handleDateInputKeyPress);
            document.getElementById('endDateFilter')?.addEventListener('keyup', handleDateInputKeyPress);
            
            // Add date validation
            setupDateValidation();

        } catch (error) {
            console.error('Error in auth state change:', error);
        }
    });

    // Cleanup on page unload
    window.addEventListener('unload', () => {
        if (window.currentUnsubscribe) window.currentUnsubscribe();
    });

    // Update the action filter options in activity_log.html
    const actionFilter = document.getElementById('actionFilter');
    if (actionFilter) {
        const roomOption = document.createElement('option');
        roomOption.value = 'room_deletion';
        roomOption.textContent = 'Room Deletions';
        actionFilter.appendChild(roomOption);
    }
});

// Handle Enter key on date inputs
function handleDateInputKeyPress(event) {
    if (event.key === 'Enter') {
        applyFilters();
        // Remove focus from the input field
        event.target.blur();
    }
}

// Setup date validation to ensure end date isn't before start date
function setupDateValidation() {
    const startDateInput = document.getElementById('startDateFilter');
    const endDateInput = document.getElementById('endDateFilter');
    
    if (!startDateInput || !endDateInput) return;
    
    // When start date changes, update end date min
    startDateInput.addEventListener('change', function() {
        if (this.value) {
            // Set the min date for the end date input
            endDateInput.min = this.value;
            
            // If end date is before start date, clear it
            if (endDateInput.value && endDateInput.value < this.value) {
                // Option 1: Clear the end date
                // endDateInput.value = '';
                
                // Option 2: Set end date to match start date
                endDateInput.value = this.value;
                
                // Show a tooltip or message
                updateFilterStatus(0, 0, 'End date updated to match start date');
                setTimeout(() => {
                    const visibleCount = parseInt(document.getElementById('filterStatus').getAttribute('data-count') || '0');
                    const totalCount = parseInt(document.getElementById('filterStatus').getAttribute('data-total') || '0');
                    updateFilterStatus(visibleCount, totalCount);
                }, 3000);
            }
        } else {
            // If start date is cleared, remove the min constraint
            endDateInput.removeAttribute('min');
        }
    });
    
    // When end date changes, update start date max
    endDateInput.addEventListener('change', function() {
        if (this.value) {
            // Set the max date for the start date input
            startDateInput.max = this.value;
            
            // If start date is after end date, clear it
            if (startDateInput.value && startDateInput.value > this.value) {
                // Option 1: Clear the start date
                // startDateInput.value = '';
                
                // Option 2: Set start date to match end date
                startDateInput.value = this.value;
                
                // Show a tooltip or message
                updateFilterStatus(0, 0, 'Start date updated to match end date');
                setTimeout(() => {
                    const visibleCount = parseInt(document.getElementById('filterStatus').getAttribute('data-count') || '0');
                    const totalCount = parseInt(document.getElementById('filterStatus').getAttribute('data-total') || '0');
                    updateFilterStatus(visibleCount, totalCount);
                }, 3000);
            }
        } else {
            // If end date is cleared, remove the max constraint
            startDateInput.removeAttribute('max');
        }
    });
}

async function setupFilters() {
    try {
        const userFilter = document.getElementById('userFilter');
        if (!userFilter) {
            console.error('User filter element not found');
            return;
        }

        userFilter.innerHTML = '<option value="">All Users</option>';
        
        const dbInstance = db();
        const usersRef = collection(dbInstance, 'users');
        const usersSnapshot = await getDocs(usersRef);
        
        const sortedUsers = [];
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            sortedUsers.push({
                id: doc.id,
                name: userData.fullname || userData.username || 'Unknown User'
            });
        });

        // Sort users alphabetically
        sortedUsers.sort((a, b) => a.name.localeCompare(b.name));

        sortedUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name;
            userFilter.appendChild(option);
        });

    } catch (error) {
        console.error('Error setting up filters:', error);
        // Show error in UI if needed
        const userFilter = document.getElementById('userFilter');
        if (userFilter) {
            userFilter.innerHTML = '<option value="">Error loading users</option>';
        }
    }
}

// Completely rewrite the setupActivityLogListener function to avoid index requirements
function setupActivityLogListener() {
    try {
        // Get the logs container
        const logsContainer = document.getElementById('activityLogTable');
        if (!logsContainer) {
            console.error('Activity logs container not found');
            return () => {}; // Return empty unsubscribe function
        }
        
        // Show loading state
        logsContainer.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center"><div class="loading-indicator"><div class="spinner"></div><p>Loading activity logs...</p></div></td></tr>';
        
        // Get the loading state element
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.classList.remove('hidden');
        }
        
        // Create a query for the activity logs collection
        const dbInstance = db();
        const logsRef = collection(dbInstance, 'activityLogs');
        const q = query(logsRef, orderBy('timestamp', 'desc'));
        
        // Log debug info
        console.log('Setting up activity log listener with query:', q);
        
        // Set up real-time listener
        return onSnapshot(q, (snapshot) => {
            try {
                // Hide loading state
                if (loadingState) {
                    loadingState.classList.add('hidden');
                }
                
                console.log('Snapshot received, documents count:', snapshot.size);
                
                // Process the activity logs
                const activityLogs = [];
                snapshot.forEach((doc) => {
                    activityLogs.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                console.log('Processed activity logs:', activityLogs.length);

                // Get filter values for in-memory filtering
                const userFilter = document.getElementById('userFilter')?.value || '';
                const actionFilter = document.getElementById('actionFilter')?.value || '';
                const startDateFilter = document.getElementById('startDateFilter')?.value || '';
                const endDateFilter = document.getElementById('endDateFilter')?.value || '';
                
                console.log('Applying filters:', { userFilter, actionFilter, startDateFilter, endDateFilter });
                
                // Apply filters in memory
                let filteredLogs = activityLogs.map(log => {
                    const data = log;
                    const timestampDate = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
                    return {
                        id: data.id,
                        ...data,
                        timestampDate: timestampDate,
                        formattedDate: timestampDate.toISOString().split('T')[0] || ''
                    };
                });
                
                // Debug log to check the conversion of timestamps
                console.log('First log after conversion:', filteredLogs[0] ? {
                    originalTimestamp: filteredLogs[0].timestamp,
                    convertedDate: filteredLogs[0].timestampDate,
                    formattedDate: filteredLogs[0].formattedDate
                } : 'No logs available');
                
                // User filter
                if (userFilter) {
                    filteredLogs = filteredLogs.filter(log => {
                        // Check both userId and userName for more flexibility
                        return (log.userId === userFilter) || (log.userName === userFilter);
                    });
                    console.log('After user filter:', filteredLogs.length);
                }
                
                // Action filter
                if (actionFilter) {
                    filteredLogs = filteredLogs.filter(log => 
                        log.actionType === actionFilter
                    );
                    console.log('After action filter:', filteredLogs.length);
                }
                
                // Date range filter
                if (startDateFilter && endDateFilter) {
                    // Convert string dates to Date objects for comparison
                    const startDate = new Date(startDateFilter);
                    startDate.setHours(0, 0, 0, 0); // Start of day
                    
                    // Set end date to the end of the day
                    const endDate = new Date(endDateFilter);
                    endDate.setHours(23, 59, 59, 999);
                    
                    console.log('Date range filter:', {
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString()
                    });
                    
                    filteredLogs = filteredLogs.filter(log => {
                        const logDate = log.timestampDate;
                        return logDate >= startDate && logDate <= endDate;
                    });
                    console.log('After date range filter:', filteredLogs.length);
                } else if (startDateFilter) {
                    // Only start date is provided
                    const startDate = new Date(startDateFilter);
                    startDate.setHours(0, 0, 0, 0); // Start of day
                    
                    console.log('Start date filter:', startDate.toISOString());
                    
                    filteredLogs = filteredLogs.filter(log => 
                        log.timestampDate >= startDate
                    );
                    console.log('After start date filter:', filteredLogs.length);
                } else if (endDateFilter) {
                    // Only end date is provided
                    const endDate = new Date(endDateFilter);
                    endDate.setHours(23, 59, 59, 999); // End of day
                    
                    console.log('End date filter:', endDate.toISOString());
                    
                    filteredLogs = filteredLogs.filter(log => 
                        log.timestampDate <= endDate
                    );
                    console.log('After end date filter:', filteredLogs.length);
                }
                
                // Sort by timestamp descending (most recent first)
                filteredLogs.sort((a, b) => b.timestampDate - a.timestampDate);
                
                // Log filtered results for debugging
                console.log(`Filtered logs: ${filteredLogs.length} of ${activityLogs.length} total`);
                
                if (filteredLogs.length === 0) {
                    logsContainer.innerHTML = `
                        <tr>
                            <td colspan="4" class="px-6 py-4 text-center text-gray-500">
                                No activity logs match the selected filters
                            </td>
                        </tr>
                    `;
                    return;
                }
                
                // Generate HTML for filtered logs
                const logsHtml = filteredLogs.map(log => {
                    // Enhanced styling for room deletions
                    let actionClass = getActionColor(log.actionType);
                    let actionDetails = log.details || 'No details';

                    // Special handling for room deletions
                    if (log.actionType === 'room_deletion') {
                        actionClass = 'bg-red-100 text-red-800';
                        actionDetails = `🗑️ ${actionDetails}`; // Add deletion icon
                    }

                    return `
                        <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" data-date="${log.formattedDate}">
                                ${log.timestampDate.toLocaleString()}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" data-user="${log.userName || ''}">
                                ${log.userName || 'Unknown User'}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm" data-action="${log.actionType || ''}">
                                <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${actionClass}">
                                    ${(log.actionType || 'UNKNOWN').toUpperCase()}
                                </span>
                            </td>
                            <td class="px-6 py-4 text-sm text-gray-500">
                                ${actionDetails}
                                ${log.module ? `<br><span class="text-xs text-gray-400">(${log.module})</span>` : ''}
                            </td>
                        </tr>
                    `;
                }).join('');
                
                logsContainer.innerHTML = logsHtml;
                
                // Populate user filter if not already set
                if (!userFilter) {
                    populateUserFilter(filteredLogs);
                }
                
                // Update filter status
                updateFilterStatus(filteredLogs.length, activityLogs.length);
            } catch (error) {
                console.error('Error processing activity logs:', error);
                handleError(error, logsContainer, loadingState);
            }
        }, (error) => {
            console.error('Error in activity log listener:', error);
            handleError(error, logsContainer, loadingState);
        });

    } catch (error) {
        console.error('Error setting up activity log listener:', error);
        handleError(error, logsContainer, loadingState);
        return () => {}; // Return empty function as fallback
    }
}

// Add this helper function for error handling
function handleError(error, container, loadingState) {
    loadingState?.classList.add('hidden');
    if (container) {
        container.innerHTML = `
            <tr>
                <td colspan="4" class="px-6 py-4 text-center text-red-500">
                    Error: ${error.message}
                    ${error.code ? `(Code: ${error.code})` : ''} 
                </td>
            </tr>
        `;
    }
}

function createLogRow(log) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';
    
    let timestampStr = 'Invalid Date';
    try {
        const timestamp = log.timestamp instanceof Timestamp 
            ? log.timestamp.toDate() 
            : new Date(log.timestamp);
        
        timestampStr = timestamp.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (e) {
        console.error('Error formatting timestamp:', e, log.timestamp);
    }

    // Enhanced log details display
    const details = log.details || 'No details provided';
    const actionType = log.actionType || 'Unknown Action';
    const userName = log.userName || 'Unknown User';

    row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">${timestampStr}</td>
        <td class="px-6 py-4 whitespace-nowrap">${userName}</td>
        <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionColor(actionType)}">
                ${actionType.toUpperCase()}
            </span>
        </td>
        <td class="px-6 py-4">${details}</td>
    `;
    
    return row;
}

// Update the getActionColor function to include room_deletion
function getActionColor(actionType) {
    const colors = {
        login: 'bg-green-100 text-green-800',
        logout: 'bg-red-100 text-red-800',
        navigation: 'bg-blue-100 text-blue-800',
        booking: 'bg-purple-100 text-purple-800',
        room: 'bg-indigo-100 text-indigo-800',
        room_deletion: 'bg-red-100 text-red-800', 
        room_add: 'bg-green-100 text-green-800',
        room_update: 'bg-yellow-100 text-yellow-800',
        request: 'bg-yellow-100 text-yellow-800'
    };
    return colors[actionType?.toLowerCase()] || 'bg-gray-100 text-gray-800';
}

// Add the action filter dropdown
const actionFilterContainer = document.getElementById('actionFilterContainer');
if (actionFilterContainer) {
    actionFilterContainer.innerHTML = `
        <select id="actionFilter" class="w-full border rounded px-3 py-2">
            <option value="">All Activities</option>
            <option value="login">Logins</option>
            <option value="logout">Logouts</option>
            <option value="navigation">Navigation</option>
            <option value="booking">Booking</option>
            <option value="room">Room Management</option>
            <option value="room_deletion">Room Deletions</option>
            <option value="request">Requests</option>
        </select>
    `;
}

// Add to room_management.js
console.log('Activity logger initialized:', activityLogger);
console.log('Room activity logger initialized:', roomActivityLogger);

// Example of proper usage (only add this if you're testing)
// roomActivityLogger.logRoomDeletion({ 
//   propertyDetails: { 
//     roomNumber: 'Test101', 
//     roomType: 'Standard' 
//   } 
// });

// Filter functions
function applyFilters() {
    try {
        console.log('Applying filters...');
        
        // Update the filter status message to show loading state
        const statusElement = document.getElementById('filterStatus');
        if (statusElement) {
            statusElement.innerHTML = `
                <span class="inline-block mr-2">
                    <i class="fas fa-spinner fa-spin text-blue-500"></i>
                </span>
                <span>Filtering activity logs...</span>
            `;
        }
        
        // Get the current unsubscribe function if it exists
        if (window.currentUnsubscribe && typeof window.currentUnsubscribe === 'function') {
            window.currentUnsubscribe();
        }
        
        // Set up a new listener with the current filters
        window.currentUnsubscribe = setupActivityLogListener();
    } catch (error) {
        console.error('Error applying filters:', error);
        alert('Error applying filters. Please check the console for details.');
    }
}

function clearFilters() {
    try {
        // Reset all filter inputs
        document.getElementById('userFilter').value = '';
        document.getElementById('actionFilter').value = '';
        document.getElementById('startDateFilter').value = '';
        document.getElementById('endDateFilter').value = '';
        
        // Update the filter status
        const statusElement = document.getElementById('filterStatus');
        if (statusElement) {
            statusElement.innerHTML = `
                <span class="inline-block mr-2">
                    <i class="fas fa-info-circle text-blue-500"></i>
                </span>
                <span>Filters cleared. Click Apply to refresh.</span>
            `;
        }
    } catch (error) {
        console.error('Error clearing filters:', error);
    }
}

// Update the updateFilterStatus function to include date range details and custom messages
function updateFilterStatus(visibleCount, totalCount, customMessage = null) {
    // If there's a status element, update it
    const statusElement = document.getElementById('filterStatus');
    if (statusElement) {
        // Store the counts as data attributes for later retrieval
        statusElement.setAttribute('data-count', visibleCount);
        statusElement.setAttribute('data-total', totalCount);
        
        // If we have a custom message, display it
        if (customMessage) {
            statusElement.innerHTML = `
                <span class="inline-block mr-2">
                    <i class="fas fa-info-circle text-blue-500"></i>
                </span>
                <span>${customMessage}</span>
            `;
            return;
        }
        
        let statusText = `Showing ${visibleCount} of ${totalCount} records`;
        
        // Check if date range filters are active
        const startDateFilter = document.getElementById('startDateFilter')?.value;
        const endDateFilter = document.getElementById('endDateFilter')?.value;
        
        if (startDateFilter && endDateFilter) {
            statusText += ` from ${formatDateForDisplay(startDateFilter)} to ${formatDateForDisplay(endDateFilter)}`;
        } else if (startDateFilter) {
            statusText += ` from ${formatDateForDisplay(startDateFilter)}`;
        } else if (endDateFilter) {
            statusText += ` until ${formatDateForDisplay(endDateFilter)}`;
        }
        
        statusElement.innerHTML = `
            <span class="inline-block mr-2">
                <i class="fas fa-info-circle text-blue-500"></i>
            </span>
            <span>${statusText}</span>
        `;
    }
}

// Format date for display in the status message
function formatDateForDisplay(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    } catch (e) {
        return dateString;
    }
}

// Populate user filter with unique users when data is loaded
function populateUserFilter(activityLogs) {
    const userFilter = document.getElementById('userFilter');
    if (!userFilter) return;
    
    // Get unique userNames from the logs
    const users = new Set();
    activityLogs.forEach(log => {
        if (log.userName) {
            users.add(log.userName);
        }
    });
    
    // Keep only the default option
    while (userFilter.options.length > 1) {
        userFilter.remove(1);
    }
    
    // Add user options alphabetically
    [...users].sort().forEach(userName => {
        const option = document.createElement('option');
        option.value = userName;
        option.textContent = userName;
        userFilter.appendChild(option);
    });
}

// Update the existing function that renders activity logs
function renderActivityLogs(logs) {
    // ...existing code...
    
    // Add data attributes for filtering
    tableBody.innerHTML = logs.map(log => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap" data-date="${formatDateForFilter(log.timestamp)}">
                ${formatTimestamp(log.timestamp)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap" data-user="${log.user?.email || ''}">
                ${log.user?.email || 'Unknown User'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap" data-action="${log.action || ''}">
                ${formatAction(log.action)}
            </td>
            <td class="px-6 py-4">
                ${log.details || 'No details provided'}
            </td>
        </tr>
    `).join('');
    
    // Populate user filter after loading data
    populateUserFilter(logs);
    
    // Initialize filter status
    updateFilterStatus();
}

// Helper function to format date for filter
function formatDateForFilter(timestamp) {
    if (!timestamp) return '';
    
    try {
        let date;
        if (timestamp instanceof Timestamp) {
            date = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else if (typeof timestamp === 'object' && timestamp.seconds) {
            // Firebase Timestamp object format
            date = new Date(timestamp.seconds * 1000);
        } else {
            date = new Date(timestamp);
        }
        
        return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
    } catch (error) {
        console.error('Error formatting date for filter:', error);
        return '';
    }
}

// Expose filter functions to global scope for the onclick/onchange handlers
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
// Notification Service for Admin Dashboard
import { db } from '../firebase.js';
import { collection, getDocs, query, orderBy, limit, doc, updateDoc, onSnapshot, writeBatch, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class NotificationService {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.listener = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;
        
        console.log('Initializing notification service...');
        
        try {
            // Set up real-time listener
            await this.setupListener();
            
            // Load existing notifications
            await this.loadNotifications();
            
            // Set up UI handlers
            this.setupUIHandlers();
            
            this.isInitialized = true;
            console.log('Notification service initialized successfully');
        } catch (error) {
            console.error('Error initializing notification service:', error);
        }
    }

    async setupListener() {
        try {
            const notificationsRef = collection(db(), 'notifications');
            const q = query(notificationsRef, orderBy('createdAt', 'desc'));
            
            this.listener = onSnapshot(q, (snapshot) => {
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
                
                // Check for new notifications
                const existingIds = this.notifications.map(n => n.id);
                const brandNewNotifications = newNotifications.filter(n => !existingIds.includes(n.id));
                
                if (brandNewNotifications.length > 0) {
                    console.log('Found new notifications:', brandNewNotifications.length);
                    this.animateBell();
                }
                
                this.notifications = newNotifications;
                this.updateUnreadCount();
                this.updateBadge();
            }, (error) => {
                console.error('Error in notification listener:', error);
            });
            
        } catch (error) {
            console.error('Error setting up notification listener:', error);
        }
    }

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
            this.updateBadge();
            console.log('Loaded notifications:', this.notifications.length);
            
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    setupUIHandlers() {
        const bellBtn = document.getElementById('notificationBell');
        const dropdown = document.getElementById('notificationDropdown');
        const markAllReadBtn = document.getElementById('markAllReadBtn');
        const closeModalBtns = document.querySelectorAll('#closeNotificationModal, #closeNotificationModalBtn');

        if (bellBtn && dropdown) {
            bellBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
                    this.closeDropdown();
                }
            });
        }

        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => {
                this.markAllAsRead();
            });
        }

        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal();
            });
        });
    }

    toggleDropdown() {
        const dropdown = document.getElementById('notificationDropdown');
        if (dropdown) {
            const isHidden = dropdown.classList.contains('hidden');
            if (isHidden) {
                dropdown.classList.remove('hidden');
                this.renderNotifications();
            } else {
                dropdown.classList.add('hidden');
            }
        }
    }

    closeDropdown() {
        const dropdown = document.getElementById('notificationDropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
        }
    }

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
    }

    createNotificationElement(notification) {
        const element = document.createElement('div');
        element.className = `notification-item ${notification.read ? '' : 'unread'}`;
        element.setAttribute('data-notification-id', notification.id);
        
        const timeAgo = this.getTimeAgo(notification.createdAt);
        const iconClass = this.getIconClass(notification.type);
        
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
    }

    getIconClass(type) {
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
    }

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
    }

    async handleNotificationClick(notification) {
        // Mark as read
        if (!notification.read) {
            await this.markAsRead(notification.id);
        }
        
        // Close dropdown
        this.closeDropdown();
        
        // Show modal
        await this.showModal(notification);
    }

    async showModal(notification) {
        const modal = document.getElementById('notificationModal');
        const modalContent = document.getElementById('notificationModalContent');
        
        if (!modal || !modalContent) return;
        
        // Get booking details if available
        let bookingDetails = null;
        if (notification.bookingId) {
            bookingDetails = await this.getBookingDetails(notification.bookingId);
        }
        
        // Populate modal
        modalContent.innerHTML = this.generateModalContent(notification, bookingDetails);
        
        // Show modal
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        // Set up view full booking button
        const viewFullBookingBtn = document.getElementById('viewFullBookingBtn');
        if (viewFullBookingBtn && notification.bookingId) {
            viewFullBookingBtn.onclick = () => {
                this.closeModal();
                window.location.href = `#booking-${notification.bookingId}`;
            };
        }
    }

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
    }

    formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        
        try {
            let date;
            if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
                // Firebase Timestamp
                date = new Date(timestamp.seconds * 1000);
            } else if (timestamp instanceof Date) {
                date = timestamp;
            } else if (typeof timestamp === 'string') {
                date = new Date(timestamp);
            } else {
                return 'N/A';
            }
            
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'N/A';
        }
    }

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
    }

    closeModal() {
        const modal = document.getElementById('notificationModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    async markAsRead(notificationId) {
        try {
            const notificationRef = doc(db(), 'notifications', notificationId);
            await updateDoc(notificationRef, { read: true });
            
            // Update local state
            const notification = this.notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.read = true;
                this.updateUnreadCount();
                this.updateBadge();
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    async markAllAsRead() {
        try {
            const unreadNotifications = this.notifications.filter(n => !n.read);
            
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
            this.updateBadge();
            this.renderNotifications();
            
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }

    updateUnreadCount() {
        this.unreadCount = this.notifications.filter(n => !n.read).length;
    }

    updateBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    }

    animateBell() {
        const bell = document.getElementById('notificationBell');
        if (bell) {
            bell.classList.add('animate-pulse');
            setTimeout(() => {
                bell.classList.remove('animate-pulse');
            }, 2000);
        }
    }

    destroy() {
        if (this.listener) {
            this.listener();
            this.listener = null;
        }
        this.isInitialized = false;
    }
}

// Create and export instance
const notificationService = new NotificationService();
export default notificationService; 
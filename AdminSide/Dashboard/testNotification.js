// Test script for notification system
import { db } from '../firebase.js';
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Function to create a test notification
export async function createTestNotification() {
    try {
        const testNotification = {
            type: 'booking',
            title: 'Test Booking Notification',
            message: 'This is a test notification for a new booking from John Doe for Dec 25, 2024 - Dec 28, 2024',
            bookingId: 'test-booking-123',
            userId: 'test-user-123',
            userEmail: 'test@example.com',
            guestName: 'John Doe',
            checkIn: 'Dec 25, 2024',
            checkOut: 'Dec 28, 2024',
            totalPrice: 3900,
            roomNumber: '101',
            read: false,
            createdAt: Timestamp.now(),
            priority: 'high'
        };

        const notificationsRef = collection(db(), 'notifications');
        const docRef = await addDoc(notificationsRef, testNotification);
        
        console.log('Test notification created with ID:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error creating test notification:', error);
        throw error;
    }
}

// Make the function available globally for testing
window.createTestNotification = createTestNotification; 
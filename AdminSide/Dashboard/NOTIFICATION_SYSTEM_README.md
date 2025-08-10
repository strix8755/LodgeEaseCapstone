# LodgeEase Notification System

## Overview

The LodgeEase Notification System provides real-time notifications to administrators when new bookings are made from the client side. It features a Facebook-style notification interface with:

- Real-time notification updates
- Notification badge with unread count
- Dropdown list of notifications
- Detailed modal views for booking information
- Mark as read functionality

## How It Works

### 1. Client Side (Booking Creation)
When a booking is successfully created in the payment process (`pay.js`), the system automatically:
- Creates a booking record in the `everlodgebookings` collection
- Calls `createBookingNotification()` to create a notification in the `notifications` collection
- The notification includes booking details like guest name, dates, room, and total price

### 2. Admin Dashboard (Real-time Updates)
The admin dashboard (`Dashboard.html`) automatically:
- Loads the notification service on page load
- Sets up a real-time listener for new notifications
- Updates the notification bell icon with unread count
- Displays notifications in a dropdown when clicked
- Shows detailed booking information in a modal

## Components

### Files Added/Modified:

1. **Dashboard.html** - Added notification bell icon, dropdown, and modal
2. **styles.css** - Added notification-specific CSS styles
3. **notificationService.js** - Main notification service class
4. **pay.js** - Added `createBookingNotification()` function
5. **testNotification.js** - Test utility for creating sample notifications

### Database Collections:

- **notifications** - Stores all notification records
- **everlodgebookings** - Stores booking records (existing)

## Notification Data Structure

Each notification document contains:
```javascript
{
    type: 'booking',           // notification type
    title: 'New Booking Received',
    message: 'Booking details...',
    bookingId: 'booking-123',  // reference to booking
    userId: 'user-123',        // user who made booking
    userEmail: 'user@email.com',
    guestName: 'John Doe',
    checkIn: '2024-12-25',
    checkOut: '2024-12-28',
    totalPrice: 3900,
    roomNumber: '101',
    read: false,               // read status
    createdAt: Timestamp,      // creation time
    priority: 'high'           // notification priority
}
```

## Features

### Real-time Updates
- Uses Firestore's `onSnapshot` for real-time notification updates
- Automatically animates the bell icon when new notifications arrive
- Updates notification badge count in real-time

### Interactive UI
- Click bell icon to open/close notification dropdown
- Click notification item to mark as read and view details
- "Mark all as read" button to clear all unread notifications
- Detailed modal showing full booking information

### Responsive Design
- Works on desktop and mobile devices
- Dropdown adjusts position on smaller screens
- Modal is responsive and scrollable

## Testing

### Create Test Notification
To test the notification system:

1. Open browser console in the admin dashboard
2. Run: `createTestNotification()`
3. A test notification will appear in the notification dropdown

### Manual Testing Flow
1. Make a booking from the client side (lodge pages)
2. Complete the payment process
3. Check the admin dashboard for the new notification
4. Click the notification bell to see the notification
5. Click the notification to view details

## Customization

### Adding New Notification Types
To add new notification types (e.g., payment, cancellation):

1. Add new type to `getIconClass()` in `notificationService.js`
2. Create corresponding CSS styles in `styles.css`
3. Add notification creation logic in the appropriate client-side files

### Styling
All notification styles are in `styles.css` under the "Notification System Styles" section. You can customize:
- Colors and gradients
- Animation effects
- Responsive breakpoints
- Badge appearance

## Browser Notifications (Optional)
The system also supports browser notifications if the user grants permission. This will show native OS notifications when new bookings arrive.

## Error Handling
- Graceful fallbacks if notification creation fails
- Console logging for debugging
- Non-blocking: booking process continues even if notification fails

## Future Enhancements

Possible improvements:
- Email notifications
- SMS notifications
- Notification preferences
- Notification history page
- Push notifications for mobile
- Sound alerts
- Different notification priorities with different colors 
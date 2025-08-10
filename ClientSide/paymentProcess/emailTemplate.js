export function generateEmailTemplate(bookingDetails) {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #2563eb;">Booking Confirmation</h1>
            <p>Dear Guest,</p>
            <p>Your booking has been confirmed. Here are your booking details:</p>
            
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Booking ID:</strong> ${bookingDetails.bookingId}</p>
                <p><strong>Check-in:</strong> ${new Date(bookingDetails.checkIn).toLocaleDateString()}</p>
                <p><strong>Check-out:</strong> ${new Date(bookingDetails.checkOut).toLocaleDateString()}</p>
                <p><strong>Number of Guests:</strong> ${bookingDetails.guests}</p>
                <p><strong>Number of Nights:</strong> ${bookingDetails.numberOfNights}</p>
                <p><strong>Total Amount:</strong> ₱${bookingDetails.totalPrice.toLocaleString()}</p>
                
                <div style="margin-top: 20px;">
                    <h3 style="color: #2563eb;">Property Details</h3>
                    <p><strong>Name:</strong> ${bookingDetails.propertyDetails.name}</p>
                    <p><strong>Location:</strong> ${bookingDetails.propertyDetails.location}</p>
                    <p><strong>Room Type:</strong> ${bookingDetails.propertyDetails.roomType}</p>
                    <p><strong>Room Number:</strong> ${bookingDetails.propertyDetails.roomNumber}</p>
                </div>
            </div>
            
            <p>Thank you for choosing LodgeEase!</p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
        </div>
    `;
}

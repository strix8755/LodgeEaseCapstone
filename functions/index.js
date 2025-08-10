const functions = require('firebase-functions');
const nodemailer = require('nodemailer');

// Create Gmail transporter with specific settings
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'strix8755@gmail.com',
        pass: 'dbgg hghi xqhi gohy'  // App password from Gmail
    },
    tls: {
        // do not fail on invalid certs
        rejectUnauthorized: false
    },
    debug: true
});

exports.sendBookingConfirmation = functions.region('us-central1').https.onCall(async (data) => {
    // Log the start of the function
    console.log('Function started with data:', JSON.stringify(data));

    try {
        // Test SMTP connection first
        await new Promise((resolve, reject) => {
            transporter.verify(function (error, success) {
                if (error) {
                    console.error('SMTP verification failed:', error);
                    reject(error);
                } else {
                    console.log('Server is ready to take our messages');
                    resolve(success);
                }
            });
        });

        // Send the email
        const info = await transporter.sendMail({
            from: '"LodgeEase" <strix8755@gmail.com>',
            to: data.email,
            subject: 'Booking Confirmation',
            text: `Your booking (${data.bookingId}) is confirmed`,
            html: `<p>Your booking (${data.bookingId}) is confirmed</p>`
        });

        console.log('Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email error:', error);
        // Return error instead of throwing
        return { success: false, error: error.message };
    }
});

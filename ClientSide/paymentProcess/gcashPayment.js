import { PayMongoClient } from './paymongoClient.js';

export class GCashPayment {
    constructor(amount) {
        this.amount = amount;
        this.paymongoClient = new PayMongoClient();
    }

    async processPayment(userData) {
        try {
            // Create PayMongo source for GCash
            const sourceResponse = await this.paymongoClient.createSource(this.amount, {
                name: userData.name,
                phone: userData.phone,
                email: userData.email
            });

            // Get the checkout URL from the response
            const checkoutUrl = sourceResponse.data.attributes.redirect.checkout_url;

            // Open GCash checkout in new window
            const checkoutWindow = window.open(checkoutUrl, '_blank');

            // Return payment details
            return {
                success: true,
                sourceId: sourceResponse.data.id,
                checkoutUrl: checkoutUrl,
                timestamp: new Date().toISOString(),
                amount: this.amount
            };
        } catch (error) {
            console.error('GCash payment failed:', error);
            throw new Error('GCash payment failed: ' + error.message);
        }
    }

    async verifyPayment(sourceId) {
        try {
            const paymentStatus = await this.paymongoClient.retrievePayment(sourceId);
            return paymentStatus.data.attributes.status === 'paid';
        } catch (error) {
            console.error('Payment verification failed:', error);
            return false;
        }
    }
}

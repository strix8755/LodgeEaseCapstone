import { PAYMONGO_CONFIG } from '../config/paymongoConfig.js';

export class PayMongoClient {
    constructor() {
        this.baseUrl = PAYMONGO_CONFIG.apiUrl;
        this.publicKey = PAYMONGO_CONFIG.publicKey;
    }

    async createSource(amount, data) {
        try {
            const response = await fetch(`${this.baseUrl}/sources`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${btoa(this.publicKey)}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: {
                        attributes: {
                            amount: amount * 100, // Convert to cents
                            currency: 'PHP',
                            type: 'gcash',
                            redirect: {
                                success: `${window.location.origin}/success`,
                                failed: `${window.location.origin}/failed`
                            },
                            billing: {
                                name: data.name,
                                phone: data.phone,
                                email: data.email
                            }
                        }
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create payment source');
            }

            return await response.json();
        } catch (error) {
            console.error('PayMongo API Error:', error);
            throw error;
        }
    }

    async retrievePayment(paymentId) {
        try {
            const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
                headers: {
                    'Authorization': `Basic ${btoa(this.publicKey)}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to retrieve payment');
            }

            return await response.json();
        } catch (error) {
            console.error('PayMongo API Error:', error);
            throw error;
        }
    }
}

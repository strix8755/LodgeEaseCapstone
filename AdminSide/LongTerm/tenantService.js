import { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc, Timestamp, orderBy, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth } from '../firebase.js';

/**
 * Service for managing tenants in Firebase
 */
export class TenantService {
    constructor(db) {
        this.db = db;
        this.tenantsCollection = 'tenants';
        this.paymentsCollection = 'payments';
        this.roomsCollection = 'rooms';
        this.totalLongTermRooms = 30; // Default total long-term rooms
    }

    /**
     * Get all long-term tenants
     */
    async getAllTenants() {
        try {
            const q = query(
                collection(this.db, this.tenantsCollection),
                where('isLongTerm', '==', true)
            );
            
            const snapshot = await getDocs(q);
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error fetching tenants:', error);
            throw error;
        }
    }

    /**
     * Get a tenant by ID
     */
    async getTenantById(tenantId) {
        try {
            const docRef = doc(this.db, this.tenantsCollection, tenantId);
            const snapshot = await getDoc(docRef);
            
            if (!snapshot.exists()) {
                throw new Error('Tenant not found');
            }
            
            return {
                id: snapshot.id,
                ...snapshot.data()
            };
        } catch (error) {
            console.error('Error fetching tenant:', error);
            throw error;
        }
    }

    /**
     * Add a new tenant
     */
    async addTenant(tenantData) {
        try {
            // Make sure required fields are present
            const requiredFields = ['name', 'email', 'roomNumber', 'monthlyRent', 'startDate', 'endDate'];
            
            for (const field of requiredFields) {
                if (!tenantData[field]) {
                    throw new Error(`${field} is required`);
                }
            }
            
            // Format dates as Timestamps
            const formattedData = {
                ...tenantData,
                startDate: Timestamp.fromDate(new Date(tenantData.startDate)),
                endDate: Timestamp.fromDate(new Date(tenantData.endDate)),
                dueDate: tenantData.dueDate ? Timestamp.fromDate(new Date(tenantData.dueDate)) : null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                isLongTerm: true,
                status: 'active'
            };
            
            // Add to Firestore
            const docRef = await addDoc(collection(this.db, this.tenantsCollection), formattedData);
            
            // Log activity
            await this.logActivity('add_tenant', `Added tenant ${tenantData.name} in room ${tenantData.roomNumber}`);
            
            return docRef.id;
        } catch (error) {
            console.error('Error adding tenant:', error);
            throw error;
        }
    }

    /**
     * Update an existing tenant
     */
    async updateTenant(tenantId, tenantData) {
        try {
            const tenantRef = doc(this.db, this.tenantsCollection, tenantId);
            
            // Format dates as Timestamps
            const formattedData = {
                ...tenantData,
                startDate: tenantData.startDate ? Timestamp.fromDate(new Date(tenantData.startDate)) : null,
                endDate: tenantData.endDate ? Timestamp.fromDate(new Date(tenantData.endDate)) : null,
                dueDate: tenantData.dueDate ? Timestamp.fromDate(new Date(tenantData.dueDate)) : null,
                updatedAt: serverTimestamp(),
                isLongTerm: true
            };
            
            await updateDoc(tenantRef, formattedData);
            
            // Log activity
            await this.logActivity('update_tenant', `Updated tenant ${tenantData.name} in room ${tenantData.roomNumber}`);
            
            return tenantId;
        } catch (error) {
            console.error('Error updating tenant:', error);
            throw error;
        }
    }

    /**
     * Record a payment for a tenant
     */
    async recordPayment(paymentData) {
        try {
            // Get tenant to update payment status
            const tenantRef = doc(this.db, this.tenantsCollection, paymentData.tenantId);
            const tenantSnapshot = await getDoc(tenantRef);
            
            if (!tenantSnapshot.exists()) {
                throw new Error('Tenant not found');
            }
            
            const tenant = tenantSnapshot.data();
            
            // Create payment record
            const paymentRecord = {
                tenantId: paymentData.tenantId,
                amount: paymentData.amount,
                date: Timestamp.fromDate(new Date(paymentData.date)),
                method: paymentData.method,
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser ? auth.currentUser.uid : 'system'
            };
            
            // Add payment record to payments collection
            const paymentRef = await addDoc(collection(this.db, this.paymentsCollection), paymentRecord);
            
            // Update tenant's payment status
            await updateDoc(tenantRef, {
                paymentStatus: 'Paid',
                lastPaymentDate: Timestamp.fromDate(new Date(paymentData.date)),
                lastPaymentAmount: paymentData.amount,
                updatedAt: serverTimestamp()
            });
            
            // Calculate next due date (first of next month)
            const nextDueDate = new Date(paymentData.date);
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
            nextDueDate.setDate(1);
            
            // Update due date for next month
            await updateDoc(tenantRef, {
                dueDate: Timestamp.fromDate(nextDueDate)
            });
            
            // Log activity
            await this.logActivity(
                'record_payment', 
                `Recorded payment of ₱${paymentData.amount} for tenant ${tenant.name} in room ${tenant.roomNumber}`
            );
            
            return paymentRef.id;
        } catch (error) {
            console.error('Error recording payment:', error);
            throw error;
        }
    }

    /**
     * Get payment history for a tenant
     */
    async getPaymentHistory(tenantId) {
        try {
            const q = query(
                collection(this.db, this.paymentsCollection),
                where('tenantId', '==', tenantId),
                orderBy('date', 'desc')
            );
            
            const snapshot = await getDocs(q);
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error fetching payment history:', error);
            throw error;
        }
    }

    /**
     * Terminate a tenant's contract
     */
    async terminateContract(tenantId) {
        try {
            const tenantRef = doc(this.db, this.tenantsCollection, tenantId);
            const tenantSnapshot = await getDoc(tenantRef);
            
            if (!tenantSnapshot.exists()) {
                throw new Error('Tenant not found');
            }
            
            const tenant = tenantSnapshot.data();
            
            // Update tenant status
            await updateDoc(tenantRef, {
                status: 'terminated',
                terminatedAt: serverTimestamp(),
                terminatedBy: auth.currentUser ? auth.currentUser.uid : 'system',
                updatedAt: serverTimestamp()
            });
            
            // Log activity
            await this.logActivity(
                'terminate_contract', 
                `Terminated contract for tenant ${tenant.name} in room ${tenant.roomNumber}`
            );
            
            return true;
        } catch (error) {
            console.error('Error terminating contract:', error);
            throw error;
        }
    }

    /**
     * Get analytics data for charts
     */
    async getTenantAnalytics() {
        try {
            // Get all tenants
            const tenants = await this.getAllTenants();
            
            // Get all payments
            const paymentsSnapshot = await getDocs(collection(this.db, this.paymentsCollection));
            const payments = paymentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Generate monthly data for the past 6 months
            const months = [];
            const revenue = [];
            const occupancyRate = [];
            
            // Get last 6 months
            for (let i = 5; i >= 0; i--) {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                
                const month = date.toLocaleString('default', { month: 'short' });
                const year = date.getFullYear();
                months.push(`${month} ${year}`);
                
                // Calculate revenue for this month
                const monthRevenue = payments
                    .filter(payment => {
                        const paymentDate = payment.date.toDate();
                        return paymentDate.getMonth() === date.getMonth() && 
                               paymentDate.getFullYear() === date.getFullYear();
                    })
                    .reduce((sum, payment) => sum + payment.amount, 0);
                
                revenue.push(monthRevenue);
                
                // Calculate occupancy for this month
                const activeTenantsInMonth = tenants.filter(tenant => {
                    const startDate = tenant.startDate.toDate();
                    const endDate = tenant.endDate.toDate();
                    
                    // Check if tenant was active during this month
                    return startDate <= date && endDate >= date;
                }).length;
                
                const occupancyRateForMonth = Math.round((activeTenantsInMonth / this.getTotalLongTermRooms()) * 100);
                occupancyRate.push(occupancyRateForMonth);
            }
            
            return {
                months,
                revenue,
                occupancyRate
            };
        } catch (error) {
            console.error('Error generating analytics:', error);
            throw error;
        }
    }

    /**
     * Get total number of rooms available for long-term stays
     */
    getTotalLongTermRooms() {
        return this.totalLongTermRooms;
    }

    /**
     * Log activity for auditing
     */
    async logActivity(actionType, details) {
        try {
            const user = auth.currentUser;
            
            const activityData = {
                actionType,
                details,
                timestamp: serverTimestamp(),
                userId: user ? user.uid : 'system',
                userName: user ? user.email : 'System',
                module: 'Long-term Management'
            };
            
            await addDoc(collection(this.db, 'activityLogs'), activityData);
        } catch (error) {
            console.error('Error logging activity:', error);
            // Don't throw error - logging should not disrupt main functionality
        }
    }
}

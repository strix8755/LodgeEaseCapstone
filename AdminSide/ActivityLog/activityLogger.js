import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp, 
    query, 
    orderBy, 
    limit, 
    getDocs 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { db, auth } from '../firebase.js';

export class ActivityLogger {
    constructor() {
        // Use the existing db instance from firebase.js
        this.db = db;
        this.auth = auth;
    }

    async logActivity(actionType, description, module = '') {
        try {
            const authInstance = this.auth();
            const user = authInstance.currentUser;
            if (!user) {
                console.warn('Activity logging skipped: User not authenticated');
                return null;
            }

            const activityData = {
                timestamp: serverTimestamp(),
                userId: user.uid,
                userEmail: user.email,
                userName: user.email,
                actionType: actionType,
                details: description,
                module: module,
                createdAt: serverTimestamp()
            };

            try {
                const dbInstance = this.db();
                const docRef = await addDoc(collection(dbInstance, 'activityLogs'), activityData);
                console.log('Activity logged successfully:', {
                    docId: docRef.id,
                    actionType,
                    details: description
                });
                return docRef;
            } catch (firestoreError) {
                console.warn('Could not log activity to Firestore:', firestoreError.message);
                return null;
            }
        } catch (error) {
            console.warn('Error logging activity:', error.message);
            return null;
        }
    }

    // Specific method for room deletions
    async logRoomDeletion(roomDetails, module = 'Room Management') {
        return this.logActivity('room_deletion', `Room deleted: ${roomDetails}`, module);
    }
}

// Create and export singleton instance
export const activityLogger = new ActivityLogger();

// Export the logActivity function with error handling
export const logActivity = async (actionType, description) => {
    try {
        return await activityLogger.logActivity(actionType, description);
    } catch (error) {
        console.warn('Failed to log activity:', error.message);
        return null;
    }
};

// Add default export
export default ActivityLogger;
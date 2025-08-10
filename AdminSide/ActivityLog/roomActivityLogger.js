import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db, auth } from '../firebase.js';
import { ActivityLogger } from './activityLogger.js';

/**
 * Room Activity Logger
 * 
 * Specialized logger for room management activities that ensures
 * consistent logging for room-related operations.
 */
export class RoomActivityLogger {
    constructor() {
        this.db = db;
        this.auth = auth;
        this.activityLogger = new ActivityLogger();
    }

    /**
     * Log a room-related activity
     * @param {string} actionType - Type of action (e.g., 'room_add', 'room_deletion', 'room_update')
     * @param {string} description - Description of the activity
     * @param {object} roomData - Optional room data object for detailed logging
     * @returns {Promise<object>} - The created document reference
     */
    async logRoomActivity(actionType, description, roomData = null) {
        try {
            const authInstance = this.auth();
            const user = authInstance.currentUser;
            if (!user) {
                console.warn('User not authenticated, activity will be logged as system');
            }

            // Create a simplified version of room details for logging
            let roomDetails = 'No room data provided';
            if (roomData) {
                const { roomNumber, roomType, name, location } = 
                    roomData.propertyDetails || roomData;
                roomDetails = `${roomNumber || 'Room'} (${roomType || 'Unknown type'}) at ${name || location || 'Unknown location'}`;
            }

            // Create activity data
            const activityData = {
                timestamp: serverTimestamp(),
                userId: user?.uid || 'system',
                userEmail: user?.email || 'system',
                userName: user?.email || 'System',
                actionType: actionType,
                details: description,
                module: 'Room Management',
                roomDetails: roomDetails,
                createdAt: serverTimestamp()
            };

            // Log to Firestore
            const dbInstance = this.db();
            const docRef = await addDoc(collection(dbInstance, 'activityLogs'), activityData);
            console.log('Room activity logged successfully:', {
                docId: docRef.id,
                actionType,
                description,
                roomDetails
            });
            return docRef;
        } catch (error) {
            console.error('Error logging room activity:', error);
            throw error;
        }
    }

    // Convenience methods for common room operations
    async logRoomAddition(roomData) {
        return this.logRoomActivity(
            'room_add', 
            `Room added: ${roomData?.propertyDetails?.roomNumber || 'Unknown room'}`, 
            roomData
        );
    }

    async logRoomDeletion(roomData) {
        return this.logRoomActivity(
            'room_deletion', 
            `Room deleted: ${roomData?.propertyDetails?.roomNumber || 'Unknown room'}`, 
            roomData
        );
    }

    async logRoomUpdate(roomData, changes) {
        return this.logRoomActivity(
            'room_update', 
            `Room updated: ${roomData?.propertyDetails?.roomNumber || 'Unknown room'} - ${changes || 'No details'}`, 
            roomData
        );
    }

    async logRoomStatusChange(roomData, oldStatus, newStatus) {
        return this.logRoomActivity(
            'room_update', 
            `Room status changed: ${roomData?.propertyDetails?.roomNumber || 'Unknown room'} from ${oldStatus} to ${newStatus}`, 
            roomData
        );
    }
}

// Create and export singleton instance
export const roomActivityLogger = new RoomActivityLogger();

// Export the logRoomActivity function for direct usage
export const logRoomActivity = (actionType, description, roomData) => {
    return roomActivityLogger.logRoomActivity(actionType, description, roomData);
};

// Export default for ESM
export default RoomActivityLogger;

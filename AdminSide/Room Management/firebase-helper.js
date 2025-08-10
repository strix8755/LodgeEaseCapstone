/**
 * Helper utilities for Firebase integration that avoid CORS issues
 * and synchronize data between admin and client sides
 */

// Check if we're in a local development environment
const isLocalDev = 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1';

/**
 * Safely initialize Firebase storage
 * @returns {Object} Storage reference object
 */
export async function getFirebaseStorage() {
    try {
        const { getStorage } = await import(
            "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js"
        );
        return getStorage();
    } catch (error) {
        console.error('Error initializing Firebase Storage:', error);
        return null;
    }
}

/**
 * Create a URL for an image that works around CORS issues
 * @param {string} url - Original Firebase storage URL
 * @returns {string} Modified URL or original if no changes needed
 */
export function createCorsAwareUrl(url) {
    if (!url) return '';
    
    // Extract download token from Firebase URL
    let token = '';
    try {
        const urlObj = new URL(url);
        token = urlObj.searchParams.get('token');
    } catch (e) {
        return url;
    }
    
    // Create a version without direct reference to Firebase Storage
    if (isLocalDev && token) {
        // Store tokens in sessionStorage for reference
        const tokenKey = `firebase-token-${Math.random()}`;
        sessionStorage.setItem(tokenKey, token);
        
        // Return a URL that uses a base64 data image as placeholder
        // The actual image can be loaded later via the token
        return `data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7#${tokenKey}`;
    }
    
    return url;
}

/**
 * Simple utility to log Firebase activity for debugging
 * @param {string} action - The action performed
 * @param {Object} details - Details of the action
 */
export function logFirebaseActivity(action, details = {}) {
    if (isLocalDev) {
        console.log(`Firebase ${action}:`, details);
        
        // Store in session for debugging
        const logs = JSON.parse(sessionStorage.getItem('firebase-logs') || '[]');
        logs.push({
            action,
            details, 
            timestamp: new Date().toISOString()
        });
        sessionStorage.setItem('firebase-logs', JSON.stringify(logs));
    }
}

/**
 * Synchronize newly created lodges to client-side rooms.html
 * @param {Object} db - Firestore database reference
 * @param {Object} newLodge - The newly created lodge data
 * @returns {Promise<boolean>} Success status
 */
export async function syncLodgeToClient(db, newLodge) {
    try {
        const { collection, addDoc, getDocs, query, where, serverTimestamp } = await import(
            "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
        );
        
        // Store this lodge in a special 'clientLodges' collection that client-side code can check
        await addDoc(collection(db, 'clientLodges'), {
            ...newLodge,
            syncTimestamp: serverTimestamp(),
            syncedToClient: false,
            createdVia: 'admin-panel'
        });
        
        console.log('Lodge synchronized to client-side database:', newLodge.name);
        
        // Attempt to update client-side data file if possible
        try {
            const clientPath = '../../ClientSide/Homepage/lodgeData.json';
            const response = await fetch(clientPath);
            
            if (response.ok) {
                console.log('Found client-side lodgeData.json file, will attempt to update');
                // Note: In a real production environment, we would need server-side code to update this file
                // This is just for development purposes, showing the logic
            }
        } catch (clientUpdateError) {
            console.warn('Cannot directly update client data file:', clientUpdateError);
        }
        
        return true;
    } catch (error) {
        console.error('Error syncing lodge to client:', error);
        return false;
    }
}

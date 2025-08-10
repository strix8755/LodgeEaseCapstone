/**
 * Module to track deleted HTML-based lodges across sessions
 * Since we cannot actually delete HTML files, we need a way to remember 
 * which lodges have been "deleted" by the user so they don't reappear on refresh.
 */

const DELETED_LODGES_KEY = 'lodgeease_deleted_html_lodges';

/**
 * Add a lodge to the deleted lodges list
 * @param {Object} lodge - The lodge to mark as deleted
 * @returns {Promise<void>}
 */
export async function markLodgeAsDeleted(lodge) {
    try {
        // Verify we have identifying info
        if (!lodge || (!lodge.id && !lodge.htmlFile)) {
            console.error('Cannot mark lodge as deleted without ID or HTML file');
            return;
        }
        
        // Get current deleted lodges from localStorage
        const currentDeleted = getDeletedLodges();
        
        // Create a deletion record with minimal info needed to identify the lodge
        const deletionRecord = {
            id: lodge.id,
            htmlFile: lodge.htmlFile,
            name: lodge.name || 'Unknown Lodge',
            timestamp: Date.now()
        };
        
        // Add to list if not already there
        if (!currentDeleted.some(l => l.id === lodge.id || l.htmlFile === lodge.htmlFile)) {
            currentDeleted.push(deletionRecord);
            
            // Save back to localStorage
            localStorage.setItem(DELETED_LODGES_KEY, JSON.stringify(currentDeleted));
            console.log(`Lodge "${lodge.name}" (${lodge.id || lodge.htmlFile}) marked as deleted`);
        }
        
        // Also save to IndexedDB for longer-term storage
        await saveToIndexedDB(deletionRecord);
        
    } catch (error) {
        console.error('Error marking lodge as deleted:', error);
    }
}

/**
 * Check if a lodge has been marked as deleted
 * @param {Object} lodge - Lodge to check
 * @returns {boolean}
 */
export function isLodgeDeleted(lodge) {
    if (!lodge || (!lodge.id && !lodge.htmlFile)) return false;
    
    const deletedLodges = getDeletedLodges();
    return deletedLodges.some(l => 
        l.id === lodge.id || 
        (lodge.htmlFile && l.htmlFile === lodge.htmlFile)
    );
}

/**
 * Get the list of deleted lodges
 * @returns {Array} List of deleted lodges
 */
export function getDeletedLodges() {
    try {
        const storedData = localStorage.getItem(DELETED_LODGES_KEY);
        return storedData ? JSON.parse(storedData) : [];
    } catch (error) {
        console.error('Error getting deleted lodges:', error);
        return [];
    }
}

/**
 * Filter an array of lodges, removing the ones that have been marked as deleted
 * @param {Array} lodges - Array of lodges to filter
 * @returns {Array} Filtered array without deleted lodges
 */
export function filterDeletedLodges(lodges) {
    if (!Array.isArray(lodges)) return lodges;
    
    const deletedLodges = getDeletedLodges();
    
    return lodges.filter(lodge => 
        !deletedLodges.some(deleted => 
            deleted.id === lodge.id || 
            (lodge.htmlFile && deleted.htmlFile === lodge.htmlFile)
        )
    );
}

/**
 * Store a deletion record in IndexedDB for persistence
 * @param {Object} deletionRecord - Record of the deleted lodge
 * @returns {Promise<void>}
 */
async function saveToIndexedDB(deletionRecord) {
    try {
        // Open (or create) the database
        const dbRequest = indexedDB.open('LodgeEaseDB', 1);
        
        // Handle database creation/upgrade
        dbRequest.onupgradeneeded = function(event) {
            const db = event.target.result;
            
            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains('deletedLodges')) {
                const objectStore = db.createObjectStore('deletedLodges', { keyPath: 'id' });
                objectStore.createIndex('htmlFile', 'htmlFile', { unique: false });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        
        // Handle successful database open
        dbRequest.onsuccess = function(event) {
            const db = event.target.result;
            
            // Start a transaction
            const transaction = db.transaction(['deletedLodges'], 'readwrite');
            const objectStore = transaction.objectStore('deletedLodges');
            
            // Add or update the deletion record
            const request = objectStore.put(deletionRecord);
            
            request.onsuccess = function() {
                console.log('Deletion record saved to IndexedDB');
            };
            
            request.onerror = function(event) {
                console.error('Error saving to IndexedDB:', event.target.error);
            };
            
            // Close the database when transaction completes
            transaction.oncomplete = function() {
                db.close();
            };
        };
        
        dbRequest.onerror = function(event) {
            console.error('IndexedDB error:', event.target.error);
        };
        
    } catch (error) {
        console.error('Error with IndexedDB operations:', error);
    }
}

/**
 * Load deleted lodges from IndexedDB and sync with localStorage
 * Call this when the app initializes
 * @returns {Promise<void>}
 */
export async function syncDeletedLodges() {
    try {
        return new Promise((resolve, reject) => {
            const dbRequest = indexedDB.open('LodgeEaseDB', 1);
            
            dbRequest.onupgradeneeded = function(event) {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('deletedLodges')) {
                    db.createObjectStore('deletedLodges', { keyPath: 'id' });
                }
            };
            
            dbRequest.onsuccess = function(event) {
                const db = event.target.result;
                try {
                    // Get current localStorage data
                    const localStorageLodges = getDeletedLodges();
                    const localIdMap = new Map(localStorageLodges.map(lodge => [lodge.id, lodge]));
                    
                    // Start transaction to get IndexedDB data
                    const transaction = db.transaction(['deletedLodges'], 'readonly');
                    const objectStore = transaction.objectStore('deletedLodges');
                    const request = objectStore.getAll();
                    
                    request.onsuccess = function() {
                        // Merge with localStorage data
                        const idbLodges = request.result || [];
                        
                        // Add any missing lodges from IndexedDB to localStorage
                        idbLodges.forEach(idbLodge => {
                            if (!localIdMap.has(idbLodge.id)) {
                                localStorageLodges.push(idbLodge);
                            }
                        });
                        
                        // Update localStorage
                        localStorage.setItem(DELETED_LODGES_KEY, JSON.stringify(localStorageLodges));
                        console.log('Deleted lodges synced:', localStorageLodges.length);
                        
                        resolve();
                    };
                    
                    request.onerror = function(event) {
                        console.error('Error reading from IndexedDB:', event.target.error);
                        resolve(); // Still resolve to not block app startup
                    };
                    
                    transaction.oncomplete = function() {
                        db.close();
                    };
                } catch (error) {
                    console.error('Error in IndexedDB transaction:', error);
                    resolve(); // Still resolve to not block app startup
                }
            };
            
            dbRequest.onerror = function(event) {
                console.error('Error opening IndexedDB:', event.target.error);
                resolve(); // Still resolve to not block app startup
            };
        });
    } catch (error) {
        console.error('Error syncing deleted lodges:', error);
    }
}

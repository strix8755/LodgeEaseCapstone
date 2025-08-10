/**
 * Helper functions to ensure proper lodge deletion and UI refresh
 */

/**
 * Function to force UI refresh after deletion
 * @param {Vue} vueInstance - The Vue instance
 * @param {string} lodgeId - ID of the lodge to remove from UI
 * @returns {boolean} - Success state
 */
export async function ensureLodgeDeletionUI(vueInstance, lodgeId) {
    try {
        // Remove from Vue data
        if (vueInstance && vueInstance.allClientLodges) {
            const initialCount = vueInstance.allClientLodges.length;
            vueInstance.allClientLodges = vueInstance.allClientLodges.filter(l => l.id !== lodgeId);
            console.log(`Lodge UI cleanup - removed from array. Before: ${initialCount}, After: ${vueInstance.allClientLodges.length}`);
            
            // Force Vue to update the DOM
            vueInstance.$forceUpdate();
            
            // Also try to manually remove the element if Vue doesn't update
            setTimeout(() => {
                const elements = [
                    document.getElementById(`lodge-card-${lodgeId}`),
                    document.getElementById(`lodge-list-${lodgeId}`)
                ];
                
                elements.forEach(element => {
                    if (element) {
                        console.log('Manually removing lodge element:', element.id);
                        element.style.opacity = '0';
                        element.style.transform = 'scale(0.5)';
                        setTimeout(() => {
                            if (element.parentNode) {
                                element.parentNode.removeChild(element);
                            }
                        }, 300);
                    }
                });
            }, 100);
        }
        
        return true;
    } catch (error) {
        console.error('Error ensuring lodge UI cleanup:', error);
        return false;
    }
}

/**
 * Verify a lodge document was actually deleted from Firestore
 * @param {Firestore} db - Firestore database reference
 * @param {string} lodgeId - ID of the lodge to verify deletion
 * @returns {boolean} - Whether the document is confirmed deleted
 */
export async function verifyLodgeDeletion(db, lodgeId) {
    try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const docRef = doc(db, 'lodges', lodgeId);
        const snapshot = await getDoc(docRef);
        
        const deleted = !snapshot.exists();
        console.log(`Lodge document ${lodgeId} deletion verification: ${deleted ? 'DELETED' : 'STILL EXISTS'}`);
        
        return deleted;
    } catch (error) {
        console.error('Error verifying lodge deletion:', error);
        return false;
    }
}

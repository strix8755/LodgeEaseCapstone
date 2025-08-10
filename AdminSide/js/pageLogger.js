import { auth, db } from '../firebase.js';
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

export class PageLogger {
    static async logNavigation(pageName) {
        try {
            const user = auth().currentUser;
            if (!user) return;

            await addDoc(collection(db(), 'activityLogs'), {
                userId: user.uid,
                userName: user.email,
                actionType: 'navigation',
                details: `Navigated to ${pageName}`,
                timestamp: Timestamp.now(),
                userRole: 'admin',
                module: pageName
            });
            
            console.log(`Navigation to ${pageName} logged for ${user.email}`);
        } catch (error) {
            console.error('Error logging navigation:', error);
        }
    }
    
    static init() {
        // Initialize the page logger
        const currentPage = this.getCurrentPageName();
        
        onAuthStateChanged(auth(), (user) => {
            if (user) {
                this.logNavigation(currentPage);
            }
        });
    }
    
    static getCurrentPageName() {
        // Extract page name from URL
        const path = window.location.pathname;
        const segments = path.split('/');
        const lastSegment = segments[segments.length - 1];
        
        // Remove file extension if present
        const pageName = lastSegment.split('.')[0];
        
        return pageName || 'Unknown';
    }
}

// Auto-initialize if loaded directly
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PageLogger.init());
} else {
    PageLogger.init();
}

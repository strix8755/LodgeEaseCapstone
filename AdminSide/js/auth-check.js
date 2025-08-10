import { auth } from '../firebase.js';

let redirectInProgress = false;

async function checkAuthentication() {
    if (redirectInProgress) return;
    
    try {
        const authInstance = auth();
        const user = authInstance.currentUser;
        if (!user && !window.location.href.includes('Login/index.html')) {
            redirectInProgress = true;
            window.location.href = '../Login/index.html';
        }
    } catch (error) {
        console.error('Authentication check failed:', error);
    }
}

// Listen for auth state changes
const authInstance = auth();
authInstance.onAuthStateChanged((user) => {
    if (!user && !window.location.href.includes('Login/index.html') && !redirectInProgress) {
        redirectInProgress = true;
        window.location.href = '../Login/index.html';
    }
});

// Run initial auth check after a slight delay to allow Firebase to initialize
setTimeout(checkAuthentication, 1000);

export { checkAuthentication };

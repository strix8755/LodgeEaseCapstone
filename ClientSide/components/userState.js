import { auth, initializeAuthState } from '../../AdminSide/firebase.js';

export function initializeUserState() {
    const userLinks = document.querySelectorAll('.user-link');
    const loginLink = document.querySelector('.login-link');
    const logoutLink = document.querySelector('.logout-link');

    initializeAuthState((user) => {
        if (user) {
            // User is logged in
            userLinks.forEach(link => link.classList.remove('hidden'));
            if (loginLink) loginLink.classList.add('hidden');
            if (logoutLink) logoutLink.classList.remove('hidden');
            
            // Store login state
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userEmail', user.email);
        } else {
            // User is logged out
            userLinks.forEach(link => link.classList.add('hidden'));
            if (loginLink) loginLink.classList.remove('hidden');
            if (logoutLink) logoutLink.classList.add('hidden');
            
            // Clear login state
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userEmail');
        }
    });
}

// Function to check if user is logged in
export function isUserLoggedIn() {
    return auth.currentUser !== null;
} 
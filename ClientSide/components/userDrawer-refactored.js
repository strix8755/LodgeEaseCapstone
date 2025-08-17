// Try to import Firebase v9 modules, but fall back gracefully if they fail
let onAuthStateChanged, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential;
let getFirestore, doc, getDoc, updateDoc, collection;
let firestore9 = {};
let isModuleMode = false;

// Attempt to load Firebase v9 modules
try {
    const authModule = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
    const firestoreModule = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    
    // Extract functions from modules
    onAuthStateChanged = authModule.onAuthStateChanged;
    signOut = authModule.signOut;
    updatePassword = authModule.updatePassword;
    EmailAuthProvider = authModule.EmailAuthProvider;
    reauthenticateWithCredential = authModule.reauthenticateWithCredential;
    
    getFirestore = firestoreModule.getFirestore;
    doc = firestoreModule.doc;
    getDoc = firestoreModule.getDoc;
    updateDoc = firestoreModule.updateDoc;
    collection = firestoreModule.collection;
    
    // Module-level variables for Firebase v9
    firestore9 = {
        doc: doc,
        getDoc: getDoc,
        updateDoc: updateDoc,
        collection: collection
    };
    
    isModuleMode = true;
    console.log('Successfully loaded Firebase v9 modules');
} catch (error) {
    console.log('Firebase v9 modules not available, will use fallback methods:', error);
    isModuleMode = false;
}

// Define Popup HTML separately
const changePasswordPopupHTML = `
<div id="changePasswordPopup" class="fixed inset-0 bg-black bg-opacity-50 hidden z-[80] flex items-center justify-center" style="z-index: 9999 !important;">
    <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold">Change Password</h3>
            <button id="closeChangePasswordPopup" class="text-gray-500 hover:text-gray-700">
                <i class="ri-close-line text-2xl"></i>
            </button>
        </div>
        <form id="changePasswordForm" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input type="password" name="currentPassword" required class="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" name="newPassword" required minlength="6" class="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input type="password" name="confirmPassword" required minlength="6" class="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
            </div>
            <p id="changePasswordError" class="text-red-500 text-sm hidden"></p>
            <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Update Password
            </button>
        </form>
    </div>
</div>
`;

// Define Settings Popup HTML
const settingsPopupHTML = `
<div id="settingsPopup" class="fixed inset-0 bg-black bg-opacity-50 hidden z-[70]">
    <div class="fixed right-0 top-0 w-96 h-full bg-white shadow-xl overflow-y-auto">
        <div class="p-6">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold">Profile Settings</h3>
                <button id="closeSettingsPopup" class="text-gray-500 hover:text-gray-700">
                    <i class="ri-close-line text-2xl"></i>
                </button>
            </div>

            <form id="settingsForm" class="space-y-6">
                <!-- Profile Picture Display (No Change Button) -->
                <div class="flex flex-col items-center mb-6">
                    <img id="profilePictureDisplay" src="" alt="Profile Picture" class="w-24 h-24 rounded-full mb-2 object-cover hidden">
                    <div id="profileIconContainer_settings" class="w-24 h-24 bg-gray-200 rounded-full mb-2 flex items-center justify-center">
                        <i class="ri-user-line text-4xl text-gray-400"></i>
                    </div>
                </div>

                <!-- Personal Information -->
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input type="text" name="fullname" value="" class="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input type="email" name="email" value="" class="w-full p-2 border rounded-lg bg-gray-50" readonly>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input type="tel" name="phone" value="" class="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                </div>

                <!-- Preferences -->
                <div class="space-y-4">
                    <h4 class="font-medium">Preferences</h4>
                    <div>
                        <label class="flex items-center space-x-2">
                            <input type="checkbox" name="emailNotifications">
                            <span>Email Notifications</span>
                        </label>
                    </div>
                </div>

                <!-- Security -->
                <div class="space-y-4">
                    <h4 class="font-medium">Security</h4>
                    <button type="button" id="changePasswordBtn_insideSettings" class="w-full text-left text-blue-600 hover:text-blue-700">
                        Change Password
                    </button>
                </div>

                <!-- Save Button -->
                <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    Save Changes
                </button>
            </form>
        </div>
    </div>
</div>
`;

// Define module-level variables to store references
let moduleFirestore;
let moduleAuth;
let isFirebaseV9 = false;

// Export a function to set Firebase version explicitly
window.setFirebaseVersion = function(isV9) {
    isFirebaseV9 = isV9;
    console.log('Firebase version set to v' + (isV9 ? '9' : '8'));
};

// Function to create a document reference based on Firebase version
function createDocRef(db, collectionName, docId) {
    if (isFirebaseV9 && firestore9.doc) {
        return firestore9.doc(db, collectionName, docId);
    } else {
        // Firebase v8 or fallback
        return db.collection(collectionName).doc(docId);
    }
}

// Function to get document data that works with both v8 and v9 snapshots
async function getDocData(docRef) {
    if (isFirebaseV9 && firestore9.getDoc) {
        const snapshot = await firestore9.getDoc(docRef);
        return {
            exists: () => snapshot.exists(),
            data: () => snapshot.data()
        };
    } else {
        // Firebase v8
        const snapshot = await docRef.get();
        return {
            exists: () => snapshot.exists,
            data: () => snapshot.data()
        };
    }
}

// Function to update document data that works with both v8 and v9
async function updateDocData(docRef, data) {
    if (isFirebaseV9 && firestore9.updateDoc) {
        return await firestore9.updateDoc(docRef, data);
    } else {
        // Firebase v8
        return await docRef.update(data);
    }
}

// Function to discover Firebase instances from various sources
function getFirebaseInstances() {
    console.log('Searching for Firebase instances...');
    
    // Try different sources to get Firebase auth and db
    if (window.firebaseAuth && window.firebaseDb) {
        console.log('Found Firebase via window.firebaseAuth and window.firebaseDb');
        return { auth: window.firebaseAuth, db: window.firebaseDb };
    }
    
    // If we have a stored userDrawerFirestore reference, use that
    if (window.userDrawerFirestore) {
        console.log('Using previously stored Firestore reference');
        return {
            auth: window.firebaseAuth || null,
            db: window.userDrawerFirestore
        };
    }
    
    if (window.firebase) {
        console.log('Found window.firebase object');
        
        // Try different methods to access Firebase auth
        if (window.firebase.auth && typeof window.firebase.auth === 'function') {
            try {
                const auth = window.firebase.auth();
                const db = window.firebase.firestore && typeof window.firebase.firestore === 'function' 
                    ? window.firebase.firestore() 
                    : null;
                console.log('Got Firebase instances via window.firebase methods');
                return { auth, db };
            } catch (e) {
                console.log('Error calling window.firebase methods:', e);
            }
        }
        
        // Check if auth is already initialized
        if (window.firebase.auth && typeof window.firebase.auth === 'object') {
            console.log('Found initialized Firebase auth object');
            const db = window.firebase.firestore || null;
            return { auth: window.firebase.auth, db };
        }
    }
    
    // Try to find Firebase in global scope
    if (typeof auth !== 'undefined' && auth) {
        console.log('Found global auth variable');
        const db = typeof db !== 'undefined' ? db : null;
        return { auth, db };
    }
    
    // Look for auth in imported modules (may be captured by other scripts)
    if (window.firebaseModule && window.firebaseModule.auth) {
        console.log('Found auth in window.firebaseModule');
        return { 
            auth: window.firebaseModule.auth, 
            db: window.firebaseModule.db 
        };
    }
    
    // As a last resort, check if Firebase is loaded via script tag
    if (document.querySelector('script[src*="firebase"]')) {
        console.log('Firebase script tag found, but instances not available yet');
    } else {
        console.log('No Firebase script tag found');
    }
    
    return null;
}

// Function to create or find required DOM elements
function ensureDOMElements() {
    let userIconBtn = document.getElementById('userIconBtn');
    let drawer = document.getElementById('userDrawer');
    
    // Try to find alternative user button if main one is missing
    if (!userIconBtn) {
        const alternativeUserBtn = document.querySelector('button.nav-button i.ri-user-line')?.parentElement;
        if (alternativeUserBtn) {
            console.log('Found alternative user button, setting ID');
            alternativeUserBtn.id = 'userIconBtn';
            userIconBtn = alternativeUserBtn;
        } else {
            console.error('User icon button not found and cannot create alternative');
            return { userIconBtn: null, drawer: null };
        }
    }
    
    // Create drawer if missing
    if (!drawer) {
        console.log('User drawer not found, creating it');
        drawer = document.createElement('div');
        drawer.id = 'userDrawer';
        drawer.className = 'fixed top-0 right-0 w-80 h-full bg-white shadow-xl transform translate-x-full transition-transform duration-300 ease-in-out z-[200000]';
        drawer.innerHTML = `
            <div class="drawer-content p-6">
                <div id="userDrawerContent">
                    <!-- Content will be inserted here -->
                </div>
            </div>
        `;
        document.body.appendChild(drawer);
    } else {
        // Update drawer styles to ensure consistency
        drawer.className = 'fixed top-0 right-0 w-80 h-full bg-white shadow-xl transform translate-x-full transition-transform duration-300 ease-in-out z-[200000]';
        
        // Ensure the drawer has the right structure
        if (!drawer.querySelector('.drawer-content')) {
            drawer.innerHTML = `
                <div class="drawer-content p-6">
                    <div id="userDrawerContent">
                        <!-- Content will be inserted here -->
                    </div>
                </div>
            `;
        }
    }
    
    return { userIconBtn, drawer };
}

// Function to add popups to the body if they don't exist
function ensureSecurityPopupsExist() {
    if (!document.getElementById('changePasswordPopup')) {
        document.body.insertAdjacentHTML('beforeend', changePasswordPopupHTML);
    }
    // Add Settings Popup check
    if (!document.getElementById('settingsPopup')) {
        document.body.insertAdjacentHTML('beforeend', settingsPopupHTML);
    }
}

// Enhanced initialization function that works with or without modules
function initializeUserDrawer(auth, db) {
    console.log('Starting user drawer initialization with auth:', !!auth, 'db:', !!db);

    // Ensure DOM elements exist
    const { userIconBtn, drawer } = ensureDOMElements();
    if (!userIconBtn || !drawer) {
        console.error('Failed to find or create required DOM elements');
        return;
    }

    // Add the popups to the DOM body once
    ensureSecurityPopupsExist();

    // Handle case where auth/db are not provided - try to find them
    if (!auth || !db) {
        console.log('Auth or DB not provided, attempting to discover Firebase instances');
        const instances = getFirebaseInstances();
        if (instances) {
            auth = auth || instances.auth;
            db = db || instances.db;
            console.log('Found Firebase instances via discovery');
        } else {
            console.log('Could not find Firebase instances, initializing with limited functionality');
        }
    }

    if (!auth) {
        console.warn('Auth is not available - user drawer will have limited functionality');
    }

    if (!db) {
        console.warn('Firestore db is not available - user drawer will have limited functionality');
    }
    
    // Check what version of Firebase we're working with
    if (typeof db === 'function' || 
        (db && db.collection && typeof db.collection === 'function') || 
        (db && db.firestore && typeof db.firestore === 'function')) {
        // Firebase v8 style
        isFirebaseV9 = false;
        console.log('Detected Firebase v8 SDK');
    } else {
        // Might be Firebase v9
        isFirebaseV9 = true;
        console.log('Detected possible Firebase v9 SDK');
    }
    
    // Check if db is a function (AdminSide/firebase.js style) or an object
    let firestore;
    try {
        if (typeof db === 'function') {
            console.log('DB is a function, calling it to get Firestore instance');
            firestore = db();
        } else if (db && db.collection && typeof db.collection === 'function') {
            console.log('DB has collection method, using directly');
            firestore = db;
        } else if (db && db.firestore && typeof db.firestore === 'function') {
            console.log('DB has firestore method, calling it');
            firestore = db.firestore();
        } else if (window.firebaseDb) {
            console.log('Using window.firebaseDb as fallback');
            firestore = window.firebaseDb;
            isFirebaseV9 = false; // This is definitely v8
        } else if (window.firebase && window.firebase.firestore) {
            console.log('Using window.firebase.firestore as fallback');
            firestore = window.firebase.firestore();
            isFirebaseV9 = false; // This is definitely v8
        } else {
            console.log('No valid Firestore instance found, proceeding with limited functionality');
            firestore = null;
        }
    } catch (error) {
        console.warn('Error getting Firestore instance:', error, '- proceeding with limited functionality');
        firestore = null;
    }
    
    // Store in module-level variables for access by other functions
    moduleFirestore = firestore;
    moduleAuth = auth;

    console.log('Elements found:', { userIconBtn: !!userIconBtn, drawer: !!drawer });

    // Add click handler to user icon
    userIconBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('User icon clicked, checking auth state');
        drawer.classList.remove('translate-x-full');
        
        // Force update content on open
        if (auth && auth.currentUser) {
            await updateDrawerForUser(auth.currentUser, drawer, firestore);
        } else {
            window.updateDrawerContent(null);
        }
    });

    // Close drawer when clicking outside
    document.addEventListener('click', function(e) {
        if (drawer && !drawer.classList.contains('translate-x-full') && 
            e.target !== userIconBtn && 
            !drawer.contains(e.target) && 
            !userIconBtn.contains(e.target)) {
            drawer.classList.add('translate-x-full');
        }
    });

    // Listen for auth state changes
    if (auth && onAuthStateChanged) {
        onAuthStateChanged(auth, async (user) => {
            console.log('Auth state changed:', user ? 'User logged in' : 'No user');
            window.updateDrawerContent(user);
        });
    } else if (auth && auth.onAuthStateChanged) {
        // Fallback for Firebase v8
        auth.onAuthStateChanged(async (user) => {
            console.log('Auth state changed (v8):', user ? 'User logged in' : 'No user');
            window.updateDrawerContent(user);
        });
    } else {
        console.log('No auth state listener available, setting up basic content');
        window.updateDrawerContent(null);
    }

    // Mark as initialized
    window.userDrawerInitialized = true;
    
    // Store the firestore reference globally for other functions to use
    window.userDrawerFirestore = firestore;
    
    console.log('User drawer initialization complete');
}

// Helper function to update drawer for authenticated user
async function updateDrawerForUser(user, drawer, firestore) {
    const drawerContent = drawer.querySelector('#userDrawerContent');
    if (!drawerContent) return;

    if (firestore) {
        try {
            // Create proper document reference with our validated firestore instance
            const userDocRef = createDocRef(firestore, 'users', user.uid);
            const userDoc = await getDocData(userDocRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                drawerContent.innerHTML = generateUserDrawerContent(userData, { currentUser: user });
                setupDrawerEventHandlers(user, drawer);
            } else {
                console.log('No user document found, creating basic content');
                drawerContent.innerHTML = generateUserDrawerContent({
                    fullname: user.displayName,
                    email: user.email
                }, { currentUser: user });
                setupDrawerEventHandlers(user, drawer);
            }
        } catch (error) {
            console.error('Error getting user data:', error);
            drawerContent.innerHTML = generateUserDrawerContent({
                fullname: user.displayName,
                email: user.email
            }, { currentUser: user });
            setupDrawerEventHandlers(user, drawer);
        }
    } else {
        // No firestore, use basic user data
        drawerContent.innerHTML = generateUserDrawerContent({
            fullname: user.displayName,
            email: user.email
        }, { currentUser: user });
        setupDrawerEventHandlers(user, drawer);
    }
}

// Function to generate the user drawer content
function generateUserDrawerContent(userData, auth) {
    console.log('Generating user drawer content with userData:', userData);
    
    // Check if user data is available
    if (!userData || !auth) {
        console.error('Missing userData or auth for drawer content');
        return generateErrorContent();
    }
    
    const user = auth.currentUser;
    if (!user) {
        console.error('No current user in auth for drawer content');
        return generateLoginContent();
    }
    
    // Format displayName - use fullname from userData if available, otherwise use displayName from auth
    const displayName = userData.fullname || user.displayName || 'LodgeEase User';
    
    // Use email from auth, fallback to userData
    const email = user.email || userData.email || '';
    
    // Generate HTML for the user drawer
    return `
        <div class="py-4">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold">User Profile</h3>
                <button id="closeDrawer" class="text-gray-500 hover:text-gray-700">
                    <i class="ri-close-line text-2xl"></i>
                </button>
            </div>
            <div class="flex justify-center mb-4">
                <div class="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                    ${user.photoURL ? 
                        `<img src="${user.photoURL}" alt="${displayName}" class="w-16 h-16 rounded-full">` :
                        `<span class="text-2xl text-blue-600">${(displayName || email || 'U').charAt(0).toUpperCase()}</span>`}
                </div>
            </div>
            <h3 class="text-center text-lg font-bold mb-1">${displayName}</h3>
            <p class="text-center text-gray-500 mb-6 text-sm">${email}</p>
            
            <div class="space-y-2">
                <button class="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded flex items-center text-sm" id="drawerBookingsBtn">
                    <i class="ri-calendar-line mr-2"></i>
                    <span>My Bookings</span>
                </button>
                <button class="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded flex items-center text-sm" id="drawerDashboardBtn">
                    <i class="ri-dashboard-line mr-2"></i>
                    <span>Dashboard</span>
                </button>
                <button class="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded flex items-center text-sm" id="settingsBtn">
                    <i class="ri-settings-line mr-2"></i>
                    <span>Settings</span>
                </button>
                <button class="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded flex items-center text-sm" id="logoutBtn">
                    <i class="ri-logout-box-line mr-2"></i>
                    <span>Sign Out</span>
                </button>
            </div>
        </div>
    `;
}

function generateLoginContent() {
    return `
        <div class="p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-semibold">Welcome</h2>
                <button id="closeDrawer" class="text-gray-500 hover:text-gray-700">
                    <i class="ri-close-line text-2xl"></i>
                </button>
            </div>
            <p class="text-gray-600 mb-6">Please log in to access your account.</p>
            <a href="../Login/index.html" class="block w-full bg-blue-500 text-white text-center py-2 rounded-lg hover:bg-blue-600 transition-colors">
                Log In
            </a>
        </div>
    `;
}

function generateErrorContent() {
    return `
        <div class="p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-semibold">Error</h2>
                <button id="closeDrawer" class="text-gray-500 hover:text-gray-700">
                    <i class="ri-close-line text-2xl"></i>
                </button>
            </div>
            <p class="text-red-500">There was an error loading your account information. Please try again later.</p>
            <button id="logoutBtn" class="w-full mt-6 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors">
                Log Out
            </button>
        </div>
    `;
}

// Make the initialization function available globally for fallback compatibility
window.initializeUserDrawer = initializeUserDrawer;

// Function to update drawer content (used by fallback systems)
window.updateDrawerContent = function(user) {
    const drawer = document.getElementById('userDrawer');
    if (!drawer) return;
    
    const content = drawer.querySelector('#userDrawerContent') || 
                   drawer.querySelector('.drawer-content');
    
    if (!content) {
        console.error('Drawer content container not found');
        return;
    }
    
    if (user) {
        // User is signed in
        content.innerHTML = generateUserDrawerContent({ 
            fullname: user.displayName,
            email: user.email 
        }, { currentUser: user });
        
        // Add event handlers for the new content
        setupDrawerEventHandlers(user, drawer);
    } else {
        // User is signed out
        content.innerHTML = generateLoginContent();
        setupDrawerEventHandlers(null, drawer);
    }
    
    // Update login button visibility
    updateLoginButtonVisibility(user);
};

// Function to setup drawer event handlers
function setupDrawerEventHandlers(user, drawer) {
    // Close drawer functionality
    const closeDrawerBtn = drawer.querySelector('#closeDrawer') || drawer.querySelector('#closeDrawerInner');
    if (closeDrawerBtn) {
        closeDrawerBtn.addEventListener('click', () => {
            drawer.classList.add('translate-x-full');
        });
    }
    
    if (user) {
        // Add bookings button handler
        const bookingsBtn = drawer.querySelector('#drawerBookingsBtn');
        if (bookingsBtn) {
            bookingsBtn.addEventListener('click', function() {
                if (typeof window.showBookingsModal === 'function') {
                    console.log('Using existing showBookingsModal function');
                    window.showBookingsModal();
                    drawer.classList.add('translate-x-full');
                } else {
                    console.log('showBookingsModal function not available, redirecting to dashboard');
                    window.location.href = '../Dashboard/Dashboard.html';
                }
            });
        }
        
        // Add dashboard button handler
        const dashboardBtn = drawer.querySelector('#drawerDashboardBtn');
        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', function() {
                window.location.href = '../Dashboard/Dashboard.html';
            });
        }
        
        // Add logout functionality
        const logoutBtn = drawer.querySelector('#logoutBtn') || drawer.querySelector('#drawerSignOutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    // Try to sign out with the available auth instance
                    if (moduleAuth && signOut) {
                        await signOut(moduleAuth);
                    } else if (window.firebaseAuth && window.firebaseAuth.signOut) {
                        await window.firebaseAuth.signOut();
                    } else if (window.firebase && window.firebase.auth) {
                        await window.firebase.auth().signOut();
                    }
                    window.location.href = '../Login/index.html';
                } catch (error) {
                    console.error('Error signing out:', error);
                    // Force redirect even if signout fails
                    window.location.href = '../Login/index.html';
                }
            });
        }
    }
}

// Function to handle login button visibility
function updateLoginButtonVisibility(user) {
    const loginButton = document.getElementById('loginButton');
    const mobileLoginButton = document.getElementById('mobileLoginButton');
    
    if (loginButton) {
        loginButton.style.display = user ? 'none' : 'block';
    }
    
    if (mobileLoginButton) {
        mobileLoginButton.style.display = user ? 'none' : 'block';
    }
}

// Auto-initialization system with retries
function setupAutoInit() {
    let attempts = 0;
    const maxAttempts = 5;
    
    function tryInitialize() {
        attempts++;
        console.log(`UserDrawer auto-init attempt ${attempts}/${maxAttempts}`);
        
        try {
            // Skip if already initialized
            if (window.userDrawerInitialized) {
                console.log('UserDrawer already initialized, skipping auto-init');
                return;
            }
            
            // Try to find Firebase instances
            const firebaseInstances = getFirebaseInstances();
            if (firebaseInstances && firebaseInstances.auth) {
                console.log('Found Firebase instances, initializing UserDrawer');
                initializeUserDrawer(firebaseInstances.auth, firebaseInstances.db);
                window.userDrawerInitialized = true;
                return;
            }
            
            // Check if we should try loading from modules
            if (window.firebaseModule) {
                const module = window.firebaseModule;
                if (module.auth && module.db) {
                    console.log('Found Firebase in window.firebaseModule, initializing');
                    try {
                        initializeUserDrawer(module.auth, module.db);
                        window.userDrawerInitialized = true;
                        return;
                    } catch (e) {
                        console.log('Error initializing from window.firebaseModule:', e);
                    }
                }
            }
            
            // If we've exhausted attempts, initialize with null to at least set up basic drawer
            if (attempts >= maxAttempts) {
                console.log('Max attempts reached, initializing with null auth/db for basic functionality');
                initializeUserDrawer(null, null);
                window.userDrawerInitialized = true;
                return;
            }
            
            // Schedule retry
            const delay = Math.min(attempts * 1500, 5000);
            console.log(`Retrying UserDrawer initialization in ${delay}ms`);
            setTimeout(tryInitialize, delay);
            
        } catch (e) {
            console.error('Error in tryInitialize:', e);
            if (attempts >= maxAttempts) {
                console.log('Initializing with null due to persistent errors');
                initializeUserDrawer(null, null);
                window.userDrawerInitialized = true;
            } else {
                const delay = Math.min(attempts * 1500, 5000);
                setTimeout(tryInitialize, delay);
            }
        }
    }
    
    // Start initialization process with a slight delay to allow for other scripts to load
    setTimeout(tryInitialize, 300);
}

// Immediate initialization for cases where Firebase is already available
(function immediateInit() {
    console.log('Running immediate UserDrawer initialization');
    
    // Check if already initialized
    if (window.userDrawerInitialized) {
        console.log('UserDrawer already initialized, skipping immediate init');
        return;
    }
    
    // Check if document.body is ready
    if (!document.body) {
        console.log('Document body not ready, deferring initialization');
        return;
    }
    
    // Try to find Firebase instances immediately
    let auth = null;
    let db = null;
    
    // Check window.firebaseAuth and window.firebaseDb first
    if (window.firebaseAuth) {
        console.log('Found firebaseAuth in window object');
        auth = window.firebaseAuth;
    }
    
    if (window.firebaseDb) {
        console.log('Found firebaseDb in window object');
        db = window.firebaseDb;
    }
    
    // If we have both, initialize immediately
    if (auth && db) {
        console.log('Initializing UserDrawer immediately with found Firebase instances');
        try {
            initializeUserDrawer(auth, db);
            window.userDrawerInitialized = true;
            return;
        } catch (error) {
            console.error('Error in immediate initialization:', error);
        }
    }
    
    // If direct initialization fails, we'll rely on the auto-init in the main function
    console.log('Immediate initialization deferred to auto-init process');
})();

// Document ready initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        if (!window.userDrawerInitialized) {
            setupAutoInit();
        }
    });
} else {
    // Document is already loaded
    if (!window.userDrawerInitialized) {
        setupAutoInit();
    }
}

// Export the main function for module usage, but also make it globally available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initializeUserDrawer };
}

// Make the module available on the window object for non-module usage
window.userDrawerModule = { initializeUserDrawer };

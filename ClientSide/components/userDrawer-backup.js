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
    console.log('Setting Firebase version to:', isV9 ? 'v9' : 'v8');
    isFirebaseV9 = !!isV9;
};

// Function to create a document reference based on Firebase version
function createDocRef(db, collectionName, docId) {
    try {
        if (isFirebaseV9) {
            console.log(`Creating v9 doc ref: collection=${collectionName}, docId=${docId}`);
            return doc(db, collectionName, docId);
        } else {
            console.log(`Creating v8 doc ref: collection=${collectionName}, docId=${docId}`);
            return db.collection(collectionName).doc(docId);
        }
    } catch (error) {
        console.error("Error creating document reference:", error);
        throw error;
    }
}

// Function to get document data that works with both v8 and v9 snapshots
async function getDocData(docRef) {
  try {
    console.log(`Getting doc data using Firebase v${isFirebaseV9 ? '9' : '8'}`);
    
    let snapshot;
    if (isFirebaseV9) {
      // V9 approach
      snapshot = await getDoc(docRef);
    } else {
      // V8 approach
      snapshot = await docRef.get();
    }
    
    console.log("Document snapshot:", snapshot);
    
    // Return an object that handles both v8 and v9 snapshot formats
    return {
      exists: () => {
        // Handle both function and property versions
        if (typeof snapshot.exists === 'function') {
          return snapshot.exists();
        }
        return snapshot.exists;
      },
      data: () => {
        if (!snapshot || !snapshot.data) {
          console.error("Invalid snapshot or missing data method");
          return null;
        }
        return snapshot.data();
      },
      id: snapshot.id,
      // Add the original snapshot for direct access if needed
      _snapshot: snapshot
    };
  } catch (error) {
    console.error("Error getting document data:", error);
    throw error;
  }
}

// Function to update document data that works with both v8 and v9
async function updateDocData(docRef, data) {
  try {
    console.log(`Updating doc data using Firebase v${isFirebaseV9 ? '9' : '8'}`);
    console.log("Update data:", data);
    
    if (isFirebaseV9) {
      // V9 approach
      await updateDoc(docRef, data);
    } else {
      // V8 approach
      await docRef.update(data);
    }
    
    return true;
  } catch (error) {
    console.error("Error updating document data:", error);
    throw error;
  }
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
        (db.collection && typeof db.collection === 'function') || 
        (db.firestore && typeof db.firestore === 'function')) {
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
        } else if (db.collection && typeof db.collection === 'function') {
            console.log('DB has collection method, using directly');
            firestore = db;
        } else if (db.firestore && typeof db.firestore === 'function') {
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
            console.error('Unable to determine valid Firestore instance');
            // Try a last resort option - initialize directly with Firebase 9+
            try {
                console.log('Attempting to initialize Firestore directly');
                firestore = getFirestore();
                isFirebaseV9 = true;
                console.log('Successfully initialized Firestore directly with v9');
            } catch (e) {
                console.error('Failed to initialize Firestore directly:', e);
                return;
            }
        }
    } catch (error) {
        console.error('Error getting Firestore instance:', error);
        return;
    }
    
    // Validate that firestore is now properly initialized
    if (isFirebaseV9) {
        // For Firebase v9, we need firestore9 utilities
        if (!firestore9) {
            console.error('Firebase v9 utilities not available yet');
            // Try to use v8 APIs instead
            isFirebaseV9 = false;
            if (!firestore || (typeof firestore.collection !== 'function')) {
                console.error('Cannot fall back to v8 APIs either');
                return;
            }
            console.log('Falling back to v8 APIs');
        } else {
            console.log('Using Firebase v9 utilities');
        }
    } else {
        // For Firebase v8, check the collection method
        if (!firestore || (typeof firestore.collection !== 'function')) {
            console.error('Failed to initialize a valid Firestore instance with collection method');
            return;
        }
        console.log('Using Firebase v8 APIs');
    }
    
    console.log('Successfully initialized Firestore instance:', !!firestore, 'Using Firebase v9:', isFirebaseV9);
    
    // Store in module-level variables for access by other functions
    moduleFirestore = firestore;
    moduleAuth = auth;

    console.log('Elements found:', { userIconBtn: !!userIconBtn, drawer: !!drawer });

    // Add click handler to user icon
    userIconBtn.addEventListener('click', async () => {
        console.log('User icon clicked, checking auth state');
        drawer.classList.remove('translate-x-full');
        
        // Force update content on open
        if (auth && auth.currentUser) {
            try {
                // Create proper document reference with our validated firestore instance
                const userDocRef = createDocRef(firestore, 'users', auth.currentUser.uid);
                const userDoc = await getDocData(userDocRef);
                
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const drawerContent = drawer.querySelector('#userDrawerContent');
                    if (drawerContent) {
                        drawerContent.innerHTML = generateUserDrawerContent(userData, auth);
                        setupDrawerEventHandlers(auth.currentUser, drawer);
                    }
                } else {
                    console.log('No user document found, creating basic content');
                    const drawerContent = drawer.querySelector('#userDrawerContent');
                    if (drawerContent) {
                        drawerContent.innerHTML = generateUserDrawerContent({
                            fullname: auth.currentUser.displayName,
                            email: auth.currentUser.email
                        }, auth);
                        setupDrawerEventHandlers(auth.currentUser, drawer);
                    }
                }
            } catch (error) {
                console.error('Error getting user data:', error);
                const drawerContent = drawer.querySelector('#userDrawerContent');
                if (drawerContent) {
                    drawerContent.innerHTML = generateUserDrawerContent({
                        fullname: auth.currentUser.displayName,
                        email: auth.currentUser.email
                    }, auth);
                    setupDrawerEventHandlers(auth.currentUser, drawer);
                }
            }
        } else {
            // User is signed out or auth not available
            const drawerContent = drawer.querySelector('#userDrawerContent');
            if (drawerContent) {
                drawerContent.innerHTML = generateLoginContent();
                setupDrawerEventHandlers(null, drawer);
            }
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
                    drawer.querySelector('.drawer-content').innerHTML = generateUserDrawerContent(userData, auth);
                    setupEventListeners(auth, firestore);
                    
                    // Add close drawer functionality
                    const closeDrawerBtn = document.getElementById('closeDrawer');
                    if (closeDrawerBtn) {
                        closeDrawerBtn.addEventListener('click', () => {
                            drawer.classList.add('translate-x-full');
                        });
                    }
                } else {
                    console.log('No such user document!');
                    drawer.querySelector('.drawer-content').innerHTML = generateLoginContent();
                    
                    // Add close drawer functionality for login content
                    const closeDrawerBtn = document.getElementById('closeDrawer');
                    if (closeDrawerBtn) {
                        closeDrawerBtn.addEventListener('click', () => {
                            drawer.classList.add('translate-x-full');
                        });
                    }
                }
            } catch (error) {
                console.error("Error getting user document:", error);
                drawer.querySelector('.drawer-content').innerHTML = generateErrorContent();
            }
        } else {
            drawer.querySelector('.drawer-content').innerHTML = generateLoginContent();
            
            // Add close drawer functionality for login content
            const closeDrawerBtn = document.getElementById('closeDrawer');
            if (closeDrawerBtn) {
                closeDrawerBtn.addEventListener('click', () => {
                    drawer.classList.add('translate-x-full');
                });
            }
        }
        drawer.classList.remove('translate-x-full');
    });

    // Handle authentication state changes
    onAuthStateChanged(auth, async (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        const drawerContent = drawer.querySelector('.drawer-content');
        if (!drawerContent) {
            console.error('Drawer content element not found');
            return;
        }

        try {
            if (user) {
                console.log('Fetching user data for:', user.uid);
                // Use the validated firestore instance for document reference
                const userDocRef = createDocRef(firestore, 'users', user.uid);
                
                try {
                    const userDoc = await getDocData(userDocRef);
                    
                    if (!userDoc.exists()) {
                        console.log('No user document found');
                        drawerContent.innerHTML = generateErrorContent();
                        return;
                    }

                    const userData = userDoc.data();
                    drawerContent.innerHTML = generateUserDrawerContent(userData, auth);

                    // Add logout functionality
                    const logoutBtn = document.getElementById('logoutBtn');
                    if (logoutBtn) {
                        logoutBtn.addEventListener('click', async () => {
                            try {
                                await signOut(auth);
                                window.location.href = '../Login/index.html';
                            } catch (error) {
                                console.error('Error signing out:', error);
                            }
                        });
                    }

                    // Add close drawer functionality
                    const closeDrawerBtn = document.getElementById('closeDrawer');
                    if (closeDrawerBtn) {
                        closeDrawerBtn.addEventListener('click', () => {
                            drawer.classList.add('translate-x-full');
                        });
                    }

                    // Call setupEventListeners with validated instances
                    setupEventListeners(auth, firestore);
                } catch (error) {
                    console.error('Error updating drawer content:', error);
                    drawerContent.innerHTML = generateErrorContent();
                }
            } else {
                // User is signed out
                drawerContent.innerHTML = generateLoginContent();
                
                // Add close drawer functionality
                const closeDrawerBtn = document.getElementById('closeDrawer');
                if (closeDrawerBtn) {
                    closeDrawerBtn.addEventListener('click', () => {
                        drawer.classList.add('translate-x-full');
                    });
                }
            }
        } catch (error) {
            console.error('Error updating drawer content:', error);
            drawerContent.innerHTML = generateErrorContent();
        }
    });
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

// Add this helper function to generate bookings list
function generateBookingsList(bookings) {
    if (!bookings || bookings.length === 0) {
        return `<p class="text-gray-500 text-center">No bookings found</p>`;
    }

    return bookings.map(booking => `
        <div class="bg-gray-50 rounded-lg p-4">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-semibold">${booking.lodgeName}</h4>
                    <p class="text-sm text-gray-600">${booking.location}</p>
                </div>
                <span class="text-sm font-medium ${booking.status === 'confirmed' ? 'text-green-600' : 'text-yellow-600'}">
                    ${booking.status}
                </span>
            </div>
            <div class="mt-2 text-sm text-gray-600">
                <p>Check-in: ${formatDate(booking.checkIn)}</p>
                <p>Check-out: ${formatDate(booking.checkOut)}</p>
            </div>
            <div class="mt-3 flex justify-between items-center">
                <span class="font-medium">₱${booking.price.toLocaleString()}</span>
                ${booking.status === 'confirmed' ? `
                    <button class="text-red-500 text-sm hover:text-red-700" onclick="cancelBooking('${booking.id}')">
                        Cancel
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Add this helper function to format dates
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function generateLoginContent() {
    return `
        <div class="p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-semibold">Welcome</h2>
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
            </div>
            <p class="text-red-500">There was an error loading your account information. Please try again later.</p>
            <button id="logoutBtn" class="w-full mt-6 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors">
                Log Out
            </button>
        </div>
    `;
}

// Add function to handle booking cancellation
window.cancelBooking = async function(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) {
        return;
    }

    try {
        if (!moduleFirestore) {
            console.error('Firestore not available in cancelBooking function');
            alert('Unable to cancel booking - database connection error');
            return;
        }
        
        const bookingRef = createDocRef(moduleFirestore, 'bookings', bookingId);
        await updateDocData(bookingRef, {
            status: 'cancelled',
            cancelledAt: new Date()
        });

        // Refresh the bookings display
        const user = moduleAuth.currentUser;
        if (user) {
            const userDoc = await getDocData(createDocRef(moduleFirestore, 'users', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const bookingsPopup = document.getElementById('bookingsPopup');
                if (bookingsPopup) {
                    const currentBookings = document.getElementById('currentBookings');
                    const previousBookings = document.getElementById('previousBookings');
                    if (currentBookings && previousBookings) {
                        currentBookings.innerHTML = generateBookingsList(userData.currentBookings || []);
                        previousBookings.innerHTML = generateBookingsList(userData.previousBookings || []);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error cancelling booking:', error);
        alert('Failed to cancel booking. Please try again.');
    }
};

// Add this in the initializeUserDrawer function after drawer content is generated
function initializeSettingsPopup(auth, db) {
    // Get popup elements
    const settingsBtn = document.getElementById('settingsBtn') || document.getElementById('showSettingsBtn');
    const settingsPopup = document.getElementById('settingsPopup');
    const closeSettingsPopup = document.getElementById('closeSettingsPopup');
    const settingsForm = document.getElementById('settingsForm');
    
    // Get change password elements
    const changePasswordBtn_insideSettings = document.getElementById('changePasswordBtn_insideSettings');
    const changePasswordPopup = document.getElementById('changePasswordPopup');
    const closeChangePasswordPopup = document.getElementById('closeChangePasswordPopup');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const changePasswordError = document.getElementById('changePasswordError');
    
    // Check if required elements exist
    if (!settingsBtn || !settingsPopup || !closeSettingsPopup || !settingsForm) {
        console.log('Settings popup elements not found, skipping setup');
        return;
    }
    
    // Validate Firestore
    if (!db) {
        console.error('Firestore not initialized in initializeSettingsPopup');
        return;
    }
    
    // Check if db is a function (AdminSide/firebase.js style) or an object
    let firestore;
    try {
        if (typeof db === 'function') {
            console.log('DB is a function in initializeSettingsPopup, calling it');
            firestore = db();
        } else if (db.collection && typeof db.collection === 'function') {
            console.log('DB has collection method in initializeSettingsPopup, using directly');
            firestore = db;
        } else if (db.firestore && typeof db.firestore === 'function') {
            console.log('DB has firestore method in initializeSettingsPopup, calling it');
            firestore = db.firestore();
        } else if (window.firebaseDb) {
            console.log('Using window.firebaseDb as fallback in initializeSettingsPopup');
            firestore = window.firebaseDb;
        } else if (window.firebase && window.firebase.firestore) {
            console.log('Using window.firebase.firestore as fallback in initializeSettingsPopup');
            firestore = window.firebase.firestore();
        } else {
            console.error('Unable to determine valid Firestore instance in initializeSettingsPopup');
            return;
        }
    } catch (error) {
        console.error('Error getting Firestore instance in initializeSettingsPopup:', error);
        return;
    }
    
    // Validate that firestore is properly initialized
    if (!firestore || (typeof firestore.collection !== 'function' && !isFirebaseV9)) {
        console.error('Failed to initialize a valid Firestore instance in initializeSettingsPopup');
        return;
    }
    
    console.log('Successfully initialized Firestore instance in initializeSettingsPopup:', !!firestore);
    
    // Add click event for settings button
    settingsBtn.addEventListener('click', async () => {
        // Load user data and populate form
        if (auth.currentUser) {
            try {
                // Use proper document reference with validated firestore
                const userDocRef = createDocRef(firestore, 'users', auth.currentUser.uid);
                const userDoc = await getDocData(userDocRef);
                
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    // Populate the form with user data
                    settingsForm.elements['fullname'].value = userData.fullname || '';
                    settingsForm.elements['email'].value = auth.currentUser.email || '';
                    settingsForm.elements['phone'].value = userData.phone || '';
                    
                    // Set checkbox
                    if (settingsForm.elements['emailNotifications']) {
                        settingsForm.elements['emailNotifications'].checked = userData.emailNotifications || false;
                    }
                    
                    // Handle profile picture if available
                    const profilePictureDisplay = document.getElementById('profilePictureDisplay');
                    const profileIconContainer = document.getElementById('profileIconContainer_settings');
                    
                    if (profilePictureDisplay && profileIconContainer) {
                        if (auth.currentUser.photoURL) {
                            profilePictureDisplay.src = auth.currentUser.photoURL;
                            profilePictureDisplay.classList.remove('hidden');
                            profileIconContainer.classList.add('hidden');
                        } else {
                            profilePictureDisplay.classList.add('hidden');
                            profileIconContainer.classList.remove('hidden');
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching user data for settings:', error);
            }
        }
        
        // Show the settings popup
        settingsPopup.classList.remove('hidden');
    });
    
    // Setup close button
    closeSettingsPopup.addEventListener('click', () => {
        settingsPopup.classList.add('hidden');
    });
    
    // Close on click outside
    settingsPopup.addEventListener('click', (e) => {
        if (e.target === settingsPopup) {
            settingsPopup.classList.add('hidden');
        }
    });
    
    // Handle form submission
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(settingsForm);
            const userData = {
                fullname: formData.get('fullname'),
                phone: formData.get('phone'),
                emailNotifications: formData.get('emailNotifications') === 'on',
                lastUpdated: new Date()
            };
            
            try {
                // Use proper document reference with validated firestore
                const userDocRef = createDocRef(firestore, 'users', auth.currentUser.uid);
                await updateDocData(userDocRef, userData);
                
                alert('Settings updated successfully!');
                settingsPopup.classList.add('hidden');
            } catch (error) {
                console.error('Error updating settings:', error);
                alert('Failed to update settings. Please try again.');
            }
        });
    }

    // Change Password Popup Logic (triggered from *within* Settings popup)
    if (changePasswordBtn_insideSettings && changePasswordPopup && closeChangePasswordPopup && changePasswordForm) {
        changePasswordBtn_insideSettings.addEventListener('click', () => {
            // Optionally hide settings popup when opening change password?
            // settingsPopup.classList.add('hidden'); 
            changePasswordPopup.classList.remove('hidden');
        });
        closeChangePasswordPopup.addEventListener('click', () => {
            changePasswordPopup.classList.add('hidden');
            if (changePasswordError) changePasswordError.classList.add('hidden'); 
            changePasswordForm.reset(); 
        });
        changePasswordPopup.addEventListener('click', (e) => { // Close on backdrop click
            if (e.target === changePasswordPopup) {
                closeChangePasswordPopup.click();
            }
        });

        // Change password form submission logic
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(changePasswordError) changePasswordError.classList.add('hidden');
            const formData = new FormData(changePasswordForm);
            const currentPassword = formData.get('currentPassword');
            const newPassword = formData.get('newPassword');
            const confirmPassword = formData.get('confirmPassword');

            if (newPassword !== confirmPassword) {
                if(changePasswordError) {
                    changePasswordError.textContent = 'New passwords do not match.';
                    changePasswordError.classList.remove('hidden');
                }
                return;
            }
            if (newPassword.length < 6) {
                 if(changePasswordError) {
                    changePasswordError.textContent = 'Password must be at least 6 characters long.';
                    changePasswordError.classList.remove('hidden');
                }
                return;
            }

            const user = auth.currentUser;
            if (!user || !user.email) {
                 if(changePasswordError) {
                    changePasswordError.textContent = 'User not found or email missing.';
                    changePasswordError.classList.remove('hidden');
                }
                return;
            }

            // Re-authenticate user
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            try {
                await reauthenticateWithCredential(user, credential);
                // User re-authenticated, now update password
                await updatePassword(user, newPassword);
                alert('Password updated successfully!');
                closeChangePasswordPopup.click(); // Close the popup
            } catch (error) {
                console.error('Error updating password:', error);
                let errorMsg = 'An error occurred. Please try again.';
                if (error.code === 'auth/wrong-password') {
                    errorMsg = 'Incorrect current password.';
                } else if (error.code === 'auth/too-many-requests') {
                    errorMsg = 'Too many attempts. Please try again later.';
                }
                if(changePasswordError) {
                    changePasswordError.textContent = errorMsg;
                    changePasswordError.classList.remove('hidden');
                }
            }
        });
    }
}

// Call initializeSettingsPopup after generating drawer content
function setupEventListeners(auth, db) {
    if (!auth || !db) {
        console.error('Auth or Firestore not initialized in setupEventListeners', {auth: !!auth, db: !!db});
        return;
    }
    
    // Check if db is a function (AdminSide/firebase.js style) or an object
    let firestore;
    try {
        if (typeof db === 'function') {
            console.log('DB is a function in setupEventListeners, calling it');
            firestore = db();
        } else if (db.collection && typeof db.collection === 'function') {
            console.log('DB has collection method in setupEventListeners, using directly');
            firestore = db;
        } else if (db.firestore && typeof db.firestore === 'function') {
            console.log('DB has firestore method in setupEventListeners, calling it');
            firestore = db.firestore();
        } else if (window.firebaseDb) {
            console.log('Using window.firebaseDb as fallback in setupEventListeners');
            firestore = window.firebaseDb;
        } else if (window.firebase && window.firebase.firestore) {
            console.log('Using window.firebase.firestore as fallback in setupEventListeners');
            firestore = window.firebase.firestore();
        } else {
            console.error('Unable to determine valid Firestore instance in setupEventListeners');
            return;
        }
    } catch (error) {
        console.error('Error getting Firestore instance in setupEventListeners:', error);
        return;
    }
    
    // Validate that firestore is properly initialized
    if (!firestore || (typeof firestore.collection !== 'function' && !isFirebaseV9)) {
        console.error('Failed to initialize a valid Firestore instance in setupEventListeners');
        return;
    }
    
    console.log('Successfully initialized Firestore instance in setupEventListeners:', !!firestore);
    
    initializeSettingsPopup(auth, firestore);
    
    // Add booking button functionality
    // Check for both possible IDs since different parts of the code might use different IDs
    const bookingsBtn = document.getElementById('drawerBookingsBtn') || document.getElementById('myBookingsBtn');
    const drawer = document.getElementById('userDrawer'); // Get drawer reference
    
    if (bookingsBtn) {
        console.log('Found bookings button: ', bookingsBtn.id);
        
        bookingsBtn.addEventListener('click', () => {
            console.log('Bookings button clicked');
            
            if (window.showBookingsModal) {
                console.log('Calling global showBookingsModal function');
                window.showBookingsModal();
                if (drawer) drawer.classList.add('translate-x-full'); // Close the drawer
            } else {
                console.log('showBookingsModal function not available, creating fallback...');
                
                // Create fallback function
                window.showBookingsModal = function() {
                    console.log('Using fallback showBookingsModal function');
                    const bookingsPopup = document.getElementById('bookingsPopup');
                    if (bookingsPopup) {
                        // Show the bookings popup
                        bookingsPopup.classList.remove('hidden');
                        
                        // Activate the history tab by default
                        const tabButtons = bookingsPopup.querySelectorAll('[data-tab]');
                        tabButtons.forEach(btn => {
                            const isHistoryTab = btn.dataset.tab === 'history';
                            btn.classList.toggle('text-blue-600', isHistoryTab);
                            btn.classList.toggle('border-b-2', isHistoryTab);
                            btn.classList.toggle('border-blue-600', isHistoryTab);
                            btn.classList.toggle('text-gray-500', !isHistoryTab);
                        });
                        
                        // Show history container, hide others
                        const currentBookings = document.getElementById('currentBookings');
                        const previousBookings = document.getElementById('previousBookings');
                        const bookingHistoryContainer = document.getElementById('bookingHistoryContainer');
                        
                        if (currentBookings) currentBookings.classList.add('hidden');
                        if (previousBookings) previousBookings.classList.add('hidden');
                        if (bookingHistoryContainer) bookingHistoryContainer.classList.remove('hidden');
                    } else if (typeof window.loadBookingHistory === 'function') {
                        // Try to load booking history if function exists
                        window.loadBookingHistory();
                    } else {
                        // If no popup or function, redirect to dashboard with bookings anchor
                        console.error('Bookings popup not found in DOM');
                        const baseUrl = window.location.origin || 'https://lms-app-2b903.web.app';
                        window.location.href = `${baseUrl}/Dashboard/Dashboard.html#bookings`;
                    }
                };
                
                // Now use our newly created function
                window.showBookingsModal();
                if (drawer) drawer.classList.add('translate-x-full'); // Close the drawer
            }
        });
    } else {
        console.warn('Bookings button not found in the DOM');
    }
    
    // Also set up the settings button
    const settingsBtn = document.getElementById('settingsBtn') || document.getElementById('showSettingsBtn');
    if (settingsBtn) {
        console.log('Found settings button: ', settingsBtn.id);
        // The actual click handler is set up in initializeSettingsPopup
    } else {
        console.warn('Settings button not found in the DOM');
    }
}

// Function to get user data from Firestore
function getUserData(userId) {
  return new Promise((resolve, reject) => {
    console.log(`Getting user data for ${userId}. Using Firebase v${isFirebaseV9 ? '9' : '8'}`);
    
    if (!db) {
      console.error("Firestore is not initialized");
      reject(new Error("Firestore not initialized"));
      return;
    }
    
    try {
      if (isFirebaseV9) {
        console.log("Using Firebase v9 to get user data");
        // V9 approach
        const userRef = doc(db, "users", userId);
        getDoc(userRef)
          .then(snapshot => {
            console.log("Got user data snapshot (v9):", snapshot);
            const userData = getDocData(snapshot);
            resolve(userData);
          })
          .catch(error => {
            console.error("Error getting user data (v9):", error);
            reject(error);
          });
      } else {
        console.log("Using Firebase v8 to get user data");
        // V8 approach
        const userRef = db.collection("users").doc(userId);
        userRef.get()
          .then(snapshot => {
            console.log("Got user data snapshot (v8):", snapshot);
            const userData = getDocData(snapshot);
            resolve(userData);
          })
          .catch(error => {
            console.error("Error getting user data (v8):", error);
            reject(error);
          });
      }
    } catch (error) {
      console.error("Error in getUserData function:", error);
      reject(error);
    }
  });
}

// Function to update user data in Firestore
function updateUserData(userId, userData) {
  return new Promise((resolve, reject) => {
    console.log(`Updating user data for ${userId}. Using Firebase v${isFirebaseV9 ? '9' : '8'}`);
    console.log("Update data:", userData);
    
    if (!db) {
      console.error("Firestore is not initialized");
      reject(new Error("Firestore not initialized"));
      return;
    }
    
    try {
      if (isFirebaseV9) {
        console.log("Using Firebase v9 to update user data");
        // V9 approach
        const userRef = doc(db, "users", userId);
        updateDoc(userRef, userData)
          .then(() => {
            console.log("User data updated successfully (v9)");
            resolve();
          })
          .catch(error => {
            console.error("Error updating user data (v9):", error);
            reject(error);
          });
      } else {
        console.log("Using Firebase v8 to update user data");
        // V8 approach
        const userRef = db.collection("users").doc(userId);
        userRef.update(userData)
          .then(() => {
            console.log("User data updated successfully (v8)");
            resolve();
          })
          .catch(error => {
            console.error("Error updating user data (v8):", error);
            reject(error);
          });
      }
    } catch (error) {
      console.error("Error in updateUserData function:", error);
      reject(error);
    }
  });
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
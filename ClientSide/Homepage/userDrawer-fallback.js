/**
 * userDrawer-fallback.js - A non-module version of the user drawer functionality
 * This file is used when the ES6 module version of userDrawer.js fails to load
 */

(function() {
  console.log('userDrawer-fallback.js loaded');
  
  // The main initialization function
  window.initializeUserDrawer = function(auth, db) {
    console.log('Initializing user drawer with fallback script');
    
    if (window.userDrawerInitialized) {
      console.log('User drawer already initialized');
      return;
    }
    
    // Check if db is a function (from AdminSide/firebase.js) and call it if needed
    let firestore = db;
    if (typeof db === 'function') {
      try {
        console.log('Converting db function to actual Firestore instance');
        firestore = db();
      } catch (error) {
        console.error('Error calling db function:', error);
        // Try fallback to window.firebaseDb
        if (window.firebaseDb) {
          console.log('Falling back to window.firebaseDb');
          firestore = window.firebaseDb;
        } else {
          console.error('No Firestore instance available');
          // Show error message to user
          const userDrawer = document.getElementById('userDrawer');
          if (userDrawer && userDrawer.querySelector('.drawer-content')) {
            userDrawer.querySelector('.drawer-content').innerHTML = `
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
          return;
        }
      }
    }
    
    const userIconBtn = document.getElementById('userIconBtn');
    const drawer = document.getElementById('userDrawer');
    
    if (!userIconBtn || !drawer) {
      console.error('Required elements not found:', { userIconBtn: !!userIconBtn, drawer: !!drawer });
      
      // Try to find alternative elements
      const alternativeUserBtn = document.querySelector('button.nav-button i.ri-user-line')?.parentElement;
      if (!userIconBtn && alternativeUserBtn) {
        console.log('Found alternative user button');
        userIconBtn = alternativeUserBtn;
      }
      
      // Create drawer if missing
      if (!drawer) {
        console.log('Creating missing drawer element');
        const newDrawer = document.createElement('div');
        newDrawer.id = 'userDrawer';
        newDrawer.className = 'fixed top-0 right-0 w-80 h-full bg-white shadow-xl transform translate-x-full transition-transform duration-300 ease-in-out z-[200000]';
        document.body.appendChild(newDrawer);
        drawer = newDrawer;
      } else {
        // Update existing drawer styles
        drawer.classList.remove('w-96');
        drawer.classList.add('w-80');
      }
      
      if (!userIconBtn || !drawer) {
        console.error('Still missing required elements after recovery attempt');
        return;
      }
    }
    
    // Update drawer styles
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
    
    // Toggle drawer when user icon is clicked
    userIconBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      drawer.classList.remove('translate-x-full');
      
      // Force update content on open
      if (auth) {
        updateDrawerContent(auth.currentUser);
      } else {
        updateDrawerContent(null);
      }
    });
    
    // Update drawer content
    function updateDrawerContent(user) {
      try {
        const content = drawer.querySelector('#userDrawerContent') || 
                      drawer.querySelector('.drawer-content');
        
        if (!content) {
          console.error('Drawer content container not found');
          return;
        }
        
        if (user) {
          // User is signed in
          content.innerHTML = `
            <div class="py-4">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold">User Profile</h3>
                <button id="closeDrawerInner" class="text-gray-500 hover:text-gray-700">
                  <i class="ri-close-line text-2xl"></i>
                </button>
              </div>
              <div class="flex justify-center mb-4">
                <div class="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                  ${user.photoURL ? 
                    `<img src="${user.photoURL}" alt="${user.displayName || 'User'}" class="w-16 h-16 rounded-full">` :
                    `<span class="text-2xl text-blue-600">${(user.displayName || user.email || 'U').charAt(0).toUpperCase()}</span>`}
                </div>
              </div>
              <h3 class="text-center text-lg font-bold mb-1">${user.displayName || 'LodgeEase User'}</h3>
              <p class="text-center text-gray-500 mb-6 text-sm">${user.email || ''}</p>
              
              <div class="space-y-2">
                <button class="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded flex items-center text-sm" id="drawerBookingsBtn">
                  <i class="ri-calendar-line mr-2"></i>
                  <span>My Bookings</span>
                </button>
                <button class="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded flex items-center text-sm" id="drawerDashboardBtn">
                  <i class="ri-dashboard-line mr-2"></i>
                  <span>Dashboard</span>
                </button>
                <button class="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded flex items-center text-sm" id="drawerSignOutBtn">
                  <i class="ri-logout-box-line mr-2"></i>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          `;
          
          // Add bookings button handler
          const bookingsBtn = content.querySelector('#drawerBookingsBtn');
          if (bookingsBtn) {
            bookingsBtn.addEventListener('click', function() {
              if (typeof window.showBookingsModal === 'function') {
                console.log('Using existing showBookingsModal function');
                window.showBookingsModal();
                drawer.classList.add('translate-x-full');
              } else {
                console.log('showBookingsModal function not available, creating fallback...');
                
                // Create a fallback function if it doesn't exist
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
                    console.log('No bookings popup found, redirecting to dashboard');
                    const baseUrl = window.location.origin || 'https://lms-app-2b903.web.app';
                    window.location.href = `${baseUrl}/Dashboard/Dashboard.html#bookings`;
                  }
                };
                
                // Now use our newly created function
                window.showBookingsModal();
                drawer.classList.add('translate-x-full');
              }
            });
          }
          
          // Add dashboard button handler
          const dashboardBtn = content.querySelector('#drawerDashboardBtn');
          if (dashboardBtn) {
            dashboardBtn.addEventListener('click', function() {
              // Create adaptive Dashboard URL
              const baseUrl = window.location.origin || 'https://lms-app-2b903.web.app';
              window.location.href = `${baseUrl}/Dashboard/Dashboard.html`;
            });
          }
          
          // Add sign out button handler
          const signOutBtn = content.querySelector('#drawerSignOutBtn');
          if (signOutBtn && auth) {
            signOutBtn.addEventListener('click', function() {
              auth.signOut().then(function() {
                drawer.classList.add('translate-x-full');
                console.log('User signed out');
                updateDrawerContent(null); // Update drawer immediately
                
                // Handle login button visibility
                updateLoginButtonVisibility(null);
              }).catch(function(error) {
                console.error('Sign out error', error);
              });
            });
          }

          // Add inner close button functionality
          const innerCloseBtn = content.querySelector('#closeDrawerInner');
          if (innerCloseBtn) {
            innerCloseBtn.addEventListener('click', function() {
              drawer.classList.add('translate-x-full');
            });
          }
        } else {
          // User is signed out
          content.innerHTML = `
            <div class="py-6 text-center">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold">User Profile</h3>
                <button id="closeDrawerInner" class="text-gray-500 hover:text-gray-700">
                  <i class="ri-close-line text-2xl"></i>
                </button>
              </div>
              <div class="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <i class="ri-user-line text-2xl text-gray-400"></i>
              </div>
              <p class="mb-6 text-sm">Please sign in to access your profile</p>
              <a href="../Login/index.html" class="inline-block bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700 transition-colors text-sm">
                Sign In
              </a>
              <p class="mt-4 text-xs text-gray-500">
                Don't have an account? 
                <a href="../Login/index.html#signup" class="text-blue-600 hover:underline">Sign Up</a>
              </p>
            </div>
          `;

          // Add inner close button functionality
          const innerCloseBtn = content.querySelector('#closeDrawerInner');
          if (innerCloseBtn) {
            innerCloseBtn.addEventListener('click', function() {
              drawer.classList.add('translate-x-full');
            });
          }
        }
      } catch (error) {
        console.error('Error updating drawer content:', error);
      }
    }
    
    // Make updateDrawerContent available globally
    window.updateDrawerContent = updateDrawerContent;
    
    // Function to handle login button visibility
    function updateLoginButtonVisibility(user) {
      const loginButton = document.getElementById('loginButton');
      const mobileLoginButton = document.getElementById('mobileLoginButton');
      
      if (loginButton) {
        loginButton.style.display = user ? 'none' : 'flex';
      }
      
      if (mobileLoginButton) {
        mobileLoginButton.style.display = user ? 'none' : 'block';
      }
    }
    
    // Close when clicking outside
    document.addEventListener('click', function(e) {
      if (drawer && !drawer.classList.contains('translate-x-full') && 
          e.target !== userIconBtn && 
          !drawer.contains(e.target) && 
          !userIconBtn.contains(e.target)) {
        drawer.classList.add('translate-x-full');
      }
    });
    
    // Listen for auth state changes
    if (auth) {
      auth.onAuthStateChanged(function(user) {
        updateDrawerContent(user);
        updateLoginButtonVisibility(user);
      });
    } else {
      updateDrawerContent(null);
    }
    
    // Store the firestore reference globally for other functions to use
    window.userDrawerFirestore = firestore;
    
    // Mark drawer as initialized
    window.userDrawerInitialized = true;
    console.log('User drawer initialization complete');
  };
  
  // Function to check and get Firebase objects
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
        console.log('Found firebase.auth as a function');
        
        // Try to get firestore
        let db = null;
        if (window.firebase.firestore && typeof window.firebase.firestore === 'function') {
          db = window.firebase.firestore();
        }
        
        return { 
          auth: window.firebase.auth(), 
          db: db 
        };
      }
      
      // Check if auth is already initialized
      if (window.firebase.auth && typeof window.firebase.auth === 'object') {
        console.log('Found firebase.auth as an object');
        
        // Try to get firestore
        let db = null;
        if (window.firebase.firestore) {
          db = typeof window.firebase.firestore === 'function' 
            ? window.firebase.firestore() 
            : window.firebase.firestore;
        }
        
        return { 
          auth: window.firebase.auth, 
          db: db 
        };
      }
    }
    
    // Try to find Firebase in global scope
    if (typeof auth !== 'undefined' && auth) {
      console.log('Found global auth variable');
      let db = typeof db !== 'undefined' ? db : null;
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
  
  // Setup auto-initialization with retries
  function setupAutoInit() {
    let attempts = 0;
    const maxAttempts = 5; // Increased from 3 to 5
    
    function tryInitialize() {
      try {
        if (window.userDrawerInitialized) {
          console.log('User drawer already initialized, skipping auto-init');
          return;
        }
        
        attempts++;
        console.log(`Auto-initialization attempt ${attempts}/${maxAttempts}`);
        
        const firebaseInstances = getFirebaseInstances();
        if (firebaseInstances) {
          console.log('Found Firebase instances for auto-init');
          window.initializeUserDrawer(firebaseInstances.auth, firebaseInstances.db);
          return true;
        } else {
          console.log('Firebase instances not found yet');
          
          // On the last attempt, try to import Firebase directly
          if (attempts === maxAttempts - 1) {
            console.log('Attempting to dynamically import Firebase...');
            
            // Try to import Firebase from relative paths
            try {
              import('../firebase.js')
                .then(module => {
                  console.log('Successfully imported Firebase module');
                  window.firebaseModule = module;
                  window.firebaseAuth = module.auth;
                  window.firebaseDb = module.db;
                  window.initializeUserDrawer(module.auth, module.db);
                })
                .catch(error => {
                  console.error('Failed to import Firebase from ../firebase.js:', error);
                  
                  // Try alternative path
                  import('../../firebase.js')
                    .then(module => {
                      console.log('Successfully imported Firebase from alternative path');
                      window.firebaseModule = module;
                      window.firebaseAuth = module.auth;
                      window.firebaseDb = module.db;
                      window.initializeUserDrawer(module.auth, module.db);
                    })
                    .catch(innerError => {
                      console.error('Failed to import Firebase from ../../firebase.js:', innerError);
                      console.error('Initializing without auth as last resort');
                      window.initializeUserDrawer(null, null);
                    });
                });
            } catch (importError) {
              console.error('Dynamic import not supported:', importError);
              // Continue with normal retry flow
              setTimeout(tryInitialize, Math.min(attempts * 1500, 5000));
            }
          } else if (attempts < maxAttempts) {
            // Try again with increasing delay
            const delay = Math.min(attempts * 1500, 5000); // Longer delays between attempts
            console.log(`Retrying in ${delay}ms...`);
            setTimeout(tryInitialize, delay);
          } else {
            console.error('Max attempts reached, initializing without auth');
            // Initialize without auth as a last resort
            window.initializeUserDrawer(null, null);
          }
        }
      } catch (e) {
        console.error('Error during auto-initialization:', e);
        if (attempts < maxAttempts) {
          const delay = Math.min(attempts * 1500, 5000);
          setTimeout(tryInitialize, delay);
        } else {
          console.error('Failed to auto-initialize after multiple attempts');
          // Try one last time without auth
          try {
            window.initializeUserDrawer(null, null);
          } catch (finalError) {
            console.error('Final initialization attempt failed:', finalError);
          }
        }
      }
    }
    
    // Start initialization process with a slight delay
    // to allow for other scripts to load
    setTimeout(tryInitialize, 300);
  }
  
  // Document loaded or loading - start auto-init process
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAutoInit);
  } else {
    setupAutoInit();
  }
})(); 
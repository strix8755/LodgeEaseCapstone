/**
 * userDrawer-fallback.js - A non-module version of the user drawer functionality
 * This file is used when the ES6 module version of userDrawer.js fails to load
 */

(function() {
  console.log('userDrawer-fallback.js loaded');
  
  // The main initialization function
  window.initializeUserDrawer = function(auth, db) {
    console.log('Initializing user drawer with auth and db');
    
    // Ensure DOM is ready
    if (!document || !document.body) {
      console.log('Document not ready, scheduling initialization for DOMContentLoaded');
      const initWhenReady = function() {
        window.initializeUserDrawer(auth, db);
        document.removeEventListener('DOMContentLoaded', initWhenReady);
      };
      document.addEventListener('DOMContentLoaded', initWhenReady);
      return;
    }
    
    // Set flag to avoid duplicate initialization
    if (window.userDrawerInitialized) {
      console.log('User drawer already initialized, skipping');
      return;
    }
    
    window.userDrawerInitialized = true;
    
    // Check if db is a function (from AdminSide/firebase.js) and call it if needed
    let firestore = db;
    
    // First check if db is null or undefined and try to find another source
    if (!db) {
      console.log('db parameter is null or undefined, trying to find alternative sources');
      if (window.firebaseDb) {
        console.log('Using window.firebaseDb');
        firestore = window.firebaseDb;
      } else if (window.firebase && window.firebase.firestore) {
        console.log('Using window.firebase.firestore()');
        firestore = window.firebase.firestore();
      } else if (window.firebaseModule && window.firebaseModule.db) {
        console.log('Using window.firebaseModule.db');
        firestore = window.firebaseModule.db;
      } else if (window.directDb) {
        console.log('Using window.directDb');
        firestore = window.directDb;
      } else {
        console.warn('No Firestore instance found in known locations');
      }
    } else if (typeof db === 'function') {
      try {
        console.log('Converting db function to actual Firestore instance');
        firestore = db();
      } catch (error) {
        console.error('Error calling db function:', error);
        // Try fallback to window.firebaseDb
        if (window.firebaseDb) {
          console.log('Falling back to window.firebaseDb');
          firestore = window.firebaseDb;
        } else if (window.firebaseModule && window.firebaseModule.db) {
          console.log('Falling back to window.firebaseModule.db');
          firestore = window.firebaseModule.db;
        } else if (window.directDb) {
          console.log('Falling back to window.directDb');
          firestore = window.directDb;
        } else {
          console.error('No Firestore instance available after db function failed');
        }
      }
    }
    
    // Check if firestore has the collection method, if not, try to fix it
    if (firestore && typeof firestore.collection !== 'function') {
      console.warn('Firestore instance does not have collection method');
      
      try {
        // Try to get a proper Firestore instance
        if (firestore.firestore && typeof firestore.firestore === 'function') {
          console.log('Getting Firestore instance via firestore.firestore()');
          firestore = firestore.firestore();
        } else if (window.firebase && window.firebase.firestore) {
          console.log('Getting Firestore instance via window.firebase.firestore()');
          firestore = window.firebase.firestore();
        } else {
          // Create a custom adapter with collection method
          console.log('Creating custom Firestore adapter with collection method');
          const originalFirestore = firestore;
          
          firestore = {
            collection: function(collectionPath) {
              console.log(`Custom adapter: accessing collection ${collectionPath}`);
              return {
                where: function(field, operator, value) {
                  console.log(`Custom adapter: where clause ${field} ${operator} ${value}`);
                  return {
                    get: function() {
                      console.log(`Custom adapter: executing get() for ${collectionPath}`);
                      return Promise.resolve({
                        empty: true,
                        docs: [],
                        forEach: function(callback) {
                          console.log('Custom adapter: forEach called but no docs to iterate');
                        }
                      });
                    },
                    onSnapshot: function(callback) {
                      console.log(`Custom adapter: onSnapshot registered for ${collectionPath}`);
                      // Immediately call the callback with empty results
                      setTimeout(() => {
                        callback({
                          empty: true,
                          docs: [],
                          forEach: function(cb) {}
                        });
                      }, 10);
                      
                      // Return an unsubscribe function
                      return function() {
                        console.log('Custom adapter: unsubscribe from onSnapshot');
                      };
                    }
                  };
                },
                doc: function(docId) {
                  console.log(`Custom adapter: accessing document ${docId} in ${collectionPath}`);
                  return {
                    get: function() {
                      console.log(`Custom adapter: getting document ${docId}`);
                      return Promise.resolve({
                        exists: false,
                        id: docId,
                        data: function() { return null; }
                      });
                    },
                    onSnapshot: function(callback) {
                      console.log(`Custom adapter: onSnapshot for document ${docId}`);
                      setTimeout(() => {
                        callback({
                          exists: false,
                          id: docId,
                          data: function() { return null; }
                        });
                      }, 10);
                      
                      return function() {
                        console.log('Custom adapter: unsubscribe from doc onSnapshot');
                      };
                    }
                  };
                },
                orderBy: function(field, direction) {
                  console.log(`Custom adapter: orderBy ${field} ${direction || 'asc'}`);
                  // Return the same interface to allow chaining
                  return this;
                },
                limit: function(limitCount) {
                  console.log(`Custom adapter: limit ${limitCount}`);
                  // Return the same interface to allow chaining
                  return this;
                },
                get: function() {
                  console.log(`Custom adapter: direct get() on collection ${collectionPath}`);
                  return Promise.resolve({
                    empty: true,
                    docs: [],
                    forEach: function(callback) {
                      console.log('Custom adapter: forEach called but no docs to iterate');
                    }
                  });
                }
              };
            },
            // Store the original firestore reference
            _original: originalFirestore,
            
            // Add doc method for direct document access
            doc: function(path) {
              console.log(`Custom adapter: direct doc access ${path}`);
              return {
                get: function() {
                  console.log(`Custom adapter: getting doc ${path}`);
                  return Promise.resolve({
                    exists: false,
                    id: path.split('/').pop(),
                    data: function() { return null; }
                  });
                },
                set: function(data) {
                  console.log(`Custom adapter: attempted to set data on ${path}`, data);
                  return Promise.resolve();
                },
                update: function(data) {
                  console.log(`Custom adapter: attempted to update ${path}`, data);
                  return Promise.resolve();
                },
                delete: function() {
                  console.log(`Custom adapter: attempted to delete ${path}`);
                  return Promise.resolve();
                }
              };
            },
            
            // Add batch functionality
            batch: function() {
              return {
                set: function() { return this; },
                update: function() { return this; },
                delete: function() { return this; },
                commit: function() { return Promise.resolve(); }
              };
            },
            
            // Required for Firestore module compatibility
            FieldValue: {
              serverTimestamp: function() { 
                return { 
                  _isServerTimestamp: true,
                  toMillis: function() { return Date.now(); }
                }; 
              },
              delete: function() { return { _isFieldDelete: true }; }
            }
          };
          
          console.warn('Created stub Firestore adapter with limited functionality');
        }
      } catch (error) {
        console.error('Failed to fix Firestore instance:', error);
        
        // Log an error to make it clear there's an issue
        console.error('Failed to initialize a valid Firestore instance with collection method');
      }
    }
    
    // Verify if we have a valid Firestore instance now
    if (firestore && typeof firestore.collection === 'function') {
      console.log('Successfully initialized Firestore with collection method');
    } else {
      console.error('Still no valid Firestore instance with collection method available');
    }
    
    let userIconBtn = document.getElementById('userIconBtn');
    let drawer = document.getElementById('userDrawer');
    
    if (!userIconBtn || !drawer) {
      console.error('Required elements not found:', { userIconBtn: !!userIconBtn, drawer: !!drawer });
      
      // Try to find alternative elements for the user button
      if (!userIconBtn) {
        // Try various selectors that might be used for user icon buttons
        const alternativeSelectors = [
          'button.nav-button i.ri-user-line',
          'button.user-button',
          'a.user-link',
          '.user-profile-icon',
          'button.profile-btn',
          'a[href*="profile"]',
          '.nav-item:has(i.fa-user)',
          '.nav-item:has(i.ri-user-line)'
        ];
        
        for (const selector of alternativeSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            userIconBtn = element.tagName === 'I' ? element.parentElement : element;
            console.log('Found alternative user button with selector:', selector);
            break;
          }
        }
        
        // If still not found, create one
        if (!userIconBtn && document.body) {
          console.log('Creating a user icon button');
          userIconBtn = document.createElement('button');
          userIconBtn.id = 'userIconBtn';
          userIconBtn.className = 'fixed top-4 right-4 bg-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg';
          userIconBtn.innerHTML = '<i class="ri-user-line"></i>';
          document.body.appendChild(userIconBtn);
        }
      }
      
      // Create drawer if missing
      if (!drawer && document.body) {
        console.log('Creating missing drawer element');
        drawer = document.createElement('div');
        drawer.id = 'userDrawer';
        drawer.className = 'fixed top-0 right-0 w-80 h-full bg-white shadow-xl transform translate-x-full transition-transform duration-300 ease-in-out z-[200000]';
        document.body.appendChild(drawer);
        
        // Create overlay for drawer
        const overlay = document.createElement('div');
        overlay.id = 'drawerOverlay';
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 hidden z-[199999]';
        overlay.addEventListener('click', function() {
          drawer.classList.add('translate-x-full');
          overlay.classList.add('hidden');
        });
        document.body.appendChild(overlay);
      }
      
      if (!userIconBtn || !drawer) {
        console.error('Still missing required elements after recovery attempt');
        console.log('Will try again when document is fully loaded');
        
        // Try again when document is ready
        if (document.readyState !== 'complete') {
          const retryInit = function() {
            window.initializeUserDrawer(auth, db);
            window.removeEventListener('load', retryInit);
          };
          window.addEventListener('load', retryInit);
        }
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
      
      // Toggle drawer visibility
      drawer.classList.remove('translate-x-full');
      
      // Show overlay if it exists
      const overlay = document.getElementById('drawerOverlay');
      if (overlay) {
        overlay.classList.remove('hidden');
      }
      
      // Force update content on open
      if (auth) {
        updateDrawerContent(auth.currentUser);
      } else {
        updateDrawerContent(null);
      }
    });
    
    // Add click event to close drawer when clicking outside
    document.addEventListener('click', function(e) {
      // Skip if drawer is already hidden or if clicking inside the drawer
      if (drawer.classList.contains('translate-x-full') || drawer.contains(e.target) || userIconBtn.contains(e.target)) {
        return;
      }
      
      // Close drawer
      drawer.classList.add('translate-x-full');
      
      // Hide overlay
      const overlay = document.getElementById('drawerOverlay');
      if (overlay) {
        overlay.classList.add('hidden');
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
                
                // Hide overlay
                const overlay = document.getElementById('drawerOverlay');
                if (overlay) {
                  overlay.classList.add('hidden');
                }
              } else {
                console.log('showBookingsModal function not available, creating fallback...');
                
                // Create a fallback function if it doesn't exist
                window.showBookingsModal = function() {
                  console.log('Using fallback showBookingsModal function');
                  
                  // Close the drawer
                  const drawer = document.getElementById('userDrawer');
                  if (drawer) {
                    drawer.classList.add('translate-x-full');
                  }
                  
                  // Hide overlay
                  const overlay = document.getElementById('drawerOverlay');
                  if (overlay) {
                    overlay.classList.add('hidden');
                  }
                  
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
                
                // Hide overlay
                const overlay = document.getElementById('drawerOverlay');
                if (overlay) {
                  overlay.classList.add('hidden');
                }
                
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
              
              // Hide overlay
              const overlay = document.getElementById('drawerOverlay');
              if (overlay) {
                overlay.classList.add('hidden');
              }
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
              
              // Hide overlay
              const overlay = document.getElementById('drawerOverlay');
              if (overlay) {
                overlay.classList.add('hidden');
              }
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

// Add immediate self-initialization at the end of the file
// This will run as soon as the script is loaded
(function immediateInit() {
  console.log('Running immediate UserDrawer initialization');
  
  // Check if already initialized
  if (window.userDrawerInitialized) {
    console.log('UserDrawer already initialized, skipping immediate init');
    return;
  }
  
  // Check if document.body is ready
  if (!document.body) {
    console.log('Document body not ready, deferring initialization to DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', function() {
      console.log('DOM is now ready, initializing UserDrawer');
      immediateInit();
    });
    return;
  }
  
  // Try to find Firebase instances
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
      window.initializeUserDrawer(auth, db);
      return;
    } catch (error) {
      console.error('Error in immediate initialization with window Firebase:', error);
    }
  }
  
  // If direct initialization fails, we'll rely on the auto-init in the main function
  console.log('Immediate initialization deferred to auto-init process');
})();

// Add a dedicated function to handle the close button in the drawer
function setupCloseButton() {
  console.log('Setting up inner close button handler');
  
  // Try to find the close button
  const closeButton = document.getElementById('closeDrawerInner');
  if (closeButton) {
    console.log('Found close button, adding click handler');
    
    // Add click handler
    closeButton.addEventListener('click', function() {
      console.log('Inner close button clicked');
      const drawer = document.getElementById('userDrawer');
      const overlay = document.getElementById('drawerOverlay');
      
      if (drawer) {
        drawer.classList.add('translate-x-full');
      }
      
      if (overlay) {
        overlay.classList.add('hidden');
      }
    });
  } else {
    console.log('Close button not found, will try again later');
    // Try again after a short delay
    setTimeout(setupCloseButton, 500);
  }
}

// Call the setup function immediately
setupCloseButton();

// Also call it when the DOM is ready
document.addEventListener('DOMContentLoaded', setupCloseButton); 
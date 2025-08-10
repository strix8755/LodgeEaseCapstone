document.addEventListener('DOMContentLoaded', () => {
    // Initialize lodge-specific functionality
    initializeLodgeDetails();
    initializeBooking();
    initializeGallery();
    initializeReviews();
});

// Add event listener for page load to check for pending bookings
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    // Initialize all event listeners
    initializeEventListeners();
  
    // Auth state observer
    auth.onAuthStateChanged((user) => {
      if (!user) {
        window.location.href = '../Login/index.html';
      }
    });
  
    // Add auth state observer to handle login button visibility
    auth.onAuthStateChanged((user) => {
      const loginButton = document.getElementById('loginButton');
      if (loginButton) {
        if (user) {
          loginButton.classList.add('hidden'); // Hide login button if user is logged in
        } else {
          loginButton.classList.remove('hidden'); // Show login button if user is logged out
        }
      }
    });
  });
  
// Copy the structure from lodge1.js and update as needed 
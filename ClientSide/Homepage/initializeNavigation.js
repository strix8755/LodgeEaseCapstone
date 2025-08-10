function initializeNavigation() {
    // Quick Search button handler
    const quickSearchBtn = document.getElementById('quickSearchBtn');
    if (quickSearchBtn) {
        quickSearchBtn.addEventListener('click', () => {
            const searchInput = document.querySelector('input[placeholder*="Search lodges"]');
            if (searchInput) {
                searchInput.scrollIntoView({ behavior: 'smooth' });
                searchInput.focus();
                
                // Highlight the search container
                const searchContainer = searchInput.closest('.search-container-wrapper');
                if (searchContainer) {
                    searchContainer.classList.add('highlight');
                    setTimeout(() => {
                        searchContainer.classList.remove('highlight');
                    }, 2000);
                }
            }
        });
    }

    // Add active state to current page
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-button').forEach(button => {
        if (button.getAttribute('href') && button.getAttribute('href').includes(currentPath)) {
            button.classList.add('active');
        }
    });
}

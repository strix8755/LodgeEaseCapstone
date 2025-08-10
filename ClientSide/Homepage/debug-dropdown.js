// Debug script for barangay dropdown
console.log('=== BARANGAY DROPDOWN DEBUG ===');

// Check if all required elements exist
function checkElements() {
    const elements = {
        barangayDropdownBtn: document.getElementById('barangayDropdownBtn'),
        barangayDropdown: document.getElementById('barangayDropdown'),
        barangayText: document.getElementById('barangayText'),
        barangayList: document.getElementById('barangayList'),
        barangaySearchInput: document.getElementById('barangaySearchInput')
    };
    
    console.log('Element check:');
    Object.entries(elements).forEach(([name, element]) => {
        console.log(`  ${name}: ${element ? 'FOUND' : 'MISSING'}`);
        if (element) {
            console.log(`    Classes: ${element.className}`);
            console.log(`    Visible: ${!element.classList.contains('hidden')}`);
        }
    });
    
    return elements;
}

// Check lodge cards and their barangay data
function checkLodgeCards() {
    const cards = document.querySelectorAll('.lodge-card');
    console.log(`\nLodge cards check (${cards.length} total):`);
    
    cards.forEach((card, index) => {
        const name = card.querySelector('h2')?.textContent || 'Unknown';
        const barangay = card.dataset.barangay;
        console.log(`  ${index + 1}. ${name} → barangay: "${barangay}"`);
    });
}

// Test dropdown functionality
function testDropdown() {
    console.log('\nTesting dropdown functionality...');
    const elements = checkElements();
    
    if (elements.barangayDropdownBtn && elements.barangayDropdown) {
        console.log('Simulating button click...');
        elements.barangayDropdownBtn.click();
        
        setTimeout(() => {
            const isVisible = !elements.barangayDropdown.classList.contains('hidden');
            console.log(`Dropdown visible after click: ${isVisible}`);
            
            // Check dropdown content
            const buttons = elements.barangayList?.querySelectorAll('button') || [];
            console.log(`Dropdown buttons found: ${buttons.length}`);
            
            if (buttons.length > 0) {
                console.log('First few button texts:');
                Array.from(buttons).slice(0, 5).forEach((btn, i) => {
                    console.log(`  ${i + 1}. "${btn.textContent}"`);
                });
            }
        }, 100);
    }
}

// Run debug on page load
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        checkElements();
        checkLodgeCards();
        
        // Add a global test function
        window.testBarangayDropdown = testDropdown;
        console.log('\nTo test dropdown manually, run: testBarangayDropdown()');
    }, 1000);
});

// Test function for manual use
window.debugBarangayDropdown = function() {
    checkElements();
    checkLodgeCards();
    testDropdown();
}; 
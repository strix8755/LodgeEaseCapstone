// Night selection and total cost calculation
document.getElementById('extension-nights').addEventListener('change', function() {
    const nights = this.value;
    const nightlyRate = 189;
    const totalCost = nights * nightlyRate;

    document.getElementById('selected-nights').textContent = nights;
    document.getElementById('total-cost').textContent = `$${totalCost}`;

    // Set default new checkout date based on current date and selected nights
    const currentCheckout = new Date('2024-11-18');
    const newCheckout = new Date(currentCheckout);
    newCheckout.setDate(currentCheckout.getDate() + parseInt(nights));
    
    const formatDate = (date) => {
        return date.toISOString().split('T')[0];
    };

    document.getElementById('new-checkout').value = formatDate(newCheckout);
});

document.getElementById('stay-extension-form').addEventListener('submit', function(e) {
    e.preventDefault();
    if (confirm('Are you sure you want to extend your stay?')) {
        alert('Stay extended successfully!');
        // Here you would typically send the extension request to the backend
    }
});

function cancelExtension() {
    document.getElementById('extension-nights').selectedIndex = 0;
    document.getElementById('new-checkout').value = '';
    document.getElementById('selected-nights').textContent = '0';
    document.getElementById('total-cost').textContent = '$0';
}

document.getElementById('extension-nights').addEventListener('change', function() {
    const nights = this.value || 0;
    document.getElementById('selected-nights').textContent = nights;
    document.getElementById('total-cost').textContent = `$${nights * 1189}`;
});
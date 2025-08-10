export function initializePaymentListeners() {
    const cardNumberInput = document.getElementById('card-number');
    const cardExpirationInput = document.getElementById('card-expiration');
    const cardCvvInput = document.getElementById('card-cvv');
    const cardZipInput = document.getElementById('card-zip');
    const cardCountrySelect = document.getElementById('card-country');
    const confirmButton = document.getElementById('confirm-button');

    function checkPaymentSelections() {
        const selectedPaymentType = document.querySelector('input[name="payment_type"]:checked');
        const selectedPaymentMethod = document.querySelector('input[name="payment_method"]:checked');
        
        if (selectedPaymentType && selectedPaymentMethod) {
            if (selectedPaymentMethod.value === 'gcash') {
                const gcashReference = document.getElementById('gcash-reference');
                confirmButton.disabled = !gcashReference || !gcashReference.value.trim();
            } else if (selectedPaymentMethod.value === 'card') {
                const hasCardDetails = cardNumberInput.value.trim() !== '' &&
                                     cardExpirationInput.value.trim() !== '' &&
                                     cardCvvInput.value.trim() !== '' &&
                                     cardZipInput.value.trim() !== '' &&
                                     cardCountrySelect.value !== '';
                
                confirmButton.disabled = !hasCardDetails;
            } else {
                confirmButton.disabled = false;
            }
        } else {
            confirmButton.disabled = true;
        }
    }

    // Add event listeners for payment type and method
    document.querySelectorAll('input[name="payment_type"]').forEach(input => {
        input.addEventListener('change', checkPaymentSelections);
    });

    document.querySelectorAll('input[name="payment_method"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const gcashForm = document.getElementById('gcash-form');
            const cardFields = document.getElementById('card-fields');
            
            // Hide all payment forms first
            if (gcashForm) gcashForm.classList.add('hidden');
            if (cardFields) cardFields.classList.add('hidden');

            // Show relevant form based on selection
            if (e.target.value === 'gcash') {
                gcashForm?.classList.remove('hidden');
                const gcashReference = document.getElementById('gcash-reference');
                if (gcashReference) {
                    gcashReference.value = '';
                    gcashReference.addEventListener('input', checkPaymentSelections);
                }
            } else if (e.target.value === 'card') {
                cardFields?.classList.remove('hidden');
            }
            checkPaymentSelections();
        });
    });

    // Add input event listeners for card fields
    [cardNumberInput, cardExpirationInput, cardCvvInput, cardZipInput, cardCountrySelect].forEach(input => {
        input.addEventListener('input', checkPaymentSelections);
    });

    // Set initial state
    confirmButton.disabled = true;
}

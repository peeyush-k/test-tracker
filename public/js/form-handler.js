document.addEventListener('DOMContentLoaded', function() {
    // Set today's date as default
    document.getElementById('test-date').value = new Date().toISOString().split('T')[0];
    
    // Handle custom total questions toggle
    const totalQuestionsSelect = document.getElementById('total-questions');
    const customTotalInput = document.getElementById('custom-total');
    
    totalQuestionsSelect.addEventListener('change', function() {
        customTotalInput.style.display = this.value === 'custom' ? 'block' : 'none';
        if (this.value !== 'custom') customTotalInput.value = '';
    });

    // Form submission handler
    document.getElementById('test-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = form.querySelector('.submit-btn');
        const originalBtnText = submitBtn.textContent;
        
        // Show loading state
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;
        
        try {
            // Process total questions
            let totalQuestions = totalQuestionsSelect.value;
            if (totalQuestions === 'custom') {
                totalQuestions = customTotalInput.value;
                if (!totalQuestions || totalQuestions < 1) {
                    throw new Error('Please enter valid total questions');
                }
            }

            // Calculate unattempted here
            const confidentAttempts = parseInt(form.querySelector('#confident-attempts').value);
            const guessedAttempts = parseInt(form.querySelector('#guessed-attempts').value);
            const unattempted = parseInt(totalQuestions) - confidentAttempts - guessedAttempts;

            if (unattempted < 0) {
                throw new Error(`Total attempts exceed ${totalQuestions} questions`);
            }

            // Prepare data with unattempted already calculated
            const testData = {
                date: form.querySelector('#test-date').value,
                testName: form.querySelector('#test-name').value.trim(),
                theme: form.querySelector('#theme').value,
                totalQuestions: parseInt(totalQuestions),
                confidentAttempts: confidentAttempts,
                correctConfident: parseInt(form.querySelector('#correct-confident').value),
                guessedAttempts: guessedAttempts,
                correctGuesses: parseInt(form.querySelector('#correct-guesses').value),
                unattempted: unattempted // Added here
            };

            const response = await fetch('/api/tests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testData)
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to save test');
            }

            submitBtn.textContent = '✓ Saved!';
            setTimeout(() => window.location.href = '/', 1000);
            
        } catch (error) {
            console.error('Error:', error);
            submitBtn.textContent = 'Error! Try Again';
            alert(error.message);
            setTimeout(() => {
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            }, 2000);
        }
    });
});
/**
 * This script manages the descriptive, description-based self-grader.
 * It allows users to select a level that best describes their ability
 * and see their recommended grade.
 */
document.addEventListener('DOMContentLoaded', function() {
    const showGradeBtn = document.getElementById('show-grade-btn');
    const resultContainer = document.getElementById('desc-grader-result');
    const form = document.getElementById('desc-grader-form');

    // Ensure all required elements are on the page before proceeding.
    if (!showGradeBtn || !resultContainer || !form) {
        return;
    }

    showGradeBtn.addEventListener('click', function() {
        const selectedGrade = form.querySelector('input[name="grade"]:checked');

        if (selectedGrade) {
            const grade = selectedGrade.value;
            resultContainer.innerHTML = `
                <h3 class="text-xl font-serif font-bold text-emerald-800">Your Recommended Grade is Level ${grade}</h3>
                <p class="text-sm text-emerald-700 mt-2">You can now use this grade when registering for events. You can always revise it later.</p>
                <div class="mt-4">
                    <a href="join.html" class="text-sm font-semibold text-brandGreen-700 hover:underline">← Back to Main Join Page</a>
                </div>
            `;
            resultContainer.classList.remove('hidden');
            resultContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // Use the global showToast function from main.js
            showToast('Selection Needed', 'Please select the level that best describes you.', false);
        }
    });
});
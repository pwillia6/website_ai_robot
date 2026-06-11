document.addEventListener('DOMContentLoaded', function() {
    const graderProceedBtn = document.getElementById('grader-proceed-btn');
    const graderBackBtn = document.getElementById('grader-back-btn');
    const graderStepAbout = document.getElementById('grader-step-about');
    const graderStepForm = document.getElementById('grader-step-form');
    const instrumentSelect = document.getElementById('instrument-select');
    const graderFormContainer = document.getElementById('grader-form-container');
    const graderAssessBtn = document.getElementById('grader-assess-btn');

    if (graderProceedBtn && graderStepAbout && graderStepForm) {
        graderProceedBtn.addEventListener('click', function() {
            graderStepAbout.classList.add('hidden');
            graderStepForm.classList.remove('hidden');
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    if (graderBackBtn && graderStepAbout && graderStepForm) {
        graderBackBtn.addEventListener('click', function() {
            graderStepForm.classList.add('hidden');
            graderStepAbout.classList.remove('hidden');
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
            // Reset form state when going back
            if (instrumentSelect) instrumentSelect.value = '-1';
            if (graderFormContainer) graderFormContainer.innerHTML = '';
            if (graderAssessBtn) graderAssessBtn.classList.add('hidden');
        });
    }
});
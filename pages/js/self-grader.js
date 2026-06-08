/**
 * This script manages the interactive self-grader functionality on the "Join Us" page.
 * It handles the following responsibilities:
 * 1. Fetching the self-grading data from a JSON file.
 * 2. Managing the multi-step UI flow (About -> Instrument Selection -> Assessment).
 * 3. Dynamically building the assessment form based on the user's chosen instrument.
 * 4. Calculating the user's self-grade based on their answers.
 * 5. Displaying the final grade in a modal.
 * 6. Applying the calculated grade to the registration form on the same page.
 */
document.addEventListener('DOMContentLoaded', function() {

    // --- DOM Element Selection ---
    // Select all necessary elements from the DOM to avoid repeated queries.
    
    // Main container for the grader application
    const graderApp = document.getElementById('grader-app');
    
    // If the grader container doesn't exist on the page, stop execution.
    if (!graderApp) {
        return; 
    }

    // Grader steps
    const graderStepAbout = document.getElementById('grader-step-about');
    const graderStepForm = document.getElementById('grader-step-form');
    
    // Grader controls
    const graderProceedBtn = document.getElementById('grader-proceed-btn');
    const instrumentSelect = document.getElementById('instrument-select');
    const graderFormContainer = document.getElementById('grader-form-container');
    const assessBtn = document.getElementById('grader-assess-btn');

    // Results Modal elements
    const resultsModal = document.getElementById('grader-results-modal');
    const resultsModalClose = document.getElementById('grader-results-close');
    const applyGradeBtn = document.getElementById('grader-apply-btn');
    const sgResultContainer = document.getElementById('sg-result-container');

    // Element from the registration form to apply the grade to.
    const regGradeInput = document.getElementById('reg-grade-val');

    // --- State Variables ---
    // These variables hold the state of the application.

    let selfGradeData = {}; // To store the grading criteria fetched from JSON.
    let finalGrade = -1;   // To store the calculated grade for the user.

    // --- Initialization ---

    /**
     * Fetches the self-grading data from the external JSON file.
     * This is the first step to initializing the grader.
     */
    async function initializeGrader() {
        try {
            // Fetch the JSON data. The path is relative to the HTML file.
            const response = await fetch('data/self_grade.json');
            if (!response.ok) {
                // If the file can't be loaded, throw an error.
                throw new Error('Failed to load self-grade data.');
            }
            // Parse the JSON response and store it in our state variable.
            selfGradeData = await response.json();
        } catch (error) {
            // If anything goes wrong, log the error and display a message to the user.
            console.error('Grader initialization failed:', error);
            graderApp.innerHTML = `<p class="text-red-500">The self-grader could not be loaded. Please try again later.</p>`;
        }
    }

    // --- Event Handlers ---

    /**
     * Handles the click on the "Proceed" button from the 'About' section.
     * Hides the 'About' text and shows the instrument selection form.
     */
    function handleProceed() {
        graderStepAbout.classList.add('hidden');
        graderStepForm.classList.remove('hidden');
    }

    /**
     * Handles the click on the "Assess My Grade" button.
     * It triggers the grade calculation and displays the results modal.
     */
    function handleAssess() {
        calculateGrade();
        resultsModal.classList.remove('hidden');
        resultsModal.classList.add('flex');
    }

    /**
     * Handles closing the results modal and resetting the grader to its initial state.
     * This allows the user to retake the test.
     */
    function handleReset() {
        // Hide the results modal.
        resultsModal.classList.add('hidden');
        resultsModal.classList.remove('flex');

        // Reset the form elements to their default state.
        instrumentSelect.value = "-1";
        graderFormContainer.innerHTML = '';
        assessBtn.classList.add('hidden');

        // Show the initial 'About' step and hide the form.
        graderStepForm.classList.add('hidden');
        graderStepAbout.classList.remove('hidden');
    }

    /**
     * Handles applying the calculated grade to the registration form.
     */
    function handleApplyGrade() {
        // Check if a valid grade has been calculated and a registration input exists.
        if (finalGrade !== -1 && regGradeInput) {
            // Update the value and styling of the registration form's grade input.
            regGradeInput.value = `Level ${finalGrade} (Verified)`;
            regGradeInput.classList.add('bg-emerald-50', 'text-emerald-800', 'font-bold');
            
            // Hide the results modal.
            resultsModal.classList.add('hidden');
            resultsModal.classList.remove('flex');
            
            // Show a success notification to the user.
            showToast('Grade Applied', `Level ${finalGrade} has been added to your registration form.`, true);
        }
    }

    /**
     * Handles clicks outside the results modal to close it.
     * @param {Event} event - The click event object.
     */
    function handleModalOuterClick(event) {
        if (event.target === resultsModal) {
            resultsModal.classList.add('hidden');
            resultsModal.classList.remove('flex');
        }
    }

    // --- Core Logic ---

    /**
     * Dynamically builds the assessment form based on the selected instrument.
     * It iterates through the grades (5 down to 1) and creates questions for each.
     */
    function buildGraderForm() {
        const instrumentId = instrumentSelect.value;
        // Clear any previous form content.
        graderFormContainer.innerHTML = '';

        // If the user selects the placeholder, hide the assess button and do nothing.
        if (instrumentId === "-1") {
            assessBtn.classList.add('hidden');
            return;
        }
        
        // Add an introductory note to the form.
        const intro = document.createElement('div');
        intro.className = 'p-4 bg-stone-100 border border-stone-200 rounded-lg text-xs text-stone-600';
        intro.innerHTML = `<p>You should respond for <strong>ALL</strong> pieces. If you do not select an option then "Not within a week" will be assumed!</p>`;
        graderFormContainer.appendChild(intro);

        // Loop through grades from 5 (easiest) to 1 (hardest).
        for (let gr = 5; gr > 0; gr--) {
            // Check if data exists for the current grade and selected instrument.
            if (selfGradeData[gr] && selfGradeData[gr][instrumentId]) {
                const gradeSection = document.createElement('div');
                gradeSection.className = 'space-y-4 py-6 border-b border-stone-200';
                
                // Create the descriptive text for the grade level.
                let gradeText = `These are examples of pieces that an SG${gr} player would be expected to be able to play with 3 - 5 days notice at a Playing Day session.`;
                if (gr > 1) {
                    gradeText += ` An SG${gr - 1} player should be able to play them at sight.`;
                }

                const pieces = selfGradeData[gr][instrumentId];
                // The URL is the same for all pieces in a grade/instrument group.
                const pdfUrl = `../Samples/${pieces[0].URL}`;

                // Set the inner HTML for the section header, including the link to the PDF.
                gradeSection.innerHTML = `
                    <h4 class="text-lg font-serif font-bold text-stone-900">Step 2: Assess SG${gr} Pieces</h4>
                    <p class="text-xs text-stone-600">${gradeText}</p>
                    <p class="text-xs text-stone-600">Please select all that you can play.</p>
                    <a href="${pdfUrl}" target="_blank" class="text-sm font-semibold text-brandGreen-700 hover:underline inline-flex items-center gap-2">
                        <i class="fa-solid fa-file-pdf"></i>
                        View SG${gr} Example Pieces for ${instrumentSelect.options[instrumentSelect.selectedIndex].text}
                    </a>
                `;

                // Create a container for the piece questions.
                const table = document.createElement('div');
                table.className = 'space-y-5 mt-4';

                // For each piece in the grade, create a set of radio buttons.
                pieces.forEach((piece, j) => {
                    const pieceContainer = document.createElement('div');
                    pieceContainer.className = 'p-4 bg-stone-50 rounded-lg border border-stone-200';
                    
                    const title = document.createElement('p');
                    title.className = 'font-semibold text-sm text-stone-800 mb-3';
                    title.textContent = piece.title;
                    pieceContainer.appendChild(title);

                    const radioGroupContainer = document.createElement('div');
                    radioGroupContainer.className = 'flex flex-col sm:flex-row gap-4 text-xs';
                    
                    // Define the radio button options.
                    const options = [
                        { label: 'Not within a week', value: 0 },
                        { label: '3-5 days notice', value: 1 },
                        { label: 'At Sight', value: 2 }
                    ];

                    // Create and append each radio button.
                    options.forEach((opt) => {
                        const radioLabel = document.createElement('label');
                        radioLabel.className = 'flex items-center gap-2 cursor-pointer';
                        const radioInput = document.createElement('input');
                        radioInput.type = 'radio';
                        radioInput.name = `grade${gr}_${j}`; // Unique name for each radio group.
                        radioInput.value = opt.value;
                        radioInput.className = 'form-radio text-brandGreen-600 focus:ring-brandGreen-500';
                        
                        radioLabel.appendChild(radioInput);
                        radioLabel.appendChild(document.createTextNode(opt.label));
                        radioGroupContainer.appendChild(radioLabel);
                    });
                    
                    pieceContainer.appendChild(radioGroupContainer);
                    table.appendChild(pieceContainer);
                });

                gradeSection.appendChild(table);
                graderFormContainer.appendChild(gradeSection);
            }
        }
        // Once the form is built, show the "Assess" button.
        assessBtn.classList.remove('hidden');
    }

    /**
     * Calculates the final grade based on the user's radio button selections.
     * The logic averages the scores and maps the average to a final grade.
     */
    function calculateGrade() {
        let assessment = 0;
        const inputs = graderFormContainer.querySelectorAll('input[type="radio"]');
        
        // Group inputs by name to correctly handle radio button logic.
        const radioGroups = {};
        inputs.forEach(input => {
            // Initialize group if it doesn't exist. Default to unchecked and value 0.
            if (!radioGroups[input.name]) {
                radioGroups[input.name] = { checked: false, value: 0 };
            }
            // If an input in the group is checked, update the group's value.
            if (input.checked) {
                radioGroups[input.name] = { checked: true, value: parseInt(input.value, 10) };
            }
        });

        const totalItems = Object.keys(radioGroups).length;
        let itemsChecked = 0;
        
        // Sum the values from all radio groups.
        for (const name in radioGroups) {
            assessment += radioGroups[name].value;
            if (radioGroups[name].checked) {
                itemsChecked++;
            }
        }

        // Calculate the average score.
        const assessmentScore = totalItems > 0 ? assessment / totalItems : 0;
        
        // Map the average score to a final grade (1-5).
        if (assessmentScore < 0.4) {
            finalGrade = 5;
        } else if (assessmentScore >= 0.4 && assessmentScore <= 0.8) {
            finalGrade = 4;
        } else if (assessmentScore <= 1.2) {
            finalGrade = 3;
        } else if (assessmentScore <= 1.6) {
            finalGrade = 2;
        } else {
            finalGrade = 1;
        }

        // Prepare the result text for the modal.
        let resultText = `<p class="text-lg">Your Recommended Self-Grade is: <strong class="text-2xl text-brandGreen-600">${finalGrade}</strong></p>`;
        // If not all questions were answered, add a warning message.
        if (itemsChecked < totalItems) {
            resultText += `<p class="mt-4 text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">You did not make a response for each piece, so your assessment may be incorrect. Please review and complete all sections for an accurate grade.</p>`;
        }
        
        // Display the result in the modal.
        sgResultContainer.innerHTML = resultText;
    }

    // --- Attach Event Listeners ---
    instrumentSelect.addEventListener('change', buildGraderForm);
    graderProceedBtn.addEventListener('click', handleProceed);
    assessBtn.addEventListener('click', handleAssess);
    resultsModalClose.addEventListener('click', handleReset);
    applyGradeBtn.addEventListener('click', handleApplyGrade);
    window.addEventListener('click', handleModalOuterClick);

    // --- Start the application ---
    initializeGrader();
});
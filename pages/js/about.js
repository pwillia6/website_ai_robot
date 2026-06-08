// /Users/user/Volumes/acms2/acms.cweb.com.au/pages/js/about.js

// --- State ---
let currentAboutSub = 'intro';

// --- UI Functions ---

/**
 * Switches the visible sub-panel on the About Us page.
 * @param {string} subId - The identifier for the sub-panel to show.
 */
function switchSubAbout(subId) {
    currentAboutSub = subId;
    document.querySelectorAll('.subabout-panel').forEach(panel => {
        panel.classList.add('hidden');
    });
    const activePanel = document.getElementById(`subabout-${subId}`);
    if (activePanel) {
        activePanel.classList.remove('hidden');
    }

    document.querySelectorAll('.about-sub-btn').forEach(btn => {
        btn.classList.remove('bg-brandGreen-50', 'text-brandGreen-800');
        btn.classList.add('text-stone-600');
    });
    const activeBtn = document.getElementById(`btn-about-${subId}`);
    if (activeBtn) {
        activeBtn.classList.remove('text-stone-600');
        activeBtn.classList.add('bg-brandGreen-50', 'text-brandGreen-800');
    }
}

/**
 * Attaches event listeners for the About page.
 */
function setupAboutListeners() {
    // Sub-tab switching
    document.querySelectorAll('.about-sub-btn').forEach(btn => {
        const subId = btn.id.replace('btn-about-', '');
        btn.addEventListener('click', () => switchSubAbout(subId));
    });

    // FAQ accordion (event delegation)
    const faqContainer = document.getElementById('faq-list');
    if (faqContainer) {
        faqContainer.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-accordion-id]');
            if (button) {
                toggleAccordion(button.dataset.accordionId);
            }
        });
    }

    // Link to join page
    document.getElementById('btn-goto-join')?.addEventListener('click', () => {
        window.location.href = 'join.html';
    });
}

// --- Page Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    setActiveTab('about');
    setupAboutListeners();
});
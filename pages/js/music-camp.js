// /Users/user/Volumes/acms2/acms.cweb.com.au/pages/js/music-camp.js

// --- Data ---
let campCosts = {};

// --- UI Functions ---

/**
 * Updates the estimated cost and balance for the camp based on user selections.
 */
function updateCampCost() {
    const accomSelect = document.getElementById('camp-accom');
    const totalEl = document.getElementById('camp-est-total');
    const balanceEl = document.getElementById('camp-est-balance');

    if (!accomSelect || !totalEl || !balanceEl) return;

    const selectedOption = accomSelect.value;
    const costs = campCosts[selectedOption] || campCosts.residential || { total: 0, balance: 0 };

    totalEl.innerText = `$${costs.total.toFixed(2)}`;
    balanceEl.innerText = `$${costs.balance.toFixed(2)}`;
}

/**
 * Shows a toast notification for the simulated booking.
 */
function simulateCampBooking() {
    const accomSelect = document.getElementById('camp-accom');
    if (!accomSelect) return;
    
    const accomValue = accomSelect.options[accomSelect.selectedIndex].text.split('—')[0].trim();
    showToast("Pre-Registration", `Pre-registration interest recorded for Mittagong Camp. Assigned Accommodation Tier: ${accomValue}.`, true);
}

/**
 * Attaches event listeners for the Music Camp page.
 */
function setupCampListeners() {
    document.getElementById('camp-accom')?.addEventListener('change', updateCampCost);
    document.getElementById('btn-pre-register')?.addEventListener('click', simulateCampBooking);
}

// --- Data Initialization ---
async function initializeCampData() {
    try {
        campCosts = await fetchJSON('data/music-camp-data.json');
        updateCampCost(); // Initial calculation on load
    } catch (error) {
        console.error("Could not fetch camp costs data:", error);
    }
}

// --- Page Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    setActiveTab('camp');
    initializeCampData();
    setupCampListeners();
});
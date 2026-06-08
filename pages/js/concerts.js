// /Users/user/Volumes/acms2/acms.cweb.com.au/pages/js/concerts.js

// --- State ---
let currentConcertSub = 'planned';
let concertData = [];

// --- UI Functions ---

/**
 * Renders the concert schedule table from the fetched event data.
 */
function renderConcertSchedule() {
    const container = document.getElementById('concerts-table-body');
    if (!container) return;

    const concerts = concertData.filter(event => event.type === 'concert');

    if (concerts.length === 0) {
        container.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-stone-500">No planned concerts found.</td></tr>`;
        return;
    }

    let tableContent = '';
    concerts.forEach(c => {
        const statusClass = c.status === 'Capped' 
            ? 'bg-stone-100 text-stone-600' 
            : 'bg-brandTeal-100 text-brandTeal-800';
        
        const repertoireHtml = c.repertoire.map(item => `<p>&bull; ${item}</p>`).join('');

        tableContent += `
            <tr class="hover:bg-stone-50">
                <td class="p-4 font-semibold text-stone-900">${c.date}</td>
                <td class="p-4">${c.organiser}</td>
                <td class="p-4 text-xs">${repertoireHtml}</td>
                <td class="p-4"><span class="px-2 py-0.5 ${statusClass} rounded text-xs font-semibold">${c.status}</span></td>
            </tr>
        `;
    });
    container.innerHTML = tableContent;
}

/**
 * Switches the visible sub-panel on the Concerts page.
 * @param {string} subId - The identifier for the sub-panel to show.
 */
function switchConcertSub(subId) {
    currentConcertSub = subId;
    document.querySelectorAll('.concert-sub-panel').forEach(p => {
        p.classList.add('hidden');
    });
    const activePanel = document.getElementById(`con-${subId}`);
    if (activePanel) {
        activePanel.classList.remove('hidden');
    }

    document.querySelectorAll('.concert-sub-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'text-stone-800', 'shadow');
        btn.classList.add('text-stone-600', 'hover:text-stone-800');
    });
    const activeBtn = document.getElementById(`btn-con-${subId}`);
    if (activeBtn) {
        activeBtn.classList.remove('text-stone-600', 'hover:text-stone-800');
        activeBtn.classList.add('bg-white', 'text-stone-800', 'shadow');
    }
}

/**
 * Attaches event listeners for the Concerts page.
 */
function setupConcertListeners() {
    // Sub-tab switching
    document.querySelectorAll('.concert-sub-btn').forEach(btn => {
        const subId = btn.id.replace('btn-con-', '');
        btn.addEventListener('click', () => switchConcertSub(subId));
    });

    // Accordion toggles for the 'Preparing for a Performance' section
    document.querySelectorAll('#con-preparing .bg-white.rounded-lg button').forEach(btn => {
        const panel = btn.nextElementSibling;
        if (panel && panel.id) {
            btn.addEventListener('click', () => toggleAccordion(panel.id));
        }
    });
}

// --- Data Initialization ---
async function initializeConcertData() {
    try {
        // Fetches all events, then filters for concerts in the render function.
        concertData = await fetchJSON('data/events-data.json');
        renderConcertSchedule();
    } catch (error) {
        console.error("Could not fetch concert data:", error);
        const container = document.getElementById('concerts-table-body');
        if (container) container.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Could not load concert schedule.</td></tr>`;
    }
}

// --- Page Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    setActiveTab('concerts');
    initializeConcertData();
    setupConcertListeners();
});
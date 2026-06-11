// /Users/user/Volumes/acms2/acms.cweb.com.au/pages/js/playing-days.js

// --- Data Sources ---
let pianistRepertoire = [];
let allEventsData = [];

// --- State ---
let currentRegion = 'sydney';

// --- UI Functions ---

/**
 * Switches the visible region panel on the Playing Days page.
 * @param {string} regId - The identifier for the region to show.
 */
function switchRegion(regId) {
    currentRegion = regId;
    document.querySelectorAll('.region-panel').forEach(panel => {
        panel.classList.add('hidden');
    });
    const activePanel = document.getElementById(`region-${regId}`);
    if (activePanel) {
        activePanel.classList.remove('hidden');
    }

    // Reset all buttons to inactive state
    document.querySelectorAll('.region-btn').forEach(btn => {
        btn.classList.remove('bg-brandGreen-400', 'text-stone-950', 'shadow-md', 'bg-brandGreen-950', 'text-brandTeal-300');
        btn.classList.add('bg-stone-800', 'text-stone-200', 'hover:bg-stone-700');
    });
    
    const activeBtn = document.getElementById(`btn-reg-${regId}`);
    if (activeBtn) {
        // Remove inactive styles
        activeBtn.classList.remove('bg-stone-800', 'text-stone-200', 'hover:bg-stone-700');
        
        // Add active styles
        if (regId === 'pianist') {
            activeBtn.classList.add('bg-brandGreen-950', 'text-brandTeal-300');
        } else {
            activeBtn.classList.add('bg-brandGreen-400', 'text-stone-950', 'shadow-md');
        }
    }
}

/**
 * Renders the Sydney playing day schedule.
 */
function renderSydneySchedule() {
    const container = document.getElementById('sydney-schedule-body');
    if (!container) return;
    const events = allEventsData.filter(e => e.type === 'playing-day' && e.region === 'sydney');
    
    let content = '';
    if (events.length > 0) {
        events.forEach(e => {
            const statusClass = e.status === 'Completed' ? 'bg-green-100 text-green-800' : (e.status === 'Enrolling Soon' ? 'bg-brandTeal-100 text-brandTeal-800' : 'bg-stone-100 text-stone-600');
            content += `
                <tr class="hover:bg-stone-50">
                    <td class="p-4 font-semibold text-stone-900">${e.date}</td>
                    <td class="p-4">${e.venue || ''}</td>
                    <td class="p-4"><span class="px-2 py-0.5 ${statusClass} rounded-full text-xs">${e.status}</span></td>
                    <td class="p-4 ${e.status === 'Completed' ? 'text-stone-400' : ''}">${e.registration_closes}</td>
                </tr>
            `;
        });
    } else {
        content = '<tr><td colspan="4" class="p-4 text-center text-stone-500">No scheduled events for Sydney.</td></tr>';
    }
    container.innerHTML = content;
}

/**
 * Renders the Canberra playing day schedule.
 */
function renderCanberraSchedule() {
    const container = document.getElementById('canberra-schedule-body');
    if (!container) return;
    const events = allEventsData.filter(e => e.type === 'playing-day' && e.region === 'canberra');

    let content = '';
    if (events.length > 0) {
        // Group by coordinator to use rowspan
        const groupedByCoordinator = events.reduce((acc, e) => {
            const coord = e.coordinator || 'N/A';
            if (!acc[coord]) {
                acc[coord] = [];
            }
            acc[coord].push(e);
            return acc;
        }, {});

        for (const coordinator in groupedByCoordinator) {
            const groupEvents = groupedByCoordinator[coordinator];
            groupEvents.forEach((e, index) => {
                content += `
                    <tr class="hover:bg-stone-50">
                        <td class="p-4 font-semibold">${e.date}</td>
                        <td class="p-4">${e.registration_closes}</td>
                        ${index === 0 ? `<td class="p-4 text-xs text-stone-500" rowspan="${groupEvents.length}">${coordinator}</td>` : ''}
                    </tr>
                `;
            });
        }
    } else {
        content = '<tr><td colspan="3" class="p-4 text-center text-stone-500">No scheduled events for Canberra.</td></tr>';
    }
    container.innerHTML = content;
}

/**
 * Renders the Brisbane playing day schedule.
 */
function renderBrisbaneSchedule() {
    const container = document.getElementById('brisbane-schedule-body');
    if (!container) return;
    const events = allEventsData.filter(e => e.type === 'playing-day' && e.region === 'brisbane');

    let content = '';
    if (events.length > 0) {
        events.forEach(e => {
            const statusClass = e.status === 'Completed' ? 'text-green-700' : 'text-brandTeal-600';
            content += `
                <tr class="hover:bg-stone-50">
                    <td class="p-4 font-semibold">${e.date}</td>
                    <td class="p-4">${e.registration_closes}</td>
                    <td class="p-4 text-xs ${statusClass}">${e.status}</td>
                </tr>
            `;
        });
    } else {
        content = '<tr><td colspan="3" class="p-4 text-center text-stone-500">No scheduled events for Brisbane.</td></tr>';
    }
    container.innerHTML = content;
}

/**
 * Renders the Blue Mountains playing day schedule.
 */
function renderBlueMountainsSchedule() {
    const container = document.getElementById('blue-mountains-schedule-container');
    if (!container) return;
    const events = allEventsData.filter(e => e.type === 'playing-day' && e.region === 'blue');

    if (events.length > 0) {
        const dates = events.map(e => `<li>&bull; ${e.date}</li>`).join('');
        container.innerHTML = `<ul class="space-y-2 text-sm font-semibold text-stone-800">${dates}</ul>`;
    } else {
        container.innerHTML = `<p class="text-sm text-stone-500">No scheduled events for the Blue Mountains.</p>`;
    }
}

/**
 * Attaches event listeners for the Playing Days page.
 */
function setupPlayingDaysListeners() {
    // Region switching buttons
    document.querySelectorAll('.region-btn').forEach(btn => {
        const regionId = btn.id.replace('btn-reg-', '');
        btn.addEventListener('click', () => switchRegion(regionId));
    });

}

// --- Data Initialization ---
async function initializePlayingDaysData() {
    try {
        // All dynamic event data for this page now comes from events-data.json.
        // The playing-days-data.json for repertoire is no longer loaded.
        allEventsData = await fetchJSON('data/events-data.json') || [];

        renderSydneySchedule();
        renderCanberraSchedule();
        renderBrisbaneSchedule();
        renderBlueMountainsSchedule();

    } catch (error) {
        console.error("Could not fetch playing days event data:", error);
        // Update UI to show errors for all sections that depend on event data.
        document.getElementById('sydney-schedule-body').innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Could not load schedule.</td></tr>';
        document.getElementById('canberra-schedule-body').innerHTML = '<tr><td colspan="3" class="p-4 text-center text-red-500">Could not load schedule.</td></tr>';
        document.getElementById('brisbane-schedule-body').innerHTML = '<tr><td colspan="3" class="p-4 text-center text-red-500">Could not load schedule.</td></tr>';
        document.getElementById('blue-mountains-schedule-container').innerHTML = '<p class="text-sm text-red-500">Could not load schedule.</p>';
    }
}

// --- Page Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    setActiveTab('playing');
    initializePlayingDaysData();
    setupPlayingDaysListeners();
});

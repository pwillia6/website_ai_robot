// /Users/user/Volumes/acms2/acms.cweb.com.au/pages/js/home.js

let eventsData = []; // To store the fetched data

/**
 * Renders the events grid based on a filter.
 * This function relies on `eventsData` being populated before it's called.
 * @param {string} [filter='all'] - The type of event to filter by ('all', 'concert', 'playing-day', 'camp').
 */
function renderEvents(filter = 'all') {
    const grid = document.getElementById('events-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const now = new Date();
    now.setHours(0, 0, 0, 0); // Compare against the start of today

    const futureEvents = eventsData.filter(e => {
        let dateToParse = e.date;

        // Handle date ranges like "11-12 July" by taking the start date
        const rangeMatch = dateToParse.match(/^(\d{1,2})-\d{1,2}\s(.+)/);
        if (rangeMatch) {
            dateToParse = `${rangeMatch[1]} ${rangeMatch[2]}`;
        }

        // Assume 2026 if year is missing, as hinted by the page content
        if (!/\d{4}/.test(dateToParse)) {
            dateToParse += ' 2026';
        }

        const eventDate = new Date(dateToParse);

        // If date is invalid, keep it in the list to be safe, but log a warning.
        if (isNaN(eventDate.getTime())) {
            console.warn(`Could not parse date for event: "${e.title}" with date string "${e.date}"`);
            return true;
        }

        return eventDate >= now;
    });

    const filtered = filter === 'all' ? futureEvents : futureEvents.filter(e => e.type === filter);

    const eventUrlMap = {
        'concert': 'concerts.html',
        'playing-day': 'playing-days.html',
        'camp': 'music-camp.html'
    };

    if (filtered.length === 0) {
        grid.innerHTML = `<p class="text-stone-500 md:col-span-3 text-center">No upcoming events found for this category.</p>`;
        return;
    }

    filtered.forEach(e => {
        let badgeColor = "bg-stone-100 text-stone-800";
        let icon = "fa-solid fa-calendar";
        if (e.type === 'concert') {
            badgeColor = "bg-brandTeal-50 text-brandTeal-800 border border-brandTeal-150";
            icon = "fa-solid fa-music";
        } else if (e.type === 'camp') {
            badgeColor = "bg-brandGreen-100 text-brandGreen-800 border border-brandGreen-200";
            icon = "fa-solid fa-hotel";
        }

        const url = eventUrlMap[e.type] || 'playing-days.html';

        grid.innerHTML += `
            <div class="bg-white rounded-xl border border-stone-200 shadow-sm p-6 hover:shadow-md hover:border-stone-300 transition duration-150 flex flex-col justify-between">
                <div class="space-y-3">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-bold tracking-wide uppercase text-stone-400 flex items-center gap-1">
                            <i class="${icon}"></i>
                            <span>${e.date}</span>
                        </span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded ${badgeColor} uppercase tracking-wider">${e.type.replace('-', ' ')}</span>
                    </div>
                    <h4 class="font-serif font-bold text-stone-900 text-base sm:text-lg">${e.title}</h4>
                    <p class="text-stone-600 text-xs sm:text-sm leading-relaxed">${e.desc || ''}</p>
                </div>
                <div class="border-t border-stone-100 pt-4 mt-4 flex items-center justify-between text-xs text-stone-500">
                    <span>${e.time ? `<i class="fa-regular fa-clock mr-1"></i>${e.time}` : ''}</span>
                    <a href="${url}" class="text-brandGreen-700 font-semibold hover:underline">Details &rarr;</a>
                </div>
            </div>
        `;
    });
}

/**
 * Filters the events displayed in the grid and updates the active filter button.
 * @param {string} type - The type of event to filter by.
 */
function filterEvents(type) {
    document.querySelectorAll('.event-filter-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'text-stone-800', 'shadow');
        btn.classList.add('text-stone-600');
    });
    const activeBtn = document.getElementById(`btn-ev-${type}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-white', 'text-stone-800', 'shadow');
    }
    renderEvents(type);
}

/**
 * Attaches event listeners for the Home page.
 */
function setupHomeListeners() {
    // Hero buttons
    document.getElementById('btn-go-grader')?.addEventListener('click', () => {
        window.location.href = 'join.html';
    });
    document.getElementById('btn-go-schedule')?.addEventListener('click', () => {
        window.location.href = 'playing-days.html';
    });

    // Event filter buttons
    document.querySelectorAll('.event-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filterEvents(btn.dataset.filter);
        });
    });
}

/**
 * Fetches event data from the JSON file and initializes the event grid.
 */
async function initializeEvents() {
    try {
        eventsData = await fetchJSON('data/events-data.json');
        renderEvents('all');
    } catch (error) {
        console.error("Could not fetch events data:", error);
        const grid = document.getElementById('events-grid');
        if (grid) {
            grid.innerHTML = `<p class="text-red-500 md:col-span-3 text-center">Could not load events. Please try again later.</p>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    setActiveTab('home');
    initializeEvents();
    setupHomeListeners();
});
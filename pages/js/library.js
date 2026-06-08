// /Users/user/Volumes/acms2/acms.cweb.com.au/pages/js/library.js

// --- UI Functions ---

/**
 * Toggles the visibility of an accordion panel and its arrow icon.
 * @param {string} accordionId - The base ID for the accordion elements.
 */
function toggleAccordion(accordionId) {
    const content = document.getElementById(accordionId);
    const arrow = document.getElementById(`${accordionId}-arrow`);

    if (content && arrow) {
        const isHidden = content.classList.contains('hidden');
        if (isHidden) {
            content.classList.remove('hidden');
            arrow.classList.remove('fa-chevron-down');
            arrow.classList.add('fa-chevron-up');
        } else {
            content.classList.add('hidden');
            arrow.classList.remove('fa-chevron-up');
            arrow.classList.add('fa-chevron-down');
        }
    }
}

/**
 * Renders the music catalog results from the API.
 * @param {Array} results - Array of catalog items.
 */
function renderCatalogResults(results) {
    const container = document.getElementById('catalog-list');
    if (!container) return;
    container.innerHTML = '';

    if (!results || results.length === 0) {
        container.innerHTML = `
            <div class="text-center py-6 text-stone-500 text-xs">
                No matching scores found. Try adjusting your search criteria.
            </div>
        `;
        return;
    }

    results.forEach(item => {
        // The 'type' field might be 'Quartet', 'Trio', etc. or a list of instruments.
        // We'll display it if it exists.
        const typeInfo = item.type ? `<span class="text-stone-500 text-[10px] block">${item.type}</span>` : '';

        const itemHTML = `
            <div class="bg-stone-900 p-3 rounded-lg border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-stone-300">
                <div>
                    <strong class="text-white block font-serif">${item.composer}</strong>
                    <span>${item.title}</span>
                    ${typeInfo}
                </div>
                <div class="flex items-center space-x-2 self-start sm:self-center">
                    <span class="text-[10px] text-stone-500 bg-stone-950 px-2 py-0.5 rounded">${item.key || ''}</span>
                    <button data-item-id="${item.id}" data-item-composer="${item.composer}" class="reserve-btn bg-brandGreen-700 hover:bg-brandGreen-600 text-white font-bold px-3 py-1 rounded text-[10px] transition duration-150">Reserve</button>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
    });
}

/**
 * Initiates a search by calling the backend API.
 */
async function searchCatalog() {
    const container = document.getElementById('catalog-list');
    if (!container) return;

    const query = document.getElementById('lib-keyword')?.value || '';
    
    const selectedInstruments = [];
    document.querySelectorAll('.instrument-input').forEach(input => {
        const count = parseInt(input.value, 10);
        if (count > 0) {
            selectedInstruments.push(input.dataset.instrumentId);
        }
    });

    const params = new URLSearchParams();
    if (query.trim()) {
        params.append('keyword', query.trim());
    }
    selectedInstruments.forEach(instId => {
        params.append('instruments[]', instId);
    });

    // Show loading state
    container.innerHTML = `
        <div class="text-center py-6 text-stone-400 text-xs">
            <i class="fa-solid fa-spinner fa-spin mr-2"></i>Searching...
        </div>
    `;

    try {
        const results = await fetchJSON(`website_search.php?${params.toString()}`);
        renderCatalogResults(results);
    } catch (error) {
        console.error("Could not fetch library search results:", error);
        container.innerHTML = `<div class="text-center py-6 text-red-400 text-xs">Error searching catalog. ${error.message}</div>`;
    }
}

/**
 * Resets the catalog search filters and re-renders the catalog.
 */
function resetCatalogFilters() {
    const keywordInput = document.getElementById('lib-keyword');
    if (keywordInput) keywordInput.value = '';
    
    document.querySelectorAll('.instrument-input').forEach(input => {
        input.value = '';
    });

    // Trigger a new search with empty filters
    searchCatalog();
}

/**
 * Simulates reserving a score and shows a toast notification.
 * @param {number} id - The ID of the score.
 * @param {string} composer - The composer of the score.
 */
function simulateReserveScore(id, composer) {
    showToast("Reserve score", `Simulated score reservation logged for Catalog #${id} (${composer}). Sign In to complete registration.`, true);
}

/**
 * Attaches event listeners for the Library page's mobile app simulation.
 */
function setupLibraryAppListeners() {
    document.getElementById('lib-keyword')?.addEventListener('input', searchCatalog);
    document.getElementById('btn-reset-catalog')?.addEventListener('click', resetCatalogFilters);

    // Add listeners to all instrument inputs for typing
    document.querySelectorAll('.instrument-input').forEach(input => {
        input.addEventListener('input', searchCatalog);
    });

    // Use event delegation for instrument filter interactions (incrementing and accordions)
    const instrumentContainer = document.getElementById('instrument-filter-container');
    if (instrumentContainer) {
        instrumentContainer.addEventListener('click', (e) => {
            const nameSpan = e.target.closest('.instrument-name');
            const accordionButton = e.target.closest('button[data-accordion-id]');

            if (nameSpan) {
                const input = document.getElementById(nameSpan.dataset.inputId);
                if (input) {
                    let currentValue = parseInt(input.value, 10);
                    if (isNaN(currentValue) || currentValue < 0) {
                        input.value = 1;
                    } else {
                        input.value = currentValue + 1;
                    }
                    // Programmatic value change doesn't fire 'input' event, so trigger search manually
                    searchCatalog(); 
                }
            } else if (accordionButton) {
                toggleAccordion(accordionButton.dataset.accordionId);
            }
        });
    }

    // Use event delegation for reserve buttons
    const catalogList = document.getElementById('catalog-list');
    if (catalogList) {
        catalogList.addEventListener('click', (event) => {
            const button = event.target.closest('.reserve-btn');
            if (button) {
                const id = button.dataset.itemId;
                const composer = button.dataset.itemComposer;
                simulateReserveScore(id, composer);
            }
        });
    }
}

// --- Page Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    setActiveTab('library');
    // Initial search on page load
    searchCatalog();
    setupLibraryAppListeners();
});
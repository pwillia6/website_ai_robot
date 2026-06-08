// /Users/user/Volumes/acms2/acms.cweb.com.au/pages/js/main.js

let toastTimeout;

/**
 * Displays a floating notification toast at the bottom-right of the screen.
 * Error toasts are "sticky" and must be manually closed. Success toasts disappear after 5 seconds.
 * @param {string} title - The title of the notification.
 * @param {string} body - The main message content. Can contain HTML.
 * @param {boolean} [isSuccess=true] - Determines the color and icon (true for success, false for warning/error).
 */
function showToast(title, body, isSuccess = true) {
    const toast = document.getElementById('toast');
    if (!toast) {
        alert(`${title}: ${body}`); // Fallback for pages without the toast element
        return;
    }

    const tTitle = document.getElementById('toast-title');
    const tBody = document.getElementById('toast-body');
    const tIcon = document.getElementById('toast-icon');
    const tClose = document.getElementById('toast-close');

    // Clear any existing timeout to prevent premature closing
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    if (tTitle) tTitle.innerText = title;
    if (tBody) tBody.innerHTML = body; // Use innerHTML to allow for formatted error messages
    
    if (tIcon) {
        if (isSuccess) {
            tIcon.className = "bg-brandGreen-900 text-brandTeal-300 p-1.5 rounded-lg text-sm border border-brandGreen-850";
            tIcon.innerHTML = `<i class="fa-solid fa-check"></i>`;
        } else {
            // Use red tones for errors for better visibility
            tIcon.className = "bg-red-900 text-red-300 p-1.5 rounded-lg text-sm border border-red-850";
            tIcon.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>`;
        }
    }

    toast.classList.remove('hidden');
    toast.classList.add('flex');

    const closeHandler = () => {
        toast.classList.add('hidden');
        toast.classList.remove('flex');
        if (toastTimeout) clearTimeout(toastTimeout);
    };

    if (tClose) tClose.onclick = closeHandler;
    
    // Auto-hide only for success messages. Errors require manual closing.
    if (isSuccess) {
        toastTimeout = setTimeout(closeHandler, 5000);
    }
}

/**
 * Fetches and parses JSON from a URL.
 * @param {string} url - The URL to fetch data from.
 * @returns {Promise<any>} A promise that resolves with the JSON data.
 * @throws {Error} If the fetch request fails or the response is not ok.
 */
async function fetchJSON(url) {
    // Add a cache-busting parameter to ensure the latest data is always fetched.
    const cacheBustingUrl = new URL(url, window.location.href);
    cacheBustingUrl.searchParams.set('v', new Date().getTime());

    const response = await fetch(cacheBustingUrl.toString());
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} for URL: ${url}`);
    }
    return await response.json();
}

/**
 * Toggles the visibility of an accordion panel and its arrow icon.
 * @param {string} id - The base ID of the accordion element.
 */
function toggleAccordion(id) {
    const block = document.getElementById(id);
    const arrow = document.getElementById(`${id}-arrow`);
    if (!block || !arrow) return;

    block.classList.toggle('hidden');
    arrow.classList.toggle('fa-chevron-down');
    arrow.classList.toggle('fa-chevron-up');
}

/**
 * Sets the active state for the main navigation and mobile navigation buttons.
 * @param {string} tabId - The data-tab attribute of the active tab.
 */
function setActiveTab(tabId) {
    // Set nav button active styling
    document.querySelectorAll('.nav-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('bg-stone-900', 'text-white', 'border-b-2', 'border-brandGreen-400');
        } else {
            btn.classList.remove('bg-stone-900', 'text-white', 'border-b-2', 'border-brandGreen-400');
        }
    });

    // Mobile nav styling
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('bg-stone-900', 'text-brandTeal-400');
        } else {
            btn.classList.remove('bg-stone-900', 'text-brandTeal-400');
        }
    });
}

// --- Common Event Listeners ---
document.addEventListener('DOMContentLoaded', function() {
    // Setup mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            const mm = document.getElementById('mobile-menu');
            if (mm) {
                mm.classList.toggle('hidden');
            }
        });
    }
});
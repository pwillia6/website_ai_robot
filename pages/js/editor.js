// /Users/user/Volumes/acms2/acms.cweb.com.au/pages/js/editor.js

(function() {
    // --- Cookie Helpers ---
    function setSessionCookie(name, value) {
        document.cookie = name + "=" + (value || "") + "; path=/";
    }

    function getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for(let i=0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0)==' ') c = c.substring(1,c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
        }
        return null;
    }

    // --- Editor UI ---
    const editorHTML = `
        <div id="ai-editor-bar" class="fixed top-0 left-0 right-0 bg-stone-900 text-white p-3 shadow-lg z-[100] flex items-start gap-3 text-sm transition-transform duration-300 -translate-y-full">
            <div class="flex-shrink-0 font-bold text-brandTeal-400 flex items-center gap-2 pt-2.5">
                <i class="fa-solid fa-robot"></i>
                <span>AI Editor</span>
            </div>
            <textarea id="ai-editor-prompt" rows="3" class="flex-grow bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-brandGreen-500 resize-y" placeholder="Enter your edit request... (Cmd/Ctrl + Enter to submit)"></textarea>
            <div class="flex flex-col gap-2 flex-shrink-0">
                <button id="ai-editor-generate" class="bg-brandGreen-700 hover:bg-brandGreen-600 text-white font-semibold px-4 py-2.5 rounded-md text-sm flex items-center justify-center gap-2 w-full">
                    <span id="ai-editor-btn-text">Generate</span>
                    <i id="ai-editor-spinner" class="fa-solid fa-spinner fa-spin hidden"></i>
                </button>
                <div class="flex items-center gap-2">
                    <button id="ai-editor-history" class="flex-1 text-stone-400 hover:text-white font-semibold px-3 py-1.5 rounded-md text-xs flex items-center justify-center gap-2 border border-stone-700 hover:bg-stone-800">
                        <i class="fa-solid fa-history"></i>
                        <span>History</span>
                    </button>
                    <button id="ai-editor-scope" class="flex-1 text-stone-400 hover:text-white font-semibold px-3 py-1.5 rounded-md text-xs flex items-center justify-center gap-2 border border-stone-700 hover:bg-stone-800">
                        <i class="fa-solid fa-crosshairs"></i>
                        <span>Scope</span>
                    </button>
                </div>
            </div>
            <button id="ai-editor-close" class="text-stone-500 hover:text-white pt-2" title="Close Editor">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
        <button id="ai-editor-toggle" class="fixed top-2 right-2 bg-brandGreen-700 text-white w-10 h-10 rounded-full shadow-lg z-[99] flex items-center justify-center hover:bg-brandGreen-600 transition-all">
            <i class="fa-solid fa-robot"></i>
        </button>
        <div id="ai-editor-history-modal" class="fixed inset-0 bg-black/60 z-[101] hidden items-center justify-center p-4">
            <div class="bg-stone-800 rounded-lg shadow-2xl w-full max-w-lg">
                <div class="p-4 border-b border-stone-700 flex justify-between items-center">
                    <h3 class="font-bold text-white flex items-center gap-2"><i class="fa-solid fa-history"></i>File History</h3>
                    <button id="ai-editor-history-close" class="text-stone-400 hover:text-white text-2xl leading-none">&times;</button>
                </div>
                <div id="ai-editor-history-list" class="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <!-- Backup list will be rendered here -->
                </div>
            </div>
        </div>
        <div id="ai-editor-scope-modal" class="fixed inset-0 bg-black/60 z-[101] hidden items-center justify-center p-4">
            <div class="bg-stone-800 rounded-lg shadow-2xl w-full max-w-lg">
                <div class="p-4 border-b border-stone-700 flex justify-between items-center">
                    <h3 class="font-bold text-white flex items-center gap-2"><i class="fa-solid fa-crosshairs"></i>Edit Scope</h3>
                    <button id="ai-editor-scope-close" class="text-stone-400 hover:text-white text-2xl leading-none">&times;</button>
                </div>
                <div class="p-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div>
                        <h4 class="text-sm font-bold text-stone-300 mb-2">Target Pages (HTML)</h4>
                        <div class="space-y-2 text-xs">
                            <label class="flex items-center space-x-2 p-2 bg-stone-900/50 rounded-md">
                                <input type="checkbox" id="ai-update-all-html" class="form-checkbox h-4 w-4 text-brandGreen-600 bg-stone-700 border-stone-600 rounded focus:ring-brandGreen-500">
                                <span class="text-stone-200 font-semibold">Update All HTML Pages</span>
                            </label>
                            <div id="ai-editor-target-files" class="space-y-2 pl-2 border-l border-stone-700 ml-2">
                                <!-- HTML files list will be rendered here -->
                            </div>
                        </div>
                    </div>
                </div>
                <div class="p-2 bg-stone-900/50 border-t border-stone-700 text-right">
                    <button id="ai-editor-scope-done" class="bg-brandGreen-700 hover:bg-brandGreen-600 text-white font-semibold px-4 py-1.5 rounded-md text-xs">Done</button>
                </div>
            </div>
        </div>
    `;

    // --- Functions ---

    function toggleEditorBar() {
        const bar = document.getElementById('ai-editor-bar');
        const toggleBtn = document.getElementById('ai-editor-toggle');
        if (bar && toggleBtn) {
            bar.classList.toggle('-translate-y-full');
            toggleBtn.classList.toggle('opacity-0');
            toggleBtn.classList.toggle('pointer-events-none');
            if (!bar.classList.contains('-translate-y-full')) {
                document.getElementById('ai-editor-prompt')?.focus();
            }
        }
    }

    /**
     * Determines the current file path relative to the document root.
     * @returns {string} The relative file path (e.g., 'index.html', 'about.html').
     */
    function getCurrentFilePath() {
        let path = window.location.pathname;
        // Remove leading slash
        if (path.startsWith('/')) {
            path = path.substring(1);
        }
        // If path is empty (root) or ends with a slash (directory), append index.html
        if (path === '' || path.endsWith('/')) {
            path += 'index.html';
        }
        return path;
    }

    async function handleGenerate() {
        const promptInput = document.getElementById('ai-editor-prompt');
        const generateBtn = document.getElementById('ai-editor-generate');
        const btnText = document.getElementById('ai-editor-btn-text');
        const spinner = document.getElementById('ai-editor-spinner');

        if (!promptInput || !generateBtn || !btnText || !spinner || generateBtn.disabled) return;

        const userPrompt = promptInput.value.trim();
        if (!userPrompt) {
            showToast('AI Editor', 'Please enter a prompt.', false);
            return;
        }

        generateBtn.disabled = true;
        btnText.textContent = 'Generating...';
        spinner.classList.remove('hidden');

        try {
            // Collect scope data
            const updateAllHtml = document.getElementById('ai-update-all-html')?.checked || false;
            
            let filesToUpdate = [];
            if (updateAllHtml) {
                // Let the backend figure out all HTML files from sitemap
            } else {
                filesToUpdate = Array.from(document.querySelectorAll('.ai-target-file:checked')).map(el => el.value);
            }
            
            // If for some reason nothing is selected, default to current file.
            if (filesToUpdate.length === 0 && !updateAllHtml) {
                filesToUpdate.push(getCurrentFilePath());
            }

            const payload = {
                prompt: userPrompt,
                update_all_html: updateAllHtml,
                target_files: filesToUpdate
            };

            const response = await fetch('webrobot.php?action=generate_and_save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error((await response.json()).error || 'Generate failed.');
            const result = await response.json();
            showToast('AI Editor', result.message || 'Update successful! Reloading...', true);

            // Reload the page to see the changes from the server.
            // A timeout gives the user a moment to see the success toast.
            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (error) {
            console.error('AI Editor Error:', error);
            showToast('AI Editor Error', error.message, false);
            generateBtn.disabled = false;
            btnText.textContent = 'Generate';
            spinner.classList.add('hidden');
        }
    }

    async function showHistoryModal() {
        const modal = document.getElementById('ai-editor-history-modal');
        const listContainer = document.getElementById('ai-editor-history-list');
        if (!modal || !listContainer) return;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        listContainer.innerHTML = '<div class="p-4 text-center text-stone-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading history...</div>';

        try {
            const filePath = getCurrentFilePath();

            const response = await fetch('webrobot.php?action=list_backups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file: filePath })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.backups && data.backups.length > 0) {
                listContainer.innerHTML = data.backups.map(backup => {
                    const isCurrent = backup.is_current;

                    const promptHtml = backup.prompt ? `
                        <div class="mt-2 p-2 bg-stone-900/50 border border-stone-700 rounded">
                            <div class="text-stone-500 text-[10px] font-bold uppercase tracking-wider mb-1">Prompt</div>
                            <div class="text-stone-300 text-xs whitespace-pre-wrap">${backup.prompt}</div>
                        </div>
                    ` : '';

                    const rollbackButtonHtml = isCurrent
                        ? `<span class="bg-brandGreen-700 text-white font-semibold px-3 py-1 rounded-md text-[10px] uppercase tracking-wider">Current</span>`
                        : `<button data-backup-file="${backup.file}" class="rollback-btn bg-stone-600 hover:bg-stone-500 text-white font-semibold px-3 py-1 rounded-md">Activate</button>`;

                    const currentVersionClasses = isCurrent ? 'bg-stone-700/75 border border-brandGreen-700' : 'border border-transparent hover:bg-stone-700/50';

                    return `
                    <div class="p-2 rounded-md transition-colors ${currentVersionClasses}">
                        <div class="flex justify-between items-center text-xs">
                            <div>
                                <span class="font-mono text-stone-300">.${backup.file.split('.').pop()}</span>
                                <span class="text-stone-400 ml-2">${backup.date}</span>
                            </div>
                            ${rollbackButtonHtml}
                        </div>
                        ${promptHtml}
                    </div>`;
                }).join('');
            } else {
                listContainer.innerHTML = '<div class="p-4 text-center text-stone-400">No backup history found for this file.</div>';
            }

        } catch (error) {
            console.error('History Error:', error);
            listContainer.innerHTML = `<div class="p-4 text-center text-red-400">Error loading history: ${error.message}</div>`;
        }
    }

    function hideHistoryModal() {
        const modal = document.getElementById('ai-editor-history-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    async function showScopeModal() {
        const modal = document.getElementById('ai-editor-scope-modal');
        if (!modal) return;

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        const targetContainer = document.getElementById('ai-editor-target-files');
        if (!targetContainer) return;

        targetContainer.innerHTML = '<div class="p-2 text-center text-stone-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading...</div>';

        try {
            const response = await fetch('data/sitemap.json');
            if (!response.ok) throw new Error('sitemap.json not found');
            const sitemap = await response.json();

            // Populate HTML target files
            if (sitemap.html_pages && sitemap.html_pages.length > 0) {
                const currentFile = getCurrentFilePath();
                targetContainer.innerHTML = sitemap.html_pages.map(page => {
                    const isCurrentPage = page.path === currentFile;
                    return `
                    <label class="flex items-center space-x-2 p-2 bg-stone-900/50 rounded-md hover:bg-stone-700/50 cursor-pointer ${isCurrentPage ? 'opacity-50' : ''}">
                        <input type="checkbox" class="form-checkbox h-4 w-4 text-brandGreen-600 bg-stone-700 border-stone-600 rounded focus:ring-brandGreen-500 ai-target-file" value="${page.path}" ${isCurrentPage ? 'checked disabled' : ''}>
                        <span class="text-stone-300">${page.title} <span class="text-stone-500 font-mono text-[10px]">(${page.path})</span></span>
                    </label>
                `}).join('');
            } else {
                targetContainer.innerHTML = '<div class="p-2 text-stone-500">No HTML pages found.</div>';
            }

        } catch (error) {
            console.error('Scope Modal Error:', error);
            targetContainer.innerHTML = `<div class="p-2 text-red-400">${error.message}</div>`;
        }
    }

    function hideScopeModal() {
        const modal = document.getElementById('ai-editor-scope-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    async function handleRollback(e) {
        const targetButton = e.target.closest('.rollback-btn');
        if (!targetButton) return;

        const backupFile = targetButton.dataset.backupFile;
        if (!backupFile) return;
        
        if (!confirm(`Are you sure you want to activate this version?\n\n${backupFile.split('/').pop()}\n\nThe current version will be overwritten.`)) {
            return;
        }

        targetButton.disabled = true;
        targetButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const filePath = getCurrentFilePath();

            const response = await fetch('webrobot.php?action=rollback_file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file: filePath, backup_file: backupFile })
            });

            if (!response.ok) throw new Error((await response.json()).error || 'Rollback failed.');

            await response.json();
            showToast('AI Editor', 'Version activated! Reloading...', true);
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error('Rollback Error:', error);
            showToast('Activation Error', error.message, false);
            targetButton.disabled = false;
            targetButton.textContent = 'Activate';
        }
    }

    function initializeEditor() {
        document.body.insertAdjacentHTML('beforeend', editorHTML);

        document.getElementById('ai-editor-toggle')?.addEventListener('click', toggleEditorBar);
        document.getElementById('ai-editor-close')?.addEventListener('click', toggleEditorBar);
        document.getElementById('ai-editor-generate')?.addEventListener('click', handleGenerate);
        document.getElementById('ai-editor-prompt')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault(); // Prevent new line in textarea
                handleGenerate();
            }
        });

        // History/Rollback listeners
        document.getElementById('ai-editor-history')?.addEventListener('click', showHistoryModal);
        document.getElementById('ai-editor-history-close')?.addEventListener('click', hideHistoryModal);
        document.getElementById('ai-editor-history-modal')?.addEventListener('click', (e) => {
            // Close modal if clicking on the background overlay
            if (e.target.id === 'ai-editor-history-modal') {
                hideHistoryModal();
            }
        });
        document.getElementById('ai-editor-history-list')?.addEventListener('click', handleRollback);

        // Scope listeners
        document.getElementById('ai-editor-scope')?.addEventListener('click', showScopeModal);
        document.getElementById('ai-editor-scope-close')?.addEventListener('click', hideScopeModal);
        document.getElementById('ai-editor-scope-done')?.addEventListener('click', hideScopeModal);
        document.getElementById('ai-editor-scope-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'ai-editor-scope-modal') {
                hideScopeModal();
            }
        });
        
        // Logic for "Update All" checkbox
        const updateAllCheckbox = document.getElementById('ai-update-all-html');
        const targetFilesContainer = document.getElementById('ai-editor-target-files');
        if (updateAllCheckbox && targetFilesContainer) {
            updateAllCheckbox.addEventListener('change', () => {
                const isChecked = updateAllCheckbox.checked;
                targetFilesContainer.querySelectorAll('.ai-target-file:not(:disabled)').forEach(checkbox => {
                    checkbox.checked = isChecked;
                });
            });
        }
    }

    // --- Initialization Logic ---
    function checkAndInitEditor() {
        const hasRobotHash = window.location.hash === '#robot';
        const hasCookie = getCookie('ai_editor_enabled') === 'true';

        if (hasRobotHash) {
            // Set the session cookie if the hash is present
            setSessionCookie('ai_editor_enabled', 'true');
        }

        if (hasRobotHash || hasCookie) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initializeEditor);
            } else {
                initializeEditor();
            }
        }
    }

    checkAndInitEditor();
})();
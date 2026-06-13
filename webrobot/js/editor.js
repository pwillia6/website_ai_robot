// /Users/user/Volumes/acms2/acms.cweb.com.au/webrobot/js/editor.js

(function() {
    // --- Cookie Helpers ---
    function setSessionCookie(name, value, days) {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days*24*60*60*1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "")  + expires + "; path=/";
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
        <style> #ai-editor-spinner.hidden, #upload-spinner.hidden { display: none !important; } </style>
        <div id="ai-editor-bar" class="fixed top-0 left-0 right-0 bg-stone-900 text-white p-3 shadow-lg z-[100] flex items-start gap-4 text-sm transition-transform duration-300 -translate-y-full">
            
            <!-- Editor Mode Toggle -->
            <div class="flex-shrink-0 text-center pt-1.5 space-y-1">
                <div class="font-bold text-brandTeal-400 flex items-center gap-2">
                    <i class="fa-solid fa-robot"></i>
                    <span>Editor</span>
                </div>
                <div class="flex items-center justify-center space-x-2">
                    <span id="ai-mode-label" class="font-semibold text-xs text-white">AI</span>
                    <label for="mode-toggle" class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" value="" id="mode-toggle" class="sr-only peer">
                        <div class="w-9 h-5 bg-stone-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-600 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brandGreen-600"></div>
                    </label>
                    <span id="text-mode-label" class="font-semibold text-xs text-stone-400">Text</span>
                </div>
            </div>

            <!-- AI Controls -->
            <div id="ai-editor-controls" class="flex-grow flex items-start gap-3">
                <textarea id="ai-editor-prompt" rows="3" class="flex-grow bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-brandGreen-500 resize-y" placeholder="Enter your edit request... (Cmd/Ctrl + Enter to submit)"></textarea>
                <div class="flex flex-col gap-2 flex-shrink-0">
                    <button id="ai-editor-generate" class="bg-brandGreen-700 hover:bg-brandGreen-600 text-white font-semibold px-4 py-2.5 rounded-md text-sm flex items-center justify-center gap-2 w-full">
                        <span id="ai-editor-btn-text">Generate</span>
                        <i id="ai-editor-spinner" class="fa-solid fa-spinner fa-spin hidden"></i>
                    </button>
                    <div class="flex items-center gap-1.5">
                        <button id="ai-editor-history" title="View file history" class="flex-1 text-stone-400 hover:text-white font-semibold px-3 py-1.5 rounded-md text-xs flex items-center justify-center gap-2 border border-stone-700 hover:bg-stone-800">
                            <i class="fa-solid fa-history"></i>
                            <span>History</span>
                        </button>
                        <button id="ai-editor-new-chat" title="Start a new conversation" class="flex-1 text-stone-400 hover:text-white font-semibold px-3 py-1.5 rounded-md text-xs flex items-center justify-center gap-2 border border-stone-700 hover:bg-stone-800">
                            <i class="fa-solid fa-comment-slash"></i>
                            <span>New Chat</span>
                        </button>
                        <button id="ai-editor-scope" title="Set edit scope" class="flex-1 text-stone-400 hover:text-white font-semibold px-3 py-1.5 rounded-md text-xs flex items-center justify-center gap-2 border border-stone-700 hover:bg-stone-800">
                            <i class="fa-solid fa-crosshairs"></i>
                            <span>Scope</span>
                        </button>
                        <button id="ai-editor-uploads" title="Manage Uploads" class="flex-1 text-stone-400 hover:text-white font-semibold px-3 py-1.5 rounded-md text-xs flex items-center justify-center gap-2 border border-stone-700 hover:bg-stone-800">
                            <i class="fa-solid fa-upload"></i>
                            <span>Uploads</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Text Editor Controls -->
            <div id="text-editor-controls" class="hidden flex-grow items-start gap-3">
                <textarea id="text-editor-comment" rows="3" class="flex-grow bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-brandGreen-500 resize-y" placeholder="Add a comment about your changes (optional)..."></textarea>
                <div class="flex flex-col gap-2 flex-shrink-0">
                    <button id="save-text-btn" class="bg-brandGreen-700 hover:bg-brandGreen-600 text-white font-semibold px-4 py-2.5 rounded-md text-sm flex items-center justify-center gap-2 w-full">
                        <i class="fa-solid fa-save mr-1"></i> Save Changes
                    </button>
                    <button id="cancel-text-btn" class="bg-stone-700 hover:bg-stone-600 text-stone-300 font-semibold px-4 py-2.5 rounded-md text-sm w-full">
                        Cancel
                    </button>
                </div>
            </div>

            <button id="ai-editor-close" class="text-stone-500 hover:text-white pt-2" title="Close Editor">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
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
        <div id="ai-editor-uploads-modal" class="fixed inset-0 bg-black/60 z-[101] hidden items-center justify-center p-4">
            <div class="bg-stone-800 rounded-lg shadow-2xl w-full max-w-4xl flex flex-col" style="height: 80vh;">
                <div class="p-4 border-b border-stone-700 flex justify-between items-center flex-shrink-0">
                    <h3 class="font-bold text-white flex items-center gap-2"><i class="fa-solid fa-upload"></i>File Uploads</h3>
                    <button id="ai-editor-uploads-close" class="text-stone-400 hover:text-white text-2xl leading-none">&times;</button>
                </div>
                <div class="flex-grow flex overflow-hidden">
                    <!-- Upload Form -->
                    <div class="w-1/3 p-4 border-r border-stone-700 flex flex-col">
                        <h4 class="text-sm font-bold text-stone-300 mb-3">Upload New File</h4>
                        <div id="upload-dropzone" class="flex-grow flex flex-col items-center justify-center border-2 border-dashed border-stone-600 rounded-lg p-4 text-center text-stone-400 transition-colors hover:border-brandGreen-500 hover:bg-stone-700/50">
                            <i class="fa-solid fa-cloud-arrow-up text-3xl mb-2"></i>
                            <p class="text-sm">Drag & drop files here or</p>
                            <button id="upload-browse-btn" class="mt-2 text-brandGreen-400 hover:underline font-semibold">browse to upload</button>
                            <input type="file" id="upload-file-input" class="hidden" multiple>
                        </div>
                        <div id="upload-preview-container" class="mt-3 space-y-2"></div>
                        <textarea id="upload-description" rows="2" class="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-sm text-white placeholder-stone-500 focus:outline-none focus:ring-1 focus:ring-brandGreen-500 mt-3" placeholder="File description..."></textarea>
                        <button id="upload-submit-btn" class="mt-3 w-full bg-brandGreen-700 hover:bg-brandGreen-600 text-white font-semibold px-4 py-2 rounded-md text-sm flex items-center justify-center gap-2">
                            <span id="upload-btn-text">Upload</span>
                            <i id="upload-spinner" class="fa-solid fa-spinner fa-spin hidden"></i>
                        </button>
                    </div>
                    <!-- File Lists -->
                    <div class="w-2/3 p-4 overflow-y-auto custom-scrollbar">
                        <div>
                            <h4 class="text-sm font-bold text-stone-300 mb-2">Images</h4>
                            <div id="uploads-image-list" class="space-y-2"></div>
                        </div>
                        <div class="mt-6">
                            <h4 class="text-sm font-bold text-stone-300 mb-2">Documents</h4>
                            <div id="uploads-document-list" class="space-y-2"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // --- Functions ---

    let isEditorInitialized = false;

    /**
     * Resets dynamically generated content on the page.
     * This is called when entering Text mode to ensure the original static HTML is edited.
     * It finds all elements with the 'generated-content' class and clears them.
     */
    function resetGeneratedContent() {
        const elementsToReset = document.querySelectorAll('.generated-content');
        elementsToReset.forEach(el => {
            el.innerHTML = '<!-- Dynamically generated content reset for editing -->';
        });
    }

    /**
     * Toggles the editor between AI and Text modes.
     */
    function setEditorMode() {
        const mainEl = document.querySelector('main');
        if (!mainEl) {
            console.error('Could not find <main> tag in the page to edit.');
            return;
        }

        const modeToggle = document.getElementById('mode-toggle');
        const aiModeLabel = document.getElementById('ai-mode-label');
        const textModeLabel = document.getElementById('text-mode-label');
        const aiEditorControls = document.getElementById('ai-editor-controls');
        const textEditorControls = document.getElementById('text-editor-controls');

        const isTextMode = modeToggle.checked;
        const wasInTextMode = mainEl.contentEditable === 'true';

        if (isTextMode) {
            // --- Enable Text Editor Mode ---
            if (aiEditorControls) aiEditorControls.style.display = 'none';
            if (textEditorControls) textEditorControls.style.display = 'flex';
            
            aiModeLabel.classList.remove('text-white');
            aiModeLabel.classList.add('text-stone-400');
            textModeLabel.classList.add('text-white');
            textModeLabel.classList.remove('text-stone-400');

            // Reset dynamically generated content before making the main tag editable.
            resetGeneratedContent();

            mainEl.contentEditable = 'true';
            mainEl.style.outline = '2px dashed #8ac43f'; // brandGreen-400
            mainEl.style.minHeight = '300px';
            mainEl.focus();
        } else {
            // --- Disable Text Editor Mode (Return to AI/View) ---
            if (wasInTextMode) {
                if (confirm('Are you sure you want to cancel? All changes will be lost.')) {
                    window.location.reload(); // Discard changes and reset state.
                } else {
                    // User doesn't want to cancel, so revert the toggle to stay in text mode.
                    modeToggle.checked = true;
                }
                return; // Stop further execution.
            }

            if (aiEditorControls) aiEditorControls.style.display = 'flex';
            if (textEditorControls) textEditorControls.style.display = 'none';

            aiModeLabel.classList.add('text-white');
            aiModeLabel.classList.remove('text-stone-400');
            textModeLabel.classList.remove('text-white');
            textModeLabel.classList.add('text-stone-400');

            mainEl.contentEditable = 'false';
            mainEl.style.outline = 'none';
        }
    }

    /**
     * Saves the edited innerHTML of the <main> tag.
     */
    async function saveTextChanges() {
        const mainEl = document.querySelector('main');
        const currentFile = getCurrentFilePath();
        const commentInput = document.getElementById('text-editor-comment');

        if (!mainEl || !currentFile) {
            showToast('Text Editor Error', 'No file selected or <main> content not found.', false);
            return;
        }

        const newMainContent = mainEl.innerHTML;
        const comment = commentInput ? commentInput.value.trim() : '';
        
        if (!confirm('Are you sure you want to save these changes? This will overwrite the main content of the page.')) {
            return;
        }

        try {
            const response = await fetch('/webrobot.php?action=save_text_edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file: currentFile,
                    content: newMainContent,
                    comment: comment,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'An unknown error occurred on the server.');
            }

            showToast('Text Editor', result.message, true);
            // Reload the page to show the saved state
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error('Error saving text edit:', error);
            showToast('Text Editor Error', 'Failed to save changes: ' + error.message, false);
        }
    }
    
    /**
     * Cancels the text edit and reloads the page.
     */
    function cancelTextChanges() {
        if (confirm('Are you sure you want to cancel? All changes will be lost.')) {
            window.location.reload(); // Reload to discard changes
        }
    }

    /**
     * Generates a page-specific cookie name for the interaction ID.
     * @returns {string} The cookie name.
     */
    function getInteractionCookieName() {
        const path = getCurrentFilePath();
        // Sanitize the path to create a valid cookie name.
        const safePath = path.replace(/\//g, '_').replace(/\./g, '-');
        return 'gemini_interaction_id_' + safePath;
    }

    /**
     * Clears the conversation history by deleting the interaction ID cookie.
     */
    function handleNewChat() {
        if (confirm('Are you sure you want to start a new conversation? This will clear the AI\'s memory of previous requests.')) {
            setSessionCookie(getInteractionCookieName(), '', -1); // Expire page-specific cookie
            document.getElementById('ai-editor-prompt').value = '';
            showToast('AI Editor', 'New conversation started.', true);
        }
    }

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

            const cookieName = getInteractionCookieName();
            // Always retrieve the interactionId to maintain conversational context.
            let interactionId = getCookie(cookieName);

            const payload = {
                prompt: userPrompt,
                update_all_html: updateAllHtml,
                target_files: filesToUpdate,
                interaction_id: interactionId
            };

            const response = await fetch('/webrobot.php?action=generate_and_save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error((await response.json()).error || 'Generate failed.');
            
            const result = await response.json();
            
            // Always manage the cookie to maintain conversational context.
            if (result.interaction_id) {
                setSessionCookie(cookieName, result.interaction_id, 1); // Set for 1 day
            } else {
                // If no ID came back, the conversation is broken or over. Clear the cookie.
                setSessionCookie(cookieName, '', -1);
            }

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
            const response = await fetch('/webrobot.php?action=list_commits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.commits && data.commits.length > 0) {
                listContainer.innerHTML = data.commits.map((backup, index) => {
                    const isCurrent = index === 0;

                    const promptHtml = backup.prompt ? `
                        <div class="mt-2 p-2 bg-stone-900/50 border border-stone-700 rounded">
                            <div class="text-stone-500 text-[10px] font-bold uppercase tracking-wider mb-1">Prompt</div>
                            <div class="text-stone-300 text-xs whitespace-pre-wrap">${backup.prompt}</div>
                        </div>
                    ` : '';

                    const isWebRobotCommit = backup.prompt && backup.prompt.includes('[WebRobot]');
                    const diffLinkHtml = isWebRobotCommit 
                        ? `<a href="#" class="diff-link text-brandTeal-400 hover:underline ml-2" data-commit="${backup.file}">changes</a>`
                        : '';

                    let rollbackButtonHtml;
                    if (isCurrent) {
                        rollbackButtonHtml = `<span class="bg-brandGreen-700 text-white font-semibold px-3 py-1 rounded-md text-[10px] uppercase tracking-wider">Current</span>`;
                    } else if (index === 1) {
                        rollbackButtonHtml = `<button data-commit="${backup.file}" class="rollback-btn bg-stone-600 hover:bg-stone-500 text-white font-semibold px-3 py-1 rounded-md">Activate</button>`;
                    } else {
                        rollbackButtonHtml = `<button disabled class="rollback-btn bg-stone-700 text-stone-500 font-semibold px-3 py-1 rounded-md cursor-not-allowed">Activate</button>`;
                    }

                    const currentVersionClasses = isCurrent ? 'bg-stone-700/75 border border-brandGreen-700' : 'border border-transparent hover:bg-stone-700/50';

                    return `
                    <div class="p-2 rounded-md transition-colors ${currentVersionClasses}">
                        <div class="flex justify-between items-center text-xs">
                            <div>
                                <span class="font-mono text-stone-300">${backup.file.substring(0, 7)}</span>
                                ${diffLinkHtml}
                                <span class="text-stone-400 ml-2">${backup.date}</span>
                            </div>
                            ${rollbackButtonHtml}
                        </div>
                        ${promptHtml}
                        <div class="diff-container hidden mt-2 p-2 bg-black/50 rounded-md max-h-60 overflow-y-auto custom-scrollbar">
                            <pre class="text-xs text-white whitespace-pre-wrap font-mono"></pre>
                        </div>
                    </div>`;
                }).join('');
            } else {
                listContainer.innerHTML = '<div class="p-4 text-center text-stone-400">No commit history found for this repository.</div>';
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
            const response = await fetch('/data/sitemap.json');
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

    /**
     * Compares two strings and returns an array of objects representing the word-level differences.
     * This is a basic implementation based on the Longest Common Subsequence algorithm.
     * @param {string} oldText The original string.
     * @param {string} newText The new string.
     * @returns {Array<{value: string, added?: boolean, removed?: boolean}>}
     */
    function diffWords(oldText, newText) {
        const oldWords = oldText.split(/(\s+)/).filter(Boolean);
        const newWords = newText.split(/(\s+)/).filter(Boolean);

        const dp = [];
        for (let i = 0; i <= oldWords.length; i++) {
            dp[i] = new Array(newWords.length + 1).fill(0);
        }

        for (let i = 1; i <= oldWords.length; i++) {
            for (let j = 1; j <= newWords.length; j++) {
                if (oldWords[i - 1] === newWords[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        const result = [];
        let i = oldWords.length;
        let j = newWords.length;
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
                result.unshift({ value: oldWords[i - 1] });
                i--; j--;
            } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
                result.unshift({ value: newWords[j - 1], added: true });
                j--;
            } else if (i > 0) {
                result.unshift({ value: oldWords[i - 1], removed: true });
                i--;
            } else { break; }
        }
        return result;
    }

    async function handleShowDiff(e) {
        const diffLink = e.target.closest('.diff-link');
        if (!diffLink) return;

        e.preventDefault();

        const commitHash = diffLink.dataset.commit;
        const historyItem = diffLink.closest('.p-2.rounded-md');
        const diffContainer = historyItem.querySelector('.diff-container');
        const preElement = diffContainer.querySelector('pre');

        if (!commitHash || !diffContainer || !preElement) return;

        // Toggle visibility if already loaded
        if (diffContainer.dataset.loaded === 'true') {
            diffContainer.classList.toggle('hidden');
            return;
        }

        diffLink.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            // Fetch sitemap data to get page titles
            let sitemapData = { html_pages: [], include_files: [] }; // Initialize with both keys
            try {
                const sitemapResponse = await fetch('/data/sitemap.json');
                if (sitemapResponse.ok) {
                    sitemapData = await sitemapResponse.json();
                }
            } catch (sitemapError) {
                console.warn('Could not fetch sitemap.json for diff titles:', sitemapError);
            }
            const allPages = (sitemapData.html_pages || []).concat(sitemapData.include_files || []);
            const titleMap = new Map(allPages.map(page => [page.path, page.title]));

            const response = await fetch('/webrobot.php?action=get_commit_diff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commit: commitHash })
            });

            if (!response.ok) throw new Error((await response.json()).error || 'Failed to fetch diff.');

            const result = await response.json();
            
            // To simplify the view, filter out the context lines (those starting with a space)
            // and apply syntax highlighting to the added/removed lines.
            const diffLines = result.diff.split('\n');
            let formattedHtml = '';
            let isJsonFile = false; // Flag for JSON file, reset for each file in the diff

            const stripTags = (str) => {
                const div = document.createElement('div');
                div.innerHTML = str;
                return div.textContent || div.innerText || '';
            };

            let i = 0;
            while (i < diffLines.length) {
                const line = diffLines[i];

                // Show filename
                if (line.startsWith('diff --git')) {
                    const parts = line.split(' ');
                    const filename = parts[3] ? parts[3].substring(2) : 'unknown file';
                    const displayTitle = titleMap.get(filename) || filename;
                    isJsonFile = filename.endsWith('.json');
                    formattedHtml += `<span class="text-white font-bold">${displayTitle}</span>\n`;
                    i++;
                    continue;
                }

                // Check for a modification pair (- line followed by + line) and perform a word-level diff
                if (line.startsWith('-') && !line.startsWith('---') && (i + 1 < diffLines.length) && diffLines[i+1].startsWith('+') && !diffLines[i+1].startsWith('+++')) {
                    let cleanMinus = stripTags(line.substring(1));
                    let cleanPlus = stripTags(diffLines[i+1].substring(1));
                    if (!isJsonFile) {
                        cleanMinus = cleanMinus.replace(/\t/g, ' ').replace(/ +/g, ' ');
                        cleanPlus = cleanPlus.replace(/\t/g, ' ').replace(/ +/g, ' ');
                    }
                    const wordDiff = diffWords(cleanMinus, cleanPlus);

                    let minusHtml = '', plusHtml = '';
                    wordDiff.forEach(part => {
                        const escapedValue = document.createElement('div');
                        escapedValue.textContent = part.value;
                        if (part.added) {
                            plusHtml += `<span class="bg-green-800/50 text-green-200">${escapedValue.innerHTML}</span>`;
                        } else if (part.removed) {
                            minusHtml += `<span class="bg-red-800/50 text-red-200">${escapedValue.innerHTML}</span>`;
                        } else {
                            minusHtml += escapedValue.innerHTML;
                            plusHtml += escapedValue.innerHTML;
                        }
                    });
                    if (cleanMinus.trim().length > 0) {
                        formattedHtml += `<span class="text-red-400">- ${minusHtml}</span>\n`;
                    }
                    if (cleanPlus.trim().length > 0) {
                        formattedHtml += `<span class="text-green-400">+ ${plusHtml}</span>\n`;
                    }
                    i += 2; // Skip next line as it has been processed
                } else if (line.startsWith('+') && !line.startsWith('+++')) {
                    let cleanText = stripTags(line.substring(1));
                    if (!isJsonFile) {
                        cleanText = cleanText.replace(/\t/g, ' ').replace(/ +/g, ' ');
                    }
                    if (cleanText.trim().length > 0) {
                        formattedHtml += `<span class="text-green-400">+ ${cleanText}</span>\n`;
                    }
                    i++;
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                    let cleanText = stripTags(line.substring(1));
                    if (!isJsonFile) {
                        cleanText = cleanText.replace(/\t/g, ' ').replace(/ +/g, ' ');
                    }
                    if (cleanText.trim().length > 0) {
                        formattedHtml += `<span class="text-red-400">- ${cleanText}</span>\n`;
                    }
                    i++;
                } else {
                    // Ignore all other lines (---, +++, @@, index, context, etc.)
                    i++;
                }
            }

            preElement.innerHTML = formattedHtml;
            diffContainer.classList.remove('hidden');
            diffContainer.dataset.loaded = 'true';

        } catch (error) {
            console.error('Diff Error:', error);
            preElement.textContent = `Error loading diff: ${error.message}`;
            diffContainer.classList.remove('hidden');
        } finally {
            diffLink.innerHTML = 'changes';
        }
    }

    async function handleRollback(e) {
        const targetButton = e.target.closest('.rollback-btn');
        if (!targetButton) return;

        const commitHash = targetButton.dataset.commit;
        if (!commitHash) return;
        
        if (!confirm(`Are you sure you want to roll back the entire site to this version?\n\nAll changes made after this version will be permanently lost.`)) {
            return;
        }

        targetButton.disabled = true;
        targetButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const response = await fetch('/webrobot.php?action=rollback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commit: commitHash })
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

    // --- Uploads Modal Functions ---

    function hideUploadsModal() {
        const modal = document.getElementById('ai-editor-uploads-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    async function showUploadsModal() {
        const modal = document.getElementById('ai-editor-uploads-modal');
        if (!modal) return;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        await refreshUploadsList();
    }

    async function refreshUploadsList() {
        const imageList = document.getElementById('uploads-image-list');
        const docList = document.getElementById('uploads-document-list');
        if (!imageList || !docList) return;

        imageList.innerHTML = '<div class="p-2 text-stone-400"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
        docList.innerHTML = '<div class="p-2 text-stone-400"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

        try {
            const response = await fetch('/webrobot.php?action=list_uploads', { method: 'POST' });
            if (!response.ok) throw new Error('Failed to fetch uploads.');
            const { uploads } = await response.json();

            const renderList = (items, type) => {
                 if (!items || items.length === 0) {
                     return '<div class="p-2 text-stone-500 text-xs">No files uploaded.</div>';
                 }
                 return items.map(item => {
                    const thumbnail = type === 'image'
                        ? `<div class="relative group flex-shrink-0 mr-3">
                               <img src="/${item.path}" alt="Preview" class="absolute bottom-0 left-12 w-[200px] h-auto bg-stone-900 border border-stone-600 rounded-lg shadow-lg p-1 hidden group-hover:block z-10">
                           </div>`
                        : `<div class="w-10 h-10 flex items-center justify-center bg-stone-700 rounded-md mr-3 flex-shrink-0"><i class="fa-solid fa-file-lines text-stone-400"></i></div>`;
 
                     return `
                     <div class="bg-stone-900/75 p-2 rounded-md flex items-start justify-between text-xs" data-filename="${item.filename}" data-type="${type}">
                         <div class="flex items-start flex-grow">
                             ${thumbnail}
                             <div class="flex-grow">
                                 <div class="font-semibold text-stone-200">${item.filename}</div>
                                 <div class="description-view text-stone-400">${item.description}</div>
                                 <div class="description-edit hidden">
                                     <input type="text" value="${item.description}" class="w-full bg-stone-800 border border-stone-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brandGreen-500">
                                     <div class="mt-1.5 space-x-2">
                                         <button class="save-desc-btn text-brandGreen-400 hover:underline">Save</button>
                                         <button class="cancel-desc-btn text-stone-400 hover:underline">Cancel</button>
                                     </div>
                                 </div>
                             </div>
                         </div>
                         <div class="flex-shrink-0 ml-2 space-x-1">
                            <button class="edit-desc-btn text-stone-400 hover:text-white px-2 py-1"><i class="fa-solid fa-pencil"></i></button>
                            <button class="delete-upload-btn text-red-500 hover:text-red-400 px-2 py-1"><i class="fa-solid fa-trash-can"></i></button>
                         </div>
                     </div>
                 `}).join('');
            };
 
            imageList.innerHTML = renderList(uploads.images, 'image');
            docList.innerHTML = renderList(uploads.documents, 'document');
        } catch (error) {
            imageList.innerHTML = `<div class="p-2 text-red-400">${error.message}</div>`;
            docList.innerHTML = `<div class="p-2 text-red-400">${error.message}</div>`;
        }
    }

    function handleFileSelect(files) {
        const previewContainer = document.getElementById('upload-preview-container');
        if (!files || files.length === 0 || !previewContainer) return;

        // For now, only handle the first file if multiple are selected/dropped
        const file = files[0];
        previewContainer.innerHTML = `
            <div class="p-2 bg-stone-700 rounded-md text-xs text-white flex items-center gap-2">
                <i class="fa-solid fa-file"></i>
                <span class="font-semibold">${file.name}</span>
                <span class="text-stone-400">(${(file.size / 1024).toFixed(1)} KB)</span>
            </div>
        `;
        // Store the file object for submission
        previewContainer.file = file;
    }

    async function handleUploadSubmit() {
        const previewContainer = document.getElementById('upload-preview-container');
        const file = previewContainer.file;
        const description = document.getElementById('upload-description').value.trim();
        const submitBtn = document.getElementById('upload-submit-btn');
        const btnText = document.getElementById('upload-btn-text');
        const spinner = document.getElementById('upload-spinner');

        if (!file) {
            showToast('Upload Error', 'Please select a file to upload.', false);
            return;
        }
        if (!description) {
            showToast('Upload Error', 'Please enter a description.', false);
            return;
        }

        submitBtn.disabled = true;
        btnText.textContent = 'Uploading...';
        spinner.classList.remove('hidden');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('description', description);

        try {
            const response = await fetch('/webrobot.php?action=handle_upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Upload failed.');

            showToast('Upload Success', result.message, true);
            
            // Reset form
            previewContainer.innerHTML = '';
            previewContainer.file = null;
            document.getElementById('upload-description').value = '';

            await refreshUploadsList();

        } catch (error) {
            showToast('Upload Error', error.message, false);
        } finally {
            submitBtn.disabled = false;
            btnText.textContent = 'Upload';
            spinner.classList.add('hidden');
        }
    }

    async function handleDeleteUpload(e) {
        const deleteBtn = e.target.closest('.delete-upload-btn');
        if (!deleteBtn) return;

        const { filename, type } = deleteBtn.dataset;
        if (!filename || !type) return;

        if (!confirm(`Are you sure you want to delete "${filename}"? This cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch('/webrobot.php?action=delete_upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, type })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Delete failed.');

            showToast('Success', result.message, true);
            await refreshUploadsList();

        } catch (error) {
            showToast('Delete Error', error.message, false);
        }
    }

    async function handleDescriptionEdit(e) {
        const editBtn = e.target.closest('.edit-desc-btn');
        const cancelBtn = e.target.closest('.cancel-desc-btn');
        const saveBtn = e.target.closest('.save-desc-btn');

        if (!editBtn && !cancelBtn && !saveBtn) return;
        e.preventDefault();

        const itemElement = e.target.closest('[data-filename]');
        if (!itemElement) return;

        const viewMode = itemElement.querySelector('.description-view');
        const editMode = itemElement.querySelector('.description-edit');
        const editBtnEl = itemElement.querySelector('.edit-desc-btn');

        if (editBtn) {
            viewMode.classList.add('hidden');
            editMode.classList.remove('hidden');
            editBtnEl.classList.add('hidden');
            editMode.querySelector('input').focus();
        }

        if (cancelBtn) {
            viewMode.classList.remove('hidden');
            editMode.classList.add('hidden');
            editBtnEl.classList.remove('hidden');
            // Reset input to original value
            editMode.querySelector('input').value = viewMode.textContent;
        }

        if (saveBtn) {
            const { filename, type } = itemElement.dataset;
            const newDescription = editMode.querySelector('input').value.trim();

            if (!newDescription) {
                showToast('Error', 'Description cannot be empty.', false);
                return;
            }

            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
            saveBtn.disabled = true;

            try {
                const response = await fetch('/webrobot.php?action=update_upload_description', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename, type, description: newDescription })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Failed to save.');

                showToast('Success', result.message, true);
                viewMode.textContent = newDescription; // Update view
                viewMode.classList.remove('hidden');
                editMode.classList.add('hidden');
                editBtnEl.classList.remove('hidden');

            } catch (error) {
                showToast('Save Error', error.message, false);
            } finally {
                saveBtn.innerHTML = 'Save';
                saveBtn.disabled = false;
            }
        }
    }

    async function initializeEditor() {
        document.body.insertAdjacentHTML('beforeend', editorHTML);

        document.getElementById('ai-editor-close')?.addEventListener('click', toggleEditorBar);
        document.getElementById('ai-editor-generate')?.addEventListener('click', handleGenerate);

        document.getElementById('ai-editor-prompt')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault(); // Prevent new line in textarea
                handleGenerate();
            }
        });

        // --- New Listeners for Text Editor Mode ---
        document.getElementById('mode-toggle')?.addEventListener('change', setEditorMode);
        document.getElementById('save-text-btn')?.addEventListener('click', saveTextChanges);
        document.getElementById('cancel-text-btn')?.addEventListener('click', cancelTextChanges);

        // History/Rollback listeners
        document.getElementById('ai-editor-history')?.addEventListener('click', showHistoryModal);
        document.getElementById('ai-editor-history-close')?.addEventListener('click', hideHistoryModal);
        document.getElementById('ai-editor-new-chat')?.addEventListener('click', handleNewChat);
        document.getElementById('ai-editor-history-modal')?.addEventListener('click', (e) => {
            // Close modal if clicking on the background overlay
            if (e.target.id === 'ai-editor-history-modal') {
                hideHistoryModal();
            }
        });
        document.getElementById('ai-editor-history-list')?.addEventListener('click', handleRollback);
        document.getElementById('ai-editor-history-list')?.addEventListener('click', handleShowDiff);

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

        // Uploads Modal Listeners
        document.getElementById('ai-editor-uploads')?.addEventListener('click', showUploadsModal);
        document.getElementById('ai-editor-uploads-close')?.addEventListener('click', hideUploadsModal);
        document.getElementById('upload-submit-btn')?.addEventListener('click', handleUploadSubmit);
        document.getElementById('uploads-image-list')?.addEventListener('click', handleDeleteUpload);
        document.getElementById('uploads-image-list')?.addEventListener('click', handleDescriptionEdit);
        document.getElementById('uploads-document-list')?.addEventListener('click', handleDeleteUpload);
        document.getElementById('uploads-document-list')?.addEventListener('click', handleDescriptionEdit);

        // Drag and Drop & Browse Listeners
        const dropzone = document.getElementById('upload-dropzone');
        const fileInput = document.getElementById('upload-file-input');
        const browseBtn = document.getElementById('upload-browse-btn');

        if (dropzone && fileInput && browseBtn) {
            browseBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files));

            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });
            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone.addEventListener(eventName, () => dropzone.classList.add('border-brandGreen-500', 'bg-stone-700/50'), false);
            });
            ['dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, () => dropzone.classList.remove('border-brandGreen-500', 'bg-stone-700/50'), false);
            });
            dropzone.addEventListener('drop', (e) => handleFileSelect(e.dataTransfer.files), false);
        }

        isEditorInitialized = true;
    }

    // --- Initialization Logic ---
    function checkAndInitEditor() {
        const hasRobotHash = window.location.hash === '#robot';
        const hasCookie = getCookie('ai_editor_enabled') === 'true';

        if (hasRobotHash) {
            setSessionCookie('ai_editor_enabled', 'true');
        } else if (!hasCookie) {
            return;
        }

        // If we reach here, show the toggle button.
        // The actual editor initialization and login check will happen when the user clicks it.
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showToggleButton);
        } else {
            showToggleButton();
        }
    }

    function showToggleButton() {
        const toggleButtonHTML = `
            <button id="ai-editor-toggle" class="fixed top-2 right-2 bg-brandGreen-700 text-white w-10 h-10 rounded-full shadow-lg z-[99] flex items-center justify-center hover:bg-brandGreen-600 transition-all">
                <i class="fa-solid fa-robot"></i>
            </button>`;
        document.body.insertAdjacentHTML('beforeend', toggleButtonHTML);
        document.getElementById('ai-editor-toggle')?.addEventListener('click', handleToggleClick);
    }

    async function handleToggleClick() {
        if (isEditorInitialized) {
            toggleEditorBar();
        } else {
            // Check login status now, when the user wants to open the editor for the first time.
            try {
                const response = await fetch('/webrobot.php?action=check_login_status', { method: 'POST' });
                if (!response.ok) {
                    // This can happen if the user cancels the login prompt.
                    console.warn('AI Editor: Not logged in or login cancelled. Editor will not load.');
                    return; 
                }
                // Login was successful, now initialize the full editor UI.
                await initializeEditor();
                toggleEditorBar(); // Open the editor bar immediately after initialization.
            } catch (error) {
                console.error('AI Editor: Failed to check login status. Editor will not load.', error);
                showToast('Editor Error', 'Could not verify login status.', false);
            }
        }
    }

    checkAndInitEditor();
})();
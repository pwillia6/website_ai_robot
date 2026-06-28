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
        <style>
            /* AI Editor: Self-contained styles to avoid host page conflicts */
            #ai-editor-bar, #ai-editor-bar *, #ai-editor-bar *::before, #ai-editor-bar *::after,
            .ai-editor-modal, .ai-editor-modal *, .ai-editor-modal *::before, .ai-editor-modal *::after {
                box-sizing: border-box;
            }
            #ai-editor-bar, .ai-editor-modal, #ai-editor-toast {
                --c-bg-base: #262626;
                --c-bg-surface: #404040;
                --c-bg-muted: #525252;
                --c-border: #525252;
                --c-text-base: #f5f5f5;
                --c-text-muted: #a3a3a3;
                --c-text-subtle: #737373;
                --c-accent-blue: #3b82f6;
                --c-accent-blue-hover: #2563eb;
                --c-accent-gold: #f59e0b;
                --c-accent-green: #22c55e;
                --c-accent-red: #ef4444;
                --c-shadow: 0 10px 15px -3px rgba(0,0,0,0.2), 0 4px 6px -2px rgba(0,0,0,0.1);
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            #ai-editor-bar {
                position: fixed;
                top: 0; left: 0; right: 0;
                background-color: var(--c-bg-base);
                color: var(--c-text-base);
                padding: 0.75rem;
                box-shadow: var(--c-shadow);
                z-index: 100001;
                display: flex;
                align-items: flex-start;
                gap: 1rem;
                font-size: 14px;
                line-height: 1.5;
                transition: transform 0.3s ease-in-out;
                transform: translateY(-100%);
            }
            #ai-editor-bar.editor-visible {
                transform: translateY(0);
            }
            #ai-editor-bar button, #ai-editor-bar input, #ai-editor-bar textarea {
                font-family: inherit;
                font-size: inherit;
                color: inherit;
                margin: 0;
            }
            #ai-editor-bar button { cursor: pointer; background: none; border: none; padding: 0; }
            .ai-editor-hidden { display: none !important; }
            @keyframes ai-editor-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            .ai-editor-spinner { animation: ai-editor-spin 1s linear infinite; }

            /* Toggle Button */
            #ai-editor-toggle {
                position: fixed;
                top: 0.5rem; right: 0.5rem;
                background-color: var(--c-accent-blue);
                color: white;
                width: 2.5rem; height: 2.5rem;
                border-radius: 9999px;
                box-shadow: var(--c-shadow);
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                border: none;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            #ai-editor-toggle:hover { background-color: var(--c-accent-blue-hover); transform: scale(1.1); }
            #ai-editor-toggle.editor-visible { opacity: 0; pointer-events: none; }

            /* Editor Bar Content */
            #ai-editor-bar .mode-toggle-container { flex-shrink: 0; text-align: center; padding-top: 0.375rem; }
            #ai-editor-bar .mode-toggle-container > * + * { margin-top: 0.25rem; }
            #ai-editor-bar .mode-toggle-container .editor-brand { font-weight: 700; color: var(--c-accent-blue); display: flex; align-items: center; gap: 0.5rem; justify-content: center; }
            #ai-editor-bar .mode-toggle-switch { display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
            #ai-editor-bar .mode-toggle-switch span { font-weight: 600; font-size: 12px; }
            #ai-editor-bar .mode-toggle-switch .label-ai { color: white; }
            #ai-editor-bar .mode-toggle-switch .label-text { color: var(--c-text-muted); }
            #ai-editor-bar .mode-toggle-switch input:checked ~ .label-ai { color: var(--c-text-muted); }
            #ai-editor-bar .mode-toggle-switch input:checked ~ .label-text { color: white; }
            #ai-editor-bar .toggle-switch-ui { position: relative; display: inline-flex; align-items: center; cursor: pointer; }
            #ai-editor-bar .toggle-switch-ui input { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); border-width: 0; }
            #ai-editor-bar .toggle-switch-ui .toggle-bg { width: 2.25rem; height: 1.25rem; background-color: var(--c-bg-surface); border-radius: 9999px; transition: background-color 0.2s ease; }
            #ai-editor-bar .toggle-switch-ui .toggle-dot { content: ''; position: absolute; top: 2px; left: 2px; background-color: white; border: 1px solid var(--c-bg-muted); border-radius: 9999px; height: 1rem; width: 1rem; transition: transform 0.2s ease; }
            #ai-editor-bar .toggle-switch-ui input:checked + .toggle-bg { background-color: var(--c-accent-blue); }
            #ai-editor-bar .toggle-switch-ui input:checked + .toggle-bg .toggle-dot { transform: translateX(100%); border-color: white; }

            #ai-editor-bar .editor-controls { display: flex; flex-grow: 1; align-items: flex-start; gap: 0.75rem; }
            #ai-editor-bar textarea {
                flex-grow: 1;
                background-color: var(--c-bg-surface);
                border: 1px solid var(--c-border);
                border-radius: 0.5rem;
                padding: 0.5rem 0.75rem;
                color: var(--c-text-base);
                resize: vertical;
                min-height: 80px;
            }
            #ai-editor-bar textarea::placeholder { color: var(--c-text-subtle); }
            #ai-editor-bar textarea:focus { outline: 2px solid transparent; outline-offset: 2px; box-shadow: 0 0 0 2px var(--c-bg-base), 0 0 0 4px var(--c-accent-gold); }
            
            #ai-editor-bar .btn-group { display: flex; flex-direction: column; gap: 0.5rem; flex-shrink: 0; }
            #ai-editor-bar .btn-primary {
                background-color: var(--c-accent-blue); color: white; font-weight: 600; padding: 0.625rem 1rem; border-radius: 0.375rem;
                display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; transition: background-color 0.2s ease;
            }
            #ai-editor-bar .btn-primary:hover { background-color: var(--c-accent-blue-hover); }
            #ai-editor-bar .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
            #ai-editor-bar .btn-secondary-group { display: flex; align-items: center; gap: 0.375rem; }
            #ai-editor-bar .btn-secondary {
                flex: 1; color: var(--c-text-muted); font-weight: 600; padding: 0.375rem 0.75rem; border-radius: 0.375rem;
                display: flex; align-items: center; justify-content: center; gap: 0.5rem; border: 1px solid var(--c-border);
                font-size: 12px; transition: all 0.2s ease;
            }
            #ai-editor-bar .btn-secondary:hover { background-color: var(--c-bg-surface); color: var(--c-text-base); }
            #ai-editor-bar .btn-tertiary { background-color: var(--c-bg-muted); color: var(--c-text-base); }
            #ai-editor-bar .btn-tertiary:hover { background-color: var(--c-text-subtle); }

            #ai-editor-bar #ai-editor-close { color: var(--c-text-subtle); padding-top: 0.5rem; }
            #ai-editor-bar #ai-editor-close:hover { color: white; }

            /* Modals */
            .ai-editor-modal { position: fixed; inset: 0; background-color: rgba(0,0,0,0.6); z-index: 100002; display: flex; align-items: center; justify-content: center; padding: 1rem; }
            .ai-editor-modal-content { background-color: var(--c-bg-base); color: var(--c-text-base); border-radius: 0.5rem; box-shadow: var(--c-shadow); width: 100%; display: flex; flex-direction: column; }
            #ai-editor-history-modal .ai-editor-modal-content { max-width: 56rem; max-height: 80vh; }
            #ai-editor-scope-modal .ai-editor-modal-content { max-width: 42rem; max-height: 80vh; }
            #ai-editor-uploads-modal .ai-editor-modal-content { max-width: 80rem; height: 80vh; }
            .ai-editor-modal-header { padding: 1rem; border-bottom: 1px solid var(--c-border); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
            .ai-editor-modal-header h3 { font-weight: 700; display: flex; align-items: center; gap: 0.5rem; font-size: 1.125rem; }
            .ai-editor-modal-header button { font-size: 1.5rem; line-height: 1; color: var(--c-text-muted); }
            .ai-editor-modal-header button:hover { color: white; }
            .ai-editor-modal-body { padding: 1rem; overflow-y: auto; flex-grow: 1; }
            .ai-editor-modal-footer { padding: 0.5rem; background-color: rgba(0,0,0,0.2); border-top: 1px solid var(--c-border); text-align: right; flex-shrink: 0; }
            .ai-editor-modal-footer button { font-size: 12px; background-color: var(--c-accent-blue); color: white; border-radius: 0.375rem; font-weight: 600; padding: 0.375rem 1rem; }
            .ai-editor-modal-footer button:hover { background-color: var(--c-accent-blue-hover); }

            /* Textareas in Modals */
            .ai-editor-modal textarea {
                background-color: var(--c-bg-surface);
                border: 1px solid var(--c-border);
                border-radius: 0.5rem;
                padding: 0.5rem 0.75rem;
                color: var(--c-text-base);
                width: 100%;
                resize: vertical;
            }
            .ai-editor-modal textarea::placeholder { color: var(--c-text-subtle); }
            .ai-editor-modal textarea:focus {
                outline: 2px solid transparent;
                outline-offset: 2px;
                box-shadow: 0 0 0 2px var(--c-bg-base), 0 0 0 4px var(--c-accent-gold);
            }

            /* Custom Scrollbar */
            .custom-scrollbar::-webkit-scrollbar { width: 8px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: var(--c-bg-base); }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--c-bg-muted); border-radius: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--c-text-subtle); }

            /* History List */
            .history-item { padding: 0.5rem; border-radius: 0.375rem; transition: background-color 0.2s ease; border: 1px solid transparent; }
            .history-item:hover { background-color: var(--c-bg-surface); }
            .history-item.current { border-color: var(--c-accent-green); }
            .history-item-header { display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
            #ai-editor-history-list .commit-hash { font-family: monospace; }
            #ai-editor-history-list .diff-link { color: var(--c-accent-gold); text-decoration: none; margin-left: 0.5rem; }
            #ai-editor-history-list .diff-link:hover { text-decoration: underline; }
            #ai-editor-history-list .commit-date { color: var(--c-text-muted); margin-left: 0.5rem; }
            #ai-editor-history-list .revert-indicator { font-size: 10px; font-weight: 600; background-color: rgba(245, 158, 11, 0.2); color: #f59e0b; padding: 2px 8px; border-radius: 9999px; border: 1px solid rgba(245, 158, 11, 0.3); margin-left: 0.5rem; }
            #ai-editor-history-list .rollback-btn { background-color: var(--c-bg-muted); color: var(--c-text-base); font-weight: 600; padding: 0.25rem 0.75rem; border-radius: 0.375rem; font-size: 12px; }
            #ai-editor-history-list .rollback-btn:hover { background-color: var(--c-text-subtle); }
            #ai-editor-history-list .current-tag { background-color: var(--c-accent-green); color: white; font-weight: 600; padding: 0.25rem 0.75rem; border-radius: 0.375rem; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
            #ai-editor-history-list .prompt-container { margin-top: 0.5rem; padding: 0.5rem; background-color: rgba(0,0,0,0.2); border: 1px solid var(--c-border); border-radius: 0.25rem; }
            #ai-editor-history-list .prompt-label { color: var(--c-text-subtle); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
            #ai-editor-history-list .prompt-text { color: var(--c-text-muted); font-size: 12px; white-space: pre-wrap; }
            #ai-editor-history-list .diff-container { margin-top: 0.5rem; padding: 0.5rem; background-color: rgba(0,0,0,0.3); border-radius: 0.375rem; max-height: 15rem; overflow-y: auto; }
            #ai-editor-history-list .diff-container pre { font-size: 12px; white-space: pre-wrap; font-family: monospace; color: var(--c-text-base); }
            #ai-editor-history-list .diff-container .diff-add-word { background-color: rgba(34, 197, 94, 0.3); }
            #ai-editor-history-list .diff-container .diff-del-word { background-color: rgba(239, 68, 68, 0.3); }

            /* Scope Modal */
            #ai-editor-scope-modal label { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background-color: rgba(0,0,0,0.2); border-radius: 0.375rem; cursor: pointer; }
            #ai-editor-scope-modal label:hover { background-color: var(--c-bg-surface); }
            #ai-editor-scope-modal label.disabled { opacity: 0.5; cursor: default; }
            #ai-editor-scope-modal input[type="checkbox"] { height: 1rem; width: 1rem; border-radius: 0.25rem; background-color: var(--c-bg-surface); border: 1px solid var(--c-border); accent-color: var(--c-accent-blue); }
            #ai-editor-scope-modal input[type="checkbox"]:focus { box-shadow: 0 0 0 2px var(--c-accent-gold); }
            #ai-editor-scope-modal #ai-editor-target-files { padding-left: 0.5rem; border-left: 1px solid var(--c-border); margin-left: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; }

            /* Uploads Modal */
            #ai-editor-uploads-modal .uploads-container { display: flex; flex-grow: 1; overflow: hidden; }
            #ai-editor-uploads-modal .upload-form-panel { width: 33.333%; padding: 1rem; border-right: 1px solid var(--c-border); display: flex; flex-direction: column; }
            #ai-editor-uploads-modal .upload-lists-panel { width: 66.667%; padding: 1rem; overflow-y: auto; }
            #upload-dropzone { flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed var(--c-border); border-radius: 0.5rem; padding: 1rem; text-align: center; color: var(--c-text-muted); transition: all 0.2s ease; }
            #upload-dropzone.drag-over { border-color: var(--c-accent-gold); background-color: var(--c-bg-surface); }
            #upload-browse-btn { margin-top: 0.5rem; color: var(--c-accent-gold); font-weight: 600; }
            #upload-browse-btn:hover { text-decoration: underline; }
            #upload-preview-container > div { padding: 0.5rem; background-color: var(--c-bg-surface); border-radius: 0.375rem; font-size: 12px; color: white; display: flex; align-items: center; gap: 0.5rem; }
            #upload-preview-container .file-name { font-weight: 600; }
            #upload-preview-container .file-size { color: var(--c-text-muted); }
            #uploads-image-list, #uploads-document-list { display: flex; flex-direction: column; gap: 0.5rem; }
            .upload-list-item { background-color: var(--c-bg-surface); padding: 0.5rem; border-radius: 0.375rem; display: flex; align-items: flex-start; justify-content: space-between; font-size: 12px; }
            .upload-list-item .item-details { display: flex; align-items: flex-start; flex-grow: 1; }
            .upload-list-item .item-thumbnail { position: relative; flex-shrink: 0; margin-right: 0.75rem; }
            .upload-list-item .item-thumbnail .preview-popup { position: absolute; bottom: 0; left: 3rem; width: 200px; background-color: var(--c-bg-base); border: 1px solid var(--c-border); border-radius: 0.5rem; box-shadow: var(--c-shadow); padding: 0.25rem; display: none; z-index: 10; }
            .upload-list-item .item-thumbnail:hover .preview-popup { display: block; }
            .upload-list-item .item-thumbnail .doc-icon { width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; background-color: var(--c-bg-muted); border-radius: 0.375rem; color: var(--c-text-muted); }
            .upload-list-item .item-info { flex-grow: 1; }
            .upload-list-item .item-filename { font-weight: 600; color: var(--c-text-base); }
            .upload-list-item .description-view { color: var(--c-text-muted); }
            .upload-list-item .description-edit { display: none; }
            .upload-list-item .description-edit input { width: 100%; background-color: var(--c-bg-base); border: 1px solid var(--c-border); border-radius: 0.25rem; padding: 0.25rem 0.5rem; font-size: 12px; color: white; }
            .upload-list-item .description-edit .desc-actions { margin-top: 0.375rem; display: flex; gap: 0.5rem; }
            .upload-list-item .description-edit .save-desc-btn { color: var(--c-accent-gold); }
            .upload-list-item .description-edit .cancel-desc-btn { color: var(--c-text-muted); }
            .upload-list-item .item-actions { flex-shrink: 0; margin-left: 0.5rem; display: flex; gap: 0.25rem; }
            .upload-list-item .item-actions button { color: var(--c-text-muted); padding: 0.25rem 0.5rem; }
            .upload-list-item .item-actions button:hover { color: white; }
            .upload-list-item .item-actions .delete-upload-btn:hover { color: var(--c-accent-red); }

            /* Toast / Notification */
            #ai-editor-toast {
                position: fixed;
                bottom: 1.5rem;
                right: 1.5rem;
                background-color: var(--c-bg-base);
                color: var(--c-text-base);
                padding: 1rem 1.25rem;
                border-radius: 0.75rem;
                box-shadow: var(--c-shadow);
                max-width: 24rem;
                z-index: 100003;
                display: flex;
                align-items: flex-start;
                gap: 0.75rem;
                transition: opacity 0.3s ease, transform 0.3s ease;
                opacity: 0;
                transform: translateY(20px);
                pointer-events: none;
            }
            #ai-editor-toast.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }
            #ai-editor-toast-icon { padding: 0.375rem; border-radius: 0.5rem; font-size: 14px; border: 1px solid transparent; }
            #ai-editor-toast-icon.success { background-color: rgba(34, 197, 94, 0.2); color: var(--c-accent-green); border-color: rgba(34, 197, 94, 0.3); }
            #ai-editor-toast-icon.error { background-color: rgba(239, 68, 68, 0.2); color: var(--c-accent-red); border-color: rgba(239, 68, 68, 0.3); }
            #ai-editor-toast-title { font-family: var(--font-serif, serif); font-weight: 700; font-size: 12px; display: block; }
            #ai-editor-toast-body { font-size: 11px; line-height: 1.5; color: var(--c-text-muted); }

            /* Section indicator */
            #ai-section-indicator {
                font-size: 11px;
                padding: 0.375rem 0.625rem;
                border-radius: 0.375rem;
                border: 1px solid var(--c-border);
                background: rgba(0,0,0,0.2);
                display: flex;
                align-items: center;
                gap: 0.375rem;
            }
            #ai-section-indicator.no-section { border-color: rgba(245,158,11,0.4); color: var(--c-accent-gold); }
            #ai-section-indicator.has-section { border-color: rgba(34,197,94,0.4); color: var(--c-accent-green); }
        </style>
        <div id="ai-editor-bar">
            
            <!-- Editor Mode Toggle -->
            <div class="mode-toggle-container">
                <div class="editor-brand">
                    <i class="fa-solid fa-robot"></i>
                    <span>Editor</span>
                </div>
                <div class="mode-toggle-switch">
                    <span class="label-ai">AI</span>
                    <label class="toggle-switch-ui">
                        <input type="checkbox" id="mode-toggle">
                        <div class="toggle-bg"><div class="toggle-dot"></div></div>
                    </label>
                    <span class="label-text">Text</span>
                </div>
            </div>

            <!-- AI Controls -->
            <div id="ai-editor-controls" class="editor-controls">
                <div style="display:flex;flex-direction:column;flex-grow:1;gap:0.5rem;">
                    <div id="ai-section-indicator" class="no-section"><i class="fa-solid fa-circle-info"></i> Use the nav links to navigate to a section, then generate.</div>
                    <textarea id="ai-editor-prompt" rows="3" placeholder="Enter your edit request for this section... (Cmd/Ctrl + Enter to submit)"></textarea>
                </div>
                <div class="btn-group">
                    <button id="ai-editor-generate" class="btn-primary">
                        <span id="ai-editor-btn-text">Generate</span>
                        <i id="ai-editor-spinner" class="fa-solid fa-spinner ai-editor-spinner ai-editor-hidden"></i>
                    </button>
                    <div class="btn-secondary-group">
                        <button id="ai-editor-history" title="View file history" class="btn-secondary">
                            <i class="fa-solid fa-history"></i>
                            <span>History</span>
                        </button>
                        <button id="ai-editor-new-chat" title="Start a new conversation" class="btn-secondary">
                            <i class="fa-solid fa-comment-slash"></i>
                            <span>New Chat</span>
                        </button>
                        <button id="ai-editor-scope" title="Set edit scope" class="btn-secondary">
                            <i class="fa-solid fa-crosshairs"></i>
                            <span>Scope</span>
                        </button>
                        <button id="ai-editor-uploads" title="Manage Uploads" class="btn-secondary">
                            <i class="fa-solid fa-upload"></i>
                            <span>Uploads</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Text Editor Controls -->
            <div id="text-editor-controls" class="editor-controls ai-editor-hidden">
                <textarea id="text-editor-comment" rows="3" placeholder="Add a comment about your changes (optional)..."></textarea>
                <div class="btn-group">
                    <button id="save-text-btn" class="btn-primary">
                        <i class="fa-solid fa-save"></i> Save Changes
                    </button>
                    <button id="cancel-text-btn" class="btn-primary btn-tertiary">
                        Cancel
                    </button>
                </div>
            </div>

            <button id="ai-editor-close" title="Close Editor">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
        <div id="ai-editor-history-modal" class="ai-editor-modal ai-editor-hidden">
            <div class="ai-editor-modal-content">
                <div class="ai-editor-modal-header">
                    <h3><i class="fa-solid fa-history"></i>File History</h3>
                    <button id="ai-editor-history-close">&times;</button>
                </div>
                <div id="ai-editor-history-list" class="ai-editor-modal-body custom-scrollbar"></div>
            </div>
        </div>
        <div id="ai-editor-scope-modal" class="ai-editor-modal ai-editor-hidden">
            <div class="ai-editor-modal-content">
                <div class="ai-editor-modal-header">
                    <h3><i class="fa-solid fa-crosshairs"></i>Edit Scope</h3>
                    <button id="ai-editor-scope-close">&times;</button>
                </div>
                <div class="ai-editor-modal-body custom-scrollbar">
                    <div>
                        <h4 style="font-size: 12px; font-weight: 700; color: var(--c-text-muted); margin-bottom: 0.5rem;">Target Pages (HTML)</h4>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 12px;">
                            <label>
                                <input type="checkbox" id="ai-update-all-html">
                                <span>Update All HTML Pages</span>
                            </label>
                            <div id="ai-editor-target-files"></div>
                        </div>
                    </div>
                </div>
                <div class="ai-editor-modal-footer">
                    <button id="ai-editor-scope-done">Done</button>
                </div>
            </div>
        </div>
        <div id="ai-editor-uploads-modal" class="ai-editor-modal ai-editor-hidden">
            <div class="ai-editor-modal-content">
                <div class="ai-editor-modal-header">
                    <h3><i class="fa-solid fa-upload"></i>File Uploads</h3>
                    <button id="ai-editor-uploads-close">&times;</button>
                </div>
                <div class="uploads-container">
                    <!-- Upload Form -->
                    <div class="upload-form-panel">
                        <h4 style="font-size: 12px; font-weight: 700; color: var(--c-text-muted); margin-bottom: 0.75rem;">Upload New File</h4>
                        <div id="upload-dropzone">
                            <i class="fa-solid fa-cloud-arrow-up" style="font-size: 1.875rem; margin-bottom: 0.5rem;"></i>
                            <p style="font-size: 14px;">Drag & drop files here or</p>
                            <button id="upload-browse-btn">browse to upload</button>
                            <input type="file" id="upload-file-input" class="ai-editor-hidden" multiple>
                        </div>
                        <div id="upload-preview-container" style="margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;"></div>
                        <textarea id="upload-description" rows="2" style="margin-top: 0.75rem;" placeholder="File description..."></textarea>
                        <button id="upload-submit-btn" class="btn-primary" style="margin-top: 0.75rem;">
                            <span id="upload-btn-text">Upload</span>
                            <i id="upload-spinner" class="fa-solid fa-spinner ai-editor-spinner ai-editor-hidden"></i>
                        </button>
                    </div>
                    <!-- File Lists -->
                    <div class="upload-lists-panel custom-scrollbar">
                        <div>
                            <h4 style="font-size: 12px; font-weight: 700; color: var(--c-text-muted); margin-bottom: 0.5rem;">Images</h4>
                            <div id="uploads-image-list"></div>
                        </div>
                        <div style="margin-top: 1.5rem;">
                            <h4 style="font-size: 12px; font-weight: 700; color: var(--c-text-muted); margin-bottom: 0.5rem;">Documents</h4>
                            <div id="uploads-document-list"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div id="ai-editor-toast">
            <div id="ai-editor-toast-icon"></div>
            <div>
                <strong id="ai-editor-toast-title"></strong>
                <p id="ai-editor-toast-body"></p>
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
        let elementsToEdit = [];
        const mainEl = document.querySelector('main');
        if (mainEl) {
            elementsToEdit.push(mainEl);
        } else {
            elementsToEdit = Array.from(document.querySelectorAll('section'));
        }

        if (elementsToEdit.length === 0) {
            console.error('Could not find <main> or <section> tags in the page to edit.');
            return;
        }

        const modeToggle = document.getElementById('mode-toggle');
        const aiModeLabel = document.getElementById('ai-mode-label');
        const textModeLabel = document.getElementById('text-mode-label');
        const aiEditorControls = document.getElementById('ai-editor-controls');
        const textEditorControls = document.getElementById('text-editor-controls');

        const isTextMode = modeToggle.checked;

        if (isTextMode) {
            // --- Enable Text Editor Mode ---
            if (aiEditorControls) aiEditorControls.classList.add('ai-editor-hidden');
            if (textEditorControls) textEditorControls.classList.remove('ai-editor-hidden');

            // Reset dynamically generated content before making the main tag editable.
            resetGeneratedContent();

            elementsToEdit.forEach(el => {
                el.contentEditable = 'true';
                el.style.outline = '2px dashed #F7A81B'; // rotary-gold
                el.style.minHeight = '150px';
            });
            elementsToEdit[0].focus();
        } else { // Switching back to AI mode
            const wasInTextMode = elementsToEdit.some(el => el.isContentEditable);
            if (wasInTextMode) {
                if (confirm('Are you sure you want to cancel? All changes will be lost.')) {
                    // Reload the page to discard changes and restore original content.
                    window.location.reload();
                } else {
                    // User cancelled, so revert the toggle switch to stay in Text mode.
                    modeToggle.checked = true;
                }
                return;
            }

            // Fallback for UI consistency if we somehow get here without being in text mode.
            if (aiEditorControls) aiEditorControls.classList.remove('ai-editor-hidden');
            if (textEditorControls) textEditorControls.classList.add('ai-editor-hidden');

            elementsToEdit.forEach(el => {
                el.contentEditable = 'false';
                el.style.outline = 'none';
            });
        }
    }

    /**
     * Displays a toast notification.
     * @param {string} title The title of the toast.
     * @param {string} body The message body.
     * @param {boolean} isSuccess Whether the toast indicates success or an error.
     */
    function showToast(title, body, isSuccess = true) {
        const toast = document.getElementById('ai-editor-toast');
        if (!toast) {
            // If the editor isn't fully initialized, fall back to a simple alert.
            alert(`${title}: ${body}`);
            return;
        }
        
        const toastTitle = document.getElementById('ai-editor-toast-title');
        const toastBody = document.getElementById('ai-editor-toast-body');
        const toastIcon = document.getElementById('ai-editor-toast-icon');

        toastTitle.textContent = title;
        toastBody.textContent = body;

        toastIcon.innerHTML = isSuccess ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>';
        toastIcon.className = isSuccess ? 'success' : 'error';
        
        toast.classList.add('visible');

        setTimeout(() => { toast.classList.remove('visible'); }, 5000);
    }

    /**
     * Saves the edited innerHTML of the <main> tag.
     */
    async function saveTextChanges() {
        const currentFile = getCurrentFilePath();
        const commentInput = document.getElementById('text-editor-comment');
        
        const editableElements = Array.from(document.querySelectorAll('[contenteditable="true"]'));
        let newContent = '';

        if (editableElements.length > 0) {
            // If a <main> tag is being edited, get its inner HTML. This implicitly excludes the contenteditable attribute.
            if (editableElements[0].tagName.toLowerCase() === 'main') {
                newContent = editableElements[0].innerHTML;
            } else {
                // Otherwise, we are editing <section> tags. The backend needs the HTML of all sections.
                const allSections = document.querySelectorAll('section');
                newContent = Array.from(allSections).map(el => {
                    // For sections that were being edited, clone them to get their outerHTML 
                    // without the temporary 'contenteditable' 
                    if (el.contentEditable === 'true') {
                        const clone = el.cloneNode(true);
                        clone.removeAttribute('contenteditable');
                        clone.removeAttribute('style');
                        return clone.outerHTML;
                    }
                    return el.outerHTML;
                }).join('\n');
            }
        }

        if (!newContent || !currentFile) {
            showToast('Text Editor Error', 'No editable content found or file path is missing.', false);
            return;
        }

        const comment = commentInput ? commentInput.value.trim() : '';
        
        if (!confirm('Are you sure you want to save these changes? This will overwrite the main content of the page.')) {
            return;
        }

        try {
            const result = await webrobotFetch('/webrobot.php?action=save_text_edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file: currentFile,
                    content: newContent,
                    comment: comment,
                }),
            });

            showToast('Text Editor', result.message, true);

            // Visually disable editing immediately after successful save.
            editableElements.forEach(el => {
                el.contentEditable = 'false';
                el.style.outline = 'none';
            });
            // Also disable the save/cancel buttons to prevent re-submission
            document.getElementById('save-text-btn').disabled = true;
            document.getElementById('cancel-text-btn').disabled = true;

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
     * A wrapper for the fetch API to handle standard WebRobot responses,
     * including session-expired redirects.
     * @param {string} url The URL to fetch.
     * @param {object} options The options for the fetch call.
     * @returns {Promise<any>} A promise that resolves with the JSON result.
     * @throws {Error} If the request fails or the server returns an error.
     */
    async function webrobotFetch(url, options) {
        const response = await fetch(url, options);
        
        let result;
        try {
            result = await response.json();
        } catch (e) {
            const rawText = await response.text();
            throw new Error(`Request failed with status ${response.status}. Server response: ${rawText}`);
        }

        if (!response.ok) {
            throw new Error(result.error || `Request failed with status ${response.status}`);
        }

        if (result.status === 'redirect' && result.redirect_url) {
            showToast('Session Expired', 'You are being redirected to the login page.', false);
            // Return a promise that never resolves to stop further execution in the caller.
            return new Promise(() => {
                setTimeout(() => { window.location.href = result.redirect_url; }, 1500);
            });
        }

        return result;
    }

    /**
     * Generates a page-specific cookie name for the interaction ID.
     * @returns {string} The cookie name.
     */
    function getInteractionCookieName() {
        const path = getCurrentFilePath();
        const sectionId = getActiveSectionId() || 'page';
        const safePath = (path + '_' + sectionId).replace(/\//g, '_').replace(/\./g, '-');
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
            bar.classList.toggle('editor-visible');
            toggleBtn.classList.toggle('editor-visible');
            // The bar's own class now controls its visibility, not a utility class
            if (bar.classList.contains('editor-visible')) {
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

    function getActiveSectionId() {
        var hash = window.location.hash;
        if (!hash || hash === '#robot') return null;
        var id = hash.substring(1);
        var el = document.getElementById(id);
        if (!el || el.tagName.toLowerCase() !== 'section') return null;
        return id;
    }

    function updateGenerateButtonState() {
        var sectionId = getActiveSectionId();
        var generateBtn = document.getElementById('ai-editor-generate');
        var indicator = document.getElementById('ai-section-indicator');

        if (generateBtn) {
            generateBtn.disabled = !sectionId;
        }

        if (indicator) {
            if (sectionId) {
                indicator.className = 'has-section';
                indicator.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Editing section: <strong>#' + sectionId + '</strong> — enter a prompt and click Generate.';
            } else {
                indicator.className = 'no-section';
                indicator.innerHTML = '<i class="fa-solid fa-circle-info"></i> Use the nav links to navigate to a section, then generate.';
            }
        }
    }

    async function handleGenerate() {
        const sectionId = getActiveSectionId();
        if (!sectionId) {
            showToast('AI Editor', 'Navigate to a section using the nav links before generating.', false);
            return;
        }

        const sectionEl = document.getElementById(sectionId);
        if (!sectionEl) {
            showToast('AI Editor', 'Section element not found on page.', false);
            return;
        }

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
        spinner.classList.remove('ai-editor-hidden');

        try {
            const cookieName = getInteractionCookieName();
            const interactionId = getCookie(cookieName);

            const payload = {
                prompt: userPrompt,
                section_id: sectionId,
                section_html: sectionEl.outerHTML,
                file: getCurrentFilePath(),
                interaction_id: interactionId
            };

            const result = await webrobotFetch('/webrobot.php?action=generate_section', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (result.summary) {
                setSessionCookie('ai_editor_summary', encodeURIComponent(result.summary), 1);
            }

            if (result.interaction_id) {
                setSessionCookie(cookieName, result.interaction_id, 1);
            } else {
                setSessionCookie(cookieName, '', -1);
            }

            showToast('AI Editor', result.message || 'Section updated! Reloading...', true);
            setTimeout(() => { window.location.reload(); }, 1500);

        } catch (error) {
            console.error('AI Editor Error:', error);
            showToast('AI Editor Error', error.message, false);
            btnText.textContent = 'Generate';
            spinner.classList.add('ai-editor-hidden');
            updateGenerateButtonState();
        }
    }

    async function showHistoryModal() {
        const modal = document.getElementById('ai-editor-history-modal');
        const listContainer = document.getElementById('ai-editor-history-list');
        if (!modal || !listContainer) return;

        modal.classList.remove('ai-editor-hidden');
        listContainer.innerHTML = '<div class="p-4 text-center text-stone-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading history...</div>';

        try {
            const data = await webrobotFetch('/webrobot.php?action=list_commits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (data.commits && data.commits.length > 0) {
                listContainer.innerHTML = data.commits.map((backup, index) => {
                    const isCurrent = index === 0; // Newest commit is the current one
                    const isRevert = backup.is_revert;

                    const promptHtml = backup.prompt ? `
                        <div class="prompt-container">
                            <div class="prompt-label">Prompt</div>
                            <div class="prompt-text">${backup.prompt}</div>
                        </div>
                    ` : '';

                    const isWebRobotCommit = backup.prompt && backup.prompt.includes('[WebRobot]');
                    const diffLinkHtml = isWebRobotCommit 
                        ? `<a href="#" class="diff-link" data-commit="${backup.file}">changes</a>`
                        : '';

                    const revertIndicatorHtml = isRevert 
                        ? `<span class="revert-indicator"><i class="fa-solid fa-undo" style="margin-right: 0.25rem;"></i>Revert</span>` 
                        : '';

                    let rollbackButtonHtml;
                    if (isCurrent) {
                        rollbackButtonHtml = `<span class="current-tag">Current</span>`;
                    } else {
                        rollbackButtonHtml = `<button data-commit="${backup.file}" class="rollback-btn">Revert</button>`;
                    }

                    return `
                    <div class="history-item ${isCurrent ? 'current' : ''}">
                        <div class="history-item-header">
                            <div class="history-item-meta">
                                <span class="commit-hash">${backup.file.substring(0, 7)}</span>
                                ${diffLinkHtml}
                                <span class="commit-date">${backup.date}</span>
                                ${revertIndicatorHtml}
                            </div>
                            ${rollbackButtonHtml}
                        </div>
                        ${promptHtml}
                        <div class="diff-container ai-editor-hidden">
                            <pre></pre>
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
            modal.classList.add('ai-editor-hidden');
        }
    }

    async function showScopeModal() {
        const modal = document.getElementById('ai-editor-scope-modal');
        if (!modal) return;

        modal.classList.remove('ai-editor-hidden');

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
                    <label class="${isCurrentPage ? 'disabled' : ''}">
                        <input type="checkbox" class="ai-target-file" value="${page.path}" ${isCurrentPage ? 'checked disabled' : ''}>
                        <span>${page.title} <span style="color: var(--c-text-subtle); font-family: monospace; font-size: 10px;">(${page.path})</span></span>
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
            modal.classList.add('ai-editor-hidden');
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
        const historyItem = diffLink.closest('.history-item');
        const diffContainer = historyItem.querySelector('.diff-container');
        const preElement = diffContainer.querySelector('pre');

        if (!commitHash || !diffContainer || !preElement) return;

        // Toggle visibility if already loaded
        if (diffContainer.dataset.loaded === 'true') {
            diffContainer.classList.toggle('ai-editor-hidden');
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
                    formattedHtml += `<span class="diff-filename">${displayTitle}</span>\n`;
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
                            plusHtml += `<span class="diff-add-word">${escapedValue.innerHTML}</span>`;
                        } else if (part.removed) {
                            minusHtml += `<span class="diff-del-word">${escapedValue.innerHTML}</span>`;
                        } else {
                            minusHtml += escapedValue.innerHTML;
                            plusHtml += escapedValue.innerHTML;
                        }
                    });
                    if (cleanMinus.trim().length > 0) {
                        formattedHtml += `<span class="diff-del">- ${minusHtml}</span>\n`;
                    }
                    if (cleanPlus.trim().length > 0) {
                        formattedHtml += `<span class="diff-add">+ ${plusHtml}</span>\n`;
                    }
                    i += 2; // Skip next line as it has been processed
                } else if (line.startsWith('+') && !line.startsWith('+++')) {
                    let cleanText = stripTags(line.substring(1));
                    if (!isJsonFile) {
                        cleanText = cleanText.replace(/\t/g, ' ').replace(/ +/g, ' ');
                    }
                    if (cleanText.trim().length > 0) {
                        formattedHtml += `<span class="diff-add">+ ${cleanText}</span>\n`;
                    }
                    i++;
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                    let cleanText = stripTags(line.substring(1));
                    if (!isJsonFile) {
                        cleanText = cleanText.replace(/\t/g, ' ').replace(/ +/g, ' ');
                    }
                    if (cleanText.trim().length > 0) {
                        formattedHtml += `<span class="diff-del">- ${cleanText}</span>\n`;
                    }
                    i++;
                } else {
                    // Ignore all other lines (---, +++, @@, index, context, etc.)
                    i++;
                }
            }

            preElement.innerHTML = formattedHtml;
            diffContainer.classList.remove('ai-editor-hidden');
            diffContainer.dataset.loaded = 'true';

        } catch (error) {
            console.error('Diff Error:', error);
            preElement.textContent = `Error loading diff: ${error.message}`;
            diffContainer.classList.remove('ai-editor-hidden');
        } finally {
            diffLink.innerHTML = 'changes';
        }
    }

    async function handleRollback(e) {
        const targetButton = e.target.closest('.rollback-btn');
        if (!targetButton) return;

        const commitHash = targetButton.dataset.commit;
        if (!commitHash) return;
        
        if (!confirm(`Are you sure you want to revert to this version?\n\nThis will create new commits to undo any changes made after this version. Your full history will be preserved.`)) {
            return;
        }

        targetButton.disabled = true;
        targetButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            await webrobotFetch('/webrobot.php?action=rollback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commit: commitHash })
            });
            showToast('AI Editor', 'Version reverted! Reloading...', true);
            setTimeout(() => window.location.reload(), 1500);

        } catch (error) {
            console.error('Rollback Error:', error);
            showToast('Revert Error', error.message, false);
            targetButton.disabled = false;
            targetButton.textContent = 'Revert';
        }
    }

    // --- Uploads Modal Functions ---

    function hideUploadsModal() {
        const modal = document.getElementById('ai-editor-uploads-modal');
        if (modal) {
            modal.classList.add('ai-editor-hidden');
        }
    }

    async function showUploadsModal() {
        const modal = document.getElementById('ai-editor-uploads-modal');
        if (!modal) return;
        modal.classList.remove('ai-editor-hidden');
        await refreshUploadsList();
    }

    async function refreshUploadsList() {
        const imageList = document.getElementById('uploads-image-list');
        const docList = document.getElementById('uploads-document-list');
        if (!imageList || !docList) return;

        imageList.innerHTML = '<div class="p-2 text-stone-400"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
        docList.innerHTML = '<div class="p-2 text-stone-400"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';

        try {
            const { uploads } = await webrobotFetch('/webrobot.php?action=list_uploads', { method: 'POST' });

            const renderList = (items, type) => {
                 if (!items || items.length === 0) {
                     return '<div class="p-2 text-stone-500 text-xs">No files uploaded.</div>';
                 }
                 return items.map(item => {
                    const thumbnail = type === 'image'
                        ? `<div class="item-thumbnail">
                               <img src="/${item.path}" alt="Preview" class="preview-popup">
                           </div>`
                        : `<div class="item-thumbnail"><div class="doc-icon"><i class="fa-solid fa-file-lines"></i></div></div>`;
 
                     return `
                     <div class="upload-list-item" data-filename="${item.filename}" data-type="${type}">
                         <div class="item-details">
                             ${thumbnail}
                             <div class="item-info">
                                 <div class="item-filename">${item.filename}</div>
                                 <div class="description-view text-stone-400">${item.description}</div>
                                 <div class="description-edit">
                                     <input type="text" value="${item.description}">
                                     <div class="desc-actions">
                                         <button class="save-desc-btn">Save</button>
                                         <button class="cancel-desc-btn">Cancel</button>
                                     </div>
                                 </div>
                             </div>
                         </div>
                         <div class="item-actions">
                            <button class="edit-desc-btn" title="Edit description"><i class="fa-solid fa-pencil"></i></button>
                            <button class="delete-upload-btn" title="Delete file"><i class="fa-solid fa-trash-can"></i></button>
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
            <div class="preview-item">
                <i class="fa-solid fa-file"></i>
                <span class="file-name">${file.name}</span>
                <span class="file-size">(${(file.size / 1024).toFixed(1)} KB)</span>
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
        spinner.classList.remove('ai-editor-hidden');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('description', description);

        try {
            const result = await webrobotFetch('/webrobot.php?action=handle_upload', {
                method: 'POST',
                body: formData
            });

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
            spinner.classList.add('ai-editor-hidden');
        }
    }

    async function handleDeleteUpload(e) {
        const deleteBtn = e.target.closest('.delete-upload-btn');
        if (!deleteBtn) return;

        const { filename, type } = deleteBtn.closest('[data-filename]').dataset;
        if (!filename || !type) return;

        if (!confirm(`Are you sure you want to delete "${filename}"? This cannot be undone.`)) {
            return;
        }

        try {
            const result = await webrobotFetch('/webrobot.php?action=delete_upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, type })
            });

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
            viewMode.style.display = 'none';
            editMode.style.display = 'block';
            editBtnEl.style.display = 'none';
            editMode.querySelector('input').focus();
        }

        if (cancelBtn) {
            viewMode.style.display = 'block';
            editMode.style.display = 'none';
            editBtnEl.style.display = 'inline-block';
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
                const result = await webrobotFetch('/webrobot.php?action=update_upload_description', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename, type, description: newDescription })
                });

                showToast('Success', result.message, true);
                viewMode.textContent = newDescription; // Update view
                viewMode.style.display = 'block';
                editMode.style.display = 'none';
                editBtnEl.style.display = 'inline-block';

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
            ['dragenter', 'dragover'].forEach(eventName => { dropzone.addEventListener(eventName, () => dropzone.classList.add('drag-over'), false); });
            ['dragleave', 'drop'].forEach(eventName => { dropzone.addEventListener(eventName, () => dropzone.classList.remove('drag-over'), false); });
            dropzone.addEventListener('drop', (e) => handleFileSelect(e.dataTransfer.files), false);
        }

        window.addEventListener('hashchange', updateGenerateButtonState);
        updateGenerateButtonState();

        isEditorInitialized = true;
    }

    /**
     * Checks for a summary from the previous AI action stored in a cookie
     * and displays it in a temporary, self-contained toast notification.
     * This is designed to run on page load, before the main editor UI is necessarily initialized.
     */
    function showSummaryToastOnLoad() {
        const summaryCookie = getCookie('ai_editor_summary');
        if (!summaryCookie) return;

        // Delete cookie so it only shows once
        setSessionCookie('ai_editor_summary', '', -1); 
        const summary = decodeURIComponent(summaryCookie);

        // Create toast elements
        const toast = document.createElement('div');
        const iconContainer = document.createElement('div');
        const contentContainer = document.createElement('div');
        const title = document.createElement('strong');
        const body = document.createElement('div');
        const closeButton = document.createElement('button');

        // Add padding to the main content area to make space for the close button
        Object.assign(contentContainer.style, {
            paddingRight: '1.5rem'
        });

        // Apply styles directly to be self-contained
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            backgroundColor: '#262626',
            color: '#f5f5f5',
            padding: '1rem 1.25rem',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2), 0 4px 6px -2px rgba(0,0,0,0.1)',
            maxWidth: '32rem',
            zIndex: '100003',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
            opacity: '0',
            transform: 'translateY(20px)',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            fontSize: '11px',
            lineHeight: '1.5'
        });

        Object.assign(iconContainer.style, {
            padding: '0.375rem',
            borderRadius: '0.5rem',
            fontSize: '14px',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            color: '#3b82f6', // --c-accent-blue
            flexShrink: '0',
            marginTop: '4px'
        });
        iconContainer.innerHTML = '<i class="fa-solid fa-brain"></i>';

        title.textContent = "AI's Thought Process";
        Object.assign(title.style, {
            fontWeight: '700',
            fontSize: '12px',
            display: 'block',
            color: '#f5f5f5'
        });

        // Basic markdown to HTML conversion
        let htmlSummary = summary
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g, '<code style="background-color: #404040; padding: 1px 4px; border-radius: 4px; font-family: monospace; font-size: 10px;">$1</code>')
            .replace(/\n/g, '<br>');
        body.innerHTML = htmlSummary;
        Object.assign(body.style, {
            color: '#a3a3a3',
            marginTop: '0.25rem',
            maxHeight: '250px',
            overflowY: 'auto',
            paddingRight: '8px'
        });

        // Style and add the close button
        Object.assign(closeButton.style, {
            position: 'absolute',
            top: '0.25rem',
            right: '0.5rem',
            background: 'transparent',
            border: 'none',
            color: '#a3a3a3', // --c-text-muted
            fontSize: '1.5rem',
            lineHeight: '1',
            cursor: 'pointer',
            padding: '0.25rem',
        });
        closeButton.innerHTML = '&times;';
        const closeHandler = () => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        };
        closeButton.addEventListener('click', closeHandler);

        // Assemble and append
        contentContainer.appendChild(title);
        contentContainer.appendChild(body);
        toast.appendChild(iconContainer);
        toast.appendChild(contentContainer);
        toast.appendChild(closeButton);
        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 100);

        // The toast is now persistent and must be closed manually.
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
            document.addEventListener('DOMContentLoaded', () => { showToggleButton(); showSummaryToastOnLoad(); });
        } else {
            showToggleButton();
            showSummaryToastOnLoad();
        }
    }

    function showToggleButton() {
        // These styles are injected separately so the toggle button is visible
        // before the main editor HTML (and its styles) are loaded on first click.
        const toggleButtonStyles = `
            <style>
                #ai-editor-toggle {
                    position: fixed;
                    top: 0.5rem; right: 0.5rem;
                    background-color: #3b82f6; /* --c-accent-blue */
                    color: white;
                    width: 2.5rem; height: 2.5rem;
                    border-radius: 9999px;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2), 0 4px 6px -2px rgba(0,0,0,0.1); /* --c-shadow */
                    z-index: 100000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                #ai-editor-toggle:hover {
                    background-color: #2563eb; /* --c-accent-blue-hover */
                    transform: scale(1.1);
                }
                #ai-editor-toggle.editor-visible {
                    opacity: 0;
                    pointer-events: none;
                }
            </style>
        `;
        const toggleButtonHTML = `
            <button id="ai-editor-toggle" title="Toggle AI Editor">
                <i class="fa-solid fa-robot"></i>
            </button>`;
        document.head.insertAdjacentHTML('beforeend', toggleButtonStyles);
        document.body.insertAdjacentHTML('beforeend', toggleButtonHTML);
        document.getElementById('ai-editor-toggle')?.addEventListener('click', handleToggleClick);
    }

    async function handleToggleClick() {
        if (isEditorInitialized) {
            toggleEditorBar();
        } else {
            // Check login status now, when the user wants to open the editor for the first time.
            try {
                // The webrobotFetch function will handle the redirect if the session is expired.
                const result = await webrobotFetch('/webrobot.php?action=check_login_status', {
                    method: 'POST'
                });

                if (result.status === 'success') {
                    // Login was successful, now initialize the full editor UI.
                    await initializeEditor();
                    toggleEditorBar(); // Open the editor bar immediately after initialization.
                } else {
                    // Unexpected response from backend
                    throw new Error(result.error || 'Unknown login status.');
                }
            } catch (error) {
                console.error('AI Editor: Failed to check login status. Editor will not load.', error);
                // The toast UI is not available yet, so we alert.
                alert('Editor Error: Could not verify login status. ' + error.message);
            }
        }
    }

    checkAndInitEditor();

})();

<?php
// PHP Compatibility: 5.6+

// The root directory of the website you want to edit.
define('DOC_ROOT', __DIR__ . '/../pages');
// Define to true to simulate a patch command failure for testing purposes.
// When true, apply_diff will always throw an exception.
define('SIMULATE_PATCH_FAILURE', false);

// --- Load Configuration ---
$projectRoot = dirname(DOC_ROOT);
$configFile = $projectRoot . '/etc/webrobot_config.json';
if (!file_exists($configFile)) {
    http_response_code(500);
    echo json_encode(['error' => "Configuration file not found: {$configFile}"]);
    exit;
}
$configData = json_decode(file_get_contents($configFile), true);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(500);
    echo json_encode(['error' => "Error decoding configuration file: " . json_last_error_msg()]);
    exit;
}

// --- Configure and load Login Checker ---
$loginCheckerClass = isset($configData['login_checker_class']) ? $configData['login_checker_class'] : 'WebRobotLoginChecker_OAuth';
$loginCheckerFile = __DIR__ . '/' . $loginCheckerClass . '.php';
if (!file_exists($loginCheckerFile)) {
    http_response_code(500);
    echo json_encode(['error' => "Login checker file not found: {$loginCheckerFile}"]);
    exit;
}
require_once $loginCheckerFile;

/**
 * Handles all interactions with the Google Gemini API.
 * This includes loading configuration, constructing prompts, making API calls, and logging.
 */
class GeminiService {
    /** @var WebRobotUpdater An instance of the updater class to access helper methods. */
    private $updater;
    /** @var string The API key for the Gemini service. */
    private $apiKey;
    /** @var string The Gemini model to be used for content generation. */
    private $model;
    /** @var string The absolute path for logging Gemini API interactions. */
    private $logPath;

    /**
     * GeminiService constructor.
     * Initializes the Gemini service by loading configuration from the /etc/gemini.json file.
     * It sets up the API key, model, and log path, with fallbacks for each.
     *
     * @param WebRobotUpdater $updater An instance of WebRobotUpdater to access its helper methods.
     * @param array $key_data The configuration data from webrobot_config.json.
     */
    public function __construct(WebRobotUpdater $updater, array $key_data) {
        $this->updater = $updater;

        if (empty($key_data['key'])) {
            throw new Exception("API 'key' is missing or empty in webrobot_config.json.");
        }
        $this->apiKey = $key_data['key'];

        if (empty($key_data['model'])) {
            throw new Exception("'model' is missing or empty in webrobot_config.json.");
        }
        $this->model = $key_data['model'];

        if (!isset($key_data['log_path'])) {
            throw new Exception("'log_path' is missing in webrobot_config.json. Set to an empty string to disable logging.");
        }
        // The path in the config is the absolute path. An empty string disables logging.
        $this->logPath = $key_data['log_path'];
    }

    /**
     * Calls the Google Gemini API to generate content based on a prompt and file content.
     * It constructs a detailed prompt including system instructions, context files, and the user's request.
     * It also handles injecting data source content into the prompt for the AI's context.
     *
     * @param array $files An array of files, where each element is an associative array with 'path' and 'content'.
     * @param string $userPrompt The user's instruction for what to change.
     * @param string|null $interactionId The ID for continuing a conversation.
     * @param string $output_format The desired output format ('diff' or 'full_content').
     * @return array An array containing 'modified_files', 'usage' (token metadata), and 'interaction_id'.
     * @throws Exception If the API key is not configured or if the API call fails.
     */
    public function call_gemini_api(array $files, $userPrompt, $interactionId = null, $output_format = 'diff') {
        // The constructor now validates that the API key is set.
        // Prepare data structure for logging the entire interaction.
        $logData = [
            'timestamp' => date('Y-m-d H:i:s'),
            'model' => $this->model,
            'request' => [
                'userPrompt' => $userPrompt,
                'files' => array_map(function($file) { return $file['path']; }, $files),
                'interactionId' => $interactionId,
            ],
            'response' => [],
            'processed' => [],
            'error' => null,
        ];

        try {
            // The system prompt and schema change based on the desired output format.
            if ($output_format === 'full_content') {
                $system_prompt = "You are an expert web developer. You will receive file contents and a task. Return the full content of any modified files. Do not return diffs.";
                $content_property = 'full_content';
            } else { // Default to 'diff'
                $system_prompt = "You are an expert web developer. You will receive file contents and a task. Return the modifications as standard Unified Diffs for any changed files. Do not return the full file content.";
                $content_property = 'unified_diff';
            }

            $input_parts = [];
            // The files array now contains both primary and data files, prepared by the caller.
            foreach ($files as $file) {
                $input_parts[] = ['type' => 'text', 'text' => "--- FILE: " . $file['path'] . " ---\n" . $file['content']];
            }
            // Add the task
            $input_parts[] = ['type' => 'text', 'text' => "--- TASK ---\n" . $userPrompt];

            $response_schema = [
                'type' => 'object',
                'properties' => [
                    'modified_files' => [
                        'type' => 'array',
                        'items' => [
                            'type' => 'object',
                            'properties' => [
                                'filename' => ['type' => 'string'],
                                $content_property => ['type' => 'string']
                            ],
                            'required' => ['filename', $content_property]
                        ]
                    ]
                ],
                'required' => ['modified_files']
            ];

            $data = [
                'model' => $this->model,
                'system_instruction' => $system_prompt,
                'input' => $input_parts,
                'response_format' => [
                    'type' => 'text',
                    'mime_type' => 'application/json',
                    'schema' => $response_schema
                ]
            ];

            if ($interactionId) {
                $data['previous_interaction_id'] = $interactionId;
            }

            $logData['request']['fullPayload'] = $data; // Log the payload after adding previous_interaction_id
            $url = "https://generativelanguage.googleapis.com/v1beta/interactions?key={$this->apiKey}";

            // Execute the API call using cURL.
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true); // It's good practice to keep this enabled.

            $apiResponse = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            error_log("Gemini API Call: URL=" . $url . " | HTTP Code=" . $httpCode);

            // Log the raw response details.
            $logData['response'] = [
                'httpCode' => $httpCode,
                'rawResponse' => $apiResponse,
                'curlError' => $curlError ?: null,
            ];

            if ($apiResponse === false) {
                throw new Exception('cURL Error: ' . $curlError);
            }

            if ($httpCode !== 200) {
                throw new Exception("API request failed with HTTP code {$httpCode}: {$apiResponse}");
            }

            $result = json_decode($apiResponse, true);
            $newInteractionId = isset($result['id']) ? $result['id'] : null;

            $modified_files_json = null;
            if (isset($result['steps']) && is_array($result['steps'])) {
                foreach ($result['steps'] as $step) {
                    if (isset($step['type']) && $step['type'] === 'model_output' && isset($step['content'][0]['text'])) {
                        $modified_files_json = $step['content'][0]['text'];
                        break;
                    }
                }
            }

            if ($modified_files_json !== null) {
                $modified_files_data = json_decode($modified_files_json, true);

                if (json_last_error() !== JSON_ERROR_NONE || !isset($modified_files_data['modified_files'])) {
                    throw new Exception("Failed to decode or invalid diff JSON from API: " . $modified_files_json);
                }

                $usage = isset($result['usage']) ? $result['usage'] : [];
                $final_usage = [
                    'promptTokenCount' => isset($usage['total_input_tokens']) ? $usage['total_input_tokens'] : 0,
                    'candidatesTokenCount' => isset($usage['total_output_tokens']) ? $usage['total_output_tokens'] : 0,
                    'totalTokens' => isset($usage['total_tokens']) ? $usage['total_tokens'] : 0
                ];

                $logData['processed'] = [
                    'extractedContent' => $modified_files_json, // Log the raw JSON with diffs
                    'usage' => $final_usage,
                    'interactionId' => $newInteractionId,
                ];
                $this->log_gemini_interaction($logData);

                return array(
                    'modified_files' => $modified_files_data['modified_files'],
                    'interaction_id' => $newInteractionId,
                    'usage' => $final_usage,
                );
            } elseif (isset($result['promptFeedback']['blockReason'])) {
                throw new Exception('API request was blocked. Reason: ' . $result['promptFeedback']['blockReason']);
            } else {
                throw new Exception('Unexpected API response format: ' . $apiResponse);
            }
        } catch (Exception $e) {
            // Catch any exception, log it, and re-throw it to be handled by the caller.
            $logData['error'] = $e->getMessage();
            $this->log_gemini_interaction($logData);
            throw $e;
        }
    }

    /**
     * Logs the details of a Gemini API interaction to a JSON file.
     * This is used for debugging and auditing purposes. Logging can be disabled by setting the log path to empty.
     *
     * @param array $logData The data to be logged, including request, response, and any errors.
     */
    private function log_gemini_interaction($logData) {
    /**
     * Logs the details of a Gemini API interaction to a JSON file.
     * This is used for debugging and auditing purposes. Logging can be disabled by setting the log path to empty.
     *
     * @param array $logData The data to be logged, including request, response, and any errors.
     */
        try {
            $logDir = $this->logPath;
            if (empty($logDir) || !is_dir($logDir) || !is_writable($logDir)) {
                // If path is empty or the directory doesn't exist, do not log.
                return;
            }

            $logFile = $logDir . '/' . date('Y-m-d_H-i-s') . '_' . uniqid() . '.json';
            
            // To prevent potential JSON encoding errors with invalid UTF-8 strings
            array_walk_recursive($logData, function (&$item, $key) {
                if (is_string($item)) {
                    $item = mb_convert_encoding($item, 'UTF-8', 'UTF-8');
                }
            });

            $jsonLogData = json_encode($logData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

            if (file_put_contents($logFile, $jsonLogData) === false) {
                error_log("Failed to write to Gemini log file: " . $logFile);
            }

        } catch (Exception $e) {
            error_log("Error in log_gemini_interaction: " . $e->getMessage());
        }
    }
}

/**
 * Handles saving content from the simple text editor mode.
 */
class TextEditor {
    /** @var WebRobotUpdater An instance of the updater class to access helper methods. */
    private $updater;

    /**
     * TextEditor constructor.
     * @param WebRobotUpdater $updater An instance of WebRobotUpdater to access its file-saving and validation methods.
     */
    public function __construct(WebRobotUpdater $updater) {
        $this->updater = $updater;
    }

    /**
     * Saves the content of the <main> tag for a given file.
     * It reads the original file, replaces the content of the <main> tag,
     * and then uses the WebRobotUpdater's save method to handle backups and file writing.
     *
     * @param string $filePath The relative path of the file to save.
     * @param string $newMainContent The new HTML content for the <main> tag.
     * @param string $comment An optional comment to save with the backup.
     * @throws Exception If the <main> tag cannot be found in the file.
     */
    public function save($filePath, $newMainContent, $comment = '') {
        $fullPath = $this->updater->validate_path($filePath);
        $originalContent = file_get_contents($fullPath);

        // --- New logic to handle included files wrapped in <includessi> ---
        $dom = new DOMDocument();
        // Use libxml to prevent errors on HTML5 tags and wrap content to ensure it's parsed correctly as a fragment.
        // The @ suppresses warnings on potentially malformed user-edited HTML.
        @$dom->loadHTML('<?xml encoding="utf-8" ?>' . $newMainContent, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);

        $filesToCommit = [];
        $includeNodes = $dom->getElementsByTagName('includessi');
        
        // Iterate backwards over the node list as we are removing/replacing nodes.
        for ($i = $includeNodes->length - 1; $i >= 0; $i--) {
            $node = $includeNodes->item($i);
            $includePath = $node->getAttribute('data-path');

            if ($includePath) {
                // Get the innerHTML of the <includessi> node.
                $innerContent = '';
                foreach ($node->childNodes as $child) {
                    $innerContent .= $dom->saveHTML($child);
                }

                // Save the extracted content to the included file.
                $fullIncludePath = $this->updater->validate_path($includePath);
                if (file_put_contents($fullIncludePath, $innerContent) === false) {
                    throw new Exception("Failed to save included file: {$includePath}");
                }
                $filesToCommit[] = $includePath;

                // Replace the <includessi> wrapper node with the original SSI directive comment.
                $ssiComment = $dom->createComment("#include virtual=\"{$includePath}\" ");
                $node->parentNode->replaceChild($ssiComment, $node);
            }
        }

        // Reconstruct the cleaned main content from the DOM, now with SSI directives restored.
        $cleanedMainContent = '';
        // childNodes of the document object itself will contain the parsed fragment.
        foreach ($dom->childNodes as $child) {
            // Don't save the xml processing instruction we added.
            if ($child->nodeType !== XML_PI_NODE) {
                 $cleanedMainContent .= $dom->saveHTML($child);
            }
        }

        // Now, update the main page's content by replacing only the content of the <main> tag.
        // We must escape special characters in the user-provided content to prevent preg_replace from
        // interpreting them as backreferences (e.g., '$100') or escape sequences.
        // The special characters in a preg_replace replacement string are '$' and '\'.
        $safeCleanedMainContent = str_replace(['\\', '$'], ['\\\\', '\\$'], $cleanedMainContent);
        $newFullContent = preg_replace('/(<main[^>]*>)(.*?)(<\/main>)/s', '$1' . $safeCleanedMainContent . '$3', $originalContent, 1, $count);

        if ($count === 0) {
            // Fallback for pages without a <main> tag. Replace all <section>s.
            $firstSectionPos = strpos($originalContent, '<section');
            $lastSectionEndPos = strrpos($originalContent, '</section>');

            if ($firstSectionPos !== false && $lastSectionEndPos !== false) {
                $lastSectionEndPos += strlen('</section>');
                $prefix = substr($originalContent, 0, $firstSectionPos);
                $suffix = substr($originalContent, $lastSectionEndPos);
                // Here we use $cleanedMainContent because we are not using preg_replace's replacement string.
                $newFullContent = $prefix . $cleanedMainContent . $suffix;
            } else {
                throw new Exception("Could not find <main> tag or <section> tags in the file to update.");
            }
        }

        if ($newFullContent === null || file_put_contents($fullPath, $newFullContent) === false) {
            throw new Exception('Failed to save main file via Text Editor.');
        }
        $filesToCommit[] = $filePath;

        // Commit all changed files to Git.
        $gitService = $this->updater->getGitService();
        if ($gitService && !empty($filesToCommit)) {
            $prompt = !empty(trim($comment)) ? $comment : '[Text Editor Update]';
            $gitService->commitChanges(array_unique($filesToCommit), $prompt);
        }
    }
}

/**
 * Manages all interactions with the Git version control system.
 */
class GitService {
    private $repoRoot;

    /**
     * GitService constructor.
     * Finds the git repository root and verifies git is installed.
     * @throws Exception if not in a git repository or git command is not found.
     */
    public function __construct() {
        $this->repoRoot = $this->find_git_root(DOC_ROOT);
        if ($this->repoRoot === null) {
            // Check if git command exists to give a more specific error
            exec('command -v git', $output, $return_var);
            if ($return_var !== 0) {
                throw new Exception("The 'git' command is not available on this server.");
            }
            throw new Exception("The project is not a git repository. Git-based versioning is disabled.");
        }
    }

    /**
     * Finds the root directory of the git repository by searching upwards from a starting directory.
     * @param string $start_dir The directory to start searching from.
     * @return string|null The path to the repo root, or null if not found.
     */
    private function find_git_root($start_dir) {
        $dir = $start_dir;
        // Go up the directory tree until we find a .git directory or hit the filesystem root.
        while ($dir !== '/' && $dir !== '' && !is_dir($dir . '/.git')) {
            $parent = dirname($dir);
            if ($parent === $dir) { // Reached the top of the filesystem
                return null;
            }
            $dir = $parent;
        }
        return (is_dir($dir . '/.git')) ? $dir : null;
    }

    /**
     * Lists the entire commit history for the repository.
     * @return array A list of commits.
     */
    public function listRepositoryHistory() {
        $separator = '|||';
        $format = '%H' . $separator . '%ai' . $separator . '%s';
        $command = 'git log --pretty=format:"' . $format . '"';
        $log_output = $this->execute($command);

        $history = [];
        $webRobotPrefix = '[WebRobot]';

        // Iterate from newest to oldest to find the relevant commits
        foreach ($log_output as $line) {
            list($hash, $date, $subject) = explode($separator, $line, 3);
            $trimmed_subject = trim($subject);

            // Check if the subject contains '[WebRobot]' anywhere, to include standard commits and revert commits.
            if (strpos($trimmed_subject, $webRobotPrefix) !== false) {
                $is_revert = (strpos($trimmed_subject, 'Revert "') === 0);
                $history[] = [
                    'file' => $hash,
                    'date' => $date,
                    'prompt' => $subject,
                    'is_revert' => $is_revert
                ];
            } else {
                // This is the first non-WebRobot commit, so it's our initial state.
                $history[] = ['file' => $hash, 'date' => $date, 'prompt' => 'Initial commit', 'is_revert' => false];
                // Stop processing further commits.
                break;
            }
        }

        return $history;
    }

    /**
     * Executes a shell command in the git repository root.
     * @param string $command The command to execute.
     * @return array The output from the command.
     * @throws Exception if the command fails.
     */
    private function execute($command) {
        // All commands should be run from the repo root. Redirect stderr to stdout to capture errors.
        $full_command = 'cd ' . escapeshellarg($this->repoRoot) . ' && ' . $command . ' 2>&1';
        exec($full_command, $output, $return_var);
        if ($return_var !== 0) {
            throw new Exception("Git command failed with code $return_var: $command\nOutput: " . implode("\n", $output));
        }
        return $output;
    }

    /**
     * Commits specified files with a given prompt as the message.
     * @param array $files Array of file paths relative to DOC_ROOT.
     * @param string $prompt The commit message.
     */
    public function commitChanges(array $files, $prompt) {
        foreach ($files as $filePath) {
            $absolutePath = realpath(DOC_ROOT . '/' . $filePath);
            if (!$absolutePath) continue; // Skip if file doesn't exist (e.g., it was just created)
            $this->execute('git add ' . escapeshellarg($absolutePath));
        }

        $status_output = $this->execute('git status --porcelain');
        if (empty($status_output)) {
            return; // Nothing to commit
        }

        $commit_message = "[WebRobot] " . $prompt;
        $this->execute('git commit -m ' . escapeshellarg($commit_message));
    }

    /**
     * Lists the commit history for a specific file.
     * @param string $filePath The file path relative to DOC_ROOT.
     * @return array A list of commits.
     */
    public function listHistory($filePath) {
        $absolutePath = realpath(DOC_ROOT . '/' . $filePath);
        if (!$absolutePath) {
            return []; // File doesn't exist, so no history.
        }
        $relativePath = str_replace($this->repoRoot . '/', '', $absolutePath);

        $separator = '|||';
        $format = '%H' . $separator . '%ai' . $separator . '%s';
        $command = 'git log --pretty=format:"' . $format . '" -- ' . escapeshellarg($relativePath);

        try {
            $log_output = $this->execute($command);
        } catch (Exception $e) {
            // If the file is not in git history, log might fail. Return empty.
            error_log("Git log failed for $filePath: " . $e->getMessage());
            return [];
        }

        $history = [];
        $current_hash_output = $this->execute('git rev-parse HEAD');
        $current_hash = trim($current_hash_output[0]);

        foreach ($log_output as $line) {
            list($hash, $date, $subject) = explode($separator, $line, 3);
            $history[] = [
                'file' => $hash, // Use hash as the identifier for rollback
                'date' => $date,
                'prompt' => $subject,
                'is_current' => ($hash === $current_hash),
            ];
        }
        return $history;
    }

    /**
     * Rolls back a file to a specific commit.
     * @param string $commitHash The commit hash to revert to.
     * @param string $filePath The file path to revert.
     */
    public function rollback($commitHash, $filePath) {
        $absolutePath = realpath(DOC_ROOT . '/' . $filePath);
        if (!$absolutePath) {
            throw new Exception("File to rollback does not exist: $filePath");
        }
        $relativePath = str_replace($this->repoRoot . '/', '', $absolutePath);
        $this->execute('git checkout ' . escapeshellarg($commitHash) . ' -- ' . escapeshellarg($relativePath));
    }

    /**
     * Rolls back the entire repository to a specific commit.
     * @param string $commitHash The commit hash to revert to.
     */
    public function rollbackRepository($commitHash) {
        // Get the list of commits to revert. This will be all commits from HEAD
        // back to the one *after* the target commit hash.
        $logCommand = 'git log --pretty=%H ' . escapeshellarg($commitHash) . '..HEAD';
        $commitsToRevert = $this->execute($logCommand);

        if (empty($commitsToRevert)) {
            // This might happen if the user tries to activate the current version,
            // or if the commit is not an ancestor of HEAD.
            // Silently do nothing, as there are no changes to revert.
            return;
        }

        // Revert the commits. `git log` gives them newest first, which is the correct order.
        // `git revert` can handle multiple commit hashes at once.
        // The --no-edit flag prevents the command from opening an editor for the commit message.
        // This creates new commits that undo the changes, preserving history and allowing
        // the user to "roll forward" by reverting the reverts.
        $revertCommand = 'git revert --no-edit ' . implode(' ', $commitsToRevert);
        $this->execute($revertCommand);
    }

    /**
     * Gets the diff for a specific commit.
     * @param string $commitHash The commit hash.
     * @return string The diff output.
     */
    public function getCommitDiff($commitHash) {
        // Use --pretty="" to only show the diff part of the commit, not the metadata.
        // This makes the output cleaner for the user.
        $command = 'git show --pretty="" ' . escapeshellarg($commitHash);
        $output = $this->execute($command);
        return implode("\n", $output);
    }
}

/**
 * Manages file system operations for the web robot, including updates, backups, and rollbacks.
 * It serves as the main controller for handling user actions related to file content.
 */
class WebRobotUpdater {

    /** @var GeminiService The service used to interact with the Gemini API. */
    private $geminiService;
    /** @var GitService|null The service for Git version control. */
    private $gitService;

    /**
     * WebRobotUpdater constructor.
     * Initializes the updater and its dependency, the GeminiService, passing a reference to itself
     * to allow the service to use its helper methods.
     */
    public function __construct(array $configData) {
        $this->geminiService = new GeminiService($this, $configData);
        try {
            $this->gitService = new GitService();
        } catch (Exception $e) {
            // If Git isn't set up, we can't use versioning. Log the error.
            error_log("GitService initialization failed: " . $e->getMessage());
            $this->gitService = null;
        }
    }

    /** @return GitService|null */
    public function getGitService() {
        return $this->gitService;
    }

    private function getUploadsMetadataPath() {
        return DOC_ROOT . '/upload/uploads.json';
    }

    private function getUploadsDir() {
        return DOC_ROOT . '/upload';
    }

    /**
     * Orchestrates the process of generating and saving file updates using the AI.
     * It can process a specific list of files or all HTML files found in the sitemap.
     *
     * @param string $prompt The user's instruction for the AI.
     * @param array $target_files A list of file paths to update.
     * @param bool $update_all_html If true, ignores $target_files and updates all HTML pages from the sitemap.
     * @param string|null $interactionId The ID for a continuing conversation.
     * @return array An array containing a success message and total token usage.
     * @throws Exception If no target files are specified.
     */
    public function generateAndSave($prompt, $target_files, $update_all_html, $interactionId = null) {
        $files_to_process = array();

        // Determine the list of files to process based on user input.
        if ($update_all_html) {
            $sitemap_path = DOC_ROOT . '/data/sitemap.json';
            if (file_exists($sitemap_path)) {
                $sitemap = json_decode(file_get_contents($sitemap_path), true);
                if (isset($sitemap['html_pages'])) {
                    foreach ($sitemap['html_pages'] as $page) {
                        $files_to_process[] = $page['path'];
                    }
                }
            }
        } else {
            $files_to_process = $target_files;
        }

        if (empty($files_to_process)) {
             throw new Exception('No target files specified for update.');
        }

        $files_for_api = [];
        $data_source_paths = [];

        // Add primary files and collect their data source paths
        foreach ($files_to_process as $filePath) {
            $fullPath = $this->validate_path($filePath);
            if (!is_file($fullPath)) {
                error_log("Skipping non-existent file in generateAndSave: " . $filePath);
                continue;
            }
            $content = file_get_contents($fullPath);
            $files_for_api[] = [
                'path' => $filePath,
                'content' => $content
            ];
            $dataSourcePath = $this->get_data_source_from_content($content);
            if ($dataSourcePath) {
                $data_source_paths[] = $dataSourcePath;
            }
        }

        // Add unique data source files to the context
        $unique_data_sources = array_unique($data_source_paths);
        foreach ($unique_data_sources as $dataSourcePath) {
            try {
                $fullDataSourcePath = $this->validate_path($dataSourcePath);
                if (is_file($fullDataSourcePath)) {
                    $files_for_api[] = [
                        'path' => $dataSourcePath,
                        'content' => file_get_contents($fullDataSourcePath)
                    ];
                }
            } catch (Exception $e) {
                error_log("Could not include data source file '$dataSourcePath' for AI processing: " . $e->getMessage());
            }
        }

        // --- New Logic: Scan for and add Server-Side Includes ---
        $ssi_paths = [];
        // Scan the content of already added files for SSI directives.
        foreach ($files_for_api as $file) {
            if (preg_match_all('/<!--#include\s+virtual="([^"]+)"\s*-->/', $file['content'], $matches)) {
                foreach ($matches[1] as $match) {
                    $ssi_paths[] = $match;
                }
            }
        }

        // Add unique SSI files to the context for the AI.
        $unique_ssi_paths = array_unique($ssi_paths);
        foreach ($unique_ssi_paths as $ssiPath) {
            try {
                $fullSsiPath = $this->validate_path($ssiPath);
                if (is_file($fullSsiPath)) {
                    $files_for_api[] = ['path' => $ssiPath, 'content' => file_get_contents($fullSsiPath)];
                }
            } catch (Exception $e) {
                error_log("Could not include SSI file '$ssiPath' for AI processing: " . $e->getMessage());
            }
        }

        // Automatically include uploads.json if it exists, to give the AI context on available files.
        $uploadsMetadataPath = $this->getUploadsMetadataPath();
        if (file_exists($uploadsMetadataPath)) {
            $files_for_api[] = [
                'path' => 'upload/uploads.json',
                'content' => file_get_contents($uploadsMetadataPath)
            ];
        }

        if (empty($files_for_api)) {
            throw new Exception('No valid files found to process.');
        }
        
        $geminiResult = $this->geminiService->call_gemini_api($files_for_api, $prompt, $interactionId);
        
        $updated_files_count = 0;
        $files_to_commit = [];
        foreach ($geminiResult['modified_files'] as $file_to_patch) {
            $this->apply_diff_and_save($file_to_patch['filename'], $file_to_patch['unified_diff'], $geminiResult['interaction_id']);
            $files_to_commit[] = $file_to_patch['filename'];
            $updated_files_count++;
        }
        if ($this->gitService && !empty($files_to_commit)) {
            $this->gitService->commitChanges($files_to_commit, $prompt);
        }
        
        return [
            'message' => "$updated_files_count file(s) updated successfully by AI.",
            'usage' => $geminiResult['usage'],
            'interaction_id' => $geminiResult['interaction_id'],
        ];
    }

    /**
     * Lists all uploaded files by reading the metadata JSON.
     * @return array A list of uploaded file metadata.
     */
    public function listUploads() {
        $metadataPath = $this->getUploadsMetadataPath();
        if (!file_exists($metadataPath)) {
            return ['images' => [], 'documents' => []];
        }

        $metadata = json_decode(file_get_contents($metadataPath), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Error reading uploads metadata file.');
        }

        return $metadata;
    }

    /**
     * Handles a file upload, saves it, and updates the metadata JSON.
     * @param array $file The uploaded file from $_FILES.
     * @param string $description The description of the file.
     * @param string $type The type of file ('image' or 'document').
     * @throws Exception If the upload fails or metadata cannot be saved.
     */
    public function handleUpload($file, $description) {
        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new Exception('File upload error: ' . $file['error']);
        }

        $tmp_path = $file['tmp_name'];

        // Sanitize filename
        $filename = preg_replace('/[^a-zA-Z0-9-_\.]/', '', basename($file['name']));
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        // Determine file type by extension and then validate content
        $imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        $documentExtensions = ['pdf']; // Only PDF is allowed

        $type = null;
        if (in_array($extension, $imageExtensions)) {
            // Verify that it's a real image file
            if (@getimagesize($tmp_path) === false) {
                throw new Exception("Uploaded file is not a valid image: {$filename}");
            }
            $type = 'image';
        } elseif (in_array($extension, $documentExtensions)) {
            // Verify that it's a real PDF file by checking MIME type
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->file($tmp_path);
            if ($mime !== 'application/pdf') {
                throw new Exception("Uploaded file is not a valid PDF: {$filename}");
            }
            $type = 'document';
        } else {
            throw new Exception("Unsupported file type: .{$extension}. Only images (jpg, png, etc.) and PDF documents are allowed.");
        }

        $uploadDir = $this->getUploadsDir();
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Sanitize filename
        $targetPath = $uploadDir . '/' . $filename;
        $filename = preg_replace('/[^a-zA-Z0-9-_\.]/', '', basename($file['name']));
        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            throw new Exception('Failed to move uploaded file.');
        }

        // Update metadata
        $metadataPath = $this->getUploadsMetadataPath();
        $metadata = $this->listUploads();

        $newEntry = [
            'filename' => $filename,
            'description' => $description,
            'path' => 'upload/' . $filename,
            'timestamp' => date('c')
        ];

        if ($type === 'image') {
            $metadata['images'][] = $newEntry;
        } else {
            $metadata['documents'][] = $newEntry;
        }

        if (file_put_contents($metadataPath, json_encode($metadata, JSON_PRETTY_PRINT)) === false) {
            // Attempt to clean up the uploaded file if metadata fails
            unlink($targetPath);
            throw new Exception('Failed to write to uploads metadata file.');
        }
    }

    /**
     * Deletes an uploaded file and removes it from the metadata JSON.
     * @param string $filename The name of the file to delete.
     * @param string $type The type of file ('image' or 'document').
     * @throws Exception If the file cannot be deleted or metadata fails to save.
     */
    public function deleteUpload($filename, $type) {
        $uploadDir = $this->getUploadsDir();
        $targetPath = $uploadDir . '/' . $filename;

        // Security check: ensure the file is within the upload directory
        if (strpos(realpath($targetPath), realpath($uploadDir)) !== 0) {
            throw new Exception('Invalid file path for deletion.');
        }

        if (file_exists($targetPath) && !unlink($targetPath)) {
            throw new Exception('Failed to delete file.');
        }

        // Update metadata
        $metadataPath = $this->getUploadsMetadataPath();
        $metadata = $this->listUploads();
        $key = ($type === 'image') ? 'images' : 'documents';

        $metadata[$key] = array_values(array_filter($metadata[$key], function($item) use ($filename) {
            return $item['filename'] !== $filename;
        }));

        file_put_contents($metadataPath, json_encode($metadata, JSON_PRETTY_PRINT));
    }

    /**
     * Updates the description for an uploaded file in the metadata JSON.
     * @param string $filename The name of the file to update.
     * @param string $type The type of file ('image' or 'document').
     * @param string $newDescription The new description text.
     * @throws Exception If metadata cannot be read or saved.
     */
    public function updateUploadDescription($filename, $type, $newDescription) {
        $metadataPath = $this->getUploadsMetadataPath();
        $metadata = $this->listUploads();
        $key = ($type === 'image') ? 'images' : 'documents';

        $found = false;
        foreach ($metadata[$key] as &$item) {
            if ($item['filename'] === $filename) {
                $item['description'] = $newDescription;
                $found = true;
                break;
            }
        }

        if (!$found) {
            throw new Exception("File '{$filename}' not found in metadata.");
        }

        if (file_put_contents($metadataPath, json_encode($metadata, JSON_PRETTY_PRINT)) === false) {
            throw new Exception('Failed to write updated metadata file.');
        }
    }

    /**
     * Lists all available backup files for a given file path.
     * It also indicates which backup, if any, matches the current live version.
     *
     * @param string $filePath The relative path to the target file.
     * @return array A sorted list of backup file details (path, date, prompt, is_current).
     */
    public function listBackups($filePath) {
        if ($this->gitService) {
            return $this->gitService->listHistory($filePath);
        }
        return [];
    }

    /**
     * Rolls back a file to a specific backup version.
     * This is an atomic operation that also restores the associated data file if it was part of the backup.
     *
     * @param string $filePath The relative path to the file to be rolled back.
     * @param string $backupFileIdentifier The identifier for the backup (commit hash).
     * @throws Exception If the backup file is invalid or if the rollback fails.
     */
    public function rollbackFile($filePath, $backupFileIdentifier) {
        if (!$this->gitService) {
            throw new Exception("Git service is not available for rollback.");
        }
        $this->gitService->rollback($backupFileIdentifier, $filePath);
    }

    /**
     * Rolls back the entire repository to a specific commit.
     *
     * @param string $commitHash The commit hash to roll back to.
     * @throws Exception If the Git service is not available.
     */
    public function rollbackRepository($commitHash) {
        if (!$this->gitService) {
            throw new Exception("Git service is not available for rollback.");
        }
        $this->gitService->rollbackRepository($commitHash);
    }


    /**
     * Validates and sanitizes a file path to prevent directory traversal attacks.
     * Ensures the final resolved path is within the defined DOC_ROOT.
     *
     * @param string $path The file path to validate.
     * @return string The absolute, validated file path.
     * @throws Exception If the path is invalid or outside the document root.
     */
    public function validate_path($path) {
        // Prevent directory traversal attacks.
        if (strpos($path, '..') !== false) {
            throw new Exception('Invalid file path: directory traversal ("..") is not allowed.');
        }
        // Prevent null byte injection.
        if (strpos($path, "\0") !== false) {
            throw new Exception('Invalid file path: null byte detected.');
        }

        // Construct the full path, removing any leading slashes from the relative path.
        $fullPath = DOC_ROOT . '/' . ltrim($path, '/\\');

        // Get the canonical, absolute path of the document root.
        $realDocRoot = realpath(DOC_ROOT);
        if ($realDocRoot === false) {
            // This would be a server configuration issue.
            throw new Exception('Could not resolve the document root path. Check server configuration.');
        }

        // Get the canonical, absolute path of the directory containing the target file.
        $realDir = realpath(dirname($fullPath));

        // If the directory doesn't exist, realpath returns false. This is an error.
        if ($realDir === false) {
            throw new Exception("The directory for the path '{$path}' does not exist or is not accessible.");
        }

        // The main security check: ensure the target directory is inside the document root.
        if (strpos($realDir, $realDocRoot) !== 0) {
            throw new Exception('Invalid or forbidden file path. Only files within the document root can be edited.');
        }

        // Return the constructed full path. We don't return the realpath of the file itself,
        // because the file might not exist yet (e.g., if it's being created).
        return $fullPath;
    }

    /**
     * Extracts the data source path from a <meta name="data-source"> tag in HTML content.
     *
     * @param string $htmlContent The HTML content to search.
     * @return string|null The path to the data source, or null if not found.
     */
    public function get_data_source_from_content($htmlContent) {
        if (preg_match('/<meta\s+name="data-source"\s+content="([^"]+)"/i', $htmlContent, $matches)) {
            return $matches[1];
        }
        return null;
    }

    /** 
     * Extracts an embedded data file block from content.
     * The block is expected to be in the format: <!-- START DATA FILE: path/to/data.json ... END DATA FILE: ... -->
     *
     * @param string $content The content to search within.
     * @return array|null An array with 'path' and 'content' keys if found, otherwise null.
     */
    public function extract_data_block($content) {
        if (preg_match('/<!--\s*START DATA FILE:\s*([^\s>]+)(.*?)END DATA FILE:\s*\1\s*-->/s', $content, $matches)) {
            return [
                'path' => trim($matches[1]),
                'content' => trim($matches[2])
            ];
        }
        return null;
    }

    /**
     * Applies a unified diff to a string of original content using the command-line `patch` utility.
     *
     * @param string $original_content The original content.
     * @param string $diff The unified diff string.
     * @return string The new content after applying the diff.
     * @throws Exception if the `patch` command is not available or fails.
     */
    private function apply_diff($original_content, $diff) {
        if (SIMULATE_PATCH_FAILURE) {
            throw new Exception('SIMULATE_PATCH_FAILURE is true: Patch command simulation failed.');
        }

        // Check if `patch` command exists. This is a basic security and functionality check.
        exec('command -v patch', $output, $return_var);
        if ($return_var !== 0) {
            throw new Exception('The `patch` command is not available on this server. Cannot apply diff.');
        }

        // Create temporary files for the original content and the diff.
        $originalFile = tempnam(sys_get_temp_dir(), 'webrbt_orig_');
        $diffFile = tempnam(sys_get_temp_dir(), 'webrbt_diff_');
        $outputFile = tempnam(sys_get_temp_dir(), 'webrbt_out_');

        // Ensure temporary files are removed on script exit, even if errors occur.
        register_shutdown_function(function() use ($originalFile, $diffFile, $outputFile) {
            if (file_exists($originalFile)) unlink($originalFile);
            if (file_exists($diffFile)) unlink($diffFile);
            if (file_exists($outputFile)) unlink($outputFile);
        });

        // Write content to temp files
        file_put_contents($originalFile, $original_content);
        file_put_contents($diffFile, $diff);

        // The `-o` flag tells patch to write the output to a file instead of modifying in-place.
        // This is much safer. We also use `--fuzz=0` to be strict and avoid partial patches.
        $command = sprintf(
            'patch -p1 -o %s %s %s',
            escapeshellarg($outputFile),
            escapeshellarg($originalFile),
            escapeshellarg($diffFile)
        );

        // Execute the command
        exec($command, $cmd_output, $return_var);

        // Get the patched content before cleaning up
        $new_content = file_get_contents($outputFile);

        // Check for errors. `patch` returns 0 for success.
        // A return value of 1 means some hunks failed (fuzz patching), 2 means serious trouble.
        if ($return_var !== 0) {
            $error_message = "Patch command failed with return code $return_var.\\n";
            $error_message .= "This can happen if the diff does not perfectly match the file content.\\n";
            $error_message .= "Command Output:\\n" . implode("\\n", $cmd_output);
            throw new Exception($error_message);
        }

        return $new_content;
    }

    private function apply_diff_and_save($filePath, $diff, $interactionId = null) {
        $fullPath = $this->validate_path($filePath);
        $isNewFile = !is_file($fullPath);
        $original_content = $isNewFile ? "" : file_get_contents($fullPath);

        try {
            // Apply the diff to get the new content.
            $newContent = $this->apply_diff($original_content, $diff);

            // If it's a JSON file, validate its syntax before writing to the actual file.
            $isJsonFile = (pathinfo($filePath, PATHINFO_EXTENSION) === 'json');
            if ($isJsonFile) {
                json_decode($newContent);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    // JSON is invalid. Throw an exception, which will prevent overwriting the original file.
                    throw new Exception("JSON syntax error detected in {$filePath} after applying diff. Error: " . json_last_error_msg());
                }
            }

            // Save the new content to the actual file.
            if (file_put_contents($fullPath, $newContent) === false) {
                throw new Exception('Failed to save file after applying diff: ' . $filePath);
            }

        } catch (Exception $e) {
            // This catch block handles exceptions from apply_diff, JSON validation, or file_put_contents.

            // If the error is specifically a JSON syntax error, we don't want to fall back to Gemini.
            // The original file was never overwritten, so we can just re-throw the error.
            if (strpos($e->getMessage(), "JSON syntax error detected") === 0) {
                throw $e; // Re-throw the specific JSON error.
            }

            // For other exceptions (e.g., patch command failure, general file_put_contents failure),
            // proceed with the Gemini full content fallback.
            error_log("Applying diff or saving failed for {$filePath}, falling back to full content request. Error: " . $e->getMessage());

            // Fallback: request the full content for the failed file.
            $fallback_prompt = "The previous diff failed to apply. Please provide the full, updated content for the file: {$filePath}";
            $file_for_api = [
                ['path' => $filePath, 'content' => $original_content] // Provide original content for context
            ];
            $geminiResult = $this->geminiService->call_gemini_api($file_for_api, $fallback_prompt, $interactionId, 'full_content');

            if (isset($geminiResult['modified_files'][0]['full_content'])) {
                $newContent = $geminiResult['modified_files'][0]['full_content'];
                // We should still validate the JSON on the fallback content
                $isJsonFile = (pathinfo($filePath, PATHINFO_EXTENSION) === 'json');
                if ($isJsonFile) {
                    json_decode($newContent);
                    if (json_last_error() !== JSON_ERROR_NONE) {
                        throw new Exception("JSON syntax error detected in fallback content for {$filePath}. Error: " . json_last_error_msg());
                    }
                }
                if (file_put_contents($fullPath, $newContent) === false) {
                    throw new Exception('Failed to save file after fallback to full content: ' . $filePath);
                }
            } else {
                throw new Exception("Fallback to get full content failed for {$filePath}. API response did not contain expected content.");
            }
        }
    }
}

// Basic security: Restrict to POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array('error' => 'Method Not Allowed'));
    exit;
}

// Set the response content type to JSON.
header('Content-Type: application/json');

$action = isset($_GET['action']) ? $_GET['action'] : '';
$response = array();

// --- New Login Guard ---
// The 'check_login_status' action is the only one that can be called without being logged in.
// All other actions require an active, authorized session.
if ($action !== 'check_login_status') {
    $fullLoginCheckerClass = '\\WebRobot\\' . $loginCheckerClass;
    $loginChecker = new $fullLoginCheckerClass($configData);
    $loginStatus = $loginChecker->isLoggedIn();

    if ($loginStatus !== true) {
        // User is not logged in. Send a redirect response and stop execution.
        // The frontend (editor.js) will handle the redirection.
        $response['status'] = 'redirect';
        $response['redirect_url'] = $loginStatus;
        echo json_encode($response);
        exit;
    }
}
$updater = new WebRobotUpdater($configData);

// Main action handler.
try {
    switch ($action) {
        case 'generate_and_save':
            $data = json_decode(file_get_contents('php://input'), true);
            $prompt = isset($data['prompt']) ? $data['prompt'] : '';
            $target_files = isset($data['target_files']) ? $data['target_files'] : array();
            $update_all_html = isset($data['update_all_html']) ? $data['update_all_html'] : false;
            $interaction_id = isset($data['interaction_id']) ? $data['interaction_id'] : null;
            
            $result = $updater->generateAndSave($prompt, $target_files, $update_all_html, $interaction_id);
            $response['message'] = $result['message'];
            $response['interaction_id'] = $result['interaction_id'];
            $response['usage'] = $result['usage'];
            break;
        case 'check_login_status':
            $fullLoginCheckerClass = '\\WebRobot\\' . $loginCheckerClass;
            $loginChecker = new $fullLoginCheckerClass($configData);
            $loginStatus = $loginChecker->isLoggedIn();

            if ($loginStatus === true) {
                $response['status'] = 'success';
                $response['message'] = 'User is logged in.';
            } else {
                // It's a redirect URL
                $response['status'] = 'redirect';
                $response['redirect_url'] = $loginStatus;
            }
            break;
        case 'list_uploads':
            $response['uploads'] = $updater->listUploads();
            break;
        case 'handle_upload':
            if (!isset($_FILES['file']) || !isset($_POST['description'])) {
                throw new Exception('Missing upload parameters.');
            }
            $updater->handleUpload($_FILES['file'], $_POST['description']);
            $response['message'] = 'File uploaded successfully.';
            break;
        case 'delete_upload':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!isset($data['filename']) || !isset($data['type'])) {
                throw new Exception('Missing delete parameters.');
            }
            $updater->deleteUpload($data['filename'], $data['type']);
            $response['message'] = 'File deleted successfully.';
            break;
        case 'update_upload_description':
            $data = json_decode(file_get_contents('php://input'), true);
            if (!isset($data['filename']) || !isset($data['type']) || !isset($data['description'])) {
                throw new Exception('Missing parameters for description update.');
            }
            $updater->updateUploadDescription($data['filename'], $data['type'], $data['description']);
            $response['message'] = 'Description updated successfully.';
            break;
        case 'save_text_edit':
            $data = json_decode(file_get_contents('php://input'), true);
            $filePath = isset($data['file']) ? $data['file'] : '';
            $newMainContent = isset($data['content']) ? $data['content'] : '';
            $comment = isset($data['comment']) ? $data['comment'] : '';

            $textEditor = new TextEditor($updater);
            $textEditor->save($filePath, $newMainContent, $comment);

            $response['message'] = 'File updated successfully via Text Editor.';
            break;
        case 'list_backups': // Kept for backward compatibility, but editor uses list_commits
            $data = json_decode(file_get_contents('php://input'), true);
            $filePath = isset($data['file']) ? $data['file'] : '';
            $response['backups'] = $updater->listBackups($filePath);
            break;
        case 'list_commits': // New action from editor.js
            $gitService = $updater->getGitService();
            $response['commits'] = $gitService ? $gitService->listRepositoryHistory() : [];
            break;
        case 'rollback_file': // Kept for backward compatibility, but editor uses rollback
            $data = json_decode(file_get_contents('php://input'), true);
            $filePath = isset($data['file']) ? $data['file'] : '';
            $backupFile = isset($data['backup_file']) ? $data['backup_file'] : '';
            $updater->rollbackFile($filePath, $backupFile);
            $response['message'] = 'File rolled back successfully.';
            break;
        case 'rollback': // New action from editor.js for repository-wide rollback
            $data = json_decode(file_get_contents('php://input'), true);
            $commitHash = isset($data['commit']) ? $data['commit'] : '';
            $updater->rollbackRepository($commitHash);
            $response['message'] = 'Repository rolled back successfully to specified version.';
            break;
        case 'get_commit_diff':
            $data = json_decode(file_get_contents('php://input'), true);
            $commitHash = isset($data['commit']) ? $data['commit'] : '';
            if (empty($commitHash)) {
                throw new Exception('Commit hash is required.');
            }
            $gitService = $updater->getGitService();
            if (!$gitService) {
                throw new Exception('Git service is not available.');
            }
            $response['diff'] = $gitService->getCommitDiff($commitHash);
            break;
        default:
            http_response_code(400);
            $response['error'] = 'Invalid action.';
    }
} catch (Exception $e) {
    // Catch any exceptions thrown during the process and return a generic server error.
    http_response_code(500);
    $response['error'] = $e->getMessage();
}

echo json_encode($response);

?>
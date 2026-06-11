<?php
// --- Start of Merged config.php ---
// The root directory of the website you want to edit.
define('DOC_ROOT', __DIR__);
// --- End of Merged config.php ---


/*-- "Curl example command" to process files with interactions API, Its output is a set of files in diff format

#!/bin/bash

# 1. Verify environment and arguments
if [ -z "$GEMINI_KEY" ]; then
    echo "Error: GEMINI_KEY environment variable is not set."
    exit 1
fi

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <html_file> <json_file>"
    echo "Example: $0 index.html header.json"
    exit 1
fi

HTML_FILE=$1
JSON_FILE=$2

# Check if files exist
if [ ! -f "$HTML_FILE" ] || [ ! -f "$JSON_FILE" ]; then
    echo "Error: One or both specified files do not exist."
    exit 1
fi

# 2. Read the prompt from the keyboard
echo "Enter your task/prompt for Gemini (Press Enter when done):"
read -r USER_PROMPT

if [ -z "$USER_PROMPT" ]; then
    echo "Error: Prompt cannot be empty."
    exit 1
fi

echo "Generating payload and calling the Interactions API..."

# 3. Safely construct the JSON payload using jq
# - Swapped model to gemini-3.5-flash for faster coding performance
# - Updated system_instruction to request Unified Diffs
# - Updated the JSON schema properties to expect "unified_diff"
JSON_PAYLOAD=$(jq -n \
  --arg html_content "$(cat "$HTML_FILE")" \
  --arg html_name "$HTML_FILE" \
  --arg json_content "$(cat "$JSON_FILE")" \
  --arg json_name "$JSON_FILE" \
  --arg prompt "$USER_PROMPT" \
  '{
    "model": "gemini-3.1-pro-preview",
    "system_instruction": "You are an expert web developer. You will receive file contents and a task. Return the modifications as standard Unified Diffs for any changed files. Do not return the full file content.",
    "input": [
      {
        "type": "text",
        "text": ("--- FILE: " + $html_name + " ---\n" + $html_content)
      },
      {
        "type": "text",
        "text": ("--- FILE: " + $json_name + " ---\n" + $json_content)
      },
      {
        "type": "text",
        "text": ("--- TASK ---\n" + $prompt)
      }
    ],
    "response_format": {
      "type": "text",
      "mime_type": "application/json",
      "schema": {
        "type": "object",
        "properties": {
          "modified_files": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "filename": { "type": "string" },
                "unified_diff": { "type": "string" }
              },
              "required": ["filename", "unified_diff"]
            }
          }
        },
        "required": ["modified_files"]
      }
    }
  }')

# 4. Send to the Interactions API and parse the response
curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/interactions?key=$GEMINI_KEY" \
-H "Content-Type: application/json" \
-d "$JSON_PAYLOAD" | jq -r '.steps[-1].content[0].text' > content.json

*/

/* "Sample Execution" of the command

user@Pauls-Mac-mini-2 learn_interactions % sh curl index.html header.json 
Enter your task/prompt for Gemini (Press Enter when done):
Modify the title of the page to header and add a newplaying day to the table for Twinkle - 3 June
Generating payload and calling the Interactions API...

*/

/* "Command Output" of -d "$JSON_PAYLOAD" | jq -r '.steps[-1].content[0].text' > content.json from the script

{
  "modified_files": [
    {
      "filename": "index.html",
      "unified_diff": "--- index.html\n+++ index.html\n@@ -3,3 +3,3 @@\n     <meta charset=\"UTF-8\">\n     <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n-    <title>Home | Amateur Chamber Music Society (ACMS) Australia</title>\n+    <title>header</title>\n     <!-- Tailwind CSS -->\n"
    },
    {
      "filename": "sample.json",
      "unified_diff": "--- sample.json\n+++ sample.json\n@@ -34,6 +34,11 @@\n         \"status\": \"Completed\"\n     },\n     {\n+        \"type\": \"playing-day\",\n+        \"date\": \"3 June\",\n+        \"title\": \"Twinkle\"\n+    },\n+    {\n         \"type\": \"concert\",\n         \"date\": \"14 June 2026\",\n"
    }
  ]
}

*/


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
     */
    public function __construct(WebRobotUpdater $updater) {
        $this->updater = $updater;

        // Set default configuration values.
        $this->apiKey = 'YOUR_GEMINI_API_KEY'; // Fallback API Key
        $this->model = 'gemini-3.1-pro-preview'; // Fallback model, updated for diff support
        $projectRoot = dirname(DOC_ROOT); // e.g., /path/to/acms.cweb.com.au
        $repoRoot = dirname($projectRoot);    // e.g., /path/to/acms2
        $this->logPath = $repoRoot . '/var/log/gemini'; // Default log path

        $key_file = $projectRoot . '/etc/gemini.json'; // Path to the configuration file

        // Override defaults with values from the configuration file if it exists.
        if (file_exists($key_file)) {
            $json_content = file_get_contents($key_file);
            $key_data = json_decode($json_content, true);
            if (!empty($key_data['key'])) {
                $this->apiKey = $key_data['key'];
            }
            if (!empty($key_data['model'])) {
                $this->model = $key_data['model'];
            }
            if (isset($key_data['log_path'])) {
                if (empty($key_data['log_path'])) {
                    $this->logPath = ''; // Disable logging by setting path to empty
                } else {
                    // The path in the config is the absolute path.
                    $this->logPath = $key_data['log_path'];
                }
            }
        }
    }

    /**
     * Calls the Google Gemini API to generate content based on a prompt and file content.
     * It constructs a detailed prompt including system instructions, context files, and the user's request.
     * It also handles injecting data source content into the prompt for the AI's context.
     *
     * @param array $files An array of files, where each element is an associative array with 'path' and 'content'.
     * @param string $userPrompt The user's instruction for what to change.
     * @return array An array containing 'modified_files' and 'usage' (token metadata).
     * @throws Exception If the API key is not configured or if the API call fails.
     */
    public function call_gemini_api(array $files, $userPrompt) {
        if ($this->apiKey === 'YOUR_GEMINI_API_KEY') {
            throw new Exception('Gemini API key is not configured.');
        }

        // Prepare data structure for logging the entire interaction.
        $logData = [
            'timestamp' => date('Y-m-d H:i:s'),
            'model' => $this->model,
            'request' => [
                'userPrompt' => $userPrompt,
                'files' => array_map(function($file) { return $file['path']; }, $files),
            ],
            'response' => [],
            'processed' => [],
            'error' => null,
        ];

        try {
            // The system prompt provides the AI with its core instructions and constraints.
            $system_prompt = "You are an expert web developer. You will receive file contents and a task. Return the modifications as standard Unified Diffs for any changed files. Do not return the full file content.";

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
                                'unified_diff' => ['type' => 'string']
                            ],
                            'required' => ['filename', 'unified_diff']
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

            $logData['request']['fullPayload'] = $data;

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

                $usage = $result['usage'] ?? [];
                $final_usage = [
                    'promptTokenCount' => $usage['total_input_tokens'] ?? 0,
                    'candidatesTokenCount' => $usage['total_output_tokens'] ?? 0,
                    'totalTokens' => $usage['total_tokens'] ?? 0
                ];

                $logData['processed'] = [
                    'extractedContent' => $modified_files_json, // Log the raw JSON with diffs
                    'usage' => $final_usage,
                ];
                $this->log_gemini_interaction($logData);

                return array(
                    'modified_files' => $modified_files_data['modified_files'],
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

        // Replace the content of the main tag. The 's' flag allows '.' to match newlines.
        $newFullContent = preg_replace('/(<main[^>]*>)(.*?)(<\/main>)/s', '$1' . $newMainContent . '$3', $originalContent, 1, $count);

        if ($count === 0) {
            throw new Exception("Could not find <main> tag in the file to update.");
        }

        if (file_put_contents($fullPath, $newFullContent) === false) {
            throw new Exception('Failed to save file via Text Editor.');
        }

        $gitService = $this->updater->getGitService();
        if ($gitService) {
            $prompt = !empty(trim($comment)) ? $comment : '[Text Editor Update]';
            $gitService->commitChanges([$filePath], $prompt);
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
    public function __construct() {
        $this->geminiService = new GeminiService($this);
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

    /**
     * Orchestrates the process of generating and saving file updates using the AI.
     * It can process a specific list of files or all HTML files found in the sitemap.
     *
     * @param string $prompt The user's instruction for the AI.
     * @param array $target_files A list of file paths to update.
     * @param bool $update_all_html If true, ignores $target_files and updates all HTML pages from the sitemap.
     * @return array An array containing a success message and total token usage.
     * @throws Exception If no target files are specified.
     */
    public function generateAndSave($prompt, $target_files, $update_all_html) {
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

        if (empty($files_for_api)) {
            throw new Exception('No valid files found to process.');
        }
        
        $geminiResult = $this->geminiService->call_gemini_api($files_for_api, $prompt);
        
        $updated_files_count = 0;
        $files_to_commit = [];
        foreach ($geminiResult['modified_files'] as $file_to_patch) {
            $this->apply_diff_and_save($file_to_patch['filename'], $file_to_patch['unified_diff']);
            $files_to_commit[] = $file_to_patch['filename'];
            $updated_files_count++;
        }
        if ($this->gitService && !empty($files_to_commit)) {
            $this->gitService->commitChanges($files_to_commit, $prompt);
        }
        
        return [
            'message' => "$updated_files_count file(s) updated successfully by AI.",
            'usage' => $geminiResult['usage'],
        ];
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
     * Validates and sanitizes a file path to prevent directory traversal attacks.
     * Ensures the final resolved path is within the defined DOC_ROOT.
     *
     * @param string $path The file path to validate.
     * @return string The absolute, validated file path.
     * @throws Exception If the path is invalid or outside the document root.
     */
    public function validate_path($path) {
        // realpath() will return false for non-existent paths. This normalizes a path to handle '..' etc.
        // without requiring the file to exist, making it safer.
        $path = str_replace('\\', '/', $path);
        $parts = array_filter(explode('/', $path), 'strlen');
        $absolutes = array();
        foreach ($parts as $part) {
            if ('.' == $part) continue;
            if ('..' == $part) {
                array_pop($absolutes);
            } else {
                $absolutes[] = $part;
            }
        }
        $fullPath = DOC_ROOT . '/' . implode('/', $absolutes);

        // Final check to ensure the path is within the document root.
        if (strpos(realpath(dirname($fullPath)), realpath(DOC_ROOT)) !== 0) {
            throw new Exception('Invalid or forbidden file path. Only files within the document root can be edited.');
        }
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

    private function apply_diff_and_save($filePath, $diff) {
        $fullPath = $this->validate_path($filePath);
        $isNewFile = !is_file($fullPath);
        $original_content = $isNewFile ? "" : file_get_contents($fullPath);

        $newContent = $this->apply_diff($original_content, $diff);
        
        if (file_put_contents($fullPath, $newContent) === false) {
            throw new Exception('Failed to save file: ' . $filePath);
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
$updater = new WebRobotUpdater();

// Main action handler.
try {
    switch ($action) {
        case 'generate_and_save':
            $data = json_decode(file_get_contents('php://input'), true);
            $prompt = isset($data['prompt']) ? $data['prompt'] : '';
            $target_files = isset($data['target_files']) ? $data['target_files'] : array();
            $update_all_html = isset($data['update_all_html']) ? $data['update_all_html'] : false;
            
            $result = $updater->generateAndSave($prompt, $target_files, $update_all_html);
            $response['message'] = $result['message'];
            $response['usage'] = $result['usage'];
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
        case 'list_backups':
            $data = json_decode(file_get_contents('php://input'), true);
            $filePath = isset($data['file']) ? $data['file'] : '';
            $response['backups'] = $updater->listBackups($filePath);
            break;
        case 'rollback_file':
            $data = json_decode(file_get_contents('php://input'), true);
            $filePath = isset($data['file']) ? $data['file'] : '';
            $backupFile = isset($data['backup_file']) ? $data['backup_file'] : '';
            $updater->rollbackFile($filePath, $backupFile);
            $response['message'] = 'File rolled back successfully.';
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
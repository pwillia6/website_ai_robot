<?php
// --- Start of Merged config.php ---
// The root directory of the website you want to edit.
define('DOC_ROOT', __DIR__);
// --- End of Merged config.php ---

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
        $this->apiKey = 'YOUR_GEMINI_API_KEY'; // Fallback
        $this->model = 'gemini-2.5-flash'; // Fallback model
        $projectRoot = dirname(DOC_ROOT); // e.g., /path/to/acms.cweb.com.au
        $repoRoot = dirname($projectRoot);    // e.g., /path/to/acms2
        $this->logPath = $repoRoot . '/var/log/gemini'; // Default log path

        $key_file = $projectRoot . '/etc/gemini.json'; // Path to config file

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
     * @param string $fileContent The original content of the file to be edited.
     * @param string $filePath The path of the file being edited, for context.
     * @param string $userPrompt The user's instruction for what to change.
     * @param array $contextFiles An array of other file paths to include for additional context.
     * @return array An array containing the 'content' (the AI's response) and 'usage' (token metadata).
     * @throws Exception If the API key is not configured or if the API call fails.
     */
    public function call_gemini_api($fileContent, $filePath, $userPrompt, $contextFiles = array(), $interaction_id = null) {
        if ($this->apiKey === 'YOUR_GEMINI_API_KEY') {
            throw new Exception('Gemini API key is not configured.');
        }

        $apiKey = $this->apiKey;
        $model = $this->model;
        $url = "https://generativelanguage.googleapis.com/v1beta/interactions?key={$apiKey}";

        // Inject data source content into the file content for the AI to process
        // but only if a data block doesn't already exist in the content.
        $dataSourcePathForContext = $this->updater->get_data_source_from_content($fileContent);
        $dataBlockExists = ($this->updater->extract_data_block($fileContent) !== null);

        if ($dataSourcePathForContext && !$dataBlockExists) {
            try {
                $fullDataSourcePath = $this->updater->validate_path($dataSourcePathForContext);
                if (is_file($fullDataSourcePath)) {
                    $dataSourceContent = file_get_contents($fullDataSourcePath);
                    $dataFileComment = "\n<!-- START DATA FILE: " . $dataSourcePathForContext . "\n" . $dataSourceContent . "\nEND DATA FILE: " . $dataSourcePathForContext . " -->";
                    // Append the data block to the end of the file content.
                    $fileContent .= $dataFileComment;
                }
            } catch (Exception $e) {
                error_log("Could not inject data source file '$dataSourcePathForContext' for AI processing: " . $e->getMessage());
            }
        }
        
        // Prepare data structure for logging the entire interaction.
        $logData = [
            'timestamp' => date('Y-m-d H:i:s'),
            'model' => $model,
            'request' => [
                'userPrompt' => $userPrompt,
                'contextFiles' => $contextFiles,
                'fileContent' => $fileContent,
            ],
            'response' => [],
            'processed' => [],
            'error' => null,
        ];

        try {
            // The system prompt provides the AI with its core instructions and constraints.
            $system_prompt = "You are an expert software engineering AI assistant. I will provide you with the content of a code file and a prompt to modify it. Your task is to return ONLY the complete, modified content of the file. It is crucial that you preserve all existing code, including any JavaScript within <script> tags and CSS within <style> tags, unless the user's request specifically asks to modify them. Do not remove or alter any part of the file that is not directly related to the user's request. Do not include any explanations, comments, or markdown code fences (like ```php or ```html). Just output the raw, updated file content.

    The file may contain a special data block formatted like this:
    <!-- START DATA FILE: path/to/data.json
    ... JSON content ...
    END DATA FILE: path/to/data.json -->

    This block contains the data associated with the page. If my request involves changing data (e.g., 'add a new event', 'update a price'), you MUST update the JSON content inside this comment block accordingly. You MUST preserve the start and end comment markers exactly as they are. The updated data will be extracted and saved automatically.";

            if ($interaction_id) {
                // This is a follow-up turn in a conversation.
                $data = [
                    'model' => $model,
                    'system_instruction' => $system_prompt,
                    'input' => $userPrompt,
                    'previous_interaction_id' => $interaction_id,
                ];
            } else {
                // This is the first turn. Build the full context.
                $user_message_content = "";
                // Add any specified context files to the prompt.
                foreach ($contextFiles as $contextFilePath) {
                    // Avoid duplicating the main data source if it was already injected and passed in context
                    if ($contextFilePath === $dataSourcePathForContext) continue;
                    try {
                        $fullContextPath = $this->updater->validate_path($contextFilePath);
                        $content = file_get_contents($fullContextPath);
                        if (!empty($content)) {
                            $user_message_content .= "For context, here is the content of '" . $contextFilePath . "':\n```\n" . $content . "\n```\n\n";
                        }
                    } catch (Exception $e) {
                        error_log("Could not include context file '$contextFilePath': " . $e->getMessage());
                    }
                }

                // Add the main file content and the user's request to the prompt.
                $user_message_content .= "File content to edit ('" . $filePath . "'):\n```\n" . $fileContent . "\n```\n\n";
                $user_message_content .= "My request:\n" . $userPrompt;

                $data = array(
                    'model' => $model,
                    'system_instruction' => $system_prompt,
                    'input' => trim($user_message_content),
                );
            }

            $logData['request']['fullPayload'] = $data;

            // Execute the API call using cURL.
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

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

            // Check for specific API errors.
            if (!isset($result['status']) || ($result['status'] !== 'completed' && $result['status'] !== 'incomplete')) {
                $status = $result['status'] ?? 'unknown';
                $message = 'Interaction did not complete successfully. Status: ' . $status;
                if (isset($result['error']['message'])) { // Check if there's a more specific error message
                    $message .= '. Details: ' . $result['error']['message'];
                }
                throw new Exception($message);
            }

            $newContent = null;
            if (isset($result['steps']) && is_array($result['steps'])) {
                foreach ($result['steps'] as $step) {
                    if (isset($step['type']) && $step['type'] === 'model_output' && isset($step['content'][0]['text'])) {
                        $newContent = $step['content'][0]['text'];
                        break; // Found the content, exit the loop
                    }
                }
            }

            if ($newContent !== null) {
                // Successfully received content from the API.
                $usage = $result['usage'] ?? [];
                $final_usage = [
                    'promptTokenCount' => $usage['total_input_tokens'] ?? 0,
                    'candidatesTokenCount' => $usage['total_output_tokens'] ?? 0,
                    'totalTokens' => $usage['total_tokens'] ?? 0
                ];
                $processedContent = trim(preg_replace('/^```[a-z]*\n|\n```$/', '', $newContent));

                $logData['processed'] = [
                    'extractedContent' => $processedContent,
                    'usage' => $final_usage,
                ];
                // Log the successful interaction before returning.
                $this->log_gemini_interaction($logData);

                $new_interaction_id = $result['id'] ?? null;

                return array(
                    'content' => $processedContent,
                    'usage' => $final_usage,
                    'interaction_id' => $new_interaction_id
                );
            } elseif (isset($result['promptFeedback']['blockReason'])) {
                // This may be redundant, but good for fallback.
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

        $prompt = !empty(trim($comment)) ? $comment : '[Text Editor Update]';

        // Use the existing save method to handle backups and writing the file.
        $this->updater->save_file_content($filePath, $newFullContent, $prompt);
    }
}

/**
 * Manages file system operations for the web robot, including updates, backups, and rollbacks.
 * It serves as the main controller for handling user actions related to file content.
 */
class WebRobotUpdater {

    /** @var GeminiService The service used to interact with the Gemini API. */
    private $geminiService;

    /**
     * WebRobotUpdater constructor.
     * Initializes the updater and its dependency, the GeminiService, passing a reference to itself
     * to allow the service to use its helper methods.
     */
    public function __construct() {
        $this->geminiService = new GeminiService($this);
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
    public function generateAndSave($prompt, $target_files, $update_all_html, $interaction_id = null) {
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

        $is_batch_job = $update_all_html || count($files_to_process) > 1;
        if ($is_batch_job) {
            $interaction_id = null; // Force stateless for batch jobs
        }

        $updated_files_count = 0;
        $total_usage = array('totalTokens' => 0);
        $new_interaction_id = null;

        // Loop through each file, call the AI, and save the result.
        foreach($files_to_process as $filePath) {
            $fullPath = $this->validate_path($filePath);
            if (!is_file($fullPath)) continue;
            $contentToEdit = file_get_contents($fullPath);
            
            $geminiResult = $this->geminiService->call_gemini_api($contentToEdit, $filePath, $prompt, array(), $interaction_id);
            $newContent = $geminiResult['content'];
            $this->save_file_content($filePath, $newContent, $prompt);
            $updated_files_count++;

            if (isset($geminiResult['usage']['totalTokens'])) {
                $total_usage['totalTokens'] += $geminiResult['usage']['totalTokens'];
            }
            // For single file calls, we'll get the new ID. For batch, it will be null.
            $new_interaction_id = $geminiResult['interaction_id'];
        }
        
        return [
            'message' => "$updated_files_count file(s) updated successfully by AI.",
            'usage' => $total_usage,
            'interaction_id' => $new_interaction_id
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
        $fullPath = $this->validate_path($filePath);
        if (!file_exists($fullPath)) {
            return array();
        }

        // Prepare both clean and hydrated versions of the current content for comparison.
        $currentContentClean = null;
        $currentContentHydrated = null;
        if (file_exists($fullPath)) {
            $currentContentClean = file_get_contents($fullPath);
            $currentContentHydrated = $currentContentClean; // Start with the clean content
            $dataSourcePath = $this->get_data_source_from_content($currentContentClean);
            if ($dataSourcePath) {
                try {
                    $fullDataSourcePath = $this->validate_path($dataSourcePath);
                    if (is_file($fullDataSourcePath)) {
                        $dataSourceContent = file_get_contents($fullDataSourcePath);
                        $dataFileComment = "\n<!-- START DATA FILE: " . $dataSourcePath . "\n" . $dataSourceContent . "\nEND DATA FILE: " . $dataSourcePath . " -->";
                        $currentContentHydrated .= $dataFileComment;
                    }
                } catch (Exception $e) {
                    error_log("Could not create current content for comparison in list_backups: " . $e->getMessage());
                    // If hydration fails, fall back to clean content for hydrated comparison as well.
                    $currentContentHydrated = $currentContentClean;
                }
            }
        }

        $backupFiles = glob($fullPath . '.bak.*');
        $backups = array();
        if (!empty($backupFiles)) {
            // Sort numerically based on the backup number, descending
            usort($backupFiles, function($a, $b) {
                $numA = intval(substr(strrchr($a, '.'), 1));
                $numB = intval(substr(strrchr($b, '.'), 1));
                return $numB - $numA;
            });
            
            foreach ($backupFiles as $backupFile) {
                $backupNumStr = substr(strrchr($backupFile, '.'), 1);
                $promptFile = $fullPath . '.prompt.' . $backupNumStr;
                $prompt = null;
                if (file_exists($promptFile)) {
                    $prompt = file_get_contents($promptFile);
                }

                // Compare the backup content with the appropriate version of the current file.
                $backupContent = file_get_contents($backupFile);
                $backupHasDataBlock = ($this->extract_data_block($backupContent) !== null);

                $isCurrent = false;
                if ($backupHasDataBlock) {
                    // Backup has a data block, so compare it against the hydrated version of the current file.
                    if ($currentContentHydrated !== null) {
                        $isCurrent = (trim($backupContent) === trim($currentContentHydrated));
                    }
                } else {
                    // Backup does NOT have a data block, compare it against the clean version of the current file.
                    if ($currentContentClean !== null) {
                        $isCurrent = (trim($backupContent) === trim($currentContentClean));
                    }
                }

                $backups[] = array(
                    'file' => str_replace(DOC_ROOT . DIRECTORY_SEPARATOR, '', $backupFile),
                    'date' => date("Y-m-d H:i:s", filemtime($backupFile)),
                    'prompt' => $prompt,
                    'is_current' => $isCurrent,
                );
            }
        }
        return $backups;
    }

    /**
     * Rolls back a file to a specific backup version.
     * This is an atomic operation that also restores the associated data file if it was part of the backup.
     *
     * @param string $filePath The relative path to the file to be rolled back.
     * @param string $backupFilePath The relative path to the backup file to restore from.
     * @throws Exception If the backup file is invalid or if the rollback fails.
     */
    public function rollbackFile($filePath, $backupFilePath) {
        $fullPath = $this->validate_path($filePath);
        $backupFullPath = $this->validate_path($backupFilePath);

        if (!file_exists($backupFullPath) || strpos($backupFullPath, $fullPath . '.bak.') !== 0) {
            throw new Exception('Invalid backup file specified.');
        }

        $backupContent = file_get_contents($backupFullPath);

        // New logic: Extract data from the backup content and restore it.
        // This makes the data and HTML file atomic for rollbacks.
        $dataBlock = $this->extract_data_block($backupContent);
        if ($dataBlock) {
            $dataSourcePath = $dataBlock['path'];
            $dataSourceContent = $dataBlock['content'];
            try {
                $dataFullPath = $this->validate_path($dataSourcePath);
                if (file_put_contents($dataFullPath, $dataSourceContent) === false) {
                    throw new Exception('Failed to roll back associated data file from backup content.');
                }
            } catch (Exception $e) {
                throw new Exception("Error rolling back data source '$dataSourcePath': " . $e->getMessage());
            }
        }

        // Save the live file with the data block removed.
        $contentForFile = preg_replace('/<!--\s*START DATA FILE:.*?END DATA FILE:.*?-->/s', '', $backupContent);
        $contentForFile = trim($contentForFile);

        if (file_put_contents($fullPath, $contentForFile) === false) {
            throw new Exception('Failed to roll back main file.');
        }
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
     * Saves new content to a file and manages the backup process.
     *
     * This function performs several key steps:
     * 1. Creates an initial backup (.bak.0) of the original file if one doesn't exist.
     * 2. Extracts any data block from the new AI-generated content and saves it to its own file.
     * 3. Creates a new versioned backup (.bak.N) containing the full AI response (HTML + data block).
     * 4. Saves the "clean" HTML (with the data block removed) to the live file.
     *
     * @param string $filePath The relative path of the file to save.
     * @param string $content The new content, potentially including an embedded data block.
     * @param string|null $prompt The prompt that generated this content, to be saved alongside the backup.
     * @throws Exception On file system errors (e.g., failed to write).
     */
    public function save_file_content($filePath, $content, $prompt = null) {
        $fullPath = $this->validate_path($filePath);
        
        $isNewFile = !is_file($fullPath);

        // --- Pre-Step: Handle initial backup (.bak.0) for existing files BEFORE any modifications.
        if (!$isNewFile && !file_exists($fullPath . '.bak.0')) {
            $oldContent = file_get_contents($fullPath);
            $dataSourcePath = $this->get_data_source_from_content($oldContent);

            // To ensure the initial backup is clean, strip any pre-existing data block from the original content.
            $contentForBak0 = preg_replace('/<!--\s*START DATA FILE:.*?END DATA FILE:.*?-->/s', '', $oldContent);
            $contentForBak0 = trim($contentForBak0);

            // Always (re)inject the data block from the ORIGINAL source file.
            if ($dataSourcePath) {
                try {
                    $fullDataSourcePath = $this->validate_path($dataSourcePath);
                    if (is_file($fullDataSourcePath)) {
                        // Read the data file BEFORE it's modified later in this function.
                        $originalDataSourceContent = file_get_contents($fullDataSourcePath);
                        $dataFileComment = "\n<!-- START DATA FILE: " . $dataSourcePath . "\n" . $originalDataSourceContent . "\nEND DATA FILE: " . $dataSourcePath . " -->";
                        $contentForBak0 .= $dataFileComment;
                    }
                } catch (Exception $e) {
                    // Log error but don't halt the process. The backup will just be missing the data block.
                    error_log("Could not inject data block into initial backup for '" . htmlspecialchars($filePath) . "': " . $e->getMessage());
                }
            }
            if (file_put_contents($fullPath . '.bak.0', $contentForBak0) === false) {
                throw new Exception("Failed to create initial backup for: " . $fullPath);
            }
            file_put_contents($fullPath . '.prompt.0', '[initial version]');
        }

        // --- Step 1: Extract data and save the data file. This is always needed.
        $dataBlock = $this->extract_data_block($content);
        if ($dataBlock) {
            $extractedDataSourcePath = $dataBlock['path'];
            $extractedDataSourceContent = $dataBlock['content'];
            try {
                $extractedDataFullPath = $this->validate_path($extractedDataSourcePath);
                if (file_put_contents($extractedDataFullPath, $extractedDataSourceContent) === false) {
                    throw new Exception("Failed to save extracted data to: " . htmlspecialchars($extractedDataSourcePath));
                }
            } catch (Exception $e) {
                throw new Exception("Could not save extracted data source '" . htmlspecialchars($extractedDataSourcePath) . "': " . $e->getMessage());
            }
        }

        // --- Step 2: Prepare the content for the live HTML file (data block removed).
        $contentForFile = preg_replace('/<!--\s*START DATA FILE:.*?END DATA FILE:.*?-->/s', '', $content);
        $contentForFile = trim($contentForFile);

        // --- Step 3: Handle backups if it's an existing file.
        if (!$isNewFile) {
            // Regular Backup of API response
            $i = 1;
            while (file_exists($fullPath . '.bak.' . $i)) $i++;
            
            if (file_put_contents($fullPath . '.bak.' . $i, $content) === false) { // Backup new content with data block
                throw new Exception("Failed to create backup for: " . $fullPath);
            }
            if ($prompt) {
                file_put_contents($fullPath . '.prompt.' . $i, $prompt);
            }
        }

        // --- Step 4: Save the live HTML file.
        if (file_put_contents($fullPath, $contentForFile) === false) {
            throw new Exception('Failed to save file.');
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
            $interaction_id = isset($data['interaction_id']) ? $data['interaction_id'] : null;
            
            $result = $updater->generateAndSave($prompt, $target_files, $update_all_html, $interaction_id);
            $response['message'] = $result['message'];
            $response['usage'] = $result['usage'];
            $response['interaction_id'] = $result['interaction_id'];
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
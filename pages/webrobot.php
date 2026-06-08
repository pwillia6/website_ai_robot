<?php
// --- Start of Merged config.php ---
// The root directory of the website you want to edit.
define('DOC_ROOT', __DIR__);

// IMPORTANT: Store your API key securely. Do not commit this file to a public repository.
// You can get an API key from Google AI Studio: https://aistudio.google.com/app/apikey
$apiKey = 'YOUR_GEMINI_API_KEY'; // Fallback
$model = 'gemini-2.5-flash'; // Fallback model
$projectRoot = dirname(DOC_ROOT); // e.g., /path/to/acms.cweb.com.au
$repoRoot = dirname($projectRoot);    // e.g., /path/to/acms2
$logPath = $repoRoot . '/var/log/gemini'; // Default log path

$key_file = $projectRoot . '/etc/gemini.json'; // Path to config file

if (file_exists($key_file)) {
    $json_content = file_get_contents($key_file);
    $key_data = json_decode($json_content, true);
    if (!empty($key_data['key'])) {
        $apiKey = $key_data['key'];
    }
    if (!empty($key_data['model'])) {
        $model = $key_data['model'];
    }
    if (isset($key_data['log_path'])) {
        if (empty($key_data['log_path'])) {
            $logPath = ''; // Disable logging by setting path to empty
        } else {
            // The path in the config is the absolute path.
            $logPath = $key_data['log_path'];
        }
    }
}
define('GEMINI_API_KEY', $apiKey);
define('GEMINI_MODEL', $model);
define('GEMINI_LOG_PATH', $logPath);
// --- End of Merged config.php ---


// Basic security: Restrict to POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array('error' => 'Method Not Allowed'));
    exit;
}

header('Content-Type: application/json');

$action = isset($_GET['action']) ? $_GET['action'] : '';
$response = array();

try {
    switch ($action) {
        case 'generate_and_save':
            $data = json_decode(file_get_contents('php://input'), true);
            $prompt = isset($data['prompt']) ? $data['prompt'] : '';
            $target_files = isset($data['target_files']) ? $data['target_files'] : array();
            $update_all_html = isset($data['update_all_html']) ? $data['update_all_html'] : false;

            $files_to_process = array();

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

            $updated_files_count = 0;
            $total_usage = array('totalTokens' => 0);

            foreach($files_to_process as $filePath) {
                $fullPath = validate_path($filePath);
                if (!is_file($fullPath)) continue;
                $contentToEdit = file_get_contents($fullPath);
                // Pass the filePath to the API call for context
                $geminiResult = call_gemini_api($contentToEdit, $filePath, $prompt);
                $newContent = $geminiResult['content'];
                save_file_content($filePath, $newContent, $prompt);
                $updated_files_count++;

                if (isset($geminiResult['usage']['totalTokens'])) {
                    $total_usage['totalTokens'] += $geminiResult['usage']['totalTokens'];
                }
            }
            
            $response['message'] = "$updated_files_count file(s) updated successfully by AI.";
            $response['usage'] = $total_usage;
            break;
        case 'list_backups':
            $data = json_decode(file_get_contents('php://input'), true);
            $filePath = isset($data['file']) ? $data['file'] : '';
            $response['backups'] = list_backups($filePath);
            break;
        case 'rollback_file':
            $data = json_decode(file_get_contents('php://input'), true);
            $filePath = isset($data['file']) ? $data['file'] : '';
            $backupFile = isset($data['backup_file']) ? $data['backup_file'] : '';
            rollback_file($filePath, $backupFile);
            $response['message'] = 'File rolled back successfully.';
            break;
        default:
            http_response_code(400);
            $response['error'] = 'Invalid action.';
    }
} catch (Exception $e) {
    http_response_code(500);
    $response['error'] = $e->getMessage();
}

echo json_encode($response);

// --- Helper Functions ---

function validate_path($path) {
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

function get_data_source_from_content($htmlContent) {
    if (preg_match('/<meta\s+name="data-source"\s+content="([^"]+)"/i', $htmlContent, $matches)) {
        return $matches[1];
    }
    return null;
}

/**
 * Extracts an embedded data file block from content.
 *
 * @param string $content The content to search within.
 * @return array|null An array with 'path' and 'content' keys if found, otherwise null.
 */
function extract_data_block($content) {
    if (preg_match('/<!--\s*START DATA FILE:\s*([^\s>]+)(.*?)END DATA FILE:\s*\1\s*-->/s', $content, $matches)) {
        return [
            'path' => trim($matches[1]),
            'content' => trim($matches[2])
        ];
    }
    return null;
}

function save_file_content($filePath, $content, $prompt = null) {
    $fullPath = validate_path($filePath);
    
    $isNewFile = !is_file($fullPath);

    // --- Pre-Step: Handle initial backup (.bak.0) for existing files BEFORE any modifications.
    if (!$isNewFile && !file_exists($fullPath . '.bak.0')) {
        $oldContent = file_get_contents($fullPath);
        $dataSourcePath = get_data_source_from_content($oldContent);

        // To ensure the initial backup is clean, strip any pre-existing data block from the original content.
        $contentForBak0 = preg_replace('/<!--\s*START DATA FILE:.*?END DATA FILE:.*?-->/s', '', $oldContent);
        $contentForBak0 = trim($contentForBak0);

        // Always (re)inject the data block from the ORIGINAL source file.
        if ($dataSourcePath) {
            try {
                $fullDataSourcePath = validate_path($dataSourcePath);
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
    $dataBlock = extract_data_block($content);
    if ($dataBlock) {
        $extractedDataSourcePath = $dataBlock['path'];
        $extractedDataSourceContent = $dataBlock['content'];
        try {
            $extractedDataFullPath = validate_path($extractedDataSourcePath);
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

function list_backups($filePath) {
    $fullPath = validate_path($filePath);
    if (!file_exists($fullPath)) {
        return array();
    }

    // Prepare the "current" content with its data block for comparison.
    $currentContentForComparison = null;
    if (file_exists($fullPath)) {
        $currentContentClean = file_get_contents($fullPath);
        $currentContentForComparison = $currentContentClean; // Start with the clean content
        $dataSourcePath = get_data_source_from_content($currentContentClean);
        if ($dataSourcePath) {
            try {
                $fullDataSourcePath = validate_path($dataSourcePath);
                if (is_file($fullDataSourcePath)) {
                    $dataSourceContent = file_get_contents($fullDataSourcePath);
                    $dataFileComment = "\n<!-- START DATA FILE: " . $dataSourcePath . "\n" . $dataSourceContent . "\nEND DATA FILE: " . $dataSourcePath . " -->";
                    $currentContentForComparison .= $dataFileComment;
                }
            } catch (Exception $e) {
                error_log("Could not create current content for comparison in list_backups: " . $e->getMessage());
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

            // Compare the full backup content with the hydrated current content.
            $backupContent = file_get_contents($backupFile);
            $isCurrent = ($currentContentForComparison !== null && trim($backupContent) === trim($currentContentForComparison));

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

function rollback_file($filePath, $backupFilePath) {
    $fullPath = validate_path($filePath);
    $backupFullPath = validate_path($backupFilePath);

    if (!file_exists($backupFullPath) || strpos($backupFullPath, $fullPath . '.bak.') !== 0) {
        throw new Exception('Invalid backup file specified.');
    }

    $backupContent = file_get_contents($backupFullPath);

    // New logic: Extract data from the backup content and restore it.
    // This makes the data and HTML file atomic for rollbacks.
    $dataBlock = extract_data_block($backupContent);
    if ($dataBlock) {
        $dataSourcePath = $dataBlock['path'];
        $dataSourceContent = $dataBlock['content'];
        try {
            $dataFullPath = validate_path($dataSourcePath);
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

function log_gemini_interaction($logData) {
    try {
        // Go up one level from /pages to the project root, then into /var/log
        $logDir = GEMINI_LOG_PATH;
        if (empty($logDir) || !is_dir($logDir)) {
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

function call_gemini_api($fileContent, $filePath, $userPrompt, $contextFiles = array()) {
    if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
        throw new Exception('Gemini API key is not configured.');
    }

    $apiKey = GEMINI_API_KEY;
    $model = GEMINI_MODEL;
    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

    // Inject data source content into the file content for the AI to process
    // but only if a data block doesn't already exist in the content.
    $dataSourcePathForContext = get_data_source_from_content($fileContent);
    $dataBlockExists = (extract_data_block($fileContent) !== null);

    if ($dataSourcePathForContext && !$dataBlockExists) {
        try {
            $fullDataSourcePath = validate_path($dataSourcePathForContext);
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
        $system_prompt = "You are an expert software engineering AI assistant. I will provide you with the content of a code file and a prompt to modify it. Your task is to return ONLY the complete, modified content of the file. It is crucial that you preserve all existing code, including any JavaScript within <script> tags and CSS within <style> tags, unless the user's request specifically asks to modify them. Do not remove or alter any part of the file that is not directly related to the user's request. Do not include any explanations, comments, or markdown code fences (like ```php or ```html). Just output the raw, updated file content.

The file may contain a special data block formatted like this:
<!-- START DATA FILE: path/to/data.json
... JSON content ...
END DATA FILE: path/to/data.json -->

This block contains the data associated with the page. If my request involves changing data (e.g., 'add a new event', 'update a price'), you MUST update the JSON content inside this comment block accordingly. You MUST preserve the start and end comment markers exactly as they are. The updated data will be extracted and saved automatically.";

        $promptParts = array(
            array('text' => $system_prompt)
        );

        foreach ($contextFiles as $contextFilePath) {
            // Avoid duplicating the main data source if it was already injected and passed in context
            if ($contextFilePath === $dataSourcePathForContext) continue;
            try {
                $fullContextPath = validate_path($contextFilePath);
                $content = file_get_contents($fullContextPath);
                if (!empty($content)) {
                    $promptParts[] = array('text' => "For context, here is the content of '" . $contextFilePath . "':\n```\n" . $content . "\n```");
                }
            } catch (Exception $e) {
                error_log("Could not include context file '$contextFilePath': " . $e->getMessage());
            }
        }

        $promptParts[] = array('text' => "File content to edit ('" . $filePath . "'):\n```\n" . $fileContent . "\n```");
        $promptParts[] = array('text' => "My request:\n" . $userPrompt);

        $data = array(
            'contents' => array(array('parts' => $promptParts)),
            'generationConfig' => array('temperature' => 0.2, 'maxOutputTokens' => 81920),
            'safetySettings' => array(
                array('category' => 'HARM_CATEGORY_HARASSMENT', 'threshold' => 'BLOCK_NONE'),
                array('category' => 'HARM_CATEGORY_HATE_SPEECH', 'threshold' => 'BLOCK_NONE'),
                array('category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'threshold' => 'BLOCK_NONE'),
                array('category' => 'HARM_CATEGORY_DANGEROUS_CONTENT', 'threshold' => 'BLOCK_NONE'),
            )
        );
        $logData['request']['fullPayload'] = $data;

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

        if (isset($result['candidates'][0]['finishReason']) && $result['candidates'][0]['finishReason'] === 'MAX_TOKENS') {
            throw new Exception('The AI response was truncated because the file is too large to be fully rewritten. The edit was not saved. Please try a smaller file or a more focused prompt.');
        }

        if (isset($result['candidates'][0]['content']['parts'][0]['text'])) {
            $newContent = $result['candidates'][0]['content']['parts'][0]['text'];
            $usage = isset($result['usageMetadata']) ? $result['usageMetadata'] : array();
            $processedContent = trim(preg_replace('/^```[a-z]*\n|\n```$/', '', $newContent));

            $logData['processed'] = [
                'extractedContent' => $processedContent,
                'usage' => $usage,
            ];
            
            log_gemini_interaction($logData);

            return array(
                'content' => $processedContent,
                'usage' => $usage
            );
        } elseif (isset($result['promptFeedback']['blockReason'])) {
            throw new Exception('API request was blocked. Reason: ' . $result['promptFeedback']['blockReason']);
        } else {
            throw new Exception('Unexpected API response format: ' . $apiResponse);
        }
    } catch (Exception $e) {
        $logData['error'] = $e->getMessage();
        log_gemini_interaction($logData);
        throw $e;
    }
}

?>
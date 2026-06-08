<?php

header('Content-Type: application/json');

// --- Data Source ---
// In a real application, this would come from a database.
// For this simulation, we'll read from a JSON file.
// We'll assume the library-data.json has been updated to include an 'instruments' array of IDs.
$dataFile = __DIR__ . '/data/library-data.json';

if (!file_exists($dataFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'Data source not found.']);
    exit;
}

$catalog = json_decode(file_get_contents($dataFile), true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(500);
    echo json_encode(['error' => 'Error parsing data source.']);
    exit;
}

// --- Get Search Parameters ---
$keyword = isset($_GET['keyword']) ? strtolower(trim($_GET['keyword'])) : '';
$selectedInstruments = isset($_GET['instruments']) && is_array($_GET['instruments']) ? $_GET['instruments'] : [];

// --- Filter Logic ---
$results = array_filter($catalog, function($item) use ($keyword, $selectedInstruments) {
    // Keyword search
    $keywordMatch = true;
    if (!empty($keyword)) {
        $keywordMatch = (
            stripos($item['composer'], $keyword) !== false ||
            stripos($item['title'], $keyword) !== false ||
            (isset($item['key']) && stripos($item['key'], $keyword) !== false)
        );
    }

    // Instrument search: Check if all selected instruments are present in the item's instrument list
    $instrumentMatch = empty($selectedInstruments) || (isset($item['instruments']) && is_array($item['instruments']) && empty(array_diff($selectedInstruments, $item['instruments'])));

    return $keywordMatch && $instrumentMatch;
});

// Re-index the array to ensure it's a JSON array, not an object
echo json_encode(array_values($results));
#!/bin/bash
#
# This script tests the webrobot.php endpoint by sending a prompt
# from the command line to modify a specific file (sample.html).
#
# Usage: ./scripts/test_change.sh "Your prompt for the AI"
#
# Example:
# ./scripts/test_change.sh "Change the main heading to 'My Test Page' and add a new paragraph."

set -euo pipefail

# --- Configuration ---
# The base URL of your local development server.
# This should point to the directory containing the 'pages' folder.
# IMPORTANT: Update this to match your local environment.
# For example: "http://localhost:8000" or "http://acms.cweb.com.au.test"
SERVER_URL="http://acms.cweb.com.au.test"

# The target file for the edit.
TARGET_FILE="sample.html"

# --- Script Logic ---

# 1. Check for prompt argument
if [ -z "${1-}" ]; then
    echo "Error: No prompt provided."
    echo "Usage: $0 \"Your prompt for the AI\""
    exit 1
fi
PROMPT="$1"

# 2. Define the endpoint URL
ENDPOINT_URL="${SERVER_URL}/pages/webrobot.php?action=generate_and_save"

echo "Target File: ${TARGET_FILE}"
echo "Prompt:      \"${PROMPT}\""
echo "Endpoint:    ${ENDPOINT_URL}"
echo "--------------------------------------------------"

# 3. Construct the JSON payload using jq for safety
JSON_PAYLOAD=$(jq -n \
                  --arg prompt "$PROMPT" \
                  --arg target_file "$TARGET_FILE" \
                  '{"prompt": $prompt, "target_files": [$target_file], "update_all_html": false}')

# 4. Make the API call using curl and pretty-print the JSON response
echo "Sending request to webrobot.php..."
curl -s -X POST \
     -H "Content-Type: application/json" \
     -d "$JSON_PAYLOAD" \
     "$ENDPOINT_URL" | jq .

echo "--------------------------------------------------"
echo "Test script finished."
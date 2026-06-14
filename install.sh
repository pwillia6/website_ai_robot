#!/bin/bash
set -euo pipefail

# --- Configuration & Setup ---
# Get the directory where the script is located to reliably find template files.
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd "$SCRIPT_DIR"

echo "Starting website configuration..."
echo "This script will create configuration files from .template files."
echo

# --- Dependency Check ---
for cmd in find grep sort uniq sed curl jq; do
    if ! command -v $cmd &> /dev/null; then
        echo "Error: Required command '$cmd' is not installed. Please install it and try again." >&2
        exit 1
    fi
done

# --- Variable Discovery ---
# Find all template files in the etc/ directory.
TEMPLATE_FILES=$(find ./etc -type f -name "*.template")
if [ -z "$TEMPLATE_FILES" ]; then
    echo "No .template files found in ./etc. Nothing to configure."
    exit 0
fi

# Find all unique variables in the format %VAR_NAME% from all template files.
VARIABLES=$(grep -o -h "%[A-Z_]*%" $TEMPLATE_FILES | sort -u)

# Associative array to hold user-provided values for each variable.
declare -A VAR_VALUES

# --- Helper Function for Prompts ---
# Converts a variable name (e.g., DOMAIN) into a more readable prompt.
function get_prompt_text() {
    case "$1" in
        DOMAIN) echo "Domain Name (e.g., acms.cweb.com.au)" ;;
        BASE_PATH) echo "Absolute base path for website files" ;;
        HTPASSWD_PATH) echo "Absolute path to .htpasswd file" ;;
        GEMINI_API_KEY) echo "Google Gemini API Key (get from https://aistudio.google.com/api-keys)" ;;
        GEMINI_MODEL) echo "Gemini Model to use (e.g., gemini-1.5-flash-latest)" ;;
        LOG_PATH) echo "Absolute path for WebRobot log directory" ;;
        *) echo "$1" ;; # Fallback to the variable name itself if not defined above.
    esac
}

# --- Pre-population of existing values ---
declare -A DEFAULT_VALUES
echo "Checking for existing configuration to pre-populate values..."
for TPL_FILE in $TEMPLATE_FILES; do
    OUTPUT_FILE=${TPL_FILE%.template}
    if [ -f "$OUTPUT_FILE" ]; then
        echo "  - Reading existing values from ${OUTPUT_FILE}"
        
        # Get variables for this specific template file
        VARS_IN_TPL=$(grep -o -h "%[A-Z_]*%" "$TPL_FILE" | sort -u)

        for VAR in $VARS_IN_TPL; do
            CLEAN_VAR_NAME=$(echo "$VAR" | tr -d '%')
            
            # Skip if we already have a value for this var from another file
            if [ -n "${DEFAULT_VALUES[$CLEAN_VAR_NAME]:-}" ]; then
                continue
            fi

            VALUE=""
            if [[ "$OUTPUT_FILE" == *.conf ]]; then
                # Handle Apache .conf files
                if [[ "$CLEAN_VAR_NAME" == "BASE_PATH" ]]; then
                    # Special case: The placeholder %BASE_PATH% is used to define the Apache variable BASE_DIR.
                    # We need to read the value from the 'Define BASE_DIR' line.
                    LINE=$(grep "^Define BASE_DIR" "$OUTPUT_FILE" || true)
                    VALUE=$(echo "$LINE" | awk '{print $3}')
                else
                    # Generic handling for other 'Define' variables where placeholder name matches the Apache variable name.
                    LINE=$(grep "^Define ${CLEAN_VAR_NAME}" "$OUTPUT_FILE" || true)
                    VALUE=$(echo "$LINE" | awk '{print $3}')
                fi
            elif [[ "$OUTPUT_FILE" == *.json ]]; then
                # Handle .json files by mapping variable name to JSON key
                JSON_KEY=""
                case "$CLEAN_VAR_NAME" in
                    GEMINI_API_KEY) JSON_KEY="key" ;;
                    GEMINI_MODEL) JSON_KEY="model" ;;
                    LOG_PATH) JSON_KEY="log_path" ;;
                esac
                
                if [ -n "$JSON_KEY" ]; then
                    VALUE=$(jq -r ".${JSON_KEY}" "$OUTPUT_FILE" || true)
                    if [[ "$VALUE" == "null" ]]; then VALUE=""; fi
                fi
            fi

            if [ -n "$VALUE" ]; then
                DEFAULT_VALUES[$CLEAN_VAR_NAME]=$VALUE
            fi
        done
    fi
done
echo

# --- User Input ---
echo "Please provide the following configuration values (press Enter to accept defaults):"
for VAR in $VARIABLES; do
    # Remove the '%' characters to get the clean variable name.
    CLEAN_VAR_NAME=$(echo "$VAR" | tr -d '%')
    PROMPT_TEXT=$(get_prompt_text "$CLEAN_VAR_NAME")
    
    # Get the default value, if it exists.
    DEFAULT_VAL="${DEFAULT_VALUES[$CLEAN_VAR_NAME]:-}"

    # Read user input for the variable.
    read -p "- ${PROMPT_TEXT}: " -e -i "$DEFAULT_VAL" USER_INPUT
    VAR_VALUES[$CLEAN_VAR_NAME]=$USER_INPUT
done
echo

# --- API Key Validation ---
if [[ -n "${VAR_VALUES[GEMINI_API_KEY]:-}" ]]; then
    while true; do
        echo "Testing Gemini API Key..."
        API_KEY_TO_TEST="${VAR_VALUES[GEMINI_API_KEY]}"
        MODEL_TO_TEST="${VAR_VALUES[GEMINI_MODEL]}"

        # The 'list models' endpoint can sometimes fail with valid keys due to specific permissions,
        # giving a misleading 401 error.
        # A more robust test is to use the 'countTokens' endpoint with the selected model.
        # This confirms the key is valid AND has access to the requested model.
        # We use -s for silent, -f to fail on server errors (like 4xx), and check the exit code.
        # We capture the response body and HTTP status code to provide detailed error feedback.
        RESPONSE_BODY=$(mktemp)
        # The countTokens endpoint returns 200 on success.
        # We use -o to write the body to a file, and -w to write the HTTP code to stdout.
        HTTP_CODE=$(curl -s -o "$RESPONSE_BODY" -w "%{http_code}" -X POST "https://generativelanguage.googleapis.com/v1beta/models/${MODEL_TO_TEST}:countTokens?key=${API_KEY_TO_TEST}" \
            -H "Content-Type: application/json" \
            -d '{"contents":[{"parts":[{"text":"validation"}]}]}')

        if [[ "$HTTP_CODE" -eq 200 ]]; then
            rm "$RESPONSE_BODY"
            echo "API Key validation successful."
            echo
            break
        else
            echo "Error: The provided Gemini API Key appears to be invalid or lacks access to the model '${MODEL_TO_TEST}'."
            echo "API Response (HTTP ${HTTP_CODE}):"
            # Try to pretty-print if jq is available, otherwise just cat.
            if command -v jq &> /dev/null; then
                jq . "$RESPONSE_BODY"
            else
                cat "$RESPONSE_BODY"
            fi
            rm "$RESPONSE_BODY"
            echo
            read -p "Would you like to (r)e-enter the key, (i)gnore the error, or (a)bort? [r/i/a]: " choice
            echo
            case "$choice" in
                r|R)
                    read -p "- Google Gemini API Key (get from https://aistudio.google.com/api-keys): " NEW_API_KEY
                    VAR_VALUES[GEMINI_API_KEY]=$NEW_API_KEY
                    ;;
                i|I)
                    echo "Warning: Continuing with a potentially invalid API key."
                    echo
                    break
                    ;;
                a|A|*)
                    echo "Aborting installation."
                    exit 1
                    ;;
            esac
        fi
    done
fi

# --- File Generation ---
for TPL_FILE in $TEMPLATE_FILES; do
    # Determine the output filename by removing the .template extension.
    OUTPUT_FILE=${TPL_FILE%.template}

    if [ -f "$OUTPUT_FILE" ]; then
        read -p "Warning: '${OUTPUT_FILE}' already exists. Overwrite? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Skipping ${OUTPUT_FILE}."
            continue
        fi
    fi

    echo "Creating ${OUTPUT_FILE}..."
    
    # Start with a copy of the template and perform replacements.
    TEMP_CONTENT=$(cat "$TPL_FILE")
    for VAR_NAME in "${!VAR_VALUES[@]}"; do
        ESCAPED_VALUE=$(echo "${VAR_VALUES[$VAR_NAME]}" | sed -e 's/[\/&]/\\&/g')
        TEMP_CONTENT=$(echo "$TEMP_CONTENT" | sed "s#%${VAR_NAME}%#${ESCAPED_VALUE}#g")
    done
    echo "$TEMP_CONTENT" > "$OUTPUT_FILE"
done

echo
echo "Configuration complete. Please review the generated files before deploying."
echo "Note: You may need to make this script executable by running: chmod +x install.sh"
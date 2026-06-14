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
for cmd in find grep sort uniq sed; do
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
        BASE_PATH) echo "Absolute base path for website files (e.g., /home/www)" ;;
        HTPASSWD_PATH) echo "Absolute path to .htpasswd file (e.g., /home/ec2-user/etc/htpasswd)" ;;
        GEMINI_API_KEY) echo "Google Gemini API Key" ;;
        GEMINI_MODEL) echo "Gemini Model to use (e.g., gemini-1.5-flash-latest)" ;;
        LOG_PATH) echo "Absolute path for WebRobot log directory (e.g., /home/ec2-user/acms.cweb.com.au/var/log/gemini)" ;;
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
                case "$CLEAN_VAR_NAME" in
                    BASE_PATH)
                        # Special handling for BASE_PATH which is part of BASE_DIR
                        LINE=$(grep "^Define BASE_DIR" "$OUTPUT_FILE" || true)
                        # Extracts from "Define BASE_DIR /path/to/base/${DOMAIN}"
                        VALUE=$(echo "$LINE" | sed -n 's#Define BASE_DIR \([^ ]*\)/${DOMAIN}#\1#p')
                        ;;
                    *)
                        # Generic handling for other 'Define' variables
                        LINE=$(grep "^Define ${CLEAN_VAR_NAME}" "$OUTPUT_FILE" || true)
                        VALUE=$(echo "$LINE" | awk '{print $3}')
                        ;;
                esac
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
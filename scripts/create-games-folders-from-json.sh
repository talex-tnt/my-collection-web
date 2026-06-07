#!/bin/zsh

# Initialize the pretend mode flag as false
PRETEND_MODE=false
JSON_FILE=""

# Parse flags and arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--pretend)
      PRETEND_MODE=true
      shift
      ;;
    -*)
      echo "❌ Error: Unknown option '$1'"
      echo "Usage: $0 [-p|--pretend] <path_to_json_file>"
      exit 1
      ;;
    *)
      if [[ -n "$JSON_FILE" ]]; then
        echo "❌ Error: Multiple file arguments provided."
        echo "Usage: $0 [-p|--pretend] <path_to_json_file>"
        exit 1
      fi
      JSON_FILE="$1"
      shift
      ;;
  esac
done

# Check if an input file argument was provided
if [[ -z "$JSON_FILE" ]]; then
  echo "❌ Error: Missing JSON file argument."
  echo "Usage: $0 [-p|--pretend] <path_to_json_file>"
  exit 1
fi

# Check if the specified JSON file actually exists
if [[ ! -f "$JSON_FILE" ]]; then
  echo "❌ Error: The file '$JSON_FILE' does not exist."
  exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo "❌ Error: 'jq' is not installed. Please install it to run this script."
  exit 1
fi

# Get the absolute parent directory of the JSON file
TARGET_DIR="${JSON_FILE:a:h}"

if $PRETEND_MODE; then
  echo "🔍 RUNNING IN PRETEND MODE (Dry Run - No changes will be written)"
  echo "------------------------------------------------"
fi

echo "Processing JSON: $JSON_FILE"
echo "Target directory: $TARGET_DIR"
echo "------------------------------------------------"

# Load the entire JSON array into a temporary shell variable to minimize disk hits
local json_data=$(cat "$JSON_FILE")
local total_games=$(echo "$json_data" | jq '. | length')

# Zsh Associative Array to track folder name uniqueness across the entire JSON array
typeset -A allocated_folders

# --- FIRST PASS: Map out existing configurations to respect uniqueness ---
for ((i=0; i<$total_games; i++)); do
  local existing_folder=$(echo "$json_data" | jq -r ".[$i].folderName // empty")
  if [[ -n "$existing_folder" ]]; then
    allocated_folders[$existing_folder]=1
  fi
done

# --- SECOND PASS: Process, sanitize, create, and update ---
for ((i=0; i<$total_games; i++)); do
  # Extract values
  local title=$(echo "$json_data" | jq -r ".[$i].title")
  local serial_code=$(echo "$json_data" | jq -r ".[$i].serial_code")
  local current_folder_name=$(echo "$json_data" | jq -r ".[$i].folderName // empty")

  local final_folder_name=""

  # Condition A: Item already has a folderName configured
  if [[ -n "$current_folder_name" ]]; then
    local full_path="$TARGET_DIR/$current_folder_name"
    if [[ -d "$full_path" ]]; then
      echo "  ℹ️ Already exists and configured: $current_folder_name"
      continue
    else
      if $PRETEND_MODE; then
        echo "  🔮 [PRETEND] Configured folder missing on drive. Would re-create: $current_folder_name"
      else
        echo "  ⚠️ Configured folder missing on drive. Re-creating: $current_folder_name"
        mkdir -p "$full_path"
      fi
      continue
    fi
  fi

  # Condition B: Item needs a brand new folder generated
  # Format base names safely
  local clean_title="${title//:/ -}"
  clean_title="${clean_title//™/ }"
  clean_title="${clean_title//®/ }"
  clean_title="$(echo "$clean_title" | xargs)"

  local clean_serial="${serial_code//\//-}"
  clean_serial="$(echo "$clean_serial" | xargs)"

  local base_folder_name="$clean_title - $clean_serial"
  final_folder_name="$base_folder_name"

  # Collision resolution loop:
  # Check if the folder name is either taken in the JSON logic OR physically present on the disk
  while [[ -n "${allocated_folders[$final_folder_name]}" || -d "$TARGET_DIR/$final_folder_name" ]]; do
    # Generate timestamp. Note: Colons are skipped since they violate macOS naming logic
    local timestamp=$(date +"%y%m%d-%H%M%S")
    final_folder_name="${base_folder_name}_${timestamp}"

    # Tiny pause ensures that if a microsecond loop happens, timestamps tick over
    if ! $PRETEND_MODE; then
      sleep 1
    fi
  done

  # Secure the folder name globally in memory
  allocated_folders[$final_folder_name]=1

  # Create the directory physically or simulate it
  if $PRETEND_MODE; then
    echo "  🔮 [PRETEND] Would create unique folder: $final_folder_name"
  else
    mkdir -p "$TARGET_DIR/$final_folder_name"
    echo "  ➕ Created unique folder: $final_folder_name"
  fi

  # Inject the generated folderName back into the temporary JSON block
  json_data=$(echo "$json_data" | jq ".[$i].folderName = \"$final_folder_name\"")
done

# --- THIRD PASS: Commit changes securely back to disk ---
echo "------------------------------------------------"
if $PRETEND_MODE; then
  echo "🔮 [PRETEND] Would write safe atomic updates back to: $JSON_FILE"
  echo "✅ Pretend execution complete! No data was touched."
else
  echo "💾 Writing updates back to JSON file..."
  # Save using a safe atomical write pattern
  echo "$json_data" | jq '.' > "${JSON_FILE}.tmp" && mv "${JSON_FILE}.tmp" "$JSON_FILE"
  echo "✅ Process complete! JSON updated and database folders synchronized safely."
fi
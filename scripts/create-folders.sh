#!/bin/zsh

# Name of the JSON file to read
JSON_FILE="games.json"

# Check if the JSON file exists
if [[ ! -f "$JSON_FILE" ]]; then
  echo "❌ Error: The file $JSON_FILE does not exist."
  exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo "❌ Error: 'jq' is not installed. Please install it to run this script."
  exit 1
fi

#!/bin/zsh

# Configuration
JSON_FILE="games.json"
ROOT_DIR="games"

# Check if the JSON file exists
if [[ ! -f "$JSON_FILE" ]]; then
  echo "❌ Error: The file $JSON_FILE does not exist."
  exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo "❌ Error: 'jq' is not installed. Please install it to run this script."
  exit 1
fi

echo "Parsing JSON file..."
# Extract keys (consoles) from the JSON file
consoles=(${(f)"$(jq -r 'keys[]' "$JSON_FILE")"})

# Create the main root directory if it doesn't exist
mkdir -p "$ROOT_DIR"

# Main loop through consoles
for console in $consoles; do
  echo "📁 Processing console: $console"
  
  # Path for the console folder inside the root directory
  console_path="$ROOT_DIR/$console"
  mkdir -p "$console_path"
  
  # Extract games for the current console from the JSON file
  games_list=(${(f)"$(jq -r --arg console "$console" '.[$console][]' "$JSON_FILE")"})
  
  for game in $games_list; do
    # Replace colons with dashes for macOS folder name compatibility
    folder_name="${game//:/ -}"
    
    # Full path for the game folder inside the console folder
    full_path="$console_path/$folder_name"
    
    if [ ! -d "$full_path" ]; then
      mkdir -p "$full_path"
      echo "  ➕ Created: $ROOT_DIR/$console/$folder_name"
    else
      echo "  ⚠️ Already exists: $ROOT_DIR/$console/$folder_name"
    fi
  done
  echo "-----------------------------------"
done

echo "✅ Done! Everything has been created inside the '$ROOT_DIR' folder."
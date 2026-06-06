#!/bin/zsh

# Set default directory to ./games if no argument is provided
TARGET_DIR="${1:-./games}"

# Check if the target directory exists
if [[ ! -d "$TARGET_DIR" ]]; then
  echo "❌ Error: The directory '$TARGET_DIR' does not exist."
  exit 1
fi

# Check if exiftool is installed
if ! command -v exiftool &> /dev/null; then
  echo "❌ Error: 'exiftool' is not installed. Please install it to run this script."
  echo "   Tip: Use 'brew install exiftool' on macOS or 'sudo apt install exiftool' on Linux."
  exit 1
fi

echo "🛡️ Starting GPS metadata removal in: $TARGET_DIR"
echo "------------------------------------------------"

# Run exiftool recursively (-r) on the target directory
# -gps:all= clears all GPS-related tags
# -overwrite_original prevents exiftool from creating "_original" backup files
exiftool -r -gps:all= -overwrite_original "$TARGET_DIR"

echo "------------------------------------------------"
echo "✅ Done! All GPS geolocation metadata has been stripped from images."
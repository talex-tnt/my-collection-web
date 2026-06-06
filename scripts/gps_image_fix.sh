#!/bin/zsh

# Set the target directory: uses the provided argument or the current directory (.) if empty
TARGET_DIR="${1:-.}"

# Check if the target directory exists
if [[ ! -d "$TARGET_DIR" ]]; then
  echo "❌ Error: The directory '$TARGET_DIR' does not exist."
  exit 1
fi

# Define the source report file path
REPORT_FILE="$TARGET_DIR/gps_distribution_report.txt"

# Check if the report file exists
if [[ ! -f "$REPORT_FILE" ]]; then
  echo "❌ Error: Report file '$REPORT_FILE' not found."
  echo "   Please run 'check_gps_distribution.sh' first to generate it."
  exit 1
fi

# Check if exiftool is installed
if ! command -v exiftool &> /dev/null; then
  echo "❌ Error: 'exiftool' is not installed."
  exit 1
fi

echo "🛡️ Reading report and fixing geolocated images..."
echo "------------------------------------------------"

FIXED_COUNT=0

# Read the report file line by line
# It looks specifically for lines starting with "  [EXPOSED] "
while IFS= read -r line; do
  if [[ "$line" =~ '^[[:space:]]*\[EXPOSED\][[:space:]]+(.*)$' ]]; then
    # Extract the clean file path from the regex match group
    FILE_PATH="${match[1]}"

    # Check if the file actually exists on disk before running exiftool
    if [[ -f "$FILE_PATH" ]]; then
      # REAL-TIME OUTPUT: Print the path right before stripping the data
      echo "🧹 Stripping GPS from: $FILE_PATH"

      # Remove GPS tags and overwrite the original file directly without creating backups
      exiftool -gps:all= -overwrite_original "$FILE_PATH" 2>/dev/null

      FIXED_COUNT=$((FIXED_COUNT + 1))
    else
      echo "⚠️ File skipped (not found on disk): $FILE_PATH"
    fi
  fi
done < "$REPORT_FILE"

echo "------------------------------------------------"
if [[ "$FIXED_COUNT" -gt 0 ]]; then
  echo "✅ Done! Successfully stripped GPS metadata from $FIXED_COUNT files one-by-one."
else
  echo "🎉 No exposed files needed fixing or matching files were found."
fi
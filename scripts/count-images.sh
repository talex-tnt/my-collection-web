#!/bin/zsh

# Set the target directory: uses the provided argument or the current directory (.) if empty
TARGET_DIR="${1:-.}"

# Check if the target directory exists
if [[ ! -d "$TARGET_DIR" ]]; then
  echo "❌ Error: The directory '$TARGET_DIR' does not exist."
  exit 1
fi

# Define the output report file path inside the target directory
REPORT_FILE="$TARGET_DIR/image_report.txt"

# Temporary file to store unsorted directory counts
TMP_FILE=$(mktemp)

echo "📊 Folder-by-Folder Image Count (Including empty folders)" > "$REPORT_FILE"
echo "Generated on: $(date)" >> "$REPORT_FILE"
echo "Directory scanned: $TARGET_DIR" >> "$REPORT_FILE"
echo "------------------------------------------------" >> "$REPORT_FILE"

echo "📊 Scanning folders in: $TARGET_DIR..."

# Enable Zsh extended globbing features to safely handle spaces and hidden characters
setopt GLOB_DOTS EXTENDED_GLOB

# Loop through all directories and subdirectories using native Zsh globbing
for dir in "$TARGET_DIR"/**/*(N/); do

  # Count matching images strictly inside the current folder (case-insensitive flag #i)
  images=("$dir"/*.(#i)(jpg|jpeg|png|heic|heif|webp|gif|bmp|tiff)(N))
  COUNT=${#images}

  echo -e "$COUNT\t$dir" >> "$TMP_FILE"
done

# SORTING LOGIC:
# -k1,1nr : Sorts the 1st column (image count) numerically (n) and in reverse/descending order (r)
# -k2,2   : Sorts the 2nd column (directory path) alphabetically as a tie-breaker
sort -t$'\t' -k1,1nr -k2,2 "$TMP_FILE" | awk -F$'\t' '{printf "  %-5s files: %s\n", $1, $2}' | tee -a "$REPORT_FILE"

echo "------------------------------------------------" | tee -a "$REPORT_FILE"

# Calculate totals by reading the parsed temporary data
TOTAL_IMAGES=0
ACTIVE_FOLDERS=0

while read -r count dir; do
  TOTAL_IMAGES=$((TOTAL_IMAGES + count))
  if [ "$count" -gt 0 ]; then
    ACTIVE_FOLDERS=$((ACTIVE_FOLDERS + 1))
  fi
done < "$TMP_FILE"

# Append the new metrics to the output and the report file
echo "📁 Folders containing at least 1 image: $ACTIVE_FOLDERS" | tee -a "$REPORT_FILE"
echo "✨ Grand total of images: $TOTAL_IMAGES" | tee -a "$REPORT_FILE"
echo "------------------------------------------------" >> "$REPORT_FILE"

# Clean up temporary file
rm "$TMP_FILE"

echo "\n💾 Report successfully saved to: $REPORT_FILE"
#!/bin/zsh

# Set the target directory: uses the provided argument or the current directory (.) if empty
TARGET_DIR="${1:-.}"

# Check if the target directory exists
if [[ ! -d "$TARGET_DIR" ]]; then
  echo "❌ Error: The directory '$TARGET_DIR' does not exist."
  exit 1
fi

# Check if exiftool is installed
if ! command -v exiftool &> /dev/null; then
  echo "❌ Error: 'exiftool' is not installed. Please install it to run this script."
  exit 1
fi

# Define the output report file path inside the target directory
REPORT_FILE="$TARGET_DIR/gps_distribution_report.txt"

# Temporary files to store data safely during processing
TMP_WITH_GPS=$(mktemp)
TMP_WITHOUT_GPS=$(mktemp)
TMP_FOLDERS=$(mktemp)

echo "📊 GPS Geolocation Distribution Report" > "$REPORT_FILE"
echo "Generated on: $(date)" >> "$REPORT_FILE"
echo "Directory scanned: $TARGET_DIR" >> "$REPORT_FILE"
echo "------------------------------------------------" >> "$REPORT_FILE"

echo "📊 Starting real-time file scan..."
echo "------------------------------------------------"

# Enable Zsh extended globbing features
setopt GLOB_DOTS EXTENDED_GLOB

# Initialize overall counters
TOTAL_ANALYZED=0
TOTAL_WITH_GPS=0
TOTAL_WITHOUT_GPS=0

# Loop through all directories and subdirectories
for dir in "$TARGET_DIR"/**/*(N/); do

  # Get all images inside this specific folder
  images=("${dir}"/*.(#i)(jpg|jpeg|png|heic|heif|webp|tiff)(N.))
  FOLDER_TOTAL=${#images}

  # Skip folders that have absolutely no images
  if [[ "$FOLDER_TOTAL" -eq 0 ]]; then
    continue
  fi

  FOLDER_GPS_COUNT=0

  # Scan each image in this folder one by one
  for file in "${images[@]}"; do
    TOTAL_ANALYZED=$((TOTAL_ANALYZED + 1))

    # REAL-TIME OUTPUT: Print the path right before scanning it
    echo "🔎 Analyzing: $file"

    # Check for GPS coordinates using exiftool
    GPS_CHECK=$(exiftool -s3 -GPSLatitude "$file" 2>/dev/null)

    if [[ -n "$GPS_CHECK" ]]; then
      echo "$file" >> "$TMP_WITH_GPS"
      FOLDER_GPS_COUNT=$((FOLDER_GPS_COUNT + 1))
      TOTAL_WITH_GPS=$((TOTAL_WITH_GPS + 1))
    else
      echo "$file" >> "$TMP_WITHOUT_GPS"
      TOTAL_WITHOUT_GPS=$((TOTAL_WITHOUT_GPS + 1))
    fi
  done

  # Calculate ratio percentage for sorting (using BC for floating point division)
  PERCENTAGE=$(echo "scale=4; $FOLDER_GPS_COUNT / $FOLDER_TOTAL" | bc)

  # Store stats: percentage [TAB] folder string format
  echo -e "$PERCENTAGE\t$dir: $FOLDER_GPS_COUNT/$FOLDER_TOTAL files have GPS metadata" >> "$TMP_FOLDERS"
done

echo "------------------------------------------------"
echo "✅ Scan complete! Compiling final report tables..."
echo "------------------------------------------------"

# --- WRITING RECURSIVE FOLDER STATS (SORTED BY PERCENTAGE DESCENDING) ---
echo "📁 FOLDER DISTRIBUTION (Sorted by GPS ratio percentage):" >> "$REPORT_FILE"
echo "------------------------------------------------" >> "$REPORT_FILE"
if [[ -s "$TMP_FOLDERS" ]]; then
  # Sort column 1 numerically (n) and reversed (r), column 2 alphabetically as fallback
  sort -t$'\t' -k1,1nr -k2,2 "$TMP_FOLDERS" | awk -F$'\t' '{print "  " $2}' >> "$REPORT_FILE"
else
  echo "  No image folders found." >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"


# --- WRITING FILE LIST WITH GPS ---
echo "📍 LIST OF FILES WITH GPS GEOLOCATION:" >> "$REPORT_FILE"
echo "------------------------------------------------" >> "$REPORT_FILE"
if [[ -s "$TMP_WITH_GPS" ]]; then
  sort "$TMP_WITH_GPS" | awk '{print "  [EXPOSED] " $0}' >> "$REPORT_FILE"
else
  echo "  No files found with GPS data." >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"


# --- WRITING FILE LIST WITHOUT GPS ---
echo "🔒 LIST OF FILES WITHOUT GPS GEOLOCATION:" >> "$REPORT_FILE"
echo "------------------------------------------------" >> "$REPORT_FILE"
if [[ -s "$TMP_WITHOUT_GPS" ]]; then
  sort "$TMP_WITHOUT_GPS" | awk '{print "  [SAFE]    " $0}' >> "$REPORT_FILE"
else
  echo "  No clean files found." >> "$REPORT_FILE"
fi
echo "" >> "$REPORT_FILE"


# --- SUMMARY TOTALS SECTION ---
echo "------------------------------------------------" >> "$REPORT_FILE"
echo "📊 FINAL SUMMARY TOTALS:" >> "$REPORT_FILE"
echo "------------------------------------------------" >> "$REPORT_FILE"
echo "  Total Images Analyzed:    $TOTAL_ANALYZED" >> "$REPORT_FILE"
echo "  Total With GPS Exposed:   $TOTAL_WITH_GPS" >> "$REPORT_FILE"
echo "  Total Without GPS (Safe): $TOTAL_WITHOUT_GPS" >> "$REPORT_FILE"
echo "------------------------------------------------" >> "$REPORT_FILE"

# Clean up temporary files
rm "$TMP_WITH_GPS" "$TMP_WITHOUT_GPS" "$TMP_FOLDERS"

# Print the compiled structured report onto the screen at the very end
cat "$REPORT_FILE"

echo "\n💾 Complete report successfully saved to: $REPORT_FILE"
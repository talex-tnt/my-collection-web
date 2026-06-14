#!/bin/zsh

# Initialize flags and target directory variable
PRETEND_MODE=false
TARGET_DIR=""

# Parse flags and arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--pretend)
      PRETEND_MODE=true
      shift
      ;;
    -*)
      echo "❌ Error: Unknown option '$1'"
      echo "Usage: $0 [-p|--pretend] <path_to_target_directory>"
      exit 1
      ;;
    *)
      if [[ -n "$TARGET_DIR" ]]; then
        echo "❌ Error: Multiple directory arguments provided."
        echo "Usage: $0 [-p|--pretend] <path_to_target_directory>"
        exit 1
      fi
      TARGET_DIR="$1"
      shift
      ;;
  esac
done

# If no directory was provided, default to the current directory (.)
TARGET_DIR="${TARGET_DIR:-.}"

# Check if the target directory exists
if [[ ! -d "$TARGET_DIR" ]]; then
  echo "❌ Error: The directory '$TARGET_DIR' does not exist."
  exit 1
fi

# Check if exiftool is installed
if ! command -v exiftool &> /dev/null; then
  echo "❌ Error: 'exiftool' is required but not installed."
  echo "Please install it using: brew install exiftool"
  exit 1
fi

if $PRETEND_MODE; then
  echo "🔍 RUNNING IN PRETEND MODE (Dry Run - No files will be modified)"
  echo "------------------------------------------------"
fi

echo "🔍 Scanning directories by OLDEST AVAILABLE timestamp inside '$TARGET_DIR'..."
echo "------------------------------------------------"

# Enable extended globbing and safe empty globbing
setopt EXTENDED_GLOB
setopt NULL_GLOB

# Loop through all subdirectories (at any depth) inside the target directory
for dir in "$TARGET_DIR"/**/*(/); do

  # Build the list of image files in the current directory
  local -a current_images
  current_images=("${dir}"/*.(#i)(jpg|jpeg|png|webp|bmp|gif))

  # Skip directory if it contains no images
  if (( ${#current_images} == 0 )); then
    continue
  fi

  # Use exiftool to find the file with the absolute oldest date.
  # Order of priority: 
  # 1. True EXIF Shooting date (DateTimeOriginal)
  # 2. File Modification Date (ModifyDate) OR File Creation Date (FileCreateDate), whichever is older!
  local oldest_image_name
  oldest_image_name=$(exiftool -q -f -T -filename \
    -fileorder +DateTimeOriginal \
    -fileorder +ModifyDate \
    -fileorder +FileCreateDate \
    "${current_images[@]}" 2>/dev/null | head -n 1 | awk -F'\t' '{print $1}')

  # Verify we actually got a valid filename back
  if [[ -n "$oldest_image_name" && "$oldest_image_name" != "-" ]]; then
    
    full_path_oldest="$dir/$oldest_image_name"
    
    # Get the file extension (lowercase)
    ext="${oldest_image_name:e:l}"

    # Define the new path
    new_name="$dir/Preview.$ext"

    # Check if the file is already named Preview (case-insensitive)
    if [[ "$oldest_image_name" == (#i)preview.* ]]; then
      echo "  ℹ️ Already correct in: $dir ($oldest_image_name)"
    else
      if $PRETEND_MODE; then
        echo "  🔮 [PRETEND] Would rename in: $dir"
        echo "     From: $oldest_image_name"
        echo "     To  : Preview.$ext"
      else
        # Rename the file physically on disk
        mv "$full_path_oldest" "$new_name"
        echo "  🔄 Renamed in: $dir"
        echo "     From: $oldest_image_name"
        echo "     To  : Preview.$ext"
      fi
    fi
  fi
done

echo "------------------------------------------------"
if $PRETEND_MODE; then
  echo "✅ Pretend execution complete! No changes were written to storage."
else
  echo "✅ Done! Finished checking and renaming preview images."
fi
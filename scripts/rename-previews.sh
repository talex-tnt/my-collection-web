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

if $PRETEND_MODE; then
  echo "🔍 RUNNING IN PRETEND MODE (Dry Run - No files will be modified)"
  echo "------------------------------------------------"
fi

echo "🔍 Scanning directories by CREATION time inside '$TARGET_DIR'..."
echo "------------------------------------------------"

# Enable extended globbing and safe empty globbing
setopt EXTENDED_GLOB
setopt NULL_GLOB

# Loop through all subdirectories (at any depth) inside the target directory
for dir in "$TARGET_DIR"/**/*(/); do

  # 1. Find all matching images sorted from NEWEST CREATION to OLDEST CREATION (oc)
  local -a images
  images=("${dir}"/*.(#i)(jpg|jpeg|png|webp|bmp|gif)(oc))

  # 2. Extract the LAST element [-1], which is guaranteed to be the OLDEST CREATED
  if (( ${#images} > 0 )); then
    oldest_image="${images[-1]}"

    # Get the file extension (lowercase)
    ext="${oldest_image:e:l}"

    # Define the new path
    new_name="$dir/Preview.$ext"

    # Check if the file is already named Preview (case-insensitive)
    if [[ "${oldest_image:t}" == (#i)preview.* ]]; then
      echo "  ℹ️ Already correct in: $dir (${oldest_image:t})"
    else
      if $PRETEND_MODE; then
        echo "  🔮 [PRETEND] Would rename in: $dir"
        echo "     From: ${oldest_image:t}"
        echo "     To  : Preview.$ext"
      else
        # Rename the file physically on disk
        mv "$oldest_image" "$new_name"
        echo "  🔄 Renamed in: $dir"
        echo "     From: ${oldest_image:t}"
        echo "     To  : Preview.$ext"
      fi
    fi
  fi
done

echo "------------------------------------------------"
if $PRETEND_MODE; then
  echo "✅ Pretend execution complete! No changes were written to storage."
else
  echo "✅ Done! Finished checking and renaming oldest created preview images."
fi
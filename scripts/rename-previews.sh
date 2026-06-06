#!/bin/zsh

# Configuration
TARGET_DIR="games"

# Check if the target directory exists
if [[ ! -d "$TARGET_DIR" ]]; then
  echo "❌ Error: The directory '$TARGET_DIR' does not exist."
  exit 1
fi

echo "🔍 Scanning directories by CREATION time inside '$TARGET_DIR'..."
echo "-----------------------------------"

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
      # Rename the file
      mv "$oldest_image" "$new_name"
      echo "  🔄 Renamed in: $dir"
      echo "     From: ${oldest_image:t}"
      echo "     To  : Preview.$ext"
    fi
  fi
done

echo "-----------------------------------"
echo "✅ Done! Finished checking for oldest created preview images."
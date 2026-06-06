#!/bin/zsh

# Configuration
TARGET_DIR="games"

# Check if the target directory exists
if [[ ! -d "$TARGET_DIR" ]]; then
  echo "❌ Error: The directory '$TARGET_DIR' does not exist."
  exit 1
fi

echo "🔄 Swapping 'Back' and 'Preview' filenames inside '$TARGET_DIR'..."
echo "--------------------------------------------------------"

# Enable extended globbing and safe empty globbing
setopt EXTENDED_GLOB
setopt NULL_GLOB

# Loop through all subdirectories (at any depth)
for dir in "$TARGET_DIR"/**/*(/); do
  
  # Find all 'Back.*' files (case-insensitive for the name, lowercase extension)
  local -a back_files
  back_files=("${dir}"/(#i)back.*)
  
  for back_file in $back_files; do
    # Get the exact extension of the current Back file
    local ext="${back_file:e:l}"
    
    # Construct the expected Preview file path with the SAME extension
    local preview_file="$dir/Preview.$ext"
    local preview_file_upper="$dir/PREVIEW.$ext" # Handle potential case variations
    
    # Determine the actual preview file path if it exists (regardless of Preview/preview/PREVIEW)
    local actual_preview=""
    if [[ -f "$preview_file" ]]; then
      actual_preview="$preview_file"
    elif [[ -f "$preview_file_upper" ]]; then
      actual_preview="$preview_file_upper"
    else
      # If there is a case-insulated version (e.g., preview.jpg)
      local -a check_preview
      check_preview=("${dir}"/(#i)preview.$ext)
      [[ ${#check_preview} -gt 0 ]] && actual_preview="${check_preview[1]}"
    fi

    # ONLY perform the swap if BOTH files exist with the exact same extension
    if [[ -n "$actual_preview" && -f "$back_file" ]]; then
      
      # Define unique temporary name inside the same folder
      local temp_file="$dir/TEMP_SWAP_P_B.$ext"
      
      echo "🔁 Swapping in: $dir (*.$ext)"
      
      # 1. Move Back to Temp -> (Back is now free)
      mv "$back_file" "$temp_file"
      
      # 2. Move Preview to Back -> (Preview is now free, Back is occupied by old Preview)
      # We use standard capitalization for the destination (Back.ext)
      mv "$actual_preview" "$dir/Back.$ext"
      
      # 3. Move Temp to Preview -> (Preview is now occupied by old Back)
      # We use standard capitalization for the destination (Preview.ext)
      mv "$temp_file" "$dir/Preview.$ext"
      
    fi
  done
done

echo "--------------------------------------------------------"
echo "✅ Done! All pairs have been swapped successfully."
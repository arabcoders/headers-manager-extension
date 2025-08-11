#!/usr/bin/env bash
set -e

zip_file="headers_manager.zip"
extension_dir="."
if [ -f "$zip_file" ]; then
    echo "Removing existing zip file: $zip_file"
    rm "$zip_file"
fi

IGNORE_FILES=(
    "*.git*"
    "*.vscode*"
    "*.idea*"
    "*.DS_Store"
    "node_modules/*"
    "dist/*"
    "build/*"
    "screenshots/*"
)

echo "Creating zip file: $zip_file"
zip -r "$zip_file" "$extension_dir" -x "${IGNORE_FILES[@]}"
echo "Zip file created successfully: $zip_file"

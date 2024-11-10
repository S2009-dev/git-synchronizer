#!/bin/bash

# Show help
usage() {
    echo "Usage: bash $0 --source=\"<source_folder>\" --dest=\"<destination_folder>\" --cpdir=\"<folder_in_source_to_copy_content>\""
    echo "Set --cpdir to \".\" to use the source_folder, or type the folder name with /. if you want to copy it's content and not the folder"
    exit 1
}

# Verify args
if [ $# -ne 3 ]; then
    usage
fi

# Extract args
source=""
dest=""
cpdir=""

for arg in "$@"; do
    if [[ $arg == --source=* ]]; then
        source=${arg#*=}
    elif [[ $arg == --dest=* ]]; then
        dest=${arg#*=}
    elif [[ $arg == --cpdir=* ]]; then
        cpdir=${arg#*=}
    else
        usage
    fi
done

# Verify if args are defined
if [ -z "$source" ] || [ -z "$dest" ] || [ -z "$cpdir" ]; then
    usage
fi

# Verify if the folders exist
if [ ! -d "$source" ] || [ ! -d "$dest" ]; then
    echo "The source $source folder or the dest $dest folder doesn't exist."
    exit 1
fi

# Remove content of destination folder
rm -drf "$dest/*"
rm -drf "$dest/.*"

# Go in the folder and pull the repo
cd "$source" || { echo "Can't open $source"; exit 1; }
git pull || { echo "Failed to execute git pull"; exit 1; }

# Verify if the cpdir folder exists
if [ ! -d "$source/$cpdir" ]; then
    echo "The cpdir $cpdir folder doesn't exist."
    exit 1
fi

# Copy the cpdir folder from source folder to the destination folder
cp -r "$cpdir" "$dest" || { echo "Failed to copy content from $source/$cpdir to $dest"; exit 1; }

# Remove content of source folder
rm -drf "$source/*"
mv "$source/.git" "$source/git"
rm -drf "$source/.*"
mv "$source/git" "$source/.git"

echo "[$source] Repo deployed !"
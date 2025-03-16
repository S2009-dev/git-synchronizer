#!/bin/bash

# Show help
usage() {
    echo "Usage: bash $0 --source=\"<source_folder>\" --dest=\"<destination_folder>\" --cpdir=\"<folder_in_source_to_copy_content>\" --postcmd=\"<execute_after_deploy>\""
    echo "Set --cpdir to \".\" to use the source_folder, or type the folder name with /. if you want to copy it's content and not the folder"
    echo "--postcmd is optional and can be \"composer\" to install composer dependencies in the destination folder, or \"npm\" to install npm dependencies in the destination folder. You can also specify a path to a .sh file to execute after the deployment."
    exit 1
}

# Verify args
if [ $# -ne 4 ]; then
    usage
fi

# Extract args
source=""
dest=""
cpdir=""
postcmd=""

for arg in "$@"; do
    if [[ $arg == --source=* ]]; then
        source=${arg#*=}
    elif [[ $arg == --dest=* ]]; then
        dest=${arg#*=}
    elif [[ $arg == --cpdir=* ]]; then
        cpdir=${arg#*=}
    elif [[ $arg == --postcmd=* ]]; then
        postcmd=${arg#*=}
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
rm -drf $dest/* || { echo "Failed to remove content of $dest"; exit 1; }
rm -drf $dest/.* || { echo "Failed to remove hidden content of $dest"; exit 1; }

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

echo "[$source] Repo deployed !"

# Execute postcmd if defined
if [ ! -z "$postcmd" ]; then
    echo "Executing postcmd..."
    
    if [ "$postcmd" == "composer" ]; then
        cd "$dest" || { echo "Can't open $dest"; exit 1; }
        /usr/local/bin/composer install || { echo "Failed to execute composer install"; exit 1; }
    elif [ "$postcmd" == "npm" ]; then
        cd "$dest" || { echo "Can't open $dest"; exit 1; }
        /usr/local/bin/npm install || { echo "Failed to execute npm install"; exit 1; }
    else
        if [ -f "$postcmd" ]; then
            sh "$postcmd" || { echo "Failed to execute $postcmd"; exit 1; }
        else
            echo "The postcmd $postcmd is not a valid file."
            exit 1
        fi
    fi
fi
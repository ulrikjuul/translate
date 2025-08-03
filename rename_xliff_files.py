#!/usr/bin/env python3

import os
import sys
import re
from pathlib import Path

def rename_xliff_files(directory='.'):
    """
    Rename XLIFF files based on the number in parentheses at the end of the filename.
    
    Examples:
    - translation_23925_de-du (983).xlf → 983.xlf
    - translation_23925_de-du (latest).xlf → LATEST.xlf
    """
    
    # Convert to Path object
    dir_path = Path(directory)
    
    # Check if directory exists
    if not dir_path.exists():
        print(f'Error: Directory "{directory}" does not exist')
        return
    
    print(f'\nScanning directory: {dir_path.resolve()}\n')
    
    # Find all XLIFF files
    xliff_files = list(dir_path.glob('*.xlf')) + list(dir_path.glob('*.xliff'))
    
    if not xliff_files:
        print('No XLIFF files found in the directory')
        return
    
    print(f'Found {len(xliff_files)} XLIFF file(s)\n')
    
    # Plan the renames
    renames = []
    
    for file_path in xliff_files:
        filename = file_path.name
        
        # Check for number in parentheses: (123)
        number_match = re.search(r'\((\d+)\)\.(xlf|xliff)$', filename, re.IGNORECASE)
        
        # Check for "latest" in parentheses: (latest)
        latest_match = re.search(r'\(latest\)\.(xlf|xliff)$', filename, re.IGNORECASE)
        
        new_name = None
        
        if number_match:
            # Use the number as the new filename
            number = number_match.group(1)
            extension = file_path.suffix
            new_name = f'{number}{extension}'
            
        elif latest_match:
            # Rename to LATEST
            extension = file_path.suffix
            new_name = f'LATEST{extension}'
        
        if new_name and new_name != filename:
            new_path = file_path.parent / new_name
            renames.append((file_path, new_path))
    
    if not renames:
        print('No files need renaming (no files with (number) or (latest) pattern found)')
        return
    
    # Show what will be renamed
    print('The following files will be renamed:\n')
    for old_path, new_path in renames:
        print(f'  {old_path.name}')
        print(f'  → {new_path.name}\n')
    
    # Ask for confirmation
    while True:
        answer = input('Do you want to proceed with renaming? (y/n): ').strip().lower()
        if answer in ['y', 'yes', 'n', 'no']:
            break
        print('Please answer y or n')
    
    if answer in ['y', 'yes']:
        # Perform the renames
        success_count = 0
        error_count = 0
        
        print()
        for old_path, new_path in renames:
            # Check if target already exists
            if new_path.exists():
                print(f'  ✗ Cannot rename "{old_path.name}" to "{new_path.name}" - file already exists')
                error_count += 1
                continue
            
            try:
                old_path.rename(new_path)
                print(f'  ✓ Renamed "{old_path.name}" to "{new_path.name}"')
                success_count += 1
            except Exception as e:
                print(f'  ✗ Error renaming "{old_path.name}": {e}')
                error_count += 1
        
        print(f'\nComplete: {success_count} file(s) renamed successfully')
        if error_count > 0:
            print(f'{error_count} file(s) failed to rename')
    else:
        print('Renaming cancelled')

def main():
    # Get directory from command line or use current directory
    directory = sys.argv[1] if len(sys.argv) > 1 else '.'
    rename_xliff_files(directory)

if __name__ == '__main__':
    main()
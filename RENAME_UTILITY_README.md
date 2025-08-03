# XLIFF File Renaming Utility

This directory contains utilities to rename XLIFF translation files based on the number or text in parentheses at the end of the filename.

## Renaming Pattern

The utilities will rename files according to these rules:
- Files with `(123)` pattern → `123.xlf`
- Files with `(latest)` pattern → `LATEST.xlf`

### Examples:
- `translation_23925_de-du (983).xlf` → `983.xlf`
- `translation_23925_de-du (latest).xlf` → `LATEST.xlf`

## Usage

### Python Version (Recommended)
```bash
# Rename files in current directory
python3 rename_xliff_files.py

# Rename files in specific directory
python3 rename_xliff_files.py /path/to/xliff/files
```

### Node.js Version
```bash
# Rename files in current directory
node rename-xliff-files.js

# Rename files in specific directory
node rename-xliff-files.js /path/to/xliff/files
```

## Features

- Shows preview of all files that will be renamed
- Asks for confirmation before renaming
- Checks for existing files to avoid overwrites
- Provides clear success/error messages
- Works with both `.xlf` and `.xliff` extensions

## Safety

The utilities will:
- Show you exactly what will be renamed before making any changes
- Ask for your confirmation
- Skip files if the target filename already exists
- Report any errors that occur during renaming
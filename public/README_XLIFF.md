# XLIFF Files Auto-Loading

## Quick Start

1. Place your XLIFF files in this `/public` folder
2. Create a `xliff-files.json` file listing your files
3. Open the application and click "Load Files from Public Folder"

## File List Configuration (Required)

Create a `xliff-files.json` file in this folder listing your XLIFF files:

```json
{
  "files": [
    "translation_23925_de-du (61).xlf",
    "translation_23925_de-du (185).xlf",
    "translation_23925_de-du (247).xlf",
    "translation_23925_de-du (latest).xlf"
  ]
}
```

Copy `xliff-files.json.example` to `xliff-files.json` and modify with your actual filenames.

## Automatic Sorting

Files are automatically sorted by the number in parentheses:
- Files with `(61)`, `(185)`, `(247)` are sorted numerically
- Files with `(latest)` are always placed at the end
- Up to 10 files can be loaded and compared

## Naming Convention

The application extracts identifiers from filenames:
- `translation_23925_de-du (61).xlf` → Identifier: "61"
- `translation_23925_de-du (185).xlf` → Identifier: "185"
- `translation_23925_de-du (latest).xlf` → Identifier: "LATEST"

These identifiers are displayed throughout the interface for easy identification.

## Important Notes

- Files must be accessible via the web server (in the `/public` folder)
- The `xliff-files.json` configuration is required
- Maximum 10 files can be compared at once
- Files are loaded sequentially to maintain order
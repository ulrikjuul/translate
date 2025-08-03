# XLIFF Files Auto-Loading

## Quick Start

1. Place your XLIFF files in this `/public` folder
2. Name them with numbers (e.g., `983.xlf`, `984.xlf`) or `LATEST.xlf`
3. Open the application and click "Load Files from Public Folder"

## Automatic Sorting

Files are automatically sorted:
- Numbered files (e.g., `983.xlf`, `984.xlf`) are loaded in ascending order
- `LATEST.xlf` is always loaded last
- Up to 10 files can be loaded

## File List Configuration (Optional)

For better control, create a `xliff-files.json` file in this folder:

```json
{
  "files": [
    "983.xlf",
    "984.xlf",
    "985.xlf",
    "LATEST.xlf"
  ]
}
```

Copy `xliff-files.json.example` to `xliff-files.json` and modify as needed.

## Naming Convention

The application extracts identifiers from filenames:
- `translation_23925_de-du (983).xlf` → Identifier: "983"
- `translation_23925_de-du (latest).xlf` → Identifier: "LATEST"
- `983.xlf` → Identifier: "983"
- `LATEST.xlf` → Identifier: "LATEST"

## Auto-Detection

If no `xliff-files.json` is present, the application will try to auto-detect files with common patterns:
- `983.xlf` through `990.xlf`
- `LATEST.xlf`

## Important Notes

- Files must be accessible via the web server (in the `/public` folder)
- The application will load files in the sorted order
- Maximum 10 files can be compared at once
- Files are loaded sequentially to maintain order
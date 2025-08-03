# XLIFF Files Auto-Loading

## Quick Start

1. Place your XLIFF files in this `/public` folder
2. Run `npm run generate-list` (or just `npm run dev` which does it automatically)
3. Open the application and click "Load Files from Public Folder"

## Automatic File Detection

The `generate-xliff-list.cjs` script automatically:
- Finds all `.xlf` and `.xliff` files in the `/public` folder
- Sorts them by the number in parentheses (e.g., `(61)`, `(185)`)
- Places files with `(latest)` at the end
- Creates `xliff-files.json` with the sorted list

## Commands

```bash
# Generate the file list manually
npm run generate-list

# Start dev server (auto-generates list first)
npm run dev
```

## Naming Convention

The application extracts identifiers from filenames:
- `GUE Translations Master_de-DU_all (61).xlf` → Identifier: "61"
- `translation_23925_de-du (185).xlf` → Identifier: "185"
- `translation_23925_de-du (latest).xlf` → Identifier: "LATEST"

These identifiers are displayed throughout the interface for easy identification.

## How It Works

1. **Automatic Detection**: The script scans the `/public` folder for all XLIFF files
2. **Smart Sorting**: Files are sorted by their numeric identifier (lowest to highest)
3. **LATEST Handling**: Files with `(latest)` are always placed at the end
4. **JSON Generation**: Creates `xliff-files.json` with the sorted file list
5. **Auto-Loading**: The web app reads this JSON and loads files in order

## Important Notes

- The file list is regenerated every time you run `npm run dev`
- Maximum 10 files can be compared at once (first 10 will be loaded)
- Files are loaded sequentially to maintain order
- The generated `xliff-files.json` includes a timestamp for tracking
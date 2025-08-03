#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get the directory from command line argument or use current directory
const directory = process.argv[2] || '.';

// Check if directory exists
if (!fs.existsSync(directory)) {
  console.error(`Directory "${directory}" does not exist`);
  process.exit(1);
}

console.log(`\nScanning directory: ${path.resolve(directory)}\n`);

// Read all files in the directory
const files = fs.readdirSync(directory);

// Filter for .xlf and .xliff files
const xliffFiles = files.filter(file => 
  file.endsWith('.xlf') || file.endsWith('.xliff')
);

if (xliffFiles.length === 0) {
  console.log('No XLIFF files found in the directory');
  process.exit(0);
}

console.log(`Found ${xliffFiles.length} XLIFF file(s)\n`);

// Process each file
const renames = [];
xliffFiles.forEach(file => {
  // Check for pattern with number in parentheses: (123)
  const numberMatch = file.match(/\((\d+)\)\.xlf/i);
  
  // Check for pattern with "latest" in parentheses: (latest)
  const latestMatch = file.match(/\(latest\)\.xlf/i);
  
  let newName = null;
  
  if (numberMatch) {
    // Extract the number and use it as the new filename
    const number = numberMatch[1];
    const extension = path.extname(file);
    newName = `${number}${extension}`;
  } else if (latestMatch) {
    // Rename to LATEST.xlf
    const extension = path.extname(file);
    newName = `LATEST${extension}`;
  }
  
  if (newName && newName !== file) {
    renames.push({ old: file, new: newName });
  }
});

if (renames.length === 0) {
  console.log('No files need renaming (no files with (number) or (latest) pattern found)');
  process.exit(0);
}

// Show what will be renamed
console.log('The following files will be renamed:\n');
renames.forEach(({ old: oldName, new: newName }) => {
  console.log(`  ${oldName}`);
  console.log(`  → ${newName}\n`);
});

// Ask for confirmation
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Do you want to proceed with renaming? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    // Perform the renames
    let successCount = 0;
    let errorCount = 0;
    
    renames.forEach(({ old: oldName, new: newName }) => {
      const oldPath = path.join(directory, oldName);
      const newPath = path.join(directory, newName);
      
      // Check if target file already exists
      if (fs.existsSync(newPath)) {
        console.error(`  ✗ Cannot rename "${oldName}" to "${newName}" - file already exists`);
        errorCount++;
        return;
      }
      
      try {
        fs.renameSync(oldPath, newPath);
        console.log(`  ✓ Renamed "${oldName}" to "${newName}"`);
        successCount++;
      } catch (error) {
        console.error(`  ✗ Error renaming "${oldName}": ${error.message}`);
        errorCount++;
      }
    });
    
    console.log(`\nComplete: ${successCount} file(s) renamed successfully`);
    if (errorCount > 0) {
      console.log(`${errorCount} file(s) failed to rename`);
    }
  } else {
    console.log('Renaming cancelled');
  }
  
  rl.close();
});
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Directory containing XLIFF files
const publicDir = path.join(__dirname, 'public');
const outputFile = path.join(publicDir, 'xliff-files.json');

// Read all files in the public directory
const files = fs.readdirSync(publicDir);

// Filter for XLIFF files
const xliffFiles = files.filter(file => 
  file.endsWith('.xlf') || file.endsWith('.xliff')
);

if (xliffFiles.length === 0) {
  console.log('No XLIFF files found in /public directory');
  process.exit(0);
}

// Sort files by extracted number, with LATEST at the end
const sortedFiles = xliffFiles.sort((a, b) => {
  // Extract numbers from parentheses
  const getOrder = (filename) => {
    // Check for (latest) pattern
    if (/\(latest\)/i.test(filename)) {
      return 999999; // Put LATEST at the end
    }
    
    // Check for number in parentheses
    const match = filename.match(/\((\d+)\)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    
    // Check if filename is just a number
    const nameWithoutExt = filename.replace(/\.(xlf|xliff)$/i, '');
    if (/^\d+$/.test(nameWithoutExt)) {
      return parseInt(nameWithoutExt, 10);
    }
    
    // Default order for non-numeric files
    return 100000;
  };
  
  return getOrder(a) - getOrder(b);
});

// Create the JSON structure
const jsonContent = {
  files: sortedFiles,
  generated: new Date().toISOString(),
  count: sortedFiles.length
};

// Write the JSON file
fs.writeFileSync(outputFile, JSON.stringify(jsonContent, null, 2));

console.log(`✅ Generated ${outputFile}`);
console.log(`📁 Found ${xliffFiles.length} XLIFF files:`);
sortedFiles.forEach((file, index) => {
  // Extract identifier for display
  let identifier = file;
  const parenMatch = file.match(/\(([^)]+)\)/);
  if (parenMatch) {
    identifier = parenMatch[1].toUpperCase();
  } else {
    const nameWithoutExt = file.replace(/\.(xlf|xliff)$/i, '');
    if (/^\d+$/.test(nameWithoutExt)) {
      identifier = nameWithoutExt;
    }
  }
  console.log(`  ${index + 1}. ${identifier} - ${file}`);
});
import type { XliffFile, TransUnit } from '../types/xliff';

// Extract identifier from filename - looks for numbers or "latest" in various patterns
export const extractFileIdentifier = (filename: string): string => {
  // Remove file extension first
  const nameWithoutExt = filename.replace(/\.(xlf|xliff)$/i, '');
  
  // Pattern 1: Just a number as filename (e.g., "983.xlf")
  if (/^\d+$/.test(nameWithoutExt)) {
    return nameWithoutExt;
  }
  
  // Pattern 2: "LATEST" or "latest" as filename
  if (/^latest$/i.test(nameWithoutExt)) {
    return 'LATEST';
  }
  
  // Pattern 3: Number in parentheses anywhere (e.g., "translation_23925_de-du (983).xlf")
  const parenNumberMatch = nameWithoutExt.match(/\((\d+)\)/);
  if (parenNumberMatch) {
    return parenNumberMatch[1];
  }
  
  // Pattern 4: "latest" in parentheses
  const parenLatestMatch = nameWithoutExt.match(/\(latest\)/i);
  if (parenLatestMatch) {
    return 'LATEST';
  }
  
  // Pattern 5: Extract any number from the filename (e.g., "file_983_translation")
  const anyNumberMatch = nameWithoutExt.match(/(\d+)/);
  if (anyNumberMatch) {
    return anyNumberMatch[1];
  }
  
  // Fallback: use the filename without extension
  return nameWithoutExt;
};

export const parseXliff = (xmlContent: string): XliffFile => {
  // Fix common XML entity issues before parsing
  // This regex finds & that are not part of valid XML entities
  let cleanedXml = xmlContent;
  
  // Replace standalone & with &amp; but preserve existing entities
  // This regex matches & that are NOT followed by a valid entity pattern
  cleanedXml = cleanedXml.replace(/&(?!(?:amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#[0-9]+);)/g, '&amp;');
  
  console.log('Cleaned XML for parsing (fixed unescaped & characters)');
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanedXml, 'text/xml');
  
  // Check for parsing errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    console.error('XML parsing error:', parserError.textContent);
  }
  
  const xliffElement = doc.getElementsByTagName('xliff')[0];
  const version = xliffElement?.getAttribute('version') || '1.2';
  
  // Get the first file element for metadata
  const fileElement = doc.getElementsByTagName('file')[0];
  const sourceLanguage = fileElement?.getAttribute('source-language') || '';
  const targetLanguage = fileElement?.getAttribute('target-language') || '';
  const original = fileElement?.getAttribute('original') || undefined;
  
  const transUnits: TransUnit[] = [];
  
  // Try different ways to find trans-units
  // 1. Direct trans-unit elements
  let transUnitElements = doc.getElementsByTagName('trans-unit');
  console.log('Found trans-unit elements directly:', transUnitElements.length);
  
  // 2. Also check for different namespaces or within groups
  if (transUnitElements.length === 0) {
    // Try with namespace
    transUnitElements = doc.getElementsByTagNameNS('*', 'trans-unit');
    console.log('Found trans-unit with namespace:', transUnitElements.length);
  }
  
  // 3. Check if trans-units are inside group elements
  const groupElements = doc.getElementsByTagName('group');
  if (groupElements.length > 0) {
    console.log('Found group elements:', groupElements.length);
    // Get trans-units from all groups
    for (let g = 0; g < groupElements.length; g++) {
      const groupTransUnits = groupElements[g].getElementsByTagName('trans-unit');
      console.log(`Group ${g} has ${groupTransUnits.length} trans-units`);
    }
  }
  
  // 4. Check for multiple file elements
  const fileElements = doc.getElementsByTagName('file');
  console.log('Found file elements:', fileElements.length);
  if (fileElements.length > 1) {
    console.log('Multiple file elements detected - processing all');
    // Process trans-units from all file elements
    for (let f = 0; f < fileElements.length; f++) {
      const fileTransUnits = fileElements[f].getElementsByTagName('trans-unit');
      console.log(`File ${f} has ${fileTransUnits.length} trans-units`);
    }
  }
  
  // Process all found trans-units
  for (let i = 0; i < transUnitElements.length; i++) {
    const transUnit = transUnitElements[i];
    const id = transUnit.getAttribute('id') || '';
    
    const sourceElement = transUnit.getElementsByTagName('source')[0];
    const targetElement = transUnit.getElementsByTagName('target')[0];
    const noteElement = transUnit.getElementsByTagName('note')[0];
    
    const source = sourceElement?.textContent || '';
    const target = targetElement?.textContent || '';
    const note = noteElement?.textContent || undefined;
    const state = targetElement?.getAttribute('state') || undefined;
    const approved = transUnit.getAttribute('approved') === 'yes';
    
    // Capture the raw XML of this trans-unit
    const rawXml = transUnit.outerHTML || '';
    
    transUnits.push({
      id,
      source,
      target,
      note,
      state,
      approved,
      rawXml
    });
  }
  
  console.log('Total trans-units parsed:', transUnits.length);
  
  // Also log some sample structure to understand the file
  if (transUnits.length < 1000 && xmlContent.length > 10000) {
    console.log('Warning: Large file but few trans-units found. Sample XML structure:');
    console.log(xmlContent.substring(0, 2000));
  }
  
  return {
    version,
    sourceLanguage,
    targetLanguage,
    original,
    transUnits
  };
};

export const generateXliff = (xliffFile: XliffFile): string => {
  const transUnitsXml = xliffFile.transUnits
    .map(unit => {
      const noteXml = unit.note ? `\n        <note>${unit.note}</note>` : '';
      const stateAttr = unit.state ? ` state="${unit.state}"` : '';
      const approvedAttr = unit.approved ? ' approved="yes"' : '';
      
      return `      <trans-unit id="${unit.id}"${approvedAttr}>
        <source>${escapeXml(unit.source)}</source>
        <target${stateAttr}>${escapeXml(unit.target)}</target>${noteXml}
      </trans-unit>`;
    })
    .join('\n');
  
  const originalAttr = xliffFile.original ? ` original="${xliffFile.original}"` : '';
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="${xliffFile.version}" xmlns="urn:oasis:names:tc:xliff:document:${xliffFile.version}">
  <file source-language="${xliffFile.sourceLanguage}" target-language="${xliffFile.targetLanguage}"${originalAttr}>
    <body>
${transUnitsXml}
    </body>
  </file>
</xliff>`;
};

const escapeXml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};
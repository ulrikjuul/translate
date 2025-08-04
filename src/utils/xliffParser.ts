import type { XliffFile, TransUnit } from '../types/xliff';

// Extract identifier from filename - MUST use the number in parentheses (e.g., (61), (185))
export const extractFileIdentifier = (filename: string): string => {
  // Priority 1: Number in parentheses (e.g., "translation_23925_de-du (61).xlf" → "61")
  const parenNumberMatch = filename.match(/\((\d+)\)/);
  if (parenNumberMatch) {
    return parenNumberMatch[1];
  }
  
  // Priority 2: "latest" in parentheses (case insensitive)
  const parenLatestMatch = filename.match(/\(latest\)/i);
  if (parenLatestMatch) {
    return 'LATEST';
  }
  
  // If no parentheses, check if the filename itself is just a number or "latest"
  const nameWithoutExt = filename.replace(/\.(xlf|xliff)$/i, '');
  
  // Just a number as filename (e.g., "61.xlf")
  if (/^\d+$/.test(nameWithoutExt)) {
    return nameWithoutExt;
  }
  
  // "LATEST" or "latest" as filename
  if (/^latest$/i.test(nameWithoutExt)) {
    return 'LATEST';
  }
  
  // Fallback: use the filename without extension (but this should rarely happen)
  // since we expect files to have (number) format
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
    
    // Get inner XML to preserve tags like <g>, <x/>, etc.
    const getInnerXML = (element: Element | undefined): string => {
      if (!element) return '';
      // Convert child nodes to string, preserving tags
      let xml = '';
      for (let i = 0; i < element.childNodes.length; i++) {
        const node = element.childNodes[i];
        if (node.nodeType === Node.TEXT_NODE) {
          xml += node.textContent || '';
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const serializer = new XMLSerializer();
          let serialized = serializer.serializeToString(node);
          // Remove xmlns attribute that gets added by XMLSerializer
          serialized = serialized.replace(/ xmlns="[^"]*"/g, '');
          xml += serialized;
        }
      }
      return xml;
    };
    
    const source = getInnerXML(sourceElement);
    const sourceText = sourceElement?.textContent || ''; // Plain text for display
    const target = getInnerXML(targetElement);
    const targetText = targetElement?.textContent || ''; // Plain text for display
    const note = noteElement?.textContent || undefined;
    const state = targetElement?.getAttribute('state') || undefined;
    const approved = transUnit.getAttribute('approved') === 'yes';
    
    // Capture the raw XML of this trans-unit
    const rawXml = transUnit.outerHTML || '';
    
    transUnits.push({
      id,
      source,
      sourceText,
      target,
      targetText,
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
  // Filter out trans-units with empty targets to avoid erasing translations
  const transUnitsWithTargets = xliffFile.transUnits.filter(unit => 
    unit.target && unit.target.trim() !== ''
  );
  
  const transUnitsXml = transUnitsWithTargets
    .map(unit => {
      const noteXml = unit.note ? `\n        <note>${unit.note}</note>` : '';
      const stateAttr = unit.state ? ` state="${unit.state}"` : '';
      const approvedAttr = unit.approved ? ' approved="yes"' : '';
      
      // Use the preserved XML version (source/target) which already contains tags
      // No need to escape since we're preserving the original XML structure
      return `      <trans-unit id="${unit.id}"${approvedAttr}>
        <source>${unit.source}</source>
        <target${stateAttr}>${unit.target}</target>${noteXml}
      </trans-unit>`;
    })
    .join('\n');
  
  const originalAttr = xliffFile.original ? ` original="${xliffFile.original}"` : '';
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="${xliffFile.version}" xmlns="urn:oasis:names:tc:xliff:document:${xliffFile.version}">
  <file source-language="${xliffFile.sourceLanguage}" target-language="${xliffFile.targetLanguage}" datatype="plaintext"${originalAttr}>
    <body>
${transUnitsXml}
    </body>
  </file>
</xliff>`;
};

// Removed escapeXml function as we now preserve XML tags directly
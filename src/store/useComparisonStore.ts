import { create } from 'zustand';
import type { XliffFile, ComparisonResult, FileName, SelectionConfig } from '../types/xliff';

export interface AllStringsResult {
  id: string;
  source: string;
  target: string;
  fromFile: FileName;
  fileName?: string;
  note?: string;
  state?: string;
  rawXml?: string;
}

interface ComparisonStore {
  files: Record<FileName, XliffFile | null>;
  rawFiles: Record<FileName, string | null>;
  comparisonResults: ComparisonResult[];
  suspiciousFiles: Set<FileName>;
  nextFileSlot: number;
  
  setFile: (fileNum: number, file: XliffFile, rawContent?: string) => void;
  getFile: (fileNum: number) => XliffFile | null;
  getRawFile: (fileNum: number) => string | null;
  compareFiles: () => void;
  selectVersion: (id: string, version: FileName) => void;
  getMergedFile: () => XliffFile | null;
  getAllStrings: () => AllStringsResult[];
  reset: () => void;
  toggleSuspicious: (fileName: FileName) => void;
  getNextFileSlot: () => number | null;
  addAdditionalFile: (file: XliffFile, rawContent: string) => void;
  exportSelectionConfig: () => SelectionConfig;
  importSelectionConfig: (config: SelectionConfig) => void;
}

const createEmptyState = () => {
  const files: Record<FileName, XliffFile | null> = {} as any;
  const rawFiles: Record<FileName, string | null> = {} as any;
  
  for (let i = 1; i <= 15; i++) {
    const key = `file${i}` as FileName;
    files[key] = null;
    rawFiles[key] = null;
  }
  
  return { files, rawFiles };
};

export const useComparisonStore = create<ComparisonStore>((set, get) => ({
  ...createEmptyState(),
  comparisonResults: [],
  suspiciousFiles: new Set<FileName>(),
  nextFileSlot: 1,
  
  setFile: (fileNum, file, rawContent) => {
    const key = `file${fileNum}` as FileName;
    set(state => ({
      files: { ...state.files, [key]: file },
      rawFiles: { ...state.rawFiles, [key]: rawContent || null }
    }));
    get().compareFiles();
  },
  
  getFile: (fileNum) => {
    const key = `file${fileNum}` as FileName;
    return get().files[key];
  },
  
  getRawFile: (fileNum) => {
    const key = `file${fileNum}` as FileName;
    return get().rawFiles[key];
  },
  
  compareFiles: () => {
    const { files } = get();
    
    // Get all loaded files
    const loadedFiles = Object.entries(files)
      .filter(([_, file]) => file !== null) as [FileName, XliffFile][];
    
    if (loadedFiles.length < 2) return;
    
    const results: ComparisonResult[] = [];
    
    // Process all files to find unique source strings (using plain text for comparison)
    const allSources = new Set<string>();
    loadedFiles.forEach(([_, file]) => {
      file.transUnits.forEach(u => allSources.add(u.sourceText || u.source));
    });
    
    // Compare all unique source strings
    allSources.forEach(source => {
      const result: ComparisonResult = {
        id: '',
        source,
        isDifferent: false,
        inFiles: []
      };
      
      const targets: (string | undefined)[] = [];
      
      // Check each file for this source
      for (let i = 1; i <= 15; i++) {
        const key = `file${i}` as FileName;
        const file = files[key];
        if (file) {
          const unit = file.transUnits.find(u => (u.sourceText || u.source) === source);
          if (unit) {
            // Store the plain text version for display in comparison table
            result[`${key}Target` as keyof ComparisonResult] = (unit.targetText || unit.target) as any;
            result.inFiles.push(key);
            // Use plain text for comparison
            targets.push(unit.targetText || unit.target);
            if (!result.id) result.id = unit.id;
          }
        }
      }
      
      // Check if all targets are the same
      const uniqueTargets = targets.filter(Boolean);
      const allSame = uniqueTargets.length > 1 && 
        uniqueTargets.every(t => t === uniqueTargets[0]);
      
      result.isDifferent = !allSame && uniqueTargets.length > 1;
      
      // Set "only" flags
      if (result.inFiles.length === 1) {
        const onlyFile = result.inFiles[0];
        result[`${onlyFile}Only` as keyof ComparisonResult] = true as any;
      }
      
      // Set default selected version if all are the same
      if (allSame && result.inFiles.length > 0) {
        result.selectedVersion = result.inFiles[0];
      }
      
      results.push(result);
    });
    
    set({ comparisonResults: results });
  },
  
  selectVersion: (id, version) => {
    set(state => ({
      comparisonResults: state.comparisonResults.map(result =>
        result.id === id ? { ...result, selectedVersion: version } : result
      )
    }));
  },
  
  getMergedFile: () => {
    const { files, comparisonResults } = get();
    
    // Find first loaded file for metadata
    const firstFile = Object.values(files).find(f => f !== null);
    if (!firstFile) return null;
    
    // Find the LATEST file if it exists
    const latestFileName = Object.entries(files).find(([_, file]) => 
      file?.fileIdentifier === 'LATEST'
    )?.[0] as FileName | undefined;
    
    const mergedTransUnits = comparisonResults.map(result => {
      let versionToUse = result.selectedVersion;
      
      if (!versionToUse) {
        // If no version selected, try to use LATEST if available
        if (latestFileName && result.inFiles.includes(latestFileName)) {
          versionToUse = latestFileName;
        } else {
          // Otherwise use the last available file (highest number)
          versionToUse = result.inFiles[result.inFiles.length - 1] || result.inFiles[0];
        }
      }
      
      const selectedFile = files[versionToUse];
      // Match based on plain text version for comparison
      const unit = selectedFile?.transUnits.find(u => (u.sourceText || u.source) === result.source);
      
      if (!unit) {
        // Fallback: Need to find the original unit with XML tags preserved
        // First, find a unit from any file to get the source with XML tags
        let sourceWithTags = result.source;
        
        for (const fileName of result.inFiles) {
          const file = files[fileName];
          const originalUnit = file?.transUnits.find(u => (u.sourceText || u.source) === result.source);
          if (originalUnit) {
            sourceWithTags = originalUnit.source; // Get source with XML tags preserved
            break;
          }
        }
        
        // Now get the target from the selected version
        const targetFile = files[versionToUse];
        const targetUnit = targetFile?.transUnits.find(u => (u.sourceText || u.source) === result.source);
        
        if (targetUnit) {
          return {
            id: result.id,
            source: sourceWithTags, // Use source with XML tags
            target: targetUnit.target, // Use target with XML tags from selected version
            sourceText: result.source,
            targetText: targetUnit.targetText || targetUnit.target
          };
        }
        
        // Last resort fallback - plain text only
        const targetKey = `${versionToUse}Target` as keyof ComparisonResult;
        return {
          id: result.id,
          source: sourceWithTags,
          target: (result[targetKey] as string) || ''
        };
      }
      
      return { ...unit };
    });
    
    return {
      ...firstFile,
      transUnits: mergedTransUnits
    };
  },
  
  getAllStrings: () => {
    const { files } = get();
    const allStrings: AllStringsResult[] = [];
    
    // Add all strings from all files
    Object.entries(files).forEach(([key, file]) => {
      if (file) {
        file.transUnits.forEach(unit => {
          allStrings.push({
            id: unit.id,
            source: unit.source,
            target: unit.target,
            fromFile: key as FileName,
            fileName: file.original,
            note: unit.note,
            state: unit.state,
            rawXml: unit.rawXml
          });
        });
      }
    });
    
    return allStrings;
  },
  
  reset: () => {
    set({
      ...createEmptyState(),
      comparisonResults: [],
      suspiciousFiles: new Set<FileName>(),
      nextFileSlot: 1
    });
  },
  
  toggleSuspicious: (fileName) => {
    set(state => {
      const newSuspicious = new Set(state.suspiciousFiles);
      if (newSuspicious.has(fileName)) {
        newSuspicious.delete(fileName);
      } else {
        newSuspicious.add(fileName);
      }
      return { suspiciousFiles: newSuspicious };
    });
  },
  
  getNextFileSlot: () => {
    const { files } = get();
    for (let i = 1; i <= 15; i++) {
      const key = `file${i}` as FileName;
      if (!files[key]) {
        return i;
      }
    }
    return null; // All slots full
  },
  
  addAdditionalFile: (file, rawContent) => {
    const slot = get().getNextFileSlot();
    if (slot) {
      get().setFile(slot, file, rawContent);
      set({ nextFileSlot: slot + 1 });
    }
  },
  
  exportSelectionConfig: () => {
    const { files, comparisonResults } = get();
    
    // Get loaded files info
    const loadedFiles = Object.entries(files)
      .filter(([_, file]) => file !== null)
      .map(([fileName, file]) => ({
        fileName: fileName as FileName,
        originalName: file!.original || '',
        identifier: file!.fileIdentifier || ''
      }));
    
    // Get selections
    const selections = comparisonResults
      .filter(result => result.inFiles.length > 0)
      .map(result => ({
        id: result.id,
        source: result.source,
        selectedVersion: result.selectedVersion
      }));
    
    // Calculate metadata
    const selectedCount = selections.filter(s => s.selectedVersion).length;
    const unselectedCount = selections.filter(s => !s.selectedVersion).length;
    
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      loadedFiles,
      selections,
      metadata: {
        totalStrings: selections.length,
        selectedCount,
        unselectedCount
      }
    };
  },
  
  importSelectionConfig: (config) => {
    const { comparisonResults } = get();
    
    // Apply selections from config
    const updatedResults = comparisonResults.map(result => {
      const selection = config.selections.find(s => 
        s.id === result.id || s.source === result.source
      );
      
      if (selection && selection.selectedVersion) {
        return { ...result, selectedVersion: selection.selectedVersion };
      }
      
      return result;
    });
    
    set({ comparisonResults: updatedResults });
  }
}));

// Helper hooks for backward compatibility and easier access
export const useFile = (fileNum: number) => {
  const store = useComparisonStore();
  return store.getFile(fileNum);
};

export const useRawFile = (fileNum: number) => {
  const store = useComparisonStore();
  return store.getRawFile(fileNum);
};
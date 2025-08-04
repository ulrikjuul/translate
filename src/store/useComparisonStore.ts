import { create } from 'zustand';
import type { XliffFile, ComparisonResult, FileName } from '../types/xliff';

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
}

const createEmptyState = () => {
  const files: Record<FileName, XliffFile | null> = {} as any;
  const rawFiles: Record<FileName, string | null> = {} as any;
  
  for (let i = 1; i <= 10; i++) {
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
    
    // Process all files to find unique source strings
    const allSources = new Set<string>();
    loadedFiles.forEach(([_, file]) => {
      file.transUnits.forEach(u => allSources.add(u.source));
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
      for (let i = 1; i <= 10; i++) {
        const key = `file${i}` as FileName;
        const file = files[key];
        if (file) {
          const unit = file.transUnits.find(u => u.source === source);
          if (unit) {
            result[`${key}Target` as keyof ComparisonResult] = unit.target as any;
            result.inFiles.push(key);
            targets.push(unit.target);
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
    
    const mergedTransUnits = comparisonResults.map(result => {
      if (!result.selectedVersion) {
        // If no version selected, use first available
        result.selectedVersion = result.inFiles[0];
      }
      
      const selectedFile = files[result.selectedVersion];
      const unit = selectedFile?.transUnits.find(u => u.source === result.source);
      
      if (!unit) {
        // Fallback: create unit from comparison result
        const targetKey = `${result.selectedVersion}Target` as keyof ComparisonResult;
        return {
          id: result.id,
          source: result.source,
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
    for (let i = 1; i <= 10; i++) {
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
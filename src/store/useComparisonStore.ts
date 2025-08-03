import { create } from 'zustand';
import type { XliffFile, ComparisonResult } from '../types/xliff';

export interface AllStringsResult {
  id: string;
  source: string;
  target: string;
  fromFile: 'file1' | 'file2' | 'file3' | 'file4';
  fileName?: string;
  note?: string;
  state?: string;
  rawXml?: string;
}

interface ComparisonStore {
  file1: XliffFile | null;
  file2: XliffFile | null;
  file3: XliffFile | null;
  file4: XliffFile | null;
  file1Raw: string | null;
  file2Raw: string | null;
  file3Raw: string | null;
  file4Raw: string | null;
  comparisonResults: ComparisonResult[];
  
  setFile1: (file: XliffFile, rawContent?: string) => void;
  setFile2: (file: XliffFile, rawContent?: string) => void;
  setFile3: (file: XliffFile, rawContent?: string) => void;
  setFile4: (file: XliffFile, rawContent?: string) => void;
  compareFiles: () => void;
  selectVersion: (id: string, version: 'file1' | 'file2' | 'file3' | 'file4') => void;
  getMergedFile: () => XliffFile | null;
  getAllStrings: () => AllStringsResult[];
  reset: () => void;
}

export const useComparisonStore = create<ComparisonStore>((set, get) => ({
  file1: null,
  file2: null,
  file3: null,
  file4: null,
  file1Raw: null,
  file2Raw: null,
  file3Raw: null,
  file4Raw: null,
  comparisonResults: [],
  
  setFile1: (file, rawContent) => {
    set({ file1: file, file1Raw: rawContent || null });
    get().compareFiles();
  },
  
  setFile2: (file, rawContent) => {
    set({ file2: file, file2Raw: rawContent || null });
    get().compareFiles();
  },
  
  setFile3: (file, rawContent) => {
    set({ file3: file, file3Raw: rawContent || null });
    get().compareFiles();
  },
  
  setFile4: (file, rawContent) => {
    set({ file4: file, file4Raw: rawContent || null });
    get().compareFiles();
  },
  
  compareFiles: () => {
    const { file1, file2, file3, file4 } = get();
    if (!file1 || !file2) return;
    
    const results: ComparisonResult[] = [];
    const processedSources = new Set<string>();
    
    // Process all files to find unique source strings
    const allSources = new Set<string>();
    file1.transUnits.forEach(u => allSources.add(u.source));
    file2.transUnits.forEach(u => allSources.add(u.source));
    if (file3) file3.transUnits.forEach(u => allSources.add(u.source));
    if (file4) file4.transUnits.forEach(u => allSources.add(u.source));
    
    // Compare all unique source strings
    allSources.forEach(source => {
      const unit1 = file1.transUnits.find(u => u.source === source);
      const unit2 = file2.transUnits.find(u => u.source === source);
      const unit3 = file3?.transUnits.find(u => u.source === source);
      const unit4 = file4?.transUnits.find(u => u.source === source);
      
      const inFiles: ('file1' | 'file2' | 'file3' | 'file4')[] = [];
      if (unit1) inFiles.push('file1');
      if (unit2) inFiles.push('file2');
      if (unit3) inFiles.push('file3');
      if (unit4) inFiles.push('file4');
      
      const targets = [unit1?.target, unit2?.target, unit3?.target, unit4?.target].filter(Boolean);
      const allSame = targets.length > 1 && targets.every(t => t === targets[0]);
      
      results.push({
        id: unit1?.id || unit2?.id || unit3?.id || unit4?.id || '',
        source,
        file1Target: unit1?.target,
        file2Target: unit2?.target,
        file3Target: unit3?.target,
        file4Target: unit4?.target,
        isDifferent: !allSame && targets.length > 1,
        file1Only: inFiles.length === 1 && inFiles[0] === 'file1',
        file2Only: inFiles.length === 1 && inFiles[0] === 'file2',
        file3Only: inFiles.length === 1 && inFiles[0] === 'file3',
        file4Only: inFiles.length === 1 && inFiles[0] === 'file4',
        inFiles,
        selectedVersion: allSame ? 'file1' : undefined
      });
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
    const { file1, file2, comparisonResults } = get();
    if (!file1 || !file2) return null;
    
    const mergedTransUnits = comparisonResults.map(result => {
      const selectedFile = result.selectedVersion === 'file1' ? file1 : file2;
      // Find unit by source string instead of ID
      const unit = selectedFile.transUnits.find(u => u.source === result.source);
      
      if (!unit) {
        // Fallback: create unit from comparison result
        return {
          id: result.id,
          source: result.source,
          target: result.selectedVersion === 'file1' 
            ? result.file1Target || '' 
            : result.file2Target || ''
        };
      }
      
      return { ...unit };
    });
    
    return {
      ...file1,
      transUnits: mergedTransUnits
    };
  },
  
  getAllStrings: () => {
    const { file1, file2, file3, file4 } = get();
    const allStrings: AllStringsResult[] = [];
    
    // Add all strings from file1
    if (file1) {
      file1.transUnits.forEach(unit => {
        allStrings.push({
          id: unit.id,
          source: unit.source,
          target: unit.target,
          fromFile: 'file1',
          fileName: file1.original,
          note: unit.note,
          state: unit.state,
          rawXml: unit.rawXml
        });
      });
    }
    
    // Add all strings from file2
    if (file2) {
      file2.transUnits.forEach(unit => {
        allStrings.push({
          id: unit.id,
          source: unit.source,
          target: unit.target,
          fromFile: 'file2',
          fileName: file2.original,
          note: unit.note,
          state: unit.state,
          rawXml: unit.rawXml
        });
      });
    }
    
    // Add all strings from file3
    if (file3) {
      file3.transUnits.forEach(unit => {
        allStrings.push({
          id: unit.id,
          source: unit.source,
          target: unit.target,
          fromFile: 'file3',
          fileName: file3.original,
          note: unit.note,
          state: unit.state,
          rawXml: unit.rawXml
        });
      });
    }
    
    // Add all strings from file4
    if (file4) {
      file4.transUnits.forEach(unit => {
        allStrings.push({
          id: unit.id,
          source: unit.source,
          target: unit.target,
          fromFile: 'file4',
          fileName: file4.original,
          note: unit.note,
          state: unit.state,
          rawXml: unit.rawXml
        });
      });
    }
    
    return allStrings;
  },
  
  reset: () => {
    set({
      file1: null,
      file2: null,
      file3: null,
      file4: null,
      file1Raw: null,
      file2Raw: null,
      file3Raw: null,
      file4Raw: null,
      comparisonResults: []
    });
  }
}));
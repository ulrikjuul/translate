export interface TransUnit {
  id: string;
  source: string;  // Source with XML tags preserved
  sourceText?: string;  // Plain text version for display
  target: string;  // Target with XML tags preserved
  targetText?: string;  // Plain text version for display
  note?: string;
  state?: string;
  approved?: boolean;
  rawXml?: string;
}

export interface XliffFile {
  version: string;
  sourceLanguage: string;
  targetLanguage: string;
  original?: string;
  fileIdentifier?: string;
  transUnits: TransUnit[];
}

export type FileNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
export type FileName = `file${FileNumber}`;

export interface ComparisonResult {
  id: string;
  source: string;
  file1Target?: string;
  file2Target?: string;
  file3Target?: string;
  file4Target?: string;
  file5Target?: string;
  file6Target?: string;
  file7Target?: string;
  file8Target?: string;
  file9Target?: string;
  file10Target?: string;
  file11Target?: string;
  file12Target?: string;
  file13Target?: string;
  file14Target?: string;
  file15Target?: string;
  isDifferent: boolean;
  file1Only?: boolean;
  file2Only?: boolean;
  file3Only?: boolean;
  file4Only?: boolean;
  file5Only?: boolean;
  file6Only?: boolean;
  file7Only?: boolean;
  file8Only?: boolean;
  file9Only?: boolean;
  file10Only?: boolean;
  file11Only?: boolean;
  file12Only?: boolean;
  file13Only?: boolean;
  file14Only?: boolean;
  file15Only?: boolean;
  inFiles: FileName[];
  selectedVersion?: FileName;
}

export interface SelectionConfig {
  version: string; // Version of the config format
  timestamp: string;
  loadedFiles: {
    fileName: FileName;
    originalName: string;
    identifier: string;
  }[];
  selections: {
    id: string;
    source: string;
    selectedVersion?: FileName;
  }[];
  metadata?: {
    totalStrings: number;
    selectedCount: number;
    unselectedCount: number;
  };
}
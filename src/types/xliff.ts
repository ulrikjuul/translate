export interface TransUnit {
  id: string;
  source: string;
  target: string;
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

export interface ComparisonResult {
  id: string;
  source: string;
  file1Target?: string;
  file2Target?: string;
  file3Target?: string;
  file4Target?: string;
  isDifferent: boolean;
  file1Only?: boolean;
  file2Only?: boolean;
  file3Only?: boolean;
  file4Only?: boolean;
  inFiles: ('file1' | 'file2' | 'file3' | 'file4')[];
  selectedVersion?: 'file1' | 'file2' | 'file3' | 'file4';
}
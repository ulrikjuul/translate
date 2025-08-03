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

export type FileNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
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
  inFiles: FileName[];
  selectedVersion?: FileName;
}
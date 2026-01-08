export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
}

export type FileFormat = 'csv' | 'tsv' | 'parquet' | 'xlsx' | 'xls' | 'json';

export interface LoadedFile {
  name: string;
  tableName: string;
  format: FileFormat;
  columns: ColumnInfo[];
  rowCount: number;
}

export interface ExportOptions {
  format: FileFormat;
  filename: string;
}

// Persistence types
export interface PersistedFile {
  id: string;
  name: string;
  format: FileFormat;
  content: string;  // Base64 encoded for binary, raw for text
  lastUsed: number;
  size: number;
}

export interface PersistedFileMetadata {
  id: string;
  name: string;
  format: FileFormat;
  size: number;
  lastUsed: number;
}

// Join types
export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL OUTER';

export interface JoinCondition {
  leftColumn: string;
  rightColumn: string;
  operator: '=' | '<' | '>' | '<=' | '>=' | '!=';
}

export interface SelectedColumn {
  table: 'left' | 'right';
  column: string;
  alias?: string;
}

export interface JoinConfig {
  leftTable: LoadedFile;
  rightTable: LoadedFile;
  joinType: JoinType;
  joinConditions: JoinCondition[];
  selectedColumns: SelectedColumn[];
}
